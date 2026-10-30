// ИИ: Codex подготовил анимацию и движение персонажей. README, записи №6–7.
import { CHARACTERS } from './characters.js';

export class Traveler {
  constructor(element, reducedMotion) {
    this.element = element;
    this.sprite = element.querySelector('.sprite');
    this.label = element.querySelector('.traveler-name');
    this.reducedMotion = reducedMotion;
    this.character = 0;
    this.frame = -1;
    this.x = innerWidth * .48;
    this.y = innerHeight * .23;
    this.dx = 1;
    this.dy = 1;
    this.reactionUntil = 0;
    this.resize();
    this.setCharacter(0);
    this.sprite.addEventListener('animationend', () => this.sprite.classList.remove('impact'));
  }

  resize() {
    // Layout is read only on resize, never in the animation loop.
    this.maxX = Math.max(0, innerWidth - this.element.offsetWidth);
    this.maxY = Math.max(0, innerHeight - this.element.offsetHeight);
    this.x = Math.min(this.maxX, Math.max(0, this.x));
    this.y = Math.min(this.maxY, Math.max(0, this.y));
  }

  setCharacter(index) {
    this.character = index;
    this.sprite.style.setProperty('--character', index);
    this.label.textContent = CHARACTERS[index].toUpperCase();
    this.element.setAttribute('aria-label', `${CHARACTERS[index]}. Сменить персонажа и услышать ноту`);
    this.element.title = `${CHARACTERS[index]} · поймай, чтобы изменить`;
  }

  change(corner = false) {
    this.setCharacter(corner ? (this.character === 8 ? 0 : 8) : (this.character + 1) % CHARACTERS.length);
    this.sprite.classList.add('impact');
  }

  react(now) { this.reactionUntil = now + 160; }

  update(now, delta) {
    let hitX = false, hitY = false;
    if (!this.reducedMotion) {
      this.x += this.dx * 63 * delta;
      this.y += this.dy * 49.8 * delta;
      if (this.x <= 0 || this.x >= this.maxX) {
        this.dx *= -1;
        this.x = Math.max(0, Math.min(this.maxX, this.x));
        hitX = true;
      }
      if (this.y <= 0 || this.y >= this.maxY) {
        this.dy *= -1;
        this.y = Math.max(0, Math.min(this.maxY, this.y));
        hitY = true;
      }
      if (hitX || hitY) this.change(hitX && hitY);
    }
    const listening = now < this.reactionUntil;
    const frame = this.reducedMotion ? 0 : Math.floor(now / (listening ? 85 : 145)) % 8;
    if (frame !== this.frame) {
      this.frame = frame;
      this.sprite.style.setProperty('--frame', frame);
    }
    this.sprite.style.setProperty('--direction', this.dx);
    this.sprite.classList.toggle('listening', listening);
    this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
  }
}
