import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateStory,parseStoryResponse} from '../src/story.mjs';
import {renderSvg} from '../src/art.mjs';
import {draftStory} from '../src/llm.mjs';

const sample=JSON.parse(fs.readFileSync(new URL('../examples/sample.story.json',import.meta.url),'utf8'));
test('sample story validates and produces a complete scene',()=>{
  const story=validateStory(sample);
  const svg=renderSvg(story,story.scenes[0],0,7,12);
  assert.match(svg,/width="1920" height="1080"/);
  assert.match(svg,/Request/);
  assert.match(svg,/Remember progress/);
});
test('untrusted visual labels are escaped in SVG',()=>{
  const story=structuredClone(sample);
  story.scenes[1].visual.labels[0]='<script>alert(1)</script>';
  const svg=renderSvg(validateStory(story),story.scenes[1],1,7,12);
  assert.doesNotMatch(svg,/<script>/);
  assert.match(svg,/&lt;script&gt;/);
});
test('rejects missing introduction and malformed scenes',()=>{
  const story=structuredClone(sample);
  story.scenes[0].visual.type='flow';
  assert.throws(()=>validateStory(story),/first scene/);
  story.scenes[0].visual.type='intro';
  story.scenes[2].visual.labels.pop();
  assert.throws(()=>validateStory(story),/exactly 3/);
});
test('accepts fenced JSON and an OpenAI compatible response',async()=>{
  const response=await draftStory({topic:'A durable workflow',brief:'',env:{EXPLAINER_LLM_BASE_URL:'https://example.com/v1',EXPLAINER_LLM_MODEL:'test',EXPLAINER_LLM_API_KEY:'secret'},fetchImpl:async (url,options)=>{
    assert.equal(url.href,'https://example.com/v1/chat/completions');
    assert.match(options.body,/Start by naming and defining/);
    return {ok:true,json:async()=>({choices:[{message:{content:`\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``}}]})};
  }});
  assert.equal(response.slug,sample.slug);
  assert.throws(()=>parseStoryResponse('{broken'),/valid JSON/);
});
