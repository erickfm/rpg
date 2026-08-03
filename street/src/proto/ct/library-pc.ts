import { BUILD, ORDER as HOOK } from './ctx';
import type { CtxBuild } from './ctx';
import type { Panel } from './hud';
// TYPE-ONLY, and that is load-bearing rather than tidy. `ct/slots.ts` takes a
// RUNTIME edge on `three` (it has to — it builds a plane of its own) and paid
// for it: any static or dynamic edge on `three` reorders the bundle's module
// graph enough to shift the `generateUUID` stream `scripts/scenedump.mjs`
// seeds, so every dithered texture built after the shift repaints and
// `npm run fpdiff` reports a catastrophe that is not there (w55, and GOTCHAS
// §1/§2 behind it). This file builds NO geometry — it repaints a plane
// `ct/int-library.ts` already put in the room — so it needs three's TYPES and
// none of its code, and `import type` is erased before the bundler ever sees
// it. That is what keeps `fp` a usable proof for this change.
import type * as THREE from 'three';

// ── THE LIBRARY TERMINALS, MADE TO ACTUALLY WORK ───────────────────────────
//
// Queue item 4: *"A Windows-style PC you can actually use, opening when the
// player sits at a library machine … two or three apps that genuinely work
// beat ten stubs — the library catalogue searching real books is the best
// fit, plus a real game."*
//
// This is the same bridge shape as `ct/slots.ts` and `ct/blackjack.ts`: a
// module that builds no geometry and owns no room, registered only through
// `world.ts`'s auto-incorporation, that opens a panel the instant the player
// sits in a seat carrying one particular label. `ct/int-library.ts` already
// builds the terminals, the chairs and the CRTs (E's room) — this file never
// draws or moves any part of them, exactly as `ct/atm.ts` never touches A's
// cabinet.
//
// ── the join, and why it does not work yet ─────────────────────────────────
//
// Every terminal chair in the library currently registers
// `label: 'sit at the terminal'` (`int-library.ts:1261`). Queue item 3 asks
// for that string to become **exactly** `'sit at the computer'`, and item 4
// (this file) is written to join on the NEW string — the desk split it this
// way on purpose so item 4 does not have to touch `int-library.ts` at all.
// Until item 3 lands, sitting at a terminal does nothing new: no seat in the
// world carries this label yet, the same "not wired" state `blackjack.ts`
// documented while it waited on its own seats. `window.__librarypc.open()`
// works the whole time, for anyone testing this file on its own.
export const SEAT_LABEL = 'sit at the computer';

export const ORDER = BUILD.INTERIOR + 7;   // after slots (+5), after blackjack (+6)

// same pattern as blackjack.ts's seatedAtTable() / slots.ts's seatedSlot():
// ask the world (through the same window bridge every script uses) whether
// the pose the player is CURRENTLY sitting in is one that carries our label,
// rather than keeping a second, private notion of "sat down" that could
// disagree with the one the framework already tracks.
interface SeatPose { x: number; z: number; yaw: number }
interface SeatRow { pose: SeatPose; label: string }
interface CtWindow { __ct?: { seated: () => SeatPose | null; seats: () => SeatRow[] } }
function seatedAtComputer(): SeatPose | null {
  const ct = (globalThis as unknown as CtWindow).__ct;
  if (!ct) return null;
  const pose = ct.seated();
  if (!pose) return null;
  return ct.seats().find((s) => s.pose === pose)?.label === SEAT_LABEL ? pose : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// WHICH CRT AM I SITTING AT?
// ═══════════════════════════════════════════════════════════════════════════
//
// ASKED OF THE WORLD, NOT LOOKED UP — the same rule `ct/atm.ts` follows with a
// `userData` tag and `ct/slots.ts` follows with a ray. Nothing from
// `ct/int-library.ts` is copied here: not `BX`, not `BZ0`, not `TERM_CX`, not
// the 1.05 m pitch of the bank. The chair's own pose is the origin, the way it
// faces is the direction, and the answer is whatever plane is in front of it.
// That stays true if the bank of terminals is re-laid, which is exactly what
// the second-authoring rule in BUILDER-BRIEF §8 is about.
//
// MEASURED BEFORE IT WAS WRITTEN (`scripts/probes/w63-pc-mesh.mjs`, against
// the running world): each chair has exactly ONE PlaneGeometry directly ahead
// of it — 0.30 x 0.24 m, at 1.02 m, side offset 0.000 — carrying ONE
// `MeshBasicMaterial` with a map. The neighbouring terminals' screens are the
// same plane at side ±1.05, and the reader sitting at the third machine is a
// 0.95 x 1.9 billboard at side +1.05 wearing `userData.citizen`. So the gates
// below are not guesses: 0.35 m of side is a quarter of the real pitch, and
// the citizen test is there because a ray or a sweep that finds a person hangs
// the interface on their back.
const REACH = 1.6;        // m ahead of the chair. The screen measures at 1.02.
const HALF_LANE = 0.35;   // m to either side. The terminals stand 1.05 apart.

/**
 * The terminal screen this chair faces, or `null`.
 *
 * `null` is a first-class answer, not a failure: `ScreenSurface.mesh`'s
 * contract is that a surface which cannot be found falls back to the
 * screen-space cabinet, so a harness that opens this machine from the street
 * gets the panel it would have got anyway. That degrade is what made the
 * framework safe to adopt twice already.
 */
function crtAhead(scene: THREE.Scene, seat: SeatPose, gy: number): THREE.Object3D | null {
  // rig convention, fp.ts:477 — fwd = (sin yaw, 0, -cos yaw). Read off the same
  // line `crosstown.ts`'s own focus controller cites, not re-derived.
  const fx = Math.sin(seat.yaw), fz = -Math.cos(seat.yaw);
  let best: THREE.Object3D | null = null;
  let bestAhead = Infinity;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (o.userData?.citizen) return;                       // a person is not a screen
    if ((m.geometry as { type?: string })?.type !== 'PlaneGeometry') return;
    // A MULTI-MATERIAL MESH WOULD THROW, so decline it and take the fallback.
    // `ct/hud.ts:1059` casts `mesh.material` to a single `MeshBasicMaterial`
    // and calls `.color.getHex()` on it a few lines later; on an array that is
    // `undefined.getHex()`, INSIDE `open()`, with the gate half-installed — it
    // presents as "the panel stopped opening". w55 filed it as item 150 and it
    // is still open. This tenant does not trip it (measured: one material), but
    // declining is one line and turns a future throw into a worse-looking panel
    // rather than a broken one.
    if (Array.isArray(m.material)) return;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements;
    const dx = e[12] - seat.x, dz = e[14] - seat.z;
    const ahead = dx * fx + dz * fz;
    const side = dx * fz - dz * fx;
    if (ahead <= 0.1 || ahead > REACH) return;
    if (Math.abs(side) > HALF_LANE) return;
    // and it is on a DESK, not on the floor or up a wall
    if (e[13] < gy + 0.4 || e[13] > gy + 1.8) return;
    if (ahead < bestAhead) { bestAhead = ahead; best = o; }
  });
  return best;
}

// ═══════════════════════════════════════════════════════════════════════════
// APP 1 — THE CARD CATALOG
// ═══════════════════════════════════════════════════════════════════════════
//
// A real search over real books, not a lorem-ipsum list. Thirty public-domain
// titles any 1997 branch library would actually own, typed in by hand rather
// than generated — there is nowhere else in this tree that already has a list
// of book titles to derive this from (`int-library.ts`'s shelves are painted
// texture, not discrete data — see the note on `shelfTex` there), so this is
// original content, not a duplicate of something owned elsewhere.
interface BookRow { title: string; author: string; year: number; subject: string }
const CATALOG: BookRow[] = [
  { title: 'Moby-Dick', author: 'Herman Melville', year: 1851, subject: 'sea adventure' },
  { title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, subject: 'romance' },
  { title: 'Frankenstein', author: 'Mary Shelley', year: 1818, subject: 'horror' },
  { title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', year: 1892, subject: 'mystery' },
  { title: 'Dracula', author: 'Bram Stoker', year: 1897, subject: 'horror' },
  { title: 'The Time Machine', author: 'H. G. Wells', year: 1895, subject: 'science fiction' },
  { title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', year: 1865, subject: 'fantasy' },
  { title: 'A Tale of Two Cities', author: 'Charles Dickens', year: 1859, subject: 'historical' },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: 1925, subject: 'fiction' },
  { title: 'War and Peace', author: 'Leo Tolstoy', year: 1869, subject: 'historical' },
  { title: 'Little Women', author: 'Louisa May Alcott', year: 1868, subject: 'fiction' },
  { title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', year: 1890, subject: 'gothic' },
  { title: 'The Odyssey', author: 'Homer', year: -800, subject: 'epic poetry' },
  { title: 'Treasure Island', author: 'Robert Louis Stevenson', year: 1883, subject: 'sea adventure' },
  { title: 'The Call of the Wild', author: 'Jack London', year: 1903, subject: 'adventure' },
  { title: 'Wuthering Heights', author: 'Emily Bronte', year: 1847, subject: 'gothic' },
  { title: 'Jane Eyre', author: 'Charlotte Bronte', year: 1847, subject: 'romance' },
  { title: 'Robinson Crusoe', author: 'Daniel Defoe', year: 1719, subject: 'sea adventure' },
  { title: "Gulliver's Travels", author: 'Jonathan Swift', year: 1726, subject: 'satire' },
  { title: 'The Scarlet Letter', author: 'Nathaniel Hawthorne', year: 1850, subject: 'historical' },
  { title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', year: 1866, subject: 'fiction' },
  { title: 'Don Quixote', author: 'Miguel de Cervantes', year: 1605, subject: 'satire' },
  { title: 'Emma', author: 'Jane Austen', year: 1815, subject: 'romance' },
  { title: 'Great Expectations', author: 'Charles Dickens', year: 1861, subject: 'fiction' },
  { title: 'Heart of Darkness', author: 'Joseph Conrad', year: 1899, subject: 'adventure' },
  { title: 'The War of the Worlds', author: 'H. G. Wells', year: 1898, subject: 'science fiction' },
  { title: 'The Strange Case of Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson', year: 1886, subject: 'horror' },
  { title: 'Anna Karenina', author: 'Leo Tolstoy', year: 1877, subject: 'fiction' },
  { title: 'The Count of Monte Cristo', author: 'Alexandre Dumas', year: 1844, subject: 'adventure' },
  { title: 'Twenty Thousand Leagues Under the Sea', author: 'Jules Verne', year: 1870, subject: 'science fiction' },
];

// ── THE RECORD BEHIND THE ROW ─────────────────────────────────────────────
//
// Clicking a result pulls its card, which is what a card catalogue is FOR and
// what the mouse buys over the keyboard-only list. Both fields are DERIVED
// from the row rather than typed into a second table (BUILDER-BRIEF §8): the
// call number the way a branch actually shelves fiction — the first three
// letters of the author's surname — and the loan status from a hash of the
// title, so the same book says the same thing every time you open it and no
// draw from `ct/rng.ts`'s one seeded stream is disturbed (GOTCHAS §2).
function callNo(b: BookRow): string {
  const surname = b.author.trim().split(/\s+/).slice(-1)[0].toUpperCase();
  return `F ${surname.slice(0, 3)}`;
}
const STATUS = ['ON SHELF', 'ON SHELF', 'ON SHELF', 'ON LOAN', 'REFERENCE ONLY'];
function status(b: BookRow): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < b.title.length; i++) h = Math.imul(h ^ b.title.charCodeAt(i), 0x01000193) >>> 0;
  return STATUS[h % STATUS.length];
}

/** matches on title, author or subject — a card catalog answers all three */
function search(q: string): BookRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return CATALOG;
  return CATALOG.filter((b) =>
    b.title.toLowerCase().includes(needle)
    || b.author.toLowerCase().includes(needle)
    || b.subject.toLowerCase().includes(needle));
}

// ═══════════════════════════════════════════════════════════════════════════
// APP 2 — MINESWEEPER, A REAL GAME
// ═══════════════════════════════════════════════════════════════════════════
//
// Chosen over a slot-machine-style toy because the brief already has two
// gambling machines (`slots.ts`, `blackjack.ts`) and asked for something that
// reads as ON A COMPUTER — Minesweeper shipped on every Windows box this
// world is styled after. Keyboard-only, like everything else `hud.ts`
// offers: arrows move a cursor, space/enter digs, F flags, R starts over.
const MS_COLS = 11, MS_ROWS = 9, MS_MINES = 14;
type MsCell = { mine: boolean; adj: number; open: boolean; flag: boolean };
interface MsState {
  grid: MsCell[][];   // [row][col]
  cx: number; cz: number;    // cursor, in grid cells
  dead: boolean; won: boolean;
  firstClick: boolean;       // mines are laid out AFTER the first dig, never under it
}

function msBlank(): MsState {
  const grid: MsCell[][] = [];
  for (let r = 0; r < MS_ROWS; r++) {
    const row: MsCell[] = [];
    for (let c = 0; c < MS_COLS; c++) row.push({ mine: false, adj: 0, open: false, flag: false });
    grid.push(row);
  }
  return { grid, cx: 0, cz: 0, dead: false, won: false, firstClick: true };
}

/** Lay mines once the first cell is known, and never on it or its neighbours
 *  — the rule every real Minesweeper honours: the first dig is always safe. */
function msSeed(s: MsState, safeR: number, safeC: number): void {
  let placed = 0;
  while (placed < MS_MINES) {
    const r = Math.floor(Math.random() * MS_ROWS), c = Math.floor(Math.random() * MS_COLS);
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    const cell = s.grid[r][c];
    if (cell.mine) continue;
    cell.mine = true;
    placed++;
  }
  for (let r = 0; r < MS_ROWS; r++) for (let c = 0; c < MS_COLS; c++) {
    if (s.grid[r][c].mine) continue;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < MS_ROWS && cc >= 0 && cc < MS_COLS && s.grid[rr][cc].mine) n++;
    }
    s.grid[r][c].adj = n;
  }
}

/** flood-fill open, iterative (a recursive version on an 11x9 board is fine
 *  too, but a stack keeps this from ever being the file that blows one) */
function msOpen(s: MsState, r0: number, c0: number): void {
  const stack: [number, number][] = [[r0, c0]];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    const cell = s.grid[r][c];
    if (cell.open || cell.flag) continue;
    cell.open = true;
    if (cell.mine) { s.dead = true; continue; }
    if (cell.adj === 0) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < MS_ROWS && cc >= 0 && cc < MS_COLS && !s.grid[rr][cc].open) stack.push([rr, cc]);
      }
    }
  }
}

function msDig(s: MsState): void {
  if (s.dead || s.won) return;
  const { cx: c, cz: r } = s;
  if (s.grid[r][c].flag) return;
  if (s.firstClick) { msSeed(s, r, c); s.firstClick = false; }
  msOpen(s, r, c);
  msCheckWin(s);
}

function msFlag(s: MsState): void {
  if (s.dead || s.won || s.firstClick) return;   // nothing is laid out yet
  const cell = s.grid[s.cz][s.cx];
  if (!cell.open) cell.flag = !cell.flag;
}

/** won the moment every non-mine cell is open — flagging every mine is not
 *  required, matching the version most people actually remember playing */
function msCheckWin(s: MsState): void {
  for (const row of s.grid) for (const cell of row) {
    if (!cell.mine && !cell.open) return;
  }
  s.won = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE MACHINE — one screen, three faces
// ═══════════════════════════════════════════════════════════════════════════
// THE CANVAS IS CUT TO THE TUBE, NOT TO A WINDOW. The terminal's screen is a
// 0.30 x 0.24 m plane (`scripts/probes/w63-pc-mesh.mjs`, and `int-library.ts`
// draws it at that size), so its aspect is 1.25:1. The old 320 x 220 was
// 1.4545:1 — free for a rectangle floating in front of the camera and wrong the
// moment it lands on an object, where it is a 16% horizontal smear. 320 x 256
// is 1066.7 px/m along BOTH axes: square texels, which is BUILDER-BRIEF §7b's
// rule stated for a canvas. Only ONE of the two numbers is a choice — the
// width — and the height follows from the tube.
const W = 320, H = 256;
const TASKBAR_H = 18;

// ── EVERY CONTROL, DECLARED ONCE ──────────────────────────────────────────
//
// The painter and the hit test read the SAME rectangles, so a button cannot be
// drawn where a click does not land, or lit while pressing it does nothing.
// That is `ct/slots.ts`'s `DECK` lesson, and it is the only structural thing
// this file borrows from that tenant.
type Rect = { x: number; y: number; w: number; h: number };
const inRect = (r: Rect, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** the title-bar close box every window in this era has, top right */
const CLOSE: Rect = { x: W - 15, y: 3, w: 12, h: 10 };
/** the desktop's icons */
const ICON_G = { x: 14, y0: 20, dy: 48, w: 26, h: 20, labelDy: 32 };
const iconRect = (i: number): Rect =>
  ({ x: ICON_G.x - 6, y: ICON_G.y0 + i * ICON_G.dy - 6, w: ICON_G.w + 12, h: ICON_G.h + 26 });
/** the taskbar's START button */
const START: Rect = { x: 4, y: H - TASKBAR_H + 4, w: 44, h: 11 };
/** the catalogue */
const CAT = {
  field: { x: 6, y: 18, w: W - 50, h: 12 } as Rect,
  clear: { x: W - 42, y: 18, w: 36, h: 12 } as Rect,
  up: { x: W - 32, y: 36, w: 13, h: 11 } as Rect,
  down: { x: W - 17, y: 36, w: 13, h: 11 } as Rect,
  top: 50, rowH: 13, detailH: 22,
};
const CAT_ROWS = Math.floor((H - CAT.top - CAT.detailH - 2) / CAT.rowH);
const catRowRect = (i: number): Rect => ({ x: 6, y: CAT.top + i * CAT.rowH, w: W - 12, h: CAT.rowH });
/** minesweeper */
const MS_CELL = 22;
const MS_X0 = Math.round((W - MS_COLS * MS_CELL) / 2);
const MS_Y0 = 32;
const MS_FLAG_BTN: Rect = { x: 6, y: 17, w: 46, h: 12 };
const MS_NEW_BTN: Rect = { x: 56, y: 17, w: 34, h: 12 };
/** Not `UI.font` from `./hud` — see the note on the dynamic import of
 *  `makePanel` below. Plain `monospace`, the same fallback `blackjack.ts`
 *  and `slots.ts` draw their own screens in for the identical reason. */
const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${px}px monospace`;

type Screen = 'desktop' | 'catalog' | 'minesweeper';
const ICONS = [
  { key: 'catalog' as const, label: 'CARD CATALOG' },
  { key: 'minesweeper' as const, label: 'MINESWEEP' },
];

export function register(ctx: CtxBuild): void {
  let panel: Panel | null = null;
  let dismissed: object | null = null;
  let screen: Screen = 'desktop';
  let iconSel = 0;
  let query = '';
  let ms: MsState = msBlank();
  // THE MOUSE'S OWN STATE. None of it changes what the keyboard does; each is a
  // thing a pointer can express that a key already could (scroll, pick a
  // record) or that a pointer cannot express at all on this framework
  // (flagging — `ct/hud.ts` forwards a click as `(x, y)` with no button, so
  // there is no right-click to give minesweeper, and a mode toggle is the
  // affordance every touch port of this game settled on for the same reason).
  let catTop = 0;              // first visible result row
  let catSel = -1;             // which record the reader has pulled, -1 = none
  let msFlagMode = false;      // clicks plant flags instead of digging
  const clockNow = () => ctx.clock.now();

  const toDesktop = () => { screen = 'desktop'; panel?.repaint(); };
  /** keep the window on the selected row, and the selection inside the results */
  const catClamp = () => {
    const n = search(query).length;
    if (catSel >= n) catSel = n - 1;
    const maxTop = Math.max(0, n - CAT_ROWS);
    if (catTop > maxTop) catTop = maxTop;
    if (catSel >= 0) {
      if (catSel < catTop) catTop = catSel;
      if (catSel >= catTop + CAT_ROWS) catTop = catSel - CAT_ROWS + 1;
    }
    if (catTop < 0) catTop = 0;
  };
  const catScroll = (d: number) => {
    const n = search(query).length;
    catTop = Math.max(0, Math.min(Math.max(0, n - CAT_ROWS), catTop + d));
  };

  // ── DRAW: the desktop ──
  const drawDesktop = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#1a7f7f'; g.fillRect(0, 0, W, H - TASKBAR_H);     // teal, the '95 default
    // dithered scanlines — every CRT this world paints gets one, so a "PC"
    // that skipped it would be the one screen in the room that looks flat
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < H - TASKBAR_H; y += 2) g.fillRect(0, y, W, 1);

    ICONS.forEach((icon, i) => {
      const x = ICON_G.x, y = ICON_G.y0 + i * ICON_G.dy;
      const sel = i === iconSel;
      if (sel) { const r = iconRect(i); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(r.x, r.y, r.w, r.h); }
      // a plain BEVELLED SQUARE, not a drawn glyph — a wrong icon reads worse
      // than an abstract one, and the label under it is what actually tells
      // you what it opens
      g.fillStyle = '#d8d4c0'; g.fillRect(x, y, ICON_G.w, ICON_G.h);
      g.fillStyle = '#8a8578'; g.fillRect(x, y + ICON_G.h, ICON_G.w, 3);
      g.fillStyle = icon.key === 'catalog' ? '#7a3b30' : '#4a4a4a';
      g.fillRect(x + 3, y + 3, ICON_G.w - 6, ICON_G.h - 6);
      g.fillStyle = sel ? '#ffffff' : '#e8e2d0';
      g.font = font(7, sel); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText(icon.label, x + ICON_G.w / 2, y + ICON_G.labelDy);
    });

    // taskbar
    g.fillStyle = '#c3c0b4'; g.fillRect(0, H - TASKBAR_H, W, TASKBAR_H);
    g.fillStyle = '#e8e4d4'; g.fillRect(0, H - TASKBAR_H, W, 1);
    g.fillStyle = '#3a3830'; g.fillRect(START.x, START.y, START.w, START.h);
    g.fillStyle = '#e8e2d0'; g.font = font(7, true); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText('START', START.x + 4, START.y + 8);
    const t = clockNow();
    const hh = String(((t.hour + 11) % 12) + 1).padStart(2, '0');
    const mm = String(t.minute).padStart(2, '0');
    g.fillStyle = '#2a2820'; g.textAlign = 'right';
    g.fillText(`${hh}:${mm} ${t.hour < 12 ? 'AM' : 'PM'}`, W - 6, START.y + 8);
  };

  /** the bevelled push-button this era draws everywhere. `down` sinks it. */
  const button = (g: CanvasRenderingContext2D, r: Rect, label: string, down = false) => {
    g.fillStyle = down ? '#a9a599' : '#c3c0b4'; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = down ? '#8a8578' : '#e8e4d4'; g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y, 1, r.h);
    g.fillStyle = down ? '#e8e4d4' : '#8a8578';
    g.fillRect(r.x, r.y + r.h - 1, r.w, 1); g.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    g.fillStyle = '#1a1a1a'; g.font = font(7, true);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    g.textBaseline = 'alphabetic';
  };

  /** the window title bar, with the close box that takes you back to the desktop */
  const titleBar = (g: CanvasRenderingContext2D, name: string) => {
    g.fillStyle = '#000078'; g.fillRect(2, 2, W - 4, 12);
    g.fillStyle = '#ffffff'; g.font = font(7, true); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(name, 6, 11);
    g.fillStyle = '#c3c0b4'; g.fillRect(CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h);
    g.fillStyle = '#e8e4d4'; g.fillRect(CLOSE.x, CLOSE.y, CLOSE.w, 1);
    g.fillStyle = '#8a8578'; g.fillRect(CLOSE.x, CLOSE.y + CLOSE.h - 1, CLOSE.w, 1);
    g.fillStyle = '#1a1a1a'; g.font = font(8, true);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('x', CLOSE.x + CLOSE.w / 2, CLOSE.y + CLOSE.h / 2 + 1);
    g.textBaseline = 'alphabetic';
  };

  // ── DRAW: the catalog ──
  const drawCatalog = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#c3c0b4'; g.fillRect(0, 0, W, H);
    titleBar(g, 'CARD CATALOG.EXE');
    // search field — sunk, the way an edit control is drawn in this era
    g.fillStyle = '#ffffff'; g.fillRect(CAT.field.x, CAT.field.y, CAT.field.w, CAT.field.h);
    g.fillStyle = '#8a8578'; g.fillRect(CAT.field.x, CAT.field.y, CAT.field.w, 1);
    g.fillRect(CAT.field.x, CAT.field.y, 1, CAT.field.h);
    g.fillStyle = '#111'; g.font = font(7); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const cursorOn = Math.floor(clockNow().totalMin / 1) % 2 === 0; // blinks with the game clock, not a second RAF
    g.fillText(`> ${query}${cursorOn ? '_' : ' '}`, CAT.field.x + 4, CAT.field.y + 9);
    button(g, CAT.clear, 'CLEAR');

    const results = search(query);
    catClamp();
    g.fillStyle = '#5a5850'; g.font = font(7); g.textAlign = 'left';
    g.fillText(`${results.length} of ${CATALOG.length} book${CATALOG.length === 1 ? '' : 's'}`, 6, CAT.up.y + 8);
    if (results.length > CAT_ROWS) {
      button(g, CAT.up, '▲', catTop === 0);
      button(g, CAT.down, '▼', catTop >= results.length - CAT_ROWS);
    }

    const shown = Math.min(results.length - catTop, CAT_ROWS);
    for (let i = 0; i < shown; i++) {
      const idx = catTop + i;
      const b = results[idx];
      const r = catRowRect(i);
      if (idx === catSel) { g.fillStyle = '#000078'; g.fillRect(r.x, r.y, r.w, r.h); }
      else if (idx % 2 === 0) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(r.x, r.y, r.w, r.h); }
      g.fillStyle = idx === catSel ? '#ffffff' : '#1a1a1a';
      g.font = font(7, true); g.textAlign = 'left';
      g.fillText(b.title, r.x + 3, r.y + 9);
      g.fillStyle = idx === catSel ? '#c8d4e8' : '#5a5850'; g.font = font(7);
      const yearS = b.year < 0 ? `${-b.year} BC` : String(b.year);
      g.textAlign = 'right';
      g.fillText(`${b.author} · ${yearS}`, r.x + r.w - 3, r.y + 9);
    }
    if (results.length === 0) {
      g.fillStyle = '#5a5850'; g.font = font(8); g.textAlign = 'center';
      g.fillText('no matches', W / 2, CAT.top + 22);
    }

    // THE RECORD STRIP. A catalogue that only lists titles is an index; the
    // card is the thing you came to the terminal for, and it is what the mouse
    // buys — click a row and its shelf mark and loan status are there.
    const sy = H - CAT.detailH;
    g.fillStyle = '#b3b0a4'; g.fillRect(0, sy, W, CAT.detailH);
    g.fillStyle = '#8a8578'; g.fillRect(0, sy, W, 1);
    g.font = font(7); g.textBaseline = 'alphabetic';
    if (catSel >= 0 && catSel < results.length) {
      const b = results[catSel];
      g.fillStyle = '#1a1a1a'; g.textAlign = 'left';
      g.fillText(`${callNo(b)}  ${b.subject}`, 6, sy + 9);
      g.fillText(b.title, 6, sy + 18);
      g.fillStyle = status(b) === 'ON SHELF' ? '#106010' : '#8a4010';
      g.textAlign = 'right';
      g.fillText(status(b), W - 6, sy + 14);
    } else {
      g.fillStyle = '#6a6760'; g.textAlign = 'center';
      g.fillText('type to search · click a title for its card', W / 2, sy + 14);
    }
  };

  // ── DRAW: minesweeper ──
  const CELL = 22, MS_X0 = (W - MS_COLS * CELL) / 2, MS_Y0 = 26;
  const NUM_COL = ['', '#1848c0', '#187818', '#c01818', '#181878', '#781818', '#187878', '#282828', '#787878'];
  const drawMinesweeper = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#c3c0b4'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000078'; g.fillRect(2, 2, W - 4, 12);
    g.fillStyle = '#ffffff'; g.font = font(7, true); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText('MINESWEEP.EXE', 6, 11);

    const flags = ms.grid.reduce((n, row) => n + row.filter((c) => c.flag).length, 0);
    g.fillStyle = '#1a1a1a'; g.font = font(7, true);
    g.fillText(`mines ${Math.max(0, MS_MINES - flags)}`, 6, 22);
    g.textAlign = 'right';
    if (ms.dead) { g.fillStyle = '#901010'; g.fillText('BOOM — R to retry', W - 6, 22); }
    else if (ms.won) { g.fillStyle = '#106010'; g.fillText('CLEARED — R for another', W - 6, 22); }
    else { g.fillStyle = '#1a1a1a'; g.fillText('arrows move · SPACE dig · F flag', W - 6, 22); }

    for (let r = 0; r < MS_ROWS; r++) for (let c = 0; c < MS_COLS; c++) {
      const cell = ms.grid[r][c];
      const x = MS_X0 + c * CELL, y = MS_Y0 + r * CELL;
      const showAll = ms.dead || ms.won;
      const revealed = cell.open || (showAll && cell.mine && !cell.flag);
      if (revealed) {
        g.fillStyle = cell.mine ? '#e08080' : '#b8b4a4';
        g.fillRect(x, y, CELL - 1, CELL - 1);
        if (cell.mine) {
          g.fillStyle = '#1a1a1a';
          g.beginPath(); g.arc(x + CELL / 2, y + CELL / 2, 5, 0, Math.PI * 2); g.fill();
        } else if (cell.adj > 0) {
          g.fillStyle = NUM_COL[cell.adj]; g.font = font(8, true);
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(String(cell.adj), x + CELL / 2, y + CELL / 2 + 1);
        }
      } else {
        g.fillStyle = '#d8d4c0'; g.fillRect(x, y, CELL - 1, CELL - 1);
        g.fillStyle = '#eeece0'; g.fillRect(x, y, CELL - 1, 2);
        g.fillStyle = '#8a8578'; g.fillRect(x, y + CELL - 3, CELL - 1, 2);
        if (cell.flag) {
          g.fillStyle = '#c01818'; g.font = font(9, true);
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText('F', x + CELL / 2, y + CELL / 2 + 1);
        }
      }
      if (r === ms.cz && c === ms.cx && !ms.dead && !ms.won) {
        g.strokeStyle = '#f0d020'; g.lineWidth = 2;
        g.strokeRect(x + 1, y + 1, CELL - 3, CELL - 3);
        g.lineWidth = 1;
      }
    }
  };

  const draw = (g: CanvasRenderingContext2D) => {
    if (screen === 'desktop') drawDesktop(g);
    else if (screen === 'catalog') drawCatalog(g);
    else drawMinesweeper(g);
  };

  // ── KEYS, dispatched by screen ──
  const onKey = (k: string) => {
    if (screen === 'desktop') {
      if (k === 'arrowup') iconSel = (iconSel + ICONS.length - 1) % ICONS.length;
      else if (k === 'arrowdown') iconSel = (iconSel + 1) % ICONS.length;
      else if (k === 'enter' || k === ' ') {
        const chosen = ICONS[iconSel].key;
        if (chosen === 'catalog') { screen = 'catalog'; query = ''; }
        else { screen = 'minesweeper'; ms = msBlank(); }
      }
    } else if (screen === 'catalog') {
      if (k === 'backspace') query = query.slice(0, -1);
      else if (k === 'escape') { /* handled by hud.ts: closes the WHOLE panel.
        Backing out to the desktop needs its own key, since ESC always means
        "leave the machine" everywhere else in this world and a second meaning
        here would be the one panel that broke that rule. */ }
      else if (k === 'tab' || k === 'backquote') toDesktop();
      else if (k.length === 1 && /[a-z0-9 '-]/i.test(k)) query = (query + k).slice(0, 40);
    } else if (screen === 'minesweeper') {
      if (k === 'tab' || k === 'backquote') toDesktop();
      else if (k === 'r') ms = msBlank();
      else if (k === 'arrowup') ms.cz = Math.max(0, ms.cz - 1);
      else if (k === 'arrowdown') ms.cz = Math.min(MS_ROWS - 1, ms.cz + 1);
      else if (k === 'arrowleft') ms.cx = Math.max(0, ms.cx - 1);
      else if (k === 'arrowright') ms.cx = Math.min(MS_COLS - 1, ms.cx + 1);
      else if (k === ' ' || k === 'enter') msDig(ms);
      else if (k === 'f') msFlag(ms);
    }
    panel?.repaint();
  };

  // `ct/hud.ts` is reached by a DYNAMIC import, not a static one — the same
  // move `blackjack.ts` and `slots.ts` make and document, for the same two
  // reasons. First, GOTCHAS §28: `ct/world.ts` collects modules via an eager
  // glob, and a module in a RUNTIME import cycle with that graph can resolve
  // to an undefined namespace in the Rollup bundle while working perfectly in
  // the dev server — that is how GOLDEN ACES shipped missing, invisible until
  // someone tested the built bundle rather than dev. A dynamic import is not
  // part of the static graph, so it cannot take part in that cycle. Second,
  // `hud.ts` reaches `virtual:build-stamp`, a Vite virtual module that does
  // not exist outside the bundler, so a static import here would make this
  // whole file unloadable by plain node — and the catalog search and the
  // Minesweeper logic above are exactly the kind of pure function a node
  // script should be able to import directly without dragging a browser in.
  void import('./hud').then(({ makePanel }) => {
    panel = makePanel({
      // FRAMELESS. `draw` already paints a complete monitor — the '95 teal
      // desktop with its own scanlines, icons and taskbar (`drawDesktop`),
      // or the catalog / Minesweeper screens it swaps to — filling the whole
      // W×H canvas. The framework's moulded 'machine' bezel used to wrap a
      // SECOND monitor around that picture of a first one, with a
      // `LIBRARY TERMINAL` title stamped over it that no real '95 desktop
      // would print on itself. Item 0c, *"i never want there to be menus
      // popping up unless they are embedded to look as if they are in the
      // actual game."*
      id: 'ct-library-pc', w: W, h: H, scale: 2, chrome: 'none',
      // WHAT LEAVES THE MACHINE DEPENDS ON WHETHER THIS SCREEN IS TYPING.
      // `[E]` closes every machine view in the world now, but the CATALOGUE is
      // a search field that takes any single character — `e` included — so it
      // keeps ESC and nothing else changes about it. The other two screens take
      // `[E]` like everything else. The framework reads the same `typing` flag
      // to decide, so the caption and the key can never disagree.
      // TAB and ENTER stay bare because they are THIS machine's own keys; the
      // one that leaves the machine is bracketed, because that is how the world
      // names it everywhere else — `[E] use the machine` over every spot.
      hint: () => (screen === 'desktop'
        ? 'arrows select · ENTER open · [E] step back'
        : screen === 'catalog'
          ? 'TAB desktop · [ESC] step back'
          : 'TAB desktop · [E] step back'),
      typing: () => screen === 'catalog',
      draw,
      key: (k) => onKey(k),
      // GOING BACK TO THE DESKTOP IS NOT THE SAME AS LEAVING THE MACHINE. Every
      // panel in this world promises ESC always closes it — hud.ts enforces
      // that centrally, and this file must not fight it (§11 of the brief: a
      // panel you cannot close from every screen inside it is the worst bug
      // this project ships). So ESC keeps its one meaning everywhere — stand
      // up — and "back to the desktop" gets its own key (TAB) instead of
      // overloading ESC into a second, screen-dependent meaning.
      onClose: () => { dismissed = seatedAtComputer(); screen = 'desktop'; iconSel = 0; },
    });
  });

  ctx.onFrame((f) => {
    if (!panel) return;
    const seat = seatedAtComputer();
    if (seat === null) dismissed = null;
    if (!panel.isOpen()) {
      if (seat !== null && seat !== dismissed) panel.open();
      return;
    }
    if (seat === null && dismissed !== null) { panel.close(); return; }
    void f;
  }, HOOK.LATE);

  // Test affordance, same shape as __atm / __slots / __blackjack: a way to
  // open and drive this from a script without first landing item 3's rename
  // and walking to the room, exactly as `ct/atm.ts`'s own note explains for
  // the same reason.
  (globalThis as unknown as Record<string, unknown>).__librarypc = {
    open: () => panel?.open(),
    close: () => panel?.close(),
    screen: () => screen,
    goto: (s: Screen) => { screen = s; if (s === 'minesweeper') ms = msBlank(); panel?.repaint(); },
    key: (k: string) => onKey(k),
    catalogQuery: () => query,
    catalogResults: () => search(query).map((b) => b.title),
    minesweeper: () => ({
      cols: MS_COLS, rows: MS_ROWS, mines: MS_MINES,
      dead: ms.dead, won: ms.won, cx: ms.cx, cz: ms.cz,
      open: ms.grid.reduce((n, row) => n + row.filter((c) => c.open).length, 0),
    }),
  };
}
