// ══ CHARACTER CREATION ═════════════════════════════════════════════════════
//
// *"new game should put me into character create menu no? what happened to
//  character create?"*   (2026-08-05)
//
// It was specified and never built. NEW GAME cleared the save and reloaded you
// straight into the flat as whoever the defaults say you are.
//
// ── IT IS THE SAME MACHINE AS THE MENU ────────────────────────────────────
//
// This is NOT a second full-screen surface. `ct/osd.ts` earned the one exception
// to *"nothing drawn over the world"* by being a television's own OSD, and this
// screen is that same television before the tape starts: the same 320x240
// nearest-filtered canvas, the same blue field, the same inverse-video cursor,
// the same dashed heading, the same legend at the foot, and the same 200 ms of
// static coming in. Every primitive below is IMPORTED from that file — there is
// one OSD renderer in this project and this is not it.
//
// ── AND ONE WARDROBE ──────────────────────────────────────────────────────
//
// `ct/wardrobe.ts` is the single source of what he has on and `ct/mirror.ts`
// already paints him from it at eight facings with per-part foreshortening. So
// this screen owns NO model and NO painter: it cycles the same slots the mirror
// cycles and calls the same `paintFigure`. Dress yourself here, walk to the
// glass in 301, and it is the same person — because it is the same two modules.
//
// ⚠ WHY THIS IS ITS OWN FILE AND NOT PART OF `ct/osd.ts`. That module documents
// itself as a NEAR-LEAF — audio and nothing else — precisely so it cannot close
// an import cycle (GOTCHAS §28: dev looks perfect and the built artifact has no
// menu in it). Painting the doll needs `ct/mirror.ts`, which pulls THREE and
// `ct/hud.ts` behind it. Putting that inside the OSD would throw away the one
// property that file was built to have. So the arrow points THIS way — create
// imports osd, osd never imports create — and the handshake between them is a
// flag in `localStorage`, not a function call.
import {
  OW, OH, FIELD, INK, DIM,
  osdFrame, row, heading, legend, font, snow, rollBar,
  setting, setName, setHand, registerOsdBusy,
} from './osd';
import { paintFigure } from './mirror';
import { SLOTS, SLOT_NAME, showing, cycle, type Slot } from './wardrobe';

/**
 * ── WHEN THIS RUNS, AND WHEN IT MUST NOT ──────────────────────────────────
 *
 * Three keys, and the order they are asked in is the whole rule:
 *
 *   `ct-create`   set by NEW GAME immediately before it reloads. This is the
 *                 handshake — it is how *"new game should put me into character
 *                 create"* is wired without `ct/osd.ts` importing this file.
 *                 Always wins, because he just asked for it.
 *   `ct-created`  you have made a character on this browser. Stops the screen
 *                 reappearing on every reload for somebody who left the name
 *                 blank, or who plays with storage that cannot hold a save.
 *   `ct-save`     `ct/save.ts`'s own LOCAL_KEY. A save present and no created
 *                 flag means a player from BEFORE this feature existed — they
 *                 have a character already, it is just one they never typed a
 *                 name into. They get the world, not a creation screen.
 *
 * ⚠ IT CANNOT OVERWRITE A GOOD SAVE and does not need a guard to manage it.
 * `ct/save.ts` holds `ready` false until a restore has been attempted, so the
 * `flush()` that `onWardrobeChange` fires while you are dressing here is a
 * no-op; and the only path that reaches this screen with a save present is the
 * one that has just deleted it.
 */
const PENDING = 'ct-create';
const CREATED = 'ct-created';
const SAVE_KEY = 'ct-save';

/** Every touch of storage is guarded — a sandboxed iframe can THROW on read
 *  rather than return null, and an exception here is a black page. */
function get(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function put(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* private mode */ }
}
function drop(k: string): void {
  try { localStorage.removeItem(k); } catch { /* private mode */ }
}

function wanted(): boolean {
  if (get(PENDING) === '1') return true;         // NEW GAME asked for it
  if (get(CREATED) === '1') return false;        // already made one here
  if (get(SAVE_KEY) !== null) return false;      // a player from before this
  return true;                                   // genuinely nobody yet
}

// ── THE SCREEN ─────────────────────────────────────────────────────────────

let wrap: HTMLDivElement | null = null;
let cv: HTMLCanvasElement | null = null;
let active = false;
/** which way he is standing, 0…7 — `viewAt`'s own eight stops, the same ones
 *  the mirror scrolls through, so he never lands between two painted angles. */
let facing = 0;
let sel = 0;
let name = '';

/** the OSD is not allowed to open on top of this. Asked as a predicate, never
 *  raced as a listener — `ct/osd.ts` argues this out at `registerOsdBusy`. */
export function creating(): boolean { return active; }

/**
 * A ROW. `NAME` types, `HAND` toggles, the seven wardrobe slots cycle through
 * `ct/wardrobe.ts`'s own racks, and `BEGIN` leaves. Nothing here holds a value
 * of its own except the name — every other row is a live read of the module
 * that actually owns the thing, which is why the doll can never disagree with
 * the list beside it.
 */
type Line = { text: () => string; step: (d: number) => void };

const LINES: Line[] = [
  {
    text: () => `NAME:${name}${sel === 0 ? '_' : ''}`,
    // stepping the name row does nothing — you type into it. Left/Right here
    // deliberately no-ops rather than doing something surprising.
    step: () => { /* typed, not stepped */ },
  },
  {
    // offered here as well as in the menu so a new player sets it ONCE, and it
    // is the same setting either way — one `ct-settings` entry, not two.
    text: () => `HAND:${setting('hand') === 'left' ? 'LEFT' : 'RIGHT'}`,
    step: () => setHand(setting('hand') === 'left' ? 'right' : 'left'),
  },
  ...SLOTS.map((s: Slot): Line => ({
    // `showing`, not `worn`: while a dress is on it claims the bottom slot, and
    // the list has to say what is actually on him or it contradicts the doll.
    text: () => `${SLOT_NAME[s]}:${showing(s).name}`,
    step: (d) => cycle(s, d),
  })),
  {
    text: () => 'BEGIN',
    step: () => finish(),
  },
];

/**
 * TEN ROWS AND A FOUR-LINE LEGEND IN 240 TEXELS, which is the whole of the
 * layout arithmetic and it is tight enough to be worth writing down: the legend
 * anchors to the FOOT (`OH - 8` upwards, 14 apart), so four lines start at 190
 * and the last row's inverse block — which runs to `y + 5` — must finish above
 * the top of its glyphs at 179. `42 + 9*14 = 168`, block to 173, six clear.
 * `BEGIN` was sitting on `SELECT` before this.
 */
const ROW_Y = 42, ROW_H = 14, ROW_PX = 11, ROW_X = 16;
/** the doll, sized to stand clear of the legend and the longest garment name */
const DOLL_X = 222, DOLL_Y = 34, DOLL_S = 1.2;

function paintCreate(g: CanvasRenderingContext2D): void {
  osdFrame(g);
  heading(g, 'CHARACTER', 26);
  let y = ROW_Y;
  LINES.forEach((l, i) => {
    row(g, l.text(), ROW_X, y, ROW_PX, i === sel);
    y += ROW_H;
  });
  // HIM, PAINTED BY THE MIRROR'S OWN PAINTER — see the header. Undimmed: the
  // room's light is the mirror panel's business, and this is not a room.
  paintFigure(g, DOLL_X, DOLL_Y, DOLL_S, facing);
  legend(g, [
    ['SELECT', '▲ ▼ KEY'],
    ['SET', '◀ ▶ KEY'],
    ['TURN', 'SCROLL'],
    ['START', 'ENTER KEY'],
  ]);
}

/** the set finding sync, exactly as the menu does it — `ct/osd.ts`'s FUZZ_MS */
const FUZZ_MS = 200;
let fuzzT = 0;

function paint(): void {
  const g = cv?.getContext('2d');
  if (!g || !active) return;
  if (fuzzT > 0) {
    const k = Math.min(1, (performance.now() - fuzzT) / FUZZ_MS);
    if (k >= 1) { fuzzT = 0; } else {
      if (k > 0.55) paintCreate(g);
      else { g.fillStyle = '#0b0b12'; g.fillRect(0, 0, OW, OH); }
      snow(g, k < 0.55 ? 0.55 : 0.34 * (1 - k) / 0.45);
      if (k < 0.7) rollBar(g, k);
      requestAnimationFrame(paint);
      return;
    }
  }
  paintCreate(g);
}

function build(): void {
  if (wrap) return;
  wrap = document.createElement('div');
  wrap.id = 'ct-create';
  // z 45: above the OSD's own 40. Nothing may be in front of this while it is
  // up, because it is the only thing on screen that is being asked a question.
  wrap.style.cssText = 'position:fixed;inset:0;z-index:45;display:none;'
    + 'background:#000;align-items:center;justify-content:center;';
  cv = document.createElement('canvas');
  cv.width = OW; cv.height = OH;
  cv.style.cssText = 'image-rendering:pixelated;display:block;'
    + 'width:min(100vw,133vh);height:min(75vw,100vh);';
  wrap.appendChild(cv);
  document.body.appendChild(wrap);
}

/**
 * ── LEAVING, AND WHY ESCAPE IS ONE OF THE WAYS ────────────────────────────
 *
 * **ESCAPE FINISHES AND DROPS YOU INTO THE WORLD.** That is the choice, and it
 * is made against this project's worst bug: *"a panel you cannot close"*. The
 * alternatives were both worse. Escape doing NOTHING leaves a full-screen field
 * with one way out, and if `BEGIN` ever fails to draw or the list ever scrolls
 * he is stuck in front of the game he opened. Escape CANCELLING has nothing to
 * cancel back to — there is no world behind this that he was in a moment ago.
 *
 * And it costs nothing, because **there is no invalid character**. The white
 * vest and the white briefs are what an empty slot IS (`ct/wardrobe.ts`), so
 * every state this screen can be in is a dressed person; and a blank name is a
 * blank name, which the menu simply does not print. Escaping out of creation
 * gives you the defaults, which is precisely what NEW GAME gave you yesterday.
 */
function finish(): void {
  if (!active) return;
  active = false;
  setName(name.trim());
  put(CREATED, '1');
  drop(PENDING);
  if (wrap) wrap.style.display = 'none';
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('wheel', onWheel, true);
  window.removeEventListener('click', onClick, true);
}

/** letters, digits, space, `_` and `-`, up to 20 — the same shape `ct/save.ts`
 *  accepts for a username, so a name typed here can never be one the server
 *  would refuse. */
const NAME_CH = /^[A-Za-z0-9 _-]$/;
const NAME_MAX = 20;

function onKey(e: KeyboardEvent): void {
  if (!active) return;
  const k = e.key.toLowerCase();
  if (k === 'escape' || k === 'enter') {
    // Enter on any row but BEGIN steps it; Enter on BEGIN, and Escape from
    // anywhere, leaves. See `finish`.
    if (k === 'escape' || sel === LINES.length - 1) { finish(); }
    else if (sel !== 0) LINES[sel].step(1);
    else sel = Math.min(sel + 1, LINES.length - 1);
  } else if (k === 'arrowup') sel = (sel + LINES.length - 1) % LINES.length;
  else if (k === 'arrowdown') sel = (sel + 1) % LINES.length;
  else if (k === 'arrowright') LINES[sel].step(1);
  else if (k === 'arrowleft') LINES[sel].step(-1);
  else if (k === 'backspace') { sel = 0; name = name.slice(0, -1); }
  else if (e.key.length === 1 && NAME_CH.test(e.key)) {
    // ⚠ NO `W`/`S` ALIASES ON THIS SCREEN, and typing anywhere jumps to the
    // name. The menu can afford WASD because nothing there takes text; here a
    // `w` has to be a `w`. And a player who selects a garment row and starts
    // typing his name — which is the first thing anyone does — must see letters
    // appear rather than nothing at all, so the row follows the typing.
    sel = 0;
    if (name.length < NAME_MAX) name += e.key;
  } else return;
  // ⚠ CAPTURE PHASE AND `stopImmediatePropagation`, and it is load-bearing:
  // `src/main.ts` switches PROTO on `z`, `x` and any digit, and `fp.ts` walks
  // on WASD. Without this, typing "Max" would leave CROSSTOWN entirely.
  e.stopImmediatePropagation();
  e.preventDefault();
  if (active) paint();
}

/** *"scroll to turn self in mirror?"* — the same eight stops, here too */
function onWheel(e: WheelEvent): void {
  if (!active) return;
  facing = (facing + (e.deltaY > 0 ? 1 : -1) + 8) % 8;
  e.stopImmediatePropagation();
  e.preventDefault();
  paint();
}

/** click a row to select it, click it again to step it — the OSD's own gesture,
 *  and the cursor is free here because nothing has taken pointer lock yet */
function onClick(e: MouseEvent): void {
  if (!active || !cv) return;
  const r = cv.getBoundingClientRect();
  const y = (e.clientY - r.top) * (OH / r.height);
  const i = Math.floor((y - (ROW_Y - ROW_PX)) / ROW_H);
  e.stopImmediatePropagation();
  e.preventDefault();
  if (i < 0 || i >= LINES.length) return;
  if (i === sel) LINES[sel].step(1); else sel = i;
  if (active) paint();
}

function start(): void {
  if (active) return;
  build();
  active = true;
  sel = 0; facing = 0;
  name = setting('name') || '';
  wrap!.style.display = 'flex';
  fuzzT = performance.now();
  // capture, so this sees every key before the world, the proto switcher and
  // the OSD do — and `registerOsdBusy` below covers the one case ordering
  // cannot: a listener registered before this one.
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('wheel', onWheel, { capture: true, passive: false });
  window.addEventListener('click', onClick, true);
  paint();
}

/**
 * Called from `crosstown.ts` beside `installOsd()`.
 *
 * THE WORLD IS ALREADY BUILT AND RUNNING BEHIND THIS, deliberately. Gating the
 * first frame on a creation screen would mean editing the trunk's build order
 * for a screen that is up for twenty seconds once — and it would put a black
 * page behind anything that went wrong in here. A blue field over a live world
 * is the same trick the menu already plays.
 */
export function installCreate(): void {
  registerOsdBusy(creating);
  if (wanted()) start();
}

// a hook for a probe, and for getting back in without clearing storage by hand
(window as unknown as { __create: unknown }).__create = {
  start, finish, active: () => active,
  reset: () => { drop(CREATED); drop(PENDING); },
};
