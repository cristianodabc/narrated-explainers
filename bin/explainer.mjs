#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildVideo} from '../src/build.mjs';
import {draftStory, readEnv, scriptPrompt} from '../src/llm.mjs';
import {validateStory} from '../src/story.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const models=[
  ['kokoro-v1.0.fp16.onnx','f3a290d384fbb27966d462905c71a46cef9e5fd00516b40df32a0b4afe77ac96'],
  ['voices-v1.0.bin','bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d']
];
function option(name) { const i=process.argv.indexOf(name); return i<0 ? undefined : process.argv[i+1]; }
function required(name) { const value=option(name); if (!value || value.startsWith('--')) throw new Error(`Missing ${name}`); return value; }
function run(bin,args) { const result=spawnSync(bin,args,{stdio:'inherit'}); if (result.error) throw result.error; if (result.status!==0) throw new Error(`${bin} exited ${result.status}`); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
async function downloadModel(name,sha) {
  const file=path.join(root,'models',name);
  if (fs.existsSync(file) && hash(file)===sha) { console.log(`${name}: ready`); return; }
  const url=`https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/${name}`;
  console.log(`Downloading ${name}…`);
  const response=await fetch(url,{signal:AbortSignal.timeout(300000)});
  if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`);
  const temporary=`${file}.download`;
  try {
    await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(temporary));
    if (hash(temporary)!==sha) throw new Error(`${name} checksum mismatch`);
    fs.renameSync(temporary,file);
  } finally { fs.rmSync(temporary,{force:true}); }
}
async function setup() {
  for (const bin of ['uv','ffmpeg','ffprobe','rsvg-convert']) {
    const result=spawnSync(bin,[['uv','rsvg-convert'].includes(bin) ? '--version' : '-version'],{stdio:'ignore'});
    if (result.error || result.status!==0) throw new Error(`Missing ${bin}. Install it, then rerun setup.`);
  }
  if (!fs.existsSync(path.join(root,'.venv','bin','python'))) run('uv',['venv','--python','3.11',path.join(root,'.venv')]);
  run('uv',['pip','install','--python',path.join(root,'.venv','bin','python'),'kokoro-onnx==0.6.1']);
  fs.mkdirSync(path.join(root,'models'),{recursive:true});
  for (const [name,sha] of models) await downloadModel(name,sha);
  console.log('Setup complete. Copy .env.example to .env and set your LLM details.');
}
function brief() { const file=option('--brief'); return file ? fs.readFileSync(file,'utf8') : ''; }
async function draft() {
  const topic=required('--topic');
  const env={...readEnv(path.join(root,'.env')),...process.env};
  const story=await draftStory({topic,brief:brief(),env});
  const file=path.join(root,'videos',story.slug,'story.json');
  if (fs.existsSync(file) && !process.argv.includes('--replace')) throw new Error(`${file} exists. Use --replace to overwrite.`);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(story,null,2)+'\n');
  console.log(`Saved script: ${file}`);
  return story;
}
function help() { console.log(`Narrated Explainers

Setup: npm run setup
One step: npm run make -- --topic "Your subject"
Review first: npm run draft -- --topic "Your subject"
              npm run render -- --story videos/your-subject/story.json
Other LLM: npm run prompt -- --topic "Your subject"
           Save the JSON response, then npm run render -- --story story.json

Options: --brief FILE adds context to draft/prompt; --replace overwrites an existing output.
Output: videos/<slug>.mp4`); }

try {
  const command=process.argv[2];
  if (!command || ['help','--help','-h'].includes(command)) help();
  else if (command==='setup') await setup();
  else if (command==='prompt') console.log(scriptPrompt(required('--topic'),brief()));
  else if (command==='draft') await draft();
  else if (command==='make') await buildVideo(root,await draft(),{replace:process.argv.includes('--replace')});
  else if (command==='render') {
    const story=validateStory(JSON.parse(fs.readFileSync(required('--story'),'utf8')));
    await buildVideo(root,story,{replace:process.argv.includes('--replace')});
  } else throw new Error(`Unknown command: ${command}`);
} catch (error) { console.error(error.message); process.exitCode=1; }
