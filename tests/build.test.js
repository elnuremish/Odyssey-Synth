import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { CHARACTERS } from '../src/characters.js';

test('standalone HTML has valid JavaScript, ten sprites and no external dependencies', () => {
  execFileSync(process.execPath, ['scripts/build.mjs']);
  const html = readFileSync('dist/Odyssey.html', 'utf8');
  assert(!html.includes('src="src/')); assert(!html.includes('href="src/')); assert(html.includes('data:image/png;base64,'));
  const script = html.match(/<script>([\s\S]+)<\/script>/)[1]; new Script(script); assert(!/^import /m.test(script));
  assert.equal(CHARACTERS.length, 10); const png = readFileSync('assets/characters.png');
  assert.equal(png.readUInt32BE(16), 1920); assert.equal(png.readUInt32BE(20), 1536);
});
