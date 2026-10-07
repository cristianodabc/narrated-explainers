const TYPES = {intro: 3, flow: 3, cards: 3, focus: 3, summary: 3};
export const visualTypes = Object.keys(TYPES);

function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function string(value, name, max, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u001f]/.test(value)) {
    throw new Error(`${name} must be ${min}–${max} printable characters`);
  }
  return value.trim();
}

export function validateStory(input) {
  if (!object(input)) throw new Error('Story must be a JSON object');
  if (input.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  const slug = string(input.slug, 'slug', 48);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('slug must use lowercase letters, numbers, and hyphens');
  const title = string(input.title, 'title', 72);
  if (!Array.isArray(input.scenes) || input.scenes.length < 5 || input.scenes.length > 10) {
    throw new Error('scenes must contain 5–10 scenes');
  }
  const scenes = input.scenes.map((scene, index) => {
    const name = `scenes[${index}]`;
    if (!object(scene) || !object(scene.visual)) throw new Error(`${name} and its visual must be objects`);
    const type = scene.visual.type;
    if (!(type in TYPES)) throw new Error(`${name}.visual.type must be one of ${visualTypes.join(', ')}`);
    if (!Array.isArray(scene.visual.labels) || scene.visual.labels.length !== TYPES[type]) {
      throw new Error(`${name}.visual.labels must contain exactly ${TYPES[type]} labels`);
    }
    return {
      title: string(scene.title, `${name}.title`, 50),
      narration: string(scene.narration, `${name}.narration`, 1200, 40),
      caption: string(scene.caption, `${name}.caption`, 80),
      visual: {type, labels: scene.visual.labels.map((label, i) => string(label, `${name}.visual.labels[${i}]`, 30))}
    };
  });
  if (scenes[0].visual.type !== 'intro') throw new Error('The first scene must use the intro visual');
  if (scenes.at(-1).visual.type !== 'summary') throw new Error('The last scene must use the summary visual');
  return {schemaVersion: 1, slug, title, scenes};
}

export function parseStoryResponse(content) {
  if (typeof content !== 'string') throw new Error('LLM response did not contain text');
  const trimmed = content.trim();
  const json = trimmed.startsWith('```') ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : trimmed;
  let parsed;
  try { parsed = JSON.parse(json); } catch { throw new Error('LLM did not return valid JSON. Save and edit its response, then use render --story.'); }
  return validateStory(parsed);
}
