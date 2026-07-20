import type { GameState, ItemId } from '../core/types';
import { maxHp } from '../core/state';
import { ITEM_ICONS } from './icons';

let dayEl: HTMLElement;
let cashEl: HTMLElement;
let hpEl: HTMLElement;
let hpTextEl: HTMLElement;
let statsEl: HTMLElement;
let invEl: HTMLElement;
let promptEl: HTMLElement;
let toastsEl: HTMLElement;
let clockCanvas: HTMLCanvasElement;
let lastInvKey = '';
let lastClockMinute = -1;

export function initHud(parent: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="hud">
      <span class="hud-group"><span id="hud-heart">❤</span><span id="hud-hp-wrap"><span id="hud-hp"></span><b id="hud-hp-text"></b></span></span>
      <span class="hud-group"><span id="hud-dollar">$</span><b id="hud-cash"></b></span>
      <span class="hud-group"><canvas id="hud-clock" width="34" height="34"></canvas><b id="hud-day"></b></span>
      <span class="hud-group" id="hud-stats"></span>
    </div>
    <div id="hud-inv"></div>
    <div id="prompt" hidden></div>
    <div id="toasts"></div>
    <div id="help">WASD move · Shift run · E interact · I inventory</div>`;
  parent.append(...wrap.children);
  dayEl = document.getElementById('hud-day')!;
  cashEl = document.getElementById('hud-cash')!;
  hpEl = document.getElementById('hud-hp')!;
  hpTextEl = document.getElementById('hud-hp-text')!;
  statsEl = document.getElementById('hud-stats')!;
  invEl = document.getElementById('hud-inv')!;
  promptEl = document.getElementById('prompt')!;
  toastsEl = document.getElementById('toasts')!;
  clockCanvas = document.getElementById('hud-clock') as HTMLCanvasElement;
}

/** The original's little analog clock: a blue pie fills as the day passes. */
function drawClock(minute: number): void {
  if (minute === lastClockMinute) return;
  lastClockMinute = minute;
  const ctx = clockCanvas.getContext('2d')!;
  const c = 17;
  ctx.clearRect(0, 0, 34, 34);
  ctx.beginPath();
  ctx.arc(c, c, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#9a9da6';
  ctx.fill();
  ctx.strokeStyle = '#1c1c22';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, 12.5, 0, Math.PI * 2);
  ctx.fillStyle = '#f2f2f5';
  ctx.fill();
  const frac = minute / 1440;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, 12.5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#2f6de0';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1c22';
  ctx.fill();
}

export function updateHud(s: GameState): void {
  dayEl.textContent = s.dayLimit ? `Day ${s.day} / ${s.dayLimit}` : `Day ${s.day}`;
  cashEl.textContent = s.cash.toLocaleString();
  const max = maxHp(s);
  hpEl.style.width = `${Math.round((100 * s.hp) / max)}%`;
  hpTextEl.textContent = `${s.hp}/${max}`;
  statsEl.textContent = `STR ${s.stats.strength} · INT ${s.stats.intelligence} · CHA ${s.stats.charm}${s.bank > 0 || s.loan > 0 ? `  ·  🏦 $${s.bank.toLocaleString()}${s.loan > 0 ? ` (−$${s.loan})` : ''}` : ''}`;
  drawClock(s.minute);

  const entries = Object.entries(s.inventory).filter(([, n]) => (n ?? 0) > 0);
  const extras = [s.hasSkateboard ? '🛹' : '', s.hasCar ? '🚗' : ''].filter(Boolean);
  const key = JSON.stringify(entries) + extras.join('');
  if (key !== lastInvKey) {
    lastInvKey = key;
    invEl.innerHTML = '';
    for (const [id, n] of entries) {
      const chip = document.createElement('span');
      chip.className = 'inv-chip';
      chip.innerHTML = `<span class="inv-icon"></span>${(n ?? 0) > 1 ? `<span class="inv-count"></span>` : ''}`;
      chip.querySelector('.inv-icon')!.textContent = ITEM_ICONS[id as ItemId] ?? '▪';
      const count = chip.querySelector('.inv-count');
      if (count) count.textContent = String(n);
      chip.title = id;
      invEl.appendChild(chip);
    }
    for (const icon of extras) {
      const chip = document.createElement('span');
      chip.className = 'inv-chip';
      chip.innerHTML = `<span class="inv-icon"></span>`;
      chip.querySelector('.inv-icon')!.textContent = icon;
      invEl.appendChild(chip);
    }
  }
}

export function setPrompt(text: string | null): void {
  promptEl.hidden = !text;
  if (text) promptEl.textContent = text;
}

export function toast(msg: string, ok = true): void {
  const el = document.createElement('div');
  el.className = ok ? 'toast' : 'toast err';
  el.textContent = msg;
  toastsEl.appendChild(el);
  while (toastsEl.children.length > 4) toastsEl.firstChild?.remove();
  setTimeout(() => el.classList.add('fade'), 4200);
  setTimeout(() => el.remove(), 4900);
}
