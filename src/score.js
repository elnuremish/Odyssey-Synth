// ИИ: Codex создал трёхминутную композицию. README, запись №6.
export const DURATION = 180;
export const STEP_SECONDS = .375;
export const CHAPTERS = ['Отплытие', 'Море', 'Сирены', 'Буря', 'Память', 'Итака'];
const PROGRESSIONS = [[0, 0, 2, 0], [0, 2, 3, 0], [4, 2, 3, 0], [0, 3, 4, 2], [2, 0, 3, 0], [2, 3, 0, 0]];
const PATTERNS = [[0], [0, 4], [0, 3, 6], [0, 2, 3, 4, 6, 7], [0, 5], [0, 4]];

export function scoreStep(step) {
  if (!Number.isInteger(step) || step < 0 || step >= 472) return null;
  const bar = Math.floor(step / 8), slot = step % 8;
  const chapter = Math.floor(bar / 10), local = bar % 10;
  if (chapter === 0 && bar % 2 === 1) return null;
  if (chapter === 5 && local >= 6 && slot !== 0) return null;
  if (!PATTERNS[chapter].includes(slot)) return null;
  const root = bar >= 58 ? 0 : PROGRESSIONS[chapter][local % 4];
  const octave = slot !== 0 && ((chapter === 2 && slot === 6) || (chapter === 3 && slot % 2 === 0));
  return {
    index: root + (octave ? 5 : 0),
    duration: chapter === 3 ? .23 : chapter === 0 ? 2.2 : chapter === 5 ? 1.1 : .82,
    intensity: [.58, .75, .82, 1, .65, .6][chapter],
  };
}

export class Voyage {
  constructor(onNote, onChange) {
    this.onNote = onNote;
    this.onChange = onChange;
    this.playing = false;
    this.startTime = 0;
    this.step = 0;
    this.display = '';
  }

  start(now) {
    this.startTime = now + .05;
    this.step = 0;
    this.playing = true;
    this.display = '';
    this.update(now);
  }

  stop() {
    this.playing = false;
    this.display = '';
    this.onChange('▷ Путь домой', false);
  }

  update(now) {
    if (!this.playing) return;
    const elapsed = Math.max(0, now - this.startTime);
    if (elapsed >= DURATION) { this.stop(); return; }
    const second = Math.floor(elapsed), chapter = Math.floor(elapsed / 30);
    const display = `■ ${Math.floor(second / 60)}:${String(second % 60).padStart(2, '0')} · ${CHAPTERS[chapter]}`;
    if (display !== this.display) {
      this.display = display;
      this.onChange(display, true);
    }
    // Drop overdue notes after a stall instead of playing a burst to catch up.
    while (this.step < 480 && this.startTime + this.step * STEP_SECONDS <= now + .035) {
      const when = this.startTime + this.step * STEP_SECONDS;
      const event = scoreStep(this.step++);
      if (event && when >= now - .09) this.onNote(event, Math.max(now, when));
    }
  }
}
