import { DAY_LENGTH_CHOICES } from '../core/newgame';

/** Full-screen new-game setup: name + game length. */
export function showNewGameScreen(
  onStart: (name: string, days: number | null) => void
): void {
  const overlay = document.createElement('div');
  overlay.id = 'screen-overlay';
  overlay.innerHTML = `
    <div class="screen-card">
      <div class="screen-kicker">A 3D remake of the 2003 classic</div>
      <h1>STICK RPG</h1>
      <p class="screen-sub">You fall asleep on a lazy afternoon… and wake up in the 2 Dimensional World.</p>
      <label class="screen-label" for="ng-name">Your name</label>
      <input id="ng-name" maxlength="24" spellcheck="false" placeholder="Oliver" />
      <div class="screen-label">How long will you live here?</div>
      <div id="ng-lengths"></div>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>('#ng-name')!;
  input.focus();
  const lengths = overlay.querySelector<HTMLElement>('#ng-lengths')!;
  for (const choice of DAY_LENGTH_CHOICES) {
    const btn = document.createElement('button');
    btn.className = 'screen-btn';
    btn.innerHTML = `<b>${choice.label}</b><span>${choice.blurb}</span>`;
    btn.addEventListener('click', () => {
      overlay.remove();
      onStart(input.value.trim() || 'Oliver', choice.days);
    });
    lengths.appendChild(btn);
  }
  // keep gameplay keys from leaking through while typing
  overlay.addEventListener('keydown', e => e.stopPropagation());
}

export interface FinalScreenSpec {
  kicker: string;
  title: string;
  blurb: string;
  stats: string[];
  buttons: { label: string; onClick: () => void }[];
}

/** Death and ending screens share this frame. */
export function showFinalScreen(spec: FinalScreenSpec): void {
  document.getElementById('screen-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'screen-overlay';
  const card = document.createElement('div');
  card.className = 'screen-card';
  card.innerHTML = `
    <div class="screen-kicker"></div>
    <h1></h1>
    <p class="screen-sub"></p>
    <div class="screen-stats"></div>
    <div class="screen-buttons"></div>`;
  card.querySelector('.screen-kicker')!.textContent = spec.kicker;
  card.querySelector('h1')!.textContent = spec.title;
  card.querySelector('.screen-sub')!.textContent = spec.blurb;
  const statsEl = card.querySelector('.screen-stats')!;
  for (const line of spec.stats) {
    const div = document.createElement('div');
    div.textContent = line;
    statsEl.appendChild(div);
  }
  const buttons = card.querySelector('.screen-buttons')!;
  for (const b of spec.buttons) {
    const btn = document.createElement('button');
    btn.className = 'screen-btn';
    btn.innerHTML = `<b>${b.label}</b>`;
    btn.addEventListener('click', () => {
      overlay.remove();
      b.onClick();
    });
    buttons.appendChild(btn);
  }
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

export function isScreenOpen(): boolean {
  return document.getElementById('screen-overlay') !== null;
}
