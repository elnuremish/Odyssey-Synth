/**
 * ==========================================
 * 1. КОНФИГУРАЦИЯ И СОСТОЯНИЕ
 * ==========================================
 */
const sounds = new Map();
const fluteSounds = new Map();

// Пентатоника (гармоничный звукоряд)
const notes = [
  32.7, 36.71, 43.65, 49.00, 55.00, 
  65.41, 73.42, 87.31, 98.00, 110.00,
  130.81, 146.83, 174.61, 196.00
];

// Раскладка клавиатуры
const synthKeys = { a:0, s:1, d:2, f:3, g:4, h:5, j:6, k:7, l:8, ";":9, "'":10, z:11, x:12, c:13 };
const fluteKeys = { q:0, w:1, e:2, r:3, t:4, y:5, u:6, i:7, o:8, p:9, "[":10, "]":11, "\\":12, "1":13 };

/**
 * ==========================================
 * 2. АУДИО ДВИЖОК (Web Audio API)
 * ==========================================
 */
let audio, masterFilter, fluteFilterMaster, masterGain, delay, reverb;

function createReverbImpulse(context, duration, decay) {
  const length = context.sampleRate * duration;
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let i = 0; i < length; i++) {
    impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

function initAudio() {
  if (audio) return;
  audio = new (window.AudioContext || window.webkitAudioContext)();

  // Мастер-громкость
  masterGain = audio.createGain();
  masterGain.gain.value = 0.5;

  // Фильтры
  masterFilter = audio.createBiquadFilter();
  masterFilter.type = "lowpass";
  masterFilter.frequency.value = 800;

  fluteFilterMaster = audio.createBiquadFilter();
  fluteFilterMaster.type = "lowpass";
  fluteFilterMaster.frequency.value = 3500;

  // Пространственные эффекты (Эхо и Реверберация)
  delay = audio.createDelay(5);
  delay.delayTime.value = 1.0;
  
  const feedback = audio.createGain();
  feedback.gain.value = 0.3; // Снижено, чтобы не было гула при простое

  reverb = audio.createConvolver();
  reverb.buffer = createReverbImpulse(audio, 3.0, 3.0);
  const reverbGain = audio.createGain();
  reverbGain.gain.value = 0.6;

  // Маршрутизация эффектов
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(reverb);
  reverb.connect(reverbGain);
  reverbGain.connect(masterGain);

  masterFilter.connect(masterGain);
  masterFilter.connect(delay);
  masterFilter.connect(reverb);

  fluteFilterMaster.connect(masterGain);
  fluteFilterMaster.connect(delay);
  fluteFilterMaster.connect(reverb);

  masterGain.connect(audio.destination);

  // LFO для фильтра (движение звука)
  const lfo = audio.createOscillator();
  const lfoAmount = audio.createGain();
  lfo.frequency.value = 0.05;
  lfoAmount.gain.value = 300;
  lfo.connect(lfoAmount);
  lfoAmount.connect(masterFilter.frequency);
  lfo.start();
}

function updateFilterDynamics(x, y) {
  if (!audio) return;
  const vertical = 1 - y / innerHeight;
  const horizontal = x / innerWidth;

  masterFilter.frequency.setTargetAtTime(150 + vertical * 2000, audio.currentTime, 0.1);
  masterFilter.Q.setTargetAtTime(0.5 + horizontal * 5, audio.currentTime, 0.1);
  fluteFilterMaster.frequency.setTargetAtTime(1500 + vertical * 3000, audio.currentTime, 0.1);
}

function checkPlayingState() {
  if (sounds.size === 0 && fluteSounds.size === 0) {
    document.body.classList.remove("playing");
  }
}

// --- КАНАЛ 1: ДРОН (ГЛУБОКИЙ БАС) ---
function playDrone(freq, id) {
  initAudio();
  audio.resume();
  document.body.classList.add("playing");

  const volume = audio.createGain();
  volume.gain.setValueAtTime(0, audio.currentTime);
  volume.gain.linearRampToValueAtTime(0.4, audio.currentTime + 1.5); // Мягкая атака
  volume.connect(masterFilter);

  // Использование чистых волн (Sine + Triangle) избавляет от грязи
  const osc1 = audio.createOscillator();
  const osc2 = audio.createOscillator();
  osc1.type = "sine";
  osc2.type = "triangle";
  
  osc1.frequency.value = freq;
  osc2.frequency.value = freq;
  osc2.detune.value = 8; // Легкий хорус эффект

  osc1.connect(volume);
  osc2.connect(volume);
  osc1.start();
  osc2.start();

  sounds.set(id, { osc1, osc2, volume });
}

function stopDrone(id) {
  const sound = sounds.get(id);
  if (!sound || !audio) return;

  const now = audio.currentTime;
  sound.volume.gain.cancelScheduledValues(now);
  sound.volume.gain.setValueAtTime(sound.volume.gain.value, now);
  
  // Экспоненциальное затухание гарантированно уводит звук в тишину
  sound.volume.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  sound.volume.gain.setValueAtTime(0, now + 1.6);

  setTimeout(() => {
    sound.osc1.stop();
    sound.osc2.stop();
    sound.osc1.disconnect();
    sound.osc2.disconnect();
    sound.volume.disconnect();
  }, 2000);

  sounds.delete(id);
  checkPlayingState();
}

// --- КАНАЛ 2: ФЛЕЙТА ---
function playFlute(freq, id) {
  initAudio();
  audio.resume();
  document.body.classList.add("playing");

  const volume = audio.createGain();
  volume.gain.setValueAtTime(0, audio.currentTime);
  volume.gain.linearRampToValueAtTime(0.3, audio.currentTime + 0.5); 
  volume.connect(fluteFilterMaster);

  const oscTri = audio.createOscillator();
  oscTri.type = "triangle"; 
  oscTri.frequency.value = freq * 4;

  const vibrato = audio.createOscillator();
  vibrato.frequency.value = 5.5; 
  const vibratoGain = audio.createGain();
  vibratoGain.gain.value = 10;
  
  vibrato.connect(vibratoGain);
  vibratoGain.connect(oscTri.detune);

  oscTri.connect(volume);
  oscTri.start();
  vibrato.start();

  fluteSounds.set(id, { oscTri, vibrato, volume });
}

function stopFlute(id) {
  const sound = fluteSounds.get(id);
  if (!sound || !audio) return;

  const now = audio.currentTime;
  sound.volume.gain.cancelScheduledValues(now);
  sound.volume.gain.setValueAtTime(sound.volume.gain.value, now);
  sound.volume.gain.exponentialRampToValueAtTime(0.001, now + 1.5); 
  sound.volume.gain.setValueAtTime(0, now + 1.6);

  setTimeout(() => {
    sound.oscTri.stop();
    sound.vibrato.stop();
    sound.oscTri.disconnect();
    sound.vibrato.disconnect();
    sound.volume.disconnect();
  }, 2000);

  fluteSounds.delete(id);
  checkPlayingState();
}

/**
 * ==========================================
 * 3. УПРАВЛЕНИЕ UI И АНИМАЦИИ
 * ==========================================
 */
const glow = document.querySelector("#glow");
const dvd = document.querySelector("#dvd");
let dvdX = Math.random() * (innerWidth - 140);
let dvdY = Math.random() * (innerHeight - 100);
let dvdDX = 0.8, dvdDY = 0.8;

function moveDvd() {
  if (dvdX <= 0 || dvdX >= innerWidth - 140) dvdDX *= -1;
  if (dvdY <= 0 || dvdY >= innerHeight - 100) dvdDY *= -1;
  dvdX += dvdDX;
  dvdY += dvdDY;
  dvd.style.transform = `translate(${dvdX}px, ${dvdY}px)`;
  requestAnimationFrame(moveDvd);
}

function updateGlowPosition(x, y) {
  glow.style.left = `${x}px`;
  glow.style.top = `${y}px`;
}

moveDvd();
window.addEventListener("resize", () => {
  dvdX = Math.min(dvdX, Math.max(0, innerWidth - 140));
  dvdY = Math.min(dvdY, Math.max(0, innerHeight - 100));
});

/**
 * ==========================================
 * 4. ОБРАБОТЧИКИ СОБЫТИЙ (Мышь / Клавиатура)
 * ==========================================
 */
document.addEventListener("contextmenu", e => e.preventDefault());

document.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
  const index = Math.min(notes.length - 1, Math.floor((e.clientX / innerWidth) * notes.length));
  
  updateGlowPosition(e.clientX, e.clientY);
  updateFilterDynamics(e.clientX, e.clientY);

  if (e.button === 2) {
    playFlute(notes[index], `pointer-flute-${e.pointerId}`);
  } else {
    playDrone(notes[index], `pointer-synth-${e.pointerId}`);
  }
});

document.addEventListener("pointermove", e => {
  updateGlowPosition(e.clientX, e.clientY);
  if (sounds.size > 0 || fluteSounds.size > 0) {
    updateFilterDynamics(e.clientX, e.clientY);
  }
});

document.addEventListener("pointerup", e => {
  stopDrone(`pointer-synth-${e.pointerId}`);
  stopFlute(`pointer-flute-${e.pointerId}`);
});

document.addEventListener("pointercancel", e => {
  stopDrone(`pointer-synth-${e.pointerId}`);
  stopFlute(`pointer-flute-${e.pointerId}`);
});

document.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  
  if (synthKeys[key] !== undefined && !sounds.has(key)) {
    updateGlowPosition(innerWidth / 2, innerHeight / 2);
    playDrone(notes[synthKeys[key]], key);
  }
  
  if (fluteKeys[key] !== undefined && !fluteSounds.has(key)) {
    updateGlowPosition(innerWidth / 2, innerHeight / 2);
    playFlute(notes[fluteKeys[key]], key);
  }
});

document.addEventListener("keyup", e => {
  const key = e.key.toLowerCase();
  if (synthKeys[key] !== undefined) stopDrone(key);
  if (fluteKeys[key] !== undefined) stopFlute(key);
});