import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreStep, Voyage, DURATION } from '../src/score.js';
import { NOTES, KEY_BINDINGS, findBinding } from '../src/config.js';

test('six chapter densities, 150 notes, exactly 180 seconds', () => {
  const counts = Array.from({ length: 6 }, (_, chapter) => Array.from({ length: 80 }, (_, step) => scoreStep(chapter * 80 + step)).filter(Boolean).length);
  assert.deepEqual(counts, [5, 20, 30, 60, 20, 15]);
  const played = [], labels = []; const voyage = new Voyage((event, when) => played.push({ ...event, when }), label => labels.push(label));
  voyage.start(0); for (let tick = 0; tick < 9100; tick++) voyage.update(tick * .02);
  assert.equal(played.length, 150); assert(played.every(note => note.index < NOTES.length && note.when < DURATION));
  assert.equal(voyage.playing, false); assert.equal(labels.at(-1), '▷ Путь домой');
});
test('stall drops missed notes; stop prevents future playback', () => {
  const played = []; const voyage = new Voyage(event => played.push(event), () => {});
  voyage.start(0); voyage.update(105); assert(played.length <= 1); voyage.stop(); voyage.update(120); assert(played.length <= 1);
});
test('54 physical bindings are unique and independent of keyboard language', () => {
  assert.equal(KEY_BINDINGS.length, 54); assert.equal(new Set(KEY_BINDINGS.map(key => `${key.code}:${key.shift}`)).size, 54);
  assert.equal(findBinding('KeyZ', true).voice, 'choir'); assert.equal(findBinding('KeyZ', false).voice, 'viola');
  assert.equal(findBinding('KeyQ', true).voice, 'flute'); assert.equal(findBinding('Digit1', false).voice, 'vocal');
  assert.equal(scoreStep(-1), null); assert.equal(scoreStep(480), null);
});
