// ИИ: Codex структурировал настройки инструмента. README, запись №7.
export const NOTES = [
  32.7, 36.71, 43.65, 49, 55, 65.41, 73.42,
  87.31, 98, 110, 130.81, 146.83, 174.61, 196,
];

// Existing tuning is deliberately preserved: C, D, F, G, A across octaves.
export const VOICES = {
  vocal: {
    name: 'Голос', keys: '1234567890', factor: 4, color: '166,185,206',
    level: .32, attack: .18, decay: .5, sustain: .30, release: 1.1,
    cutoff: 3400, room: .65, echo: .55, position: .14, limit: 4,
  },
  flute: {
    name: 'Флейта', keys: 'qwertyuiop[]\\', factor: 4, color: '220,220,220',
    level: .3, attack: .5, release: 1.5, cutoff: 3500,
    room: 1, echo: 1, position: .3, limit: 13,
  },
  bass: {
    name: 'Бас', keys: "asdfghjkl;'", factor: 2, color: '201,185,165',
    level: .34, attack: .12, decay: .28, sustain: .32, release: .35,
    cutoff: 1500, room: .25, echo: .12, position: .81, limit: 1,
  },
  viola: {
    name: 'Виола', keys: 'zxcvbnm,./', factor: 4, color: '177,194,171',
    level: .32, attack: .26, decay: .6, sustain: .30, release: 1.1,
    cutoff: 2700, room: .6, echo: .5, position: .47, limit: 4,
  },
  choir: {
    name: 'Хор', keys: 'zxcvbnm,./', shift: true, factor: 2, color: '186,176,199',
    level: .34, attack: .45, decay: .8, sustain: .32, release: 1.5,
    cutoff: 2400, room: .7, echo: .5, position: .64, limit: 4,
  },
};

const PUNCTUATION = {
  '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
  ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period', '/': 'Slash',
};

export const KEY_BINDINGS = Object.entries(VOICES).flatMap(([voice, profile]) =>
  [...profile.keys].map((key, index) => ({
    id: `${voice}:${index}`, voice, index, key, shift: Boolean(profile.shift),
    code: PUNCTUATION[key] ?? (/\d/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`),
  })),
);

export function findBinding(code, shift) {
  return KEY_BINDINGS.find(binding => binding.code === code && binding.shift === shift)
    ?? KEY_BINDINGS.find(binding => binding.code === code && !binding.shift);
}

export function noteName(frequency) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  return names[(midi % 12 + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export function consonant(index, root) {
  const interval = (Math.round(12 * Math.log2(NOTES[index] / NOTES[root])) % 12 + 12) % 12;
  return [0, 5, 7].includes(interval);
}
