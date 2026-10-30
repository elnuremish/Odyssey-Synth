// ИИ: Codex переработал синтез и освобождение аудиоузлов. README, запись №7.
import { NOTES, VOICES } from './config.js';

export class AudioEngine {
  constructor(createContext = () => new (window.AudioContext || window.webkitAudioContext)()) {
    this.createContext = createContext;
    this.context = null;
    this.channels = new Map();
    this.levels = new Map(Object.keys(VOICES).map(voice => [voice, 1]));
    this.active = new Map();
    this.live = new Set();
    this.onStop = () => {};
  }

  get time() { return this.context?.currentTime ?? 0; }

  ensure() {
    if (!this.context) this.initialize();
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    return this.context;
  }

  initialize() {
    const ctx = this.context = this.createContext();
    this.master = ctx.createGain();
    this.master.gain.value = .5;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -17;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = .012;
    compressor.release.value = .24;
    this.master.connect(compressor).connect(ctx.destination);

    this.delay = ctx.createDelay(5);
    this.delay.delayTime.value = 1;
    const feedback = ctx.createGain();
    feedback.gain.value = .3;
    this.delay.connect(feedback).connect(this.delay);
    this.reverb = ctx.createConvolver();
    const impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    }
    this.reverb.buffer = impulse;
    const roomReturn = ctx.createGain();
    roomReturn.gain.value = .6;
    this.delay.connect(this.reverb);
    this.reverb.connect(roomReturn).connect(this.master);

    for (const [voice, profile] of Object.entries(VOICES)) {
      const input = ctx.createGain();
      input.gain.value = this.levels.get(voice);
      let output = input;
      if (voice === 'bass' || voice === 'flute') {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = profile.cutoff;
        if (voice === 'bass') filter.Q.value = .45;
        input.connect(filter);
        output = filter;
        if (voice === 'flute') this.fluteFilter = filter;
      }
      const room = ctx.createGain(), echo = ctx.createGain();
      room.gain.value = profile.room;
      echo.gain.value = profile.echo;
      output.connect(this.master);
      output.connect(room).connect(this.reverb);
      output.connect(echo).connect(this.delay);
      this.channels.set(voice, input);
    }
  }

  setVolume(voice, value) {
    const level = Math.max(0, Math.min(1, value));
    this.levels.set(voice, level);
    this.channels.get(voice)?.gain.setTargetAtTime(level, this.time, .025);
  }

  setBrightness(vertical) {
    this.fluteFilter?.frequency.setTargetAtTime(1500 + Math.max(0, Math.min(1, vertical)) * 3000, this.time, .1);
  }

  start(id, voice, index, { when = this.time, intensity = 1 } = {}) {
    if (this.active.has(id)) return this.active.get(id);
    const ctx = this.ensure(), profile = VOICES[voice];
    when = Math.max(when, this.time);
    const siblings = [...this.active.values()].filter(note => note.voice === voice);
    if (siblings.length >= profile.limit) this.stop(siblings[0].id, { release: .09 });

    const amp = ctx.createGain();
    amp.gain.value = 0;
    amp.connect(this.channels.get(voice));
    const note = { id, voice, index, amp, when, intensity, sources: [], nodes: [amp], tones: [], released: false };
    const target = NOTES[index] * profile.factor;
    let destination = amp;
    if (voice !== 'flute') {
      note.filter = ctx.createBiquadFilter();
      note.filter.type = 'lowpass';
      note.filter.Q.value = voice === 'bass' ? .45 : .55;
      note.filter.frequency.value = profile.cutoff;
      note.filter.connect(amp);
      note.nodes.push(note.filter);
      destination = note.filter;
    }

    const oscillator = (wave, ratio = 1, gain = 1, pan = 0, detune = 0) => {
      const source = ctx.createOscillator();
      source.type = wave;
      source.frequency.value = target * ratio;
      source.detune.value = detune;
      if (gain === 1 && pan === 0) source.connect(destination);
      else {
        const mix = ctx.createGain(), stereo = ctx.createStereoPanner();
        mix.gain.value = gain;
        stereo.pan.value = pan;
        source.connect(mix).connect(stereo).connect(destination);
        note.nodes.push(mix, stereo);
      }
      note.sources.push(source);
      note.nodes.push(source);
      note.tones.push({ source, ratio });
      source.start(when);
    };

    if (voice === 'bass') {
      oscillator('triangle', 1, .78);
      oscillator('sine', 1, .18);
      oscillator('sine', .5, .1);
      note.filter.frequency.setValueAtTime(Math.min(2600, target * 16), when);
      note.filter.frequency.exponentialRampToValueAtTime(Math.min(2200, target * 12), when + .28);
    } else {
      if (voice === 'flute') oscillator('triangle');
      else if (voice === 'choir') {
        for (let i = -1; i <= 1; i++) oscillator('triangle', 1, 1 / 3, i * .3, i * 5);
      } else {
        oscillator('triangle', 1, .85);
        oscillator('sine', voice === 'vocal' ? .5 : 1, .15);
      }
      const vibrato = ctx.createOscillator(), depth = ctx.createGain();
      vibrato.frequency.value = voice === 'viola' ? 4.7 : 5.5;
      depth.gain.value = voice === 'choir' ? 7 : 10;
      vibrato.connect(depth);
      note.tones.forEach(({ source }) => depth.connect(source.detune));
      vibrato.start(when);
      note.sources.push(vibrato);
      note.nodes.push(vibrato, depth);
    }

    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(profile.level * intensity, when + profile.attack);
    if (profile.sustain) amp.gain.exponentialRampToValueAtTime(profile.sustain * intensity, when + profile.attack + profile.decay);
    this.active.set(id, note);
    this.live.add(note);
    // The audio clock owns cleanup, including scheduled notes and hidden tabs.
    note.sources[0].onended = () => this.dispose(note);
    return note;
  }

  envelopeAt(note, time) {
    if (note.releaseEnvelope && time >= note.releaseEnvelope.start) {
      const { start, end, level } = note.releaseEnvelope;
      return level * Math.max(0, 1 - (time - start) / (end - start));
    }
    const profile = VOICES[note.voice], elapsed = Math.max(0, time - note.when);
    const peak = profile.level * note.intensity;
    if (elapsed < profile.attack) return peak * elapsed / profile.attack;
    if (!profile.sustain) return peak;
    const progress = Math.min(1, (elapsed - profile.attack) / profile.decay);
    return peak * (profile.sustain / profile.level) ** progress;
  }

  stop(id, { when = this.time, release } = {}) {
    const note = this.active.get(id);
    if (!note) return;
    this.release(note, when, release ?? VOICES[note.voice].release);
  }

  release(note, when, duration) {
    const parameter = note.amp.gain;
    const start = Math.max(this.time, when);
    const level = this.envelopeAt(note, start);
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(start);
    else {
      // Safari may lack cancelAndHoldAtTime. Restore the cancelled ramp's
      // endpoint so its earlier portion does not disappear at key-up.
      parameter.cancelScheduledValues(start);
      const profile = VOICES[note.voice];
      if (note.releaseEnvelope || start <= note.when + profile.attack) {
        parameter.linearRampToValueAtTime(level, start);
      } else if (profile.sustain && start < note.when + profile.attack + profile.decay) {
        parameter.exponentialRampToValueAtTime(level, start);
      } else parameter.setValueAtTime(level, start);
    }
    // A linear release also works at zero gain (an immediate key-up).
    // Reach exact silence before stopping sources and disconnecting filters.
    const end = start + Math.max(.015, duration);
    parameter.linearRampToValueAtTime(0, end);
    note.releaseEnvelope = { start, end, level };
    for (const source of note.sources) source.stop(end + .03);
    note.released = true;
    this.active.delete(note.id);
    this.onStop(note);
  }

  dispose(note) {
    if (this.active.get(note.id) === note) {
      this.active.delete(note.id);
      this.onStop(note);
    }
    note.nodes.forEach(node => node.disconnect());
    this.live.delete(note);
  }

  move(id, index) {
    const note = this.active.get(id);
    if (!note) return;
    note.index = index;
    const frequency = NOTES[index] * VOICES[note.voice].factor;
    note.tones.forEach(({ source, ratio }) => source.frequency.setTargetAtTime(frequency * ratio, this.time, .035));
    if (note.voice === 'bass') note.filter.frequency.setTargetAtTime(Math.min(1400, frequency * 3.5), this.time, .06);
  }

  stopAll() {
    for (const note of this.live) this.release(note, this.time, .08);
  }
}
