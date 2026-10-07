import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli = fileURLToPath(new URL('../bin/explainer.mjs', import.meta.url));

test('prompt command prints a usable storyboard request', () => {
  const result = spawnSync(process.execPath, [cli, 'prompt', '--topic', 'Heat pumps'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Heat pumps/);
  assert.match(result.stdout, /Start by naming and defining/);
  assert.match(result.stdout, /first scene must be intro/);
});

test('prompt command reports a missing topic', () => {
  const result = spawnSync(process.execPath, [cli, 'prompt'], {encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing --topic/);
});
