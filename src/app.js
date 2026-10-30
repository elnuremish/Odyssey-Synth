// ИИ: Codex написал управление инструментом и собрал модули. README, запись №7.
import { NOTES, KEY_BINDINGS, findBinding } from './config.js';
import { AudioEngine } from './audio.js';
import { Voyage } from './score.js';
import { Traveler } from './traveler.js';
import { InstrumentView } from './view.js';

const engine = new AudioEngine();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const traveler = new Traveler(document.querySelector('#traveler'), reducedMotion);
const motifButton = document.querySelector('#motif');
const mixer = document.querySelector('#mixer');
const pressed = new Map(), pointers = new Map();
let serial = 0, previousFrame = performance.now(), animationId;

const view = new InstrumentView(audition, (voice, value) => engine.setVolume(voice, value), reducedMotion);
const voyage = new Voyage((event, when) => {
  play(`voyage:${++serial}`, 'bass', event.index, { when, intensity: event.intensity, duration: event.duration, accompaniment: true });
}, (label, playing) => {
  motifButton.textContent = label;
  motifButton.setAttribute('aria-pressed', String(playing));
  motifButton.classList.toggle('on', playing);
});
engine.onStop = note => {
  view.hide(note);
  if (note.voice === 'bass' && !voyage.playing && ![...engine.active.values()].some(item => item.voice === 'bass')) view.setRoot(null);
};

function play(id, voice, index, options = {}) {
  if (voice === 'bass' && !options.accompaniment && voyage.playing) stopVoyage(false);
  const note = engine.start(id, voice, index, options);
  if (options.duration) note.releaseAt = note.when + options.duration;
  const bindingId = KEY_BINDINGS.find(binding => binding.voice === voice && binding.index === index)?.id;
  view.show(note, bindingId);
  if (voice === 'bass') view.setRoot(index);
  traveler.react(performance.now());
  return note;
}

function audition(voice, index) {
  play(`audition:${++serial}`, voice, index, { duration: voice === 'choir' ? 1.4 : .48 });
}

function stopVoyage(resolve = true) {
  voyage.stop();
  for (const id of engine.active.keys()) if (id.startsWith('voyage:')) engine.stop(id);
  if (resolve && engine.context) play(`voyage:${++serial}`, 'bass', 0, { duration: .9, intensity: .7, accompaniment: true });
}

function toggleVoyage() {
  if (voyage.playing) stopVoyage();
  else {
    engine.ensure();
    for (const note of engine.active.values()) if (note.voice === 'bass') engine.stop(note.id);
    voyage.start(engine.time);
  }
}

function stopEverything() {
  stopVoyage(false);
  engine.stopAll();
  pressed.clear();
  pointers.clear();
  view.setRoot(null);
}

function fieldIndex(x) { return Math.max(0, Math.min(NOTES.length - 1, Math.floor(x / innerWidth * NOTES.length))); }
function isControl(target) { return Boolean(target.closest('button, details, input, a')); }

motifButton.addEventListener('click', toggleVoyage);
document.querySelector('#traveler').addEventListener('click', () => {
  traveler.change();
  // Use a managed voice so Escape and blur also stop the character's reply.
  play(`traveler:${++serial}`, 'vocal', view.root ?? 0, { duration: .22, intensity: .22 });
});

document.addEventListener('pointerdown', event => {
  const key = event.target.closest('.key');
  if (!key && isControl(event.target)) return;
  if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
  if (pointers.has(event.pointerId)) return;
  event.preventDefault();
  const binding = key ? KEY_BINDINGS.find(item => item.id === key.dataset.binding) : null;
  const voice = binding?.voice ?? (event.button === 2 ? 'flute' : 'bass');
  const index = binding?.index ?? fieldIndex(event.clientX);
  const id = `pointer:${event.pointerId}`;
  pointers.set(event.pointerId, { id, voice, index, field: !binding });
  document.body.setPointerCapture(event.pointerId);
  play(id, voice, index);
  engine.setBrightness(1 - event.clientY / innerHeight);
});

document.addEventListener('pointermove', event => {
  if (event.target.closest('#mixer')) return;
  const pointer = pointers.get(event.pointerId);
  if (pointer?.field) {
    const index = fieldIndex(event.clientX);
    if (index !== pointer.index) {
      pointer.index = index;
      engine.move(pointer.id, index);
      const note = engine.active.get(pointer.id);
      if (note) view.position(note);
      if (pointer.voice === 'bass') view.setRoot(index);
    }
  }
  if (engine.active.size) engine.setBrightness(1 - event.clientY / innerHeight);
});

function releasePointer(event) {
  const pointer = pointers.get(event.pointerId);
  if (!pointer) return;
  pointers.delete(event.pointerId);
  engine.stop(pointer.id);
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(type, releasePointer);
document.addEventListener('contextmenu', event => { if (!isControl(event.target)) event.preventDefault(); });
document.addEventListener('click', event => { if (!event.target.closest('#mixer')) mixer.open = false; });

document.addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    mixer.open = false;
    stopEverything();
    return;
  }
  if (event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input, textarea, select')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) toggleVoyage();
    return;
  }
  const binding = findBinding(event.code, event.shiftKey);
  if (!binding || pressed.has(event.code) || event.repeat) return;
  event.preventDefault();
  const id = `key:${event.code}`;
  // Store by physical code: releasing Shift before a choir key cannot stick it.
  pressed.set(event.code, id);
  play(id, binding.voice, binding.index);
});
document.addEventListener('keyup', event => {
  const id = pressed.get(event.code);
  if (!id) return;
  pressed.delete(event.code);
  engine.stop(id);
});

function frame(now) {
  const delta = Math.min((now - previousFrame) / 1000, .05);
  previousFrame = now;
  voyage.update(engine.time);
  for (const note of engine.active.values()) {
    if (note.releaseAt !== undefined && note.releaseAt <= engine.time + .035) engine.stop(note.id, { when: note.releaseAt });
  }
  traveler.update(now, delta);
  animationId = requestAnimationFrame(frame);
}
animationId = requestAnimationFrame(frame);
window.addEventListener('resize', () => { traveler.resize(); view.resize(); });
window.addEventListener('blur', stopEverything);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopEverything();
    cancelAnimationFrame(animationId);
  } else {
    previousFrame = performance.now();
    animationId = requestAnimationFrame(frame);
  }
});
