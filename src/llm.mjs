import fs from 'node:fs';
import {parseStoryResponse, visualTypes} from './story.mjs';

export function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || line.trimStart().startsWith('#')) return [];
    const value = match[2].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, a, b) => a ?? b);
    return [[match[1], value]];
  }));
}

export function scriptPrompt(topic, brief = '') {
  if (!topic || topic.length > 200) throw new Error('Provide a topic of at most 200 characters');
  if (brief.length > 12000) throw new Error('Brief must be at most 12,000 characters');
  return `Write a documentary-style spoken explainer about: ${topic}\n${brief ? `\nContext and source notes:\n${brief}\n` : ''}
Return ONLY a JSON object with this shape:
{"schemaVersion":1,"slug":"short-lowercase-slug","title":"Video title","scenes":[{"title":"Short scene title","narration":"Spoken English narration.","caption":"Short takeaway","visual":{"type":"intro","labels":["label one","label two","label three"]}}]}

Rules:
- Use 5 to 8 scenes. Each narration should be 45 to 90 words, written for a warm, natural human voice. Use contractions and varied sentence length. Explain terms before using them.
- Start by naming and defining the subject or framework, what problem it addresses, and the promise of the story. Do not open with an unexplained example.
- Carry one concrete example through the middle scenes. Explain mechanism and tradeoffs accurately. Mark uncertainty rather than inventing facts.
- End with a useful synthesis, not an advertisement or generic call to action.
- Use visual types from ${visualTypes.join(', ')}. The first scene must be intro; the last must be summary. Each visual must have exactly three labels. Choose flow for sequences, cards for comparisons, focus for a center and related ideas.
- All titles, captions, and labels must be brief and readable on a screen. Titles <=50 characters, captions <=80, labels <=30. Narration is the only long-form text.
- Use a slug with lowercase letters, numbers, and hyphens. Plain JSON, no Markdown or code fences.`;
}

export async function draftStory({topic, brief, env, fetchImpl = fetch}) {
  const base = env.EXPLAINER_LLM_BASE_URL;
  const model = env.EXPLAINER_LLM_MODEL;
  const key = env.EXPLAINER_LLM_API_KEY;
  if (!base || !model || !key) throw new Error('Set EXPLAINER_LLM_BASE_URL, EXPLAINER_LLM_MODEL, and EXPLAINER_LLM_API_KEY in .env');
  let url;
  try { url = new URL(`${base.replace(/\/$/, '')}/chat/completions`); } catch { throw new Error('Invalid EXPLAINER_LLM_BASE_URL'); }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('LLM endpoint must use HTTPS, except for localhost');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {'content-type': 'application/json', authorization: `Bearer ${key}`},
    body: JSON.stringify({model, temperature: 0.6, messages: [
      {role: 'system', content: 'You are a careful documentary writer and visual storyboard editor. Output valid JSON only.'},
      {role: 'user', content: scriptPrompt(topic, brief)}
    ]}),
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error(`LLM request failed with HTTP ${response.status}`);
  const data = await response.json();
  return parseStoryResponse(data?.choices?.[0]?.message?.content);
}
