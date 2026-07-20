import type { GameState } from '../core/types';
import { fmtClock, weekdayName } from '../core/sim';
import { gigTimeLeft } from '../core/gigs';
import { progress } from '../core/aspirations';

let clockEl: HTMLElement;
let cashEl: HTMLElement;
let energyEl: HTMLElement;
let hungerEl: HTMLElement;
let debtEl: HTMLElement;
let savingsEl: HTMLElement;
let promptEl: HTMLElement;
let toastsEl: HTMLElement;
let hintEl: HTMLElement;
let gigEl: HTMLElement;
let weatherEl: HTMLElement;
let goalsEl: HTMLElement;
let soakedEl: HTMLElement;
let shelterEl: HTMLElement;
let navEl: HTMLElement;
let seasonEl: HTMLElement;

export function initHud(parent: HTMLElement): void {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="crosshair">·</div>
    <div id="statusbar">
      <span class="cell" id="hud-clock"></span>
      <span class="cell" id="hud-cash"></span>
      <span class="cell" id="hud-savings" hidden></span>
      <span class="cell warn" id="hud-debt" hidden></span>
      <span class="cell" id="hud-weather"></span>
      <span class="cell" id="hud-season"></span>
      <span class="cell" id="hud-goals"></span>
    </div>
    <div id="needs">
      <div class="need"><label>ENERGY</label><div class="bar"><div id="bar-energy"></div></div></div>
      <div class="need"><label>FOOD</label><div class="bar"><div id="bar-food"></div></div></div>
    </div>
    <div id="gig" hidden></div>
    <div id="nav" hidden></div>
    <div id="soaked" hidden>🌧 Getting soaked — find cover</div>
    <div id="shelter" hidden>☂ Dry under the umbrella</div>
    <div id="prompt" hidden></div>
    <div id="toasts"></div>
    <div id="hint">Click to look around · WASD move · Shift run · E interact/drive</div>`;
  parent.append(...wrap.children);
  clockEl = document.getElementById('hud-clock')!;
  cashEl = document.getElementById('hud-cash')!;
  debtEl = document.getElementById('hud-debt')!;
  savingsEl = document.getElementById('hud-savings')!;
  energyEl = document.getElementById('bar-energy')!;
  hungerEl = document.getElementById('bar-food')!;
  promptEl = document.getElementById('prompt')!;
  toastsEl = document.getElementById('toasts')!;
  hintEl = document.getElementById('hint')!;
  gigEl = document.getElementById('gig')!;
  weatherEl = document.getElementById('hud-weather')!;
  goalsEl = document.getElementById('hud-goals')!;
  soakedEl = document.getElementById('soaked')!;
  shelterEl = document.getElementById('shelter')!;
  navEl = document.getElementById('nav')!;
  seasonEl = document.getElementById('hud-season')!;
}

export function updateNav(text: string | null): void {
  navEl.hidden = !text;
  if (text) navEl.textContent = text;
}

export function updateSeason(seasonLabel: string, holiday: { emoji: string; name: string } | null): void {
  seasonEl.textContent = holiday ? `${holiday.emoji} ${holiday.name}` : seasonLabel;
  seasonEl.classList.toggle('fest', !!holiday);
}

export function setSoaked(on: boolean): void {
  soakedEl.hidden = !on;
}

export function setShelter(on: boolean): void {
  shelterEl.hidden = !on;
}

export function updateWeatherHud(label: string, sky: string): void {
  const icon = sky === 'clear' ? '☀' : sky === 'overcast' ? '☁' : sky === 'rain' ? '🌧' : '⛈';
  weatherEl.textContent = `${icon} ${label}`;
}

export function updateGig(s: GameState): void {
  if (!s.gig) {
    gigEl.hidden = true;
    return;
  }
  const left = gigTimeLeft(s) ?? 0;
  gigEl.hidden = false;
  gigEl.textContent = `JOB → ${s.gig.destName}  ($${s.gig.pay}, ${left > 0 ? left + ' min' : 'LATE'})`;
  gigEl.classList.toggle('warn', left <= 15);
}

export function updateHud(s: GameState): void {
  clockEl.textContent = `${weekdayName(s.day)} · Day ${s.day} · ${fmtClock(s.minute)}`;
  cashEl.textContent = `$${s.cash.toLocaleString()}`;
  savingsEl.hidden = s.savings <= 0;
  if (s.savings > 0) savingsEl.textContent = `BANK $${s.savings.toLocaleString()}`;
  const g = progress(s);
  goalsEl.textContent = `🎯 ${g.done}/${g.total}`;
  debtEl.hidden = s.debt <= 0;
  if (s.debt > 0) debtEl.textContent = `OWED $${s.debt}`;
  energyEl.style.width = `${s.energy}%`;
  energyEl.classList.toggle('low', s.energy <= 20);
  hungerEl.style.width = `${s.hunger}%`;
  hungerEl.classList.toggle('low', s.hunger <= 20);
}

export function setPrompt(text: string | null): void {
  promptEl.hidden = !text;
  if (text) promptEl.textContent = text;
}

export function setHint(text: string | null): void {
  hintEl.hidden = !text;
  if (text) hintEl.textContent = text;
}

export function toast(msg: string, ok = true): void {
  const el = document.createElement('div');
  el.className = ok ? 'toast' : 'toast err';
  el.textContent = msg;
  toastsEl.appendChild(el);
  while (toastsEl.children.length > 4) toastsEl.firstChild?.remove();
  setTimeout(() => el.classList.add('fade'), 4600);
  setTimeout(() => el.remove(), 5300);
}
