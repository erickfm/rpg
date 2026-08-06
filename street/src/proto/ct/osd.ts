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
// A NEAR-LEAF MODULE. It imports `ct/audio.ts` and nothing else from the world,
// so it cannot close an import cycle (GOTCHAS §28) — audio imports nothing back.
// `crosstown.ts` registers the few things this cannot see for itself.
import { volume, setVolume, toggleMute, isMuted, VOLUME_STEP } from './audio';

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
/** the world's own save, so NEW GAME can clear it. `ct/save.ts`'s own key. */
const SAVE_KEY = 'ct-save';
let confirming = false;
let confirmSel = 0;
export interface Settings {
  /** which wrist the watch is on, and which hand the world assumes */
  hand: 'left' | 'right';
  /** mouse sensitivity, as a multiplier on the rig's own 0.0022 */
  sens: number;
  /** the name he gave himself at character creation */
  name: string;
}
// ⚠ `invertY` AND `fov` ARE GONE FROM THIS LIST — *"i dont like selecting fov
// from menu, idc about invert look"*. An old stored value for either is simply
// ignored: the spread below only takes keys this interface declares.
const DEFAULTS: Settings = { hand: 'left', sens: 1, name: '' };
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

/**
 * ══ THE SET SWITCHING TO ITS MENU ═════════════════════════════════════════
 *
 * *"also lets make it so theres like a fuzz transition into the tv menu pls"*
 *   (2026-08-05)
 *
 * A CRT does not cut cleanly to its OSD — it drops the signal, snows for a
 * moment, and the menu comes up out of it. That is the sound of the whole
 * conceit: this surface is allowed to be full-screen because it IS a
 * television, so it should arrive like one.
 *
 * THREE STAGES OVER 200 ms, none of them a fade:
 *   0.00-0.55   SNOW. Hard black-and-white texels, redrawn every frame, plus a
 *               couple of bright rolling bars — the horizontal tear a set makes
 *               while it is hunting for sync.
 *   0.55-0.80   the blue field arrives UNDER the snow, which thins.
 *   0.80-1.00   the menu paints, with a last few specks over it.
 *
 * TEXELS, NOT NOISE FUNCTIONS. The canvas is 320x240 and nearest-filtered, so
 * `fillRect(x, y, 1, 1)` at random is already the right grain — the same reason
 * every glow and every dither in this project is drawn rather than shaded. No
 * gradient, no alpha ramp, no blur.
 *
 * IT IS NOT A GATE. The menu is fully interactive from the first frame: the
 * fuzz is painted OVER a live screen, `sel` is already 0, and a keypress during
 * it works and repaints normally. A transition that eats input is a transition
 * that gets pressed twice.
 */
const FUZZ_MS = 200;
let fuzzT = 0;                       // 0 = no transition running
function snow(g: CanvasRenderingContext2D, density: number): void {
  const n = Math.round(OW * OH * density);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(Math.random() * OW), y = Math.floor(Math.random() * OH);
    const v = Math.random();
    g.fillStyle = v > 0.72 ? '#ffffff' : v > 0.4 ? '#9a9ab4' : '#101018';
    g.fillRect(x, y, 1, 1);
  }
}
/** the bright bar a set tears on while it hunts for sync */
function rollBar(g: CanvasRenderingContext2D, t: number): void {
  const y = Math.round(((t * 2.4) % 1) * (OH + 40)) - 20;
  g.fillStyle = 'rgba(255,255,255,0.30)';
  g.fillRect(0, y, OW, 6);
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(0, y + 6, OW, 10);
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
 * SOUND IS HERE AND IT IS LIVE, off `ct/audio.ts`'s own exports — see the
 * VOLUME row for why it briefly was not.
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
    // mirrors the arm as a set — anchor, pivot and tilt. See `setHanded`.
    label: 'HANDEDNESS',
    value: () => (S.hand === 'left' ? 'LEFT' : 'RIGHT'),
    step: () => put('hand', S.hand === 'left' ? 'right' : 'left'),
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
    /**
     * ── SOUND, LIVE ──────────────────────────────────────────────────────
     *
     * *"i would like sound settings to be part of this"*
     *
     * ⚠ THESE WERE STUBS UNTIL 2026-08-05 AND THE REASON IS WORTH KEEPING. I
     * had them reading and writing `localStorage['ct.audio']` directly, because
     * `ct/audio.ts` appeared to expose nothing — and it turned out the exports
     * were there and DEAD: `crosstown.ts` was throwing at `rig.look2` before
     * `register()` ever ran, so that module's handle stayed null and every
     * setter was a silent no-op. The same crash `580042a6` fixed had this second,
     * quieter symptom, and I diagnosed the symptom instead of the crash. The
     * lesson is the crash's, not the API's: a fatal at load makes everything
     * downstream of it look like it was never built.
     *
     * ONE PATH NOW. `M`, `[`, `]`, the corner widget and these two rows all go
     * through the same four functions, so a change here persists exactly as a
     * keypress does and the widget agrees with the menu.
     *
     * ⚠ READ EVERY PAINT, NEVER CACHED — its own instruction, and it is what
     * stops the menu showing a stale number after he presses `M` with the menu
     * open. `value()` runs on each repaint and asks.
     */
    label: 'VOLUME',
    value: () => (isMuted() ? '--' : `${Math.round(volume() * 100)}%`),
    // VOLUME_STEP is the stride the keys use and the widget's eight blocks are
    // drawn from, so the menu moves by exactly one block per press.
    step: (d) => setVolume(volume() + d * VOLUME_STEP),
  },
  {
    label: 'MUTE',
    value: () => (isMuted() ? 'ON' : 'OFF'),
    step: () => toggleMute(),
  },
  {
    /**
     * ── NEW GAME, AND IT ASKS FIRST ──────────────────────────────────────
     *
     * *"i also would like to be able to start a new game, make sure new game
     *  has a confirm dialog"*
     *
     * THE CONFIRM IS A SECOND OSD SCREEN, not a browser `confirm()` — the point
     * of this whole surface is that the television owns its own dialogs, and a
     * native alert box would be the one thing on screen that is not 1997.
     *
     * IT DEFAULTS TO NO. The cursor starts on the row that does nothing, so the
     * dangerous answer needs a deliberate press rather than a reflex Enter.
     */
    label: 'NEW GAME',
    value: () => null,
    step: () => { confirming = true; confirmSel = 0; },
  },
];

let open = false;
let sel = 0;
export function menuOpen(): boolean { return open; }

function paintConfirm(g: CanvasRenderingContext2D): void {
  osdFrame(g);
  heading(g, 'NEW GAME', 60);
  g.font = font(12); g.fillStyle = INK;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('THIS ERASES YOUR SAVED GAME.', OW / 2, 104);
  g.fillText('THIS CANNOT BE UNDONE.', OW / 2, 122);
  g.textAlign = 'left';
  row(g, 'NO  — KEEP PLAYING', 96, 158, 14, confirmSel === 0);
  row(g, 'YES — START OVER', 96, 182, 14, confirmSel === 1);
  legend(g, [['SELECT', '▲ ▼ KEY'], ['SET', '▶ KEY'], ['END', 'ESC KEY']]);
}

function paint(): void {
  const g = cv?.getContext('2d');
  if (!g) return;
  // ⚠ THE FUZZ IS PAINTED OVER THE REAL SCREEN, never instead of it — see
  // `FUZZ_MS`. The menu below is drawn first at every stage past the snow, so
  // the thing arriving out of the static is the live one.
  if (fuzzT > 0) {
    const k = Math.min(1, (performance.now() - fuzzT) / FUZZ_MS);
    if (k >= 1) { fuzzT = 0; } else {
      if (k > 0.55) { if (confirming) paintConfirm(g); else paintMenu(g); }
      else { g.fillStyle = '#0b0b12'; g.fillRect(0, 0, OW, OH); }
      snow(g, k < 0.55 ? 0.55 : 0.34 * (1 - k) / 0.45);
      if (k < 0.7) rollBar(g, k);
      requestAnimationFrame(paint);
      return;
    }
  }
  if (confirming) { paintConfirm(g); return; }
  paintMenu(g);
}

function paintMenu(g: CanvasRenderingContext2D): void {
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
    fuzzT = performance.now();          // the set hunting for sync — see FUZZ_MS
    paint();
    e.stopImmediatePropagation();
    return;
  }
  // ── THE CONFIRM OWNS EVERY KEY WHILE IT IS UP ─────────────────────────
  // Escape backs out of it rather than out of the menu, which is the safe
  // direction: the one press he is most likely to make in a panic is the one
  // that does not erase anything.
  if (confirming) {
    if (k === 'escape') confirming = false;
    else if (k === 'arrowup' || k === 'arrowdown' || k === 'w' || k === 's') {
      confirmSel = confirmSel === 0 ? 1 : 0;
    } else if (k === 'arrowright' || k === 'enter' || k === ' ') {
      if (confirmSel === 1) { newGame(); return; }
      confirming = false;
    } else return;
    paint();
    e.stopImmediatePropagation();
    e.preventDefault();
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

/**
 * ── STARTING OVER ─────────────────────────────────────────────────────────
 *
 * The world's save is `localStorage['ct-save']` (`ct/save.ts`'s LOCAL_KEY), so
 * clearing that key and reloading IS a new game — every slice rebuilds from its
 * own defaults and nothing here has to know what any of them contain.
 *
 * ⚠ SETTINGS SURVIVE IT, deliberately. Handedness and look speed are facts
 * about the PERSON AND THE MACHINE, not about the character — the same reason
 * they are not in the save in the first place. Starting a new life should not
 * put the watch back on the other wrist. The audio preference survives for the
 * same reason.
 */
function newGame(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
  location.reload();
}

export function close(): void {
  if (!open) return;
  open = false;
  confirming = false;
  if (wrap) wrap.style.display = 'none';
}

/** click a row to select it, click again to step it — the mouse is free here */
function onClick(e: MouseEvent): void {
  if (!open || !cv || confirming) return;      // the confirm is keyboard-only
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
