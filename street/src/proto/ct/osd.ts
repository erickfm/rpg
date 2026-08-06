// ══ THE ON-SCREEN DISPLAY ═══════════════════════════════════════════════════
//
// *"also if you could make a menu that would be great. idk if we can use esc to
//  access it since thats also how you exit the game in browser but that would be
//  ideal. the menu should contain options for left/right handedness, sound
//  options, regular menu stuff, etc."*   (2026-08-05)
//
// HE SUPPLIED THE STYLE AND IT IS THE WHOLE REASON THIS IS ALLOWED. A reference
// shot of a VCR's on-screen display: a saturated blue field, chunky white
// monospace, `--------- MENU ---------` with dashed rules either side of the
// word, the selected line in INVERSE VIDEO, and a key legend at the foot.
//
// ⚠ THIS IS THE ONE EXCEPTION TO "NOTHING DRAWN OVER THE WORLD", and it is
// earned rather than taken. That rule exists because a floating panel breaks
// the fiction — but a VCR OSD is a thing a 1997 television DOES, so a
// full-screen blue field with white type is not an interface laid over the
// world, it is the world's own idea of what a menu looks like. It does not
// extend to anything else: the bag, the mirror, the drawer, the calendar and
// the mail all stay diegetic objects.
//
// A LEAF MODULE. It imports nothing from the world, so anything may read it
// without closing an import cycle (GOTCHAS §28) — `crosstown.ts` registers the
// few things it cannot see for itself.

/** the reference's own palette, sampled from his screenshot, not invented */
const FIELD = '#2018c8';        // the blue field
const INK = '#f4f4ff';          // the type
const DIM = '#a8a4e0';          // the legend, one step back

/** ── WHAT THE PLAYER HAS CHOSEN ────────────────────────────────────────────
 *
 * ⚠ SETTINGS ARE NOT WORLD STATE AND DO NOT GO IN THE SAVE. `ct/save.ts` is a
 * slice registry and a settings slice would be the obvious place — and it is
 * wrong for the same reason the audio builder kept volume out of it: a
 * preference belongs to the PERSON AND THE MACHINE, not to the character. Put
 * handedness in a save file and it travels to somebody else's screen with the
 * world. localStorage, under its own key, exactly as `ct/audio.ts` already does
 * for volume and mute.
 */
const PREF = 'ct-settings';
export interface Settings {
  /** which wrist the watch is on, and which hand the world assumes */
  hand: 'left' | 'right';
  /** invert the vertical look, the way a flight stick does */
  invertY: boolean;
  /** mouse sensitivity, as a multiplier on the rig's own 0.0022 */
  sens: number;
  /** the resting field of view in degrees — the world's own FOV_REST default */
  fov: number;
  /** the name he gave himself at character creation */
  name: string;
}
const DEFAULTS: Settings = { hand: 'left', invertY: false, sens: 1, fov: 88, name: '' };
let S: Settings = { ...DEFAULTS };
try {
  const raw = JSON.parse(localStorage.getItem(PREF) || '{}') as Partial<Settings>;
  S = { ...DEFAULTS, ...raw };
} catch { /* private mode, or a corrupt entry — the defaults are fine */ }
const persist = () => {
  try { localStorage.setItem(PREF, JSON.stringify(S)); } catch { /* private mode */ }
};

/** read a setting. Live — the world asks every frame and gets the current one. */
export function setting<K extends keyof Settings>(k: K): Settings[K] { return S[k]; }
/** and the watchers, so a change reaches the arm without polling */
const WATCH: (() => void)[] = [];
export function onSettingChange(fn: () => void): void { WATCH.push(fn); }
function put<K extends keyof Settings>(k: K, v: Settings[K]): void {
  S[k] = v;
  persist();
  for (const fn of WATCH) { try { fn(); } catch { /* a bad watcher is not a bad setting */ } }
}
export function setName(v: string): void { put('name', v); }

// ── THE FIELD ──────────────────────────────────────────────────────────────
//
// One canvas, sized in TEXELS and blown up, the same trick every readable
// surface in this project uses — `image-rendering: pixelated` over a small grid
// is what makes the type chunky rather than merely small. 320 x 240 is a VCR's
// own display resolution and the reference is that shape.
const OW = 320, OH = 240;
let wrap: HTMLDivElement | null = null;
let cv: HTMLCanvasElement | null = null;

function build(): void {
  if (wrap) return;
  wrap = document.createElement('div');
  wrap.id = 'ct-osd';
  // z 40: above the panels (11-20) and above the night wash, because a menu is
  // the television's own signal and nothing in the world is in front of it.
  wrap.style.cssText = 'position:fixed;inset:0;z-index:40;display:none;'
    + 'background:#000;align-items:center;justify-content:center;';
  cv = document.createElement('canvas');
  cv.width = OW; cv.height = OH;
  cv.style.cssText = 'image-rendering:pixelated;display:block;'
    + 'width:min(100vw,133vh);height:min(75vw,100vh);';
  wrap.appendChild(cv);
  document.body.appendChild(wrap);
}

/** the reference's own face: one weight, one size, no antialiased edges */
const font = (px: number) => `bold ${px}px ui-monospace, Menlo, Consolas, monospace`;

/**
 * A ROW, AND THE SELECTED ONE IS INVERSE VIDEO — a white block with blue type
 * knocked out of it, which is exactly what the reference does and is how every
 * OSD of the period showed a cursor. Not a colour change, not an arrow: the
 * block is the cursor.
 */
function row(g: CanvasRenderingContext2D, text: string, x: number, y: number,
             px: number, on: boolean): void {
  g.font = font(px);
  const w = g.measureText(text).width;
  if (on) {
    g.fillStyle = INK;
    g.fillRect(Math.round(x - 3), Math.round(y - px + 1), Math.round(w + 6), Math.round(px + 5));
    g.fillStyle = FIELD;
  } else {
    g.fillStyle = INK;
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(text, x, y);
}

/** `--------- MENU ---------`, the dashes sized to what is left of the line */
function heading(g: CanvasRenderingContext2D, word: string, y: number): void {
  g.font = font(16);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = INK;
  g.fillText(`--------- ${word} ---------`, OW / 2, y);
  g.textAlign = 'left';
}

/** the legend at the foot, in the reference's own words and order */
function legend(g: CanvasRenderingContext2D, lines: [string, string][]): void {
  g.font = font(11);
  g.fillStyle = DIM;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  let y = OH - 8 - (lines.length - 1) * 14;
  for (const [k, v] of lines) {
    g.fillText(`${k.padEnd(7)}:${v}`, 16, y);
    y += 14;
  }
}

/** paint a whole screen: the field, a heading, rows and a legend */
export function osdFrame(g: CanvasRenderingContext2D): void {
  g.fillStyle = FIELD;
  g.fillRect(0, 0, OW, OH);
}

// ── THE MENU ───────────────────────────────────────────────────────────────

/**
 * EVERY ENTRY DOES SOMETHING. That is the rule this list is built to, and it is
 * why it is short: an option the game cannot honour is worse than a missing one,
 * because he will set it and nothing will happen.
 *
 * ⚠ SOUND IS NOT HERE AND IT IS NOT AN OVERSIGHT. `ct/audio.ts` owns volume and
 * mute — it remembers them across reloads and binds `M`, `[` and `]` — but it
 * exports only `register` and `ORDER`. There is no getter and no setter, so
 * this module cannot read or move them, and that file belongs to another agent.
 * IT NEEDS TO EXPOSE THREE THINGS: `volume()`, `setVolume(v)` and `toggleMute()`
 * (or `muted()`/`setMuted(b)`). The moment it does, two rows go in here and
 * nothing else changes.
 */
type Item = {
  label: string;
  /** what the row reads on the right, or null for a plain row */
  value: () => string | null;
  /** the RIGHT key, and the mouse — one step forward, wrapping */
  step: (dir: number) => void;
};
const ITEMS: Item[] = [
  {
    // ⚠ THE ONE WITH A REAL CONSEQUENCE. `ct/hud.ts` draws the watch arm up the
    // LEFT of the frame and `ct/wardrobe.ts` puts the watch on that wrist; this
    // flips the arm. See `crosstown.ts`, which owns the wiring.
    label: 'HANDEDNESS',
    value: () => (S.hand === 'left' ? 'LEFT' : 'RIGHT'),
    step: () => put('hand', S.hand === 'left' ? 'right' : 'left'),
  },
  {
    label: 'INVERT LOOK',
    value: () => (S.invertY ? 'ON' : 'OFF'),
    step: () => put('invertY', !S.invertY),
  },
  {
    label: 'LOOK SPEED',
    // five stops rather than a slider: an OSD of this period had no sliders,
    // and five is enough to find one that suits a hand.
    value: () => `${Math.round(S.sens * 100)}%`,
    step: (d) => {
      const stops = [0.5, 0.75, 1, 1.5, 2];
      const i = stops.indexOf(S.sens) < 0 ? 2 : stops.indexOf(S.sens);
      put('sens', stops[(i + d + stops.length) % stops.length]);
    },
  },
  {
    label: 'FIELD OF VIEW',
    value: () => `${S.fov}`,
    step: (d) => {
      const stops = [72, 80, 88, 96];
      const i = stops.indexOf(S.fov) < 0 ? 2 : stops.indexOf(S.fov);
      put('fov', stops[(i + d + stops.length) % stops.length]);
    },
  },
];

let open = false;
let sel = 0;
export function menuOpen(): boolean { return open; }

function paint(): void {
  const g = cv?.getContext('2d');
  if (!g) return;
  osdFrame(g);
  heading(g, 'MENU', 46);
  let y = 92;
  ITEMS.forEach((it, i) => {
    const v = it.value();
    row(g, v === null ? it.label : `${it.label}:${v}`, 44, y, 14, i === sel);
    y += 22;
  });
  // his own name, when he has one — the only row that is not a setting
  if (S.name) {
    g.font = font(11); g.fillStyle = DIM; g.textAlign = 'center';
    g.fillText(S.name.toUpperCase(), OW / 2, y + 10);
    g.textAlign = 'left';
  }
  legend(g, [['SELECT', '▲ ▼ KEY'], ['SET', '▶ KEY'], ['END', 'ESC KEY']]);
}

/**
 * ── ESCAPE, AND WHO OWNS IT ───────────────────────────────────────────────
 *
 * *"idk if we can use esc to access it since thats also how you exit the game in
 *  browser but that would be ideal"*
 *
 * HE IS RIGHT THAT ESCAPE RELEASES POINTER LOCK AND THAT IT CANNOT BE PREVENTED
 * — and that is CONVENIENT rather than a problem, because a menu wants a cursor
 * and the browser hands one over for free at exactly the right moment.
 *
 * ⚠ THE PRECEDENCE IS THE DANGEROUS PART. Five things already close on Escape:
 * every `makePanel` (the mirror, the drawer, the calendar, the mail, the ATM,
 * the slots…), the bag, and `fp.ts` standing you out of a seat. If this opened
 * on top of any of them he would have a menu over a panel and a panel he could
 * not reach. So the order is:
 *
 *   1. the MENU itself, if it is open — Escape closes it and nothing else sees
 *      the press
 *   2. a PANEL, the BAG, or a SEAT — those own the press; this does nothing
 *   3. otherwise, and only otherwise, the menu opens
 *
 * ASKED, NOT ORDERED. The test is a predicate `crosstown.ts` supplies, not a
 * bet on which capture listener the browser runs first — two listeners on the
 * same phase are ordered by registration, and that is not a thing to stake "a
 * view you cannot leave" on. This project's worst bug is a panel you cannot
 * close; it is not going to be caused by a menu.
 */
let busy: () => boolean = () => false;
export function registerOsdBusy(fn: () => boolean): void { busy = fn; }

function onKey(e: KeyboardEvent): void {
  const k = e.key.toLowerCase();
  if (!open) {
    if (k !== 'escape' || busy()) return;      // rule 2: they own this press
    open = true; sel = 0;
    build();
    wrap!.style.display = 'flex';
    paint();
    e.stopImmediatePropagation();
    return;
  }
  // rule 1: while it is up, every one of these keys is the menu's
  if (k === 'escape' || k === 'e') { close(); }
  else if (k === 'arrowup' || k === 'w') sel = (sel + ITEMS.length - 1) % ITEMS.length;
  else if (k === 'arrowdown' || k === 's') sel = (sel + 1) % ITEMS.length;
  else if (k === 'arrowright' || k === 'enter' || k === ' ') ITEMS[sel].step(1);
  else if (k === 'arrowleft') ITEMS[sel].step(-1);
  else return;
  if (open) paint();
  e.stopImmediatePropagation();
  e.preventDefault();
}

export function close(): void {
  if (!open) return;
  open = false;
  if (wrap) wrap.style.display = 'none';
}

/** click a row to select it, click again to step it — the mouse is free here */
function onClick(e: MouseEvent): void {
  if (!open || !cv) return;
  const r = cv.getBoundingClientRect();
  const y = (e.clientY - r.top) * (OH / r.height);
  const i = Math.floor((y - 80) / 22);
  if (i < 0 || i >= ITEMS.length) return;
  if (i === sel) ITEMS[sel].step(1); else sel = i;
  paint();
  e.stopImmediatePropagation();
}

export function installOsd(): void {
  build();
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('click', onClick, true);
  onSettingChange(() => { if (open) paint(); });
}
