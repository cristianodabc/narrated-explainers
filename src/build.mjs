import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {renderSvg} from './art.mjs';
import {validateStory} from './story.mjs';

const fps = 24;
function command(bin, args, options = {}) {
  const result = spawnSync(bin, args, {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${bin} failed: ${(result.stderr || result.stdout || '').trim().slice(-2500)}`);
  return result.stdout;
}
function renderFrame(svg, destination) {
  return new Promise((resolve, reject) => {
    const child = spawn('rsvg-convert', ['-o', destination], {stdio: ['pipe', 'ignore', 'pipe']});
    let error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(error || `rsvg-convert exited ${code}`)));
    child.stdin.on('error', reject);
    child.stdin.end(svg);
  });
}

export async function buildVideo(root, storyInput, {replace = false} = {}) {
  const story = validateStory(storyInput);
  const workspace = path.join(root, 'videos', story.slug);
  const output = path.join(root, 'videos', `${story.slug}.mp4`);
  if (fs.existsSync(output) && !replace) throw new Error(`${output} exists. Use --replace to rebuild it.`);
  for (const bin of ['ffmpeg', 'ffprobe', 'rsvg-convert']) command(bin, [bin === 'rsvg-convert' ? '--version' : '-version']);
  const python = path.join(root, '.venv', 'bin', 'python');
  const model = path.join(root, 'models', 'kokoro-v1.0.fp16.onnx');
  const voices = path.join(root, 'models', 'voices-v1.0.bin');
  for (const file of [python, model, voices]) if (!fs.existsSync(file)) throw new Error(`Missing ${file}; run npm run setup`);
  fs.mkdirSync(workspace, {recursive: true});
  const storyFile = path.join(workspace, 'story.json');
  const audioDir = path.join(workspace, 'audio');
  const framesDir = path.join(workspace, 'frames');
  fs.writeFileSync(storyFile, JSON.stringify(story, null, 2) + '\n');
  fs.mkdirSync(audioDir, {recursive: true});
  fs.rmSync(framesDir, {recursive: true, force: true});
  fs.mkdirSync(framesDir);
  console.log('Generating narration…');
  command(python, [path.join(root, 'scripts', 'narrate.py'), '--story', storyFile, '--audio-dir', audioDir, '--model', model, '--voices', voices], {stdio: 'inherit'});
  const manifest = story.scenes.map((scene, i) => {
    const audio = path.join(audioDir, `scene-${String(i + 1).padStart(2, '0')}.wav`);
    const speech = Number(command('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',audio]).trim());
    if (!Number.isFinite(speech) || speech <= 0) throw new Error(`Invalid narration length for scene ${i+1}`);
    const count = Math.ceil((speech + 1.4) * fps);
    return {...scene, audio, speech, count, duration: count / fps};
  });
  fs.writeFileSync(path.join(workspace,'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const jobs = [];
  let number = 0;
  for (const [index, scene] of manifest.entries()) {
    for (let frame = 0; frame < scene.count; frame++) {
      jobs.push({svg: renderSvg(story,scene,index,frame/fps,scene.duration), file: path.join(framesDir,`${String(number++).padStart(6,'0')}.png`)});
    }
  }
  console.log(`Rendering ${jobs.length} frames (${(jobs.length/fps).toFixed(1)} seconds)…`);
  let cursor=0, done=0;
  await Promise.all(Array.from({length: 6}, async () => {
    while (cursor < jobs.length) {
      const job=jobs[cursor++];
      await renderFrame(job.svg,job.file);
      done++;
      if (done % 240 === 0 || done === jobs.length) console.log(`${done}/${jobs.length} frames`);
    }
  }));
  const posterScene=manifest[0];
  await renderFrame(renderSvg(story,posterScene,0,Math.max(0,posterScene.duration-0.5),posterScene.duration),path.join(workspace,'poster.png'));
  const filters=manifest.map((scene,i)=>`[${i+1}:a]apad,atrim=duration=${scene.duration},asetpts=PTS-STARTPTS[a${i}]`);
  filters.push(`${manifest.map((_,i)=>`[a${i}]`).join('')}concat=n=${manifest.length}:v=0:a=1[joined]`);
  filters.push('[joined]loudnorm=I=-16:TP=-1.5:LRA=11[out]');
  const temporary=path.join(workspace,'rendering.mp4');
  console.log('Encoding MP4…');
  command('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i',path.join(framesDir,'%06d.png'),...manifest.flatMap(scene=>['-i',scene.audio]),'-filter_complex',filters.join(';'),'-map','0:v:0','-map','[out]','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',temporary]);
  fs.renameSync(temporary,output);
  fs.rmSync(framesDir,{recursive:true,force:true});
  console.log(`Saved ${output}`);
  return output;
}
