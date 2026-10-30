// ИИ: Codex подготовил клавиатуру, микшер и визуальную обратную связь. README, запись №7.
import { NOTES, VOICES, KEY_BINDINGS, noteName, consonant } from './config.js';

export class InstrumentView {
  constructor(onAudition, onVolume, reducedMotion) {
    this.keys = new Map();
    this.pitches = new Map();
    this.lights = new Map();
    this.notes = new Map();
    this.activeCounts = new Map();
    this.lightContainer = document.querySelector('#lights');
    this.root = null;
    this.reducedMotion = reducedMotion;
    const keyboard = document.querySelector('#keyboard');
    const mixer = document.querySelector('.mixer-panel');

    for (const [voice, profile] of Object.entries(VOICES)) {
      const row = document.createElement('div');
      row.className = 'voice-row';
      row.style.setProperty('--tone', profile.color);
      const label = document.createElement('button');
      label.className = 'voice-name';
      label.textContent = profile.name;
      label.title = `Послушать: ${profile.name}`;
      label.addEventListener('click', () => onAudition(voice, 0));
      row.append(label);
      for (const binding of KEY_BINDINGS.filter(item => item.voice === voice)) {
        const key = document.createElement('button');
        key.className = 'key';
        key.dataset.binding = binding.id;
        key.textContent = (binding.shift ? '⇧' : '') + binding.key.toUpperCase();
        key.title = `${profile.name} · ${noteName(NOTES[binding.index] * profile.factor)}`;
        key.setAttribute('aria-label', `${binding.shift ? 'Shift + ' : ''}${binding.key.toUpperCase()}: ${key.title}`);
        // Pointer input is handled separately. detail=0 means keyboard/AT activation.
        key.addEventListener('click', event => { if (event.detail === 0) onAudition(voice, binding.index); });
        this.keys.set(binding.id, key);
        row.append(key);
      }
      const pitch = document.createElement('span');
      pitch.className = 'row-note';
      pitch.textContent = '·';
      pitch.setAttribute('aria-hidden', 'true');
      this.pitches.set(voice, pitch);
      row.append(pitch);
      keyboard.append(row);

      const control = document.createElement('label');
      control.textContent = profile.name;
      const input = document.createElement('input');
      input.type = 'range'; input.min = '0'; input.max = '100'; input.value = '100';
      input.setAttribute('aria-label', `Громкость: ${profile.name}`);
      const value = document.createElement('output');
      value.textContent = '100';
      input.addEventListener('input', () => { value.textContent = input.value; onVolume(voice, Number(input.value) / 100); });
      control.append(input, value);
      mixer.append(control);
    }
  }

  setRoot(index) {
    if (index === this.root) return;
    this.root = index;
    for (const binding of KEY_BINDINGS) {
      this.keys.get(binding.id).classList.toggle('suggested', index !== null && binding.voice !== 'bass' && consonant(binding.index, index));
    }
  }

  show(note, bindingId) {
    const light = document.createElement('div');
    light.className = `note-light ${note.voice}`;
    light.style.setProperty('--tone', VOICES[note.voice].color);
    this.lightContainer.append(light);
    this.lights.set(note.id, light);
    this.notes.set(note.id, { note, bindingId });
    if (bindingId) {
      const count = (this.activeCounts.get(bindingId) ?? 0) + 1;
      this.activeCounts.set(bindingId, count);
      this.keys.get(bindingId)?.classList.add('active');
    }
    this.position(note);
    requestAnimationFrame(() => { if (light.isConnected) light.classList.add('on'); });
  }

  position(note) {
    const light = this.lights.get(note.id);
    if (!light) return;
    const usable = Math.max(90, innerHeight - (innerWidth <= 980 ? 390 : 210));
    light.style.left = `${(note.index + .5) / NOTES.length * innerWidth}px`;
    light.style.top = `${55 + usable * VOICES[note.voice].position - note.index % 5 * Math.min(7, usable * .02)}px`;
    this.pitches.get(note.voice).textContent = noteName(NOTES[note.index] * VOICES[note.voice].factor);
  }

  hide(note) {
    const entry = this.notes.get(note.id);
    if (!entry) return;
    const light = this.lights.get(note.id);
    this.notes.delete(note.id);
    this.lights.delete(note.id);
    if (entry.bindingId) {
      const count = Math.max(0, (this.activeCounts.get(entry.bindingId) ?? 1) - 1);
      this.activeCounts.set(entry.bindingId, count);
      this.keys.get(entry.bindingId)?.classList.toggle('active', count > 0);
    }
    light.classList.remove('on');
    light.classList.add('out');
    if (this.reducedMotion) light.remove();
    else light.addEventListener('animationend', () => light.remove(), { once: true });
  }

  resize() { for (const { note } of this.notes.values()) this.position(note); }
}
