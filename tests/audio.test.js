import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio.js';
import { VOICES, NOTES } from '../src/config.js';

// Deterministic API contract double. Real sound and layout are checked in a browser.
class Param {
  constructor() { this.value = 0; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push({ kind: 'set', value, time }); }
  linearRampToValueAtTime(value, time) { this.events.push({ kind: 'linear', value, time }); }
  exponentialRampToValueAtTime(value, time) { assert(value > 0); this.events.push({ kind: 'exp', value, time }); }
  setTargetAtTime(value) { this.value = value; }
  cancelScheduledValues(time) { this.events = this.events.filter(event => event.time < time); }
  cancelAndHoldAtTime() {}
}
class Node {
  constructor(context) {
    this.context = context; this.connections = [];
    for (const name of ['gain', 'frequency', 'detune', 'pan', 'Q', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[name] = new Param();
  }
  connect(node) { assert(node); this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; this.connections = []; }
  start(time) { this.started = time; this.context.sources.add(this); }
  stop(time) { this.end = time; }
}
class Context {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.sources = new Set(); this.destination = new Node(this); }
  resume() { return Promise.resolve(); }
  createGain() { return new Node(this); }
  createOscillator() { return new Node(this); }
  createBiquadFilter() { return new Node(this); }
  createStereoPanner() { return new Node(this); }
  createDynamicsCompressor() { return new Node(this); }
  createDelay() { return new Node(this); }
  createConvolver() { return new Node(this); }
  createBuffer(channels, length) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { getChannelData: i => data[i] }; }
  advance(time) { this.currentTime = time; for (const source of [...this.sources]) if (source.end <= time) { this.sources.delete(source); source.onended?.(); } }
}
const setup = () => { const context = new Context(); return { context, engine: new AudioEngine(() => context) }; };

test('flute retains its oscillator, pitch, half-second attack and vibrato', () => {
  const { engine } = setup(); const note = engine.start('q', 'flute', 0);
  assert.equal(note.tones.length, 1); assert.equal(note.tones[0].source.type, 'triangle');
  assert.equal(note.tones[0].source.frequency.value, NOTES[0] * 4);
  assert.equal(note.sources[1].frequency.value, 5.5);
  assert.deepEqual(note.amp.gain.events[1], { kind: 'linear', value: .3, time: .5 });
  assert.equal(engine.start('q', 'flute', 0), note);
});
test('five simultaneous channels, monophonic bass and pitched sub-bass', () => {
  const { engine, context } = setup(); for (const voice of Object.keys(VOICES)) engine.start(voice, voice, 0);
  assert.equal(engine.active.size, 5); const old = engine.active.get('bass');
  engine.start('new', 'bass', 3); assert.equal(engine.active.size, 5); assert(old.released);
  engine.move('new', 5); assert.equal(engine.active.get('new').tones[2].source.frequency.value, NOTES[5]);
  context.advance(.2); assert(old.nodes.every(node => node.disconnected));
});
test('volume before initialization persists and channels remain independent', () => {
  const { engine } = setup(); engine.setVolume('bass', .25); engine.ensure();
  assert.equal(engine.channels.get('bass').gain.value, .25); assert.equal(engine.channels.get('flute').gain.value, 1);
  engine.setVolume('bass', 0); assert.equal(engine.channels.get('bass').gain.value, 0);
});
test('old releases cannot dispose a newer voice with the same id', () => {
  const { engine, context } = setup(); const old = engine.start('z', 'viola', 0); engine.stop('z');
  const next = engine.start('z', 'viola', 2); context.advance(1.2);
  assert.equal(engine.active.get('z'), next); assert(!engine.live.has(old));
  engine.stopAll(); context.advance(3); assert.equal(engine.live.size, 0); assert.equal(context.sources.size, 0);
});
test('polyphony cap and panic disconnect all oscillators, vibrato and release tails', () => {
  const { engine, context } = setup(); for (let i = 0; i < 20; i++) engine.start(`n${i}`, 'choir', i % NOTES.length);
  assert.equal(engine.active.size, 4); engine.stopAll(); context.advance(3);
  assert.equal(engine.active.size, 0); assert.equal(engine.live.size, 0); assert.equal(context.sources.size, 0);
});
test('fallback release during attack does not jump to full volume', () => {
  const { engine, context } = setup(); const note = engine.start('q', 'flute', 0);
  note.amp.gain.cancelAndHoldAtTime = undefined; context.advance(.1); engine.stop('q');
  const held = note.amp.gain.events.find(event => event.kind === 'linear' && event.time === .1);
  assert(Math.abs(held.value - .06) < 1e-10);
});

test('immediate key-up reaches exact silence without an exponential ramp from zero', () => {
  const { engine } = setup(); const note = engine.start('q', 'flute', 0);
  engine.stop('q');
  assert.deepEqual(note.amp.gain.events.at(-1), { kind: 'linear', value: 0, time: 1.5 });
});
test('panic during a release continues from the fading level in Safari', () => {
  const { engine, context } = setup(); const note = engine.start('q', 'flute', 0);
  note.amp.gain.cancelAndHoldAtTime = undefined;
  context.advance(.5); engine.stop('q'); context.advance(1.25); engine.stopAll();
  const held = note.amp.gain.events.find(e => e.time === 1.25);
  assert.equal(held.kind, 'linear'); assert(Math.abs(held.value - .15) < 1e-10);
  context.advance(2); assert.equal(engine.live.size, 0);
});
