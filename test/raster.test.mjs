import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {renderSvg} from '../src/art.mjs';
import {validateStory} from '../src/story.mjs';

const sample = validateStory(JSON.parse(fs.readFileSync(new URL('../examples/sample.story.json', import.meta.url), 'utf8')));

test('every sample layout rasterizes to a full HD PNG', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainer-raster-'));
  try {
    for (const [index, scene] of sample.scenes.entries()) {
      const output = path.join(dir, `${index}.png`);
      const svg = renderSvg(sample, scene, index, 8, 10);
      const result = spawnSync('rsvg-convert', ['-o', output], {input: svg, encoding: 'utf8'});
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      const png = fs.readFileSync(output);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(png.readUInt32BE(16), 1920);
      assert.equal(png.readUInt32BE(20), 1080);
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
