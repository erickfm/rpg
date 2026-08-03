import { BUILD, ORDER as HOOK } from './ctx';
import type { CtxBuild } from './ctx';
import type { Panel } from './hud';
// TYPE-ONLY, and that is the whole reason this file can stay honest with `fp`.
// `ct/slots.ts` had to take a RUNTIME edge on three to build its own screen
// plane, and measured the cost: 1018 of 1458 textures re-hashed, because
// `scenedump.mjs` seeds `Math.random` and reordering the module graph shifts
// three's `generateUUID` stream (GOTCHAS 75). This file builds no geometry and
// constructs no three object — the screen it paints on is already in the room —
// so it needs the TYPES and nothing else, and `import type` is erased entirely.
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
// THE SCREEN THIS PICTURE BELONGS ON — item 157
// ═══════════════════════════════════════════════════════════════════════════
//
// *"i need the pc in the library to be like the atm too. intergrated overlay.
// realistic setup."*
//
// THE MECHANISM IS `PanelSpec.surface` AND NONE OF IT IS RE-IMPLEMENTED HERE.
// Hanging the canvas on a mesh, easing the eye onto it, locking the look,
// freezing the feet, raycasting the pointer back into canvas pixels, the Win98
// arrow/hand, ESC and `[E]` always closing, giving the fov and the feet back,
// putting the object's own face back — every one of those is `ct/hud.ts` and
// `crosstown.ts`, built for the ATM by w41 (item 86) and re-used unchanged by
// the slots (w55, item 100). The only thing this section does is answer the one
// question the framework asks the caller: WHICH MESH.
//
// AND THIS TENANT IS THE EASY ONE, WHICH IS WORTH SAYING PLAINLY.
//
//  · The ATM had a screen mesh with a `userData.atmPart` tag on it.
//  · The slot machine had NO screen mesh at all — one `BoxGeometry` wearing six
//    materials — so `ct/slots.ts` had to build its own plane, and `ct/hud.ts`
//    would have THROWN on the six-material array (item 150) if it had not.
//  · The library terminal already has a real CRT face: `ct/int-library.ts:1121`
//    builds `new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.24), new
//    THREE.MeshBasicMaterial({ map: screenTex(kind) }))` — a plane, with ONE
//    material. MEASURED in the running world, not read off the source:
//    `scripts/probes/w64-pc-mesh.mjs` reports `PlaneGeometry size [0.3,0.24,0]`
//    at 1.02 m in front of the chair, `mats 1`, `map 20x16`, `graded false`.
//
// So item 150's multi-material throw DOES NOT BITE HERE, and this file builds
// no geometry: it paints on the CRT that is already in the room and hands it
// straight back on close. `ct/int-library.ts` is not imported, not touched, and
// none of `BX`, `BZ0`, `BZ1`, `BENCH_TOP` or `TERM_CX` appears anywhere here.
//
// HOW THE MESH IS FOUND, AND WHY NOT BY RAYCAST. `ct/slots.ts` casts a ray from
// the stool, which needs a runtime `three` and cost it a whole-world dither
// reseed to import one (GOTCHAS 75). Nothing here needs a three OBJECT — the
// screen is a plane, the seat states which way the player faces, and a dot
// product answers "is it in front of me and looking back at me". So the search
// is arithmetic over `scene.traverse`, `import type` covers the rest, and this
// change adds no edge to the module graph and no mesh to the world: `npm run
// fp` stays a valid proof for it, which it was not for w55.
//
// Every number below is a TOLERANCE on the seat's own frame, not a coordinate:
// nothing here knows where the library is.

/** how far ahead of the chair a CRT may be and still be the one you sat at.
 *  The measured distance is 1.02 m; the next terminal along is 1.05 m SIDEWAYS
 *  and is excluded by `OFF_AXIS`, not by this. */
const REACH_MIN = 0.15, REACH_MAX = 1.60;
/** …and how far off the line of sight. The bank's terminals are 1.05 m apart,
 *  so anything past a third of that is a different machine. */
const OFF_AXIS = 0.30;
/** a screen is at desk height. Relative to the floor the player is standing on,
 *  never to an absolute y — the library has a gallery. */
const Y_LO = 0.40, Y_HI = 2.00;
/** how square the face must be to the chair. cos 45°; the measured face is
 *  dead-on at 1.000. */
const FACING = 0.70;

function screenAhead(scene: THREE.Scene, seat: SeatPose, gy: number): THREE.Object3D | null {
  // rig convention, fp.ts:477 — fwd = (sin yaw, 0, -cos yaw). Read off the same
  // line `crosstown.ts`'s own focus controller cites, not re-derived.
  const fx = Math.sin(seat.yaw), fz = -Math.cos(seat.yaw);
  let best: THREE.Object3D | null = null, bestAhead = Infinity;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    // A SCREEN IS A PLANE. This is what makes the search exact rather than
    // "the first thing the ray hit": the tube's box and its bezel are
    // `BoxGeometry` and are 10 mm behind the glass, so a first-hit test would
    // depend on 10 mm of clearance surviving forever.
    if (m.geometry.type !== 'PlaneGeometry') return;
    // …AND ONE MATERIAL. `ct/hud.ts` throws on an array (item 150) rather than
    // degrading, so a surface that would throw is one this file must not
    // nominate — the framework's own promise is that an unfindable mesh gives
    // the screen-space panel back, not an exception inside `open()`.
    if (Array.isArray(m.material) || !m.material) return;
    if (!m.visible) return;
    m.updateWorldMatrix(true, false);
    const e = m.matrixWorld.elements;
    const cx = e[12], cy = e[13], cz = e[14];
    const dx = cx - seat.x, dz = cz - seat.z;
    const ahead = dx * fx + dz * fz;                    // metres in front of the chair
    if (ahead <= REACH_MIN || ahead > REACH_MAX) return;
    if (Math.abs(dx * fz - dz * fx) > OFF_AXIS) return; // …and off its axis
    if (cy - gy < Y_LO || cy - gy > Y_HI) return;
    // The face's own normal, which for a plane is its matrix's third basis
    // vector — three's elements are column-major, so 8/9/10. It must be looking
    // BACK at the chair or it is the back of something.
    const nx = e[8], ny = e[9], nz = e[10];
    const nl = Math.hypot(nx, ny, nz) || 1;
    if ((-fx * nx - fz * nz) / nl < FACING) return;
    if (ahead < bestAhead) { bestAhead = ahead; best = m; }
  });
  return best;
}

/**
 * The face's own w/h, read off the LIVE mesh at open time.
 *
 * From the local bounding box, never from `geometry.parameters` — a builder lost
 * a measurement to exactly that last night, because `parameters` describes the
 * geometry as constructed and lies wherever a rotation was baked into the
 * vertices. In local space a plane's box is the plane whatever the object's
 * transform does.
 */
function faceAspect(mesh: THREE.Object3D): number | null {
  const g = (mesh as THREE.Mesh).geometry;
  if (!g) return null;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  if (!bb) return null;
  const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
  return h > 1e-6 ? w / h : null;
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
// ── THE FACE, AND WHY IT IS 320 x 256 AND NOT 320 x 220 ────────────────────
//
// *"i need the pc in the library to be like the atm too. intergrated overlay.
// realistic setup."* — item 157.
//
// This canvas is no longer a rectangle in front of the camera; it is painted
// onto the terminal's own CRT (see `screenAhead` below). w41 and w55 both name
// the same trap in one line — *"your canvas should be cut to your mesh face's
// aspect, or it will stretch"* — and it is the difference between "there is a
// UI here" and "the interface is on the machine".
//
// The face is `ct/int-library.ts:1122`'s `new THREE.PlaneGeometry(0.30, 0.24)`.
// COPIED WITH A CITATION, not silently duplicated (BUILDER-BRIEF §8): the
// canvas size is a module constant and the mesh is only resolved at open time,
// so it cannot be derived here. What CAN be derived is the check — `faceAspect`
// below reads the live mesh's own bounding box every time the panel opens and
// says so if the two ever disagree, and `__librarypc.face()` publishes it so a
// probe can fail on it. A follow-up to hoist the CRT's size out of
// `int-library.ts` as a shared export would remove the copy entirely.
//
// 320 / 256 = 1.25 = 0.30 / 0.24, so the texels are square at 1066.7 px/m both
// ways (§7b). It is also the same face size `ct/slots.ts` (`FACE`) and
// `ct/blackjack.ts` (`FELT`) already use, so all three frameless panels now
// share one.
//
// The 36 new rows are not padding. At 320 x 220 the Minesweeper grid ran to
// y 223 against a 220-tall canvas — MS_Y0 26 + 9 rows x 22 — so **the bottom
// row of mines was clipped off the canvas entirely**, on a keyboard-only board
// where nothing could ever reach it. That is fixed by the re-cut, not by a
// separate change.
const W = 320, H = 256;
const TASKBAR_H = 16;

// ── EVERY RECTANGLE THE MOUSE CAN PRESS, DECLARED ONCE ─────────────────────
//
// w55's `DECK` lesson, restated: the painter, `hot` and `click` all read THESE,
// so a control cannot be drawn where a click does not land, or lit while
// pressing it does nothing. Nothing is registered with the framework — `hot`
// and `click` arrive in this canvas's own pixels and this file answers for its
// own layout, which is the entire point of the `PanelSpec.surface` seam.
interface Rect { x: number; y: number; w: number; h: number }
const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** the Win95 close box at the right end of a title bar — "back to the desktop",
 *  which is TAB on the keyboard. It is NOT "leave the machine": that is the
 *  world's own `[E]`/ESC and no window on this screen may claim it. */
const CLOSE_BOX: Rect = { x: W - 14, y: 3, w: 11, h: 10 };
/** desktop icons: the hit rect IS the highlight `drawDesktop` paints when the
 *  icon is selected, so what looks pressable is exactly what is. */
const ICON_X = 12, ICON_Y0 = 16, ICON_PITCH = 44;
const iconRect = (i: number): Rect => ({ x: ICON_X - 3, y: ICON_Y0 + i * ICON_PITCH - 3, w: 30, h: 36 });
/** the catalogue's search field and the CLEAR button beside it. A mouse user
 *  has a keyboard for the query itself, but nothing on the face to empty it. */
const CLR_BTN: Rect = { x: W - 36, y: 18, w: 30, h: 12 };
const FIELD: Rect = { x: 6, y: 18, w: W - 12 - 34, h: 12 };
/** Minesweeper's two mouse-only controls.
 *  FLAG is a MODE, not an action, and it exists because `ScreenSurface.click`
 *  carries no button — there is no right-click to flag with, which is the same
 *  shape of gap as w55's missing bill acceptor: the affordance the mouse needs
 *  and the part the machine was missing are the same object. */
const NEW_BTN: Rect = { x: W - 38, y: 17, w: 32, h: 12 };
const FLAG_BTN: Rect = { x: W - 38 - 44, y: 17, w: 40, h: 12 };
/** Not `UI.font` from `./hud` — see the note on the dynamic import of
 *  `makePanel` below. Plain `monospace`, the same fallback `blackjack.ts`
 *  and `slots.ts` draw their own screens in for the identical reason. */
const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${px}px monospace`;

/** the moulded Win95 raised button, in this machine's own beige */
function drawButton(g: CanvasRenderingContext2D, r: Rect, label: string, live: boolean): void {
  g.fillStyle = live ? '#d8d4c0' : '#c3c0b4'; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = '#eeece0'; g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y, 1, r.h);
  g.fillStyle = '#8a8578'; g.fillRect(r.x, r.y + r.h - 1, r.w, 1); g.fillRect(r.x + r.w - 1, r.y, 1, r.h);
  g.fillStyle = live ? '#1a1a1a' : '#8a8578';
  g.font = font(6, true); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
/** the same button, pressed in — used for the FLAG mode while it is on */
function drawButtonDown(g: CanvasRenderingContext2D, r: Rect, label: string): void {
  g.fillStyle = '#a8a498'; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = '#8a8578'; g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y, 1, r.h);
  g.fillStyle = '#eeece0'; g.fillRect(r.x, r.y + r.h - 1, r.w, 1); g.fillRect(r.x + r.w - 1, r.y, 1, r.h);
  g.fillStyle = '#101010';
  g.font = font(6, true); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
/** the close box every '95 window wears, drawn from `CLOSE_BOX` itself */
function drawCloseBox(g: CanvasRenderingContext2D): void {
  const r = CLOSE_BOX;
  g.fillStyle = '#c3c0b4'; g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = '#eeece0'; g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y, 1, r.h);
  g.fillStyle = '#8a8578'; g.fillRect(r.x, r.y + r.h - 1, r.w, 1); g.fillRect(r.x + r.w - 1, r.y, 1, r.h);
  g.fillStyle = '#1a1a1a';
  g.font = font(7, true); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('x', r.x + r.w / 2, r.y + r.h / 2 + 1);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}

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
  /** MOUSE ONLY. `ScreenSurface.click` carries no mouse button, so there is no
   *  right-click to flag with; this is the mode that replaces it. The keyboard
   *  is unaffected — `F` still flags at the cursor whatever this says. */
  let msFlagMode = false;
  /** the aspect of the CRT this open landed on, or `null` when the panel is
   *  shut or fell back to the screen-space cabinet. Written by `surface.mesh`,
   *  cleared by `onClose`, published through `__librarypc.face()`. */
  let faceSeen: number | null = null;
  /** …and the CRT itself, so a probe clicks the object the panel actually
   *  landed on rather than hunting the scene for something that looks like it.
   *  Held only while the panel is open. */
  let screenMesh: THREE.Object3D | null = null;
  const clockNow = () => ctx.clock.now();

  const toDesktop = () => { screen = 'desktop'; panel?.repaint(); };

  // ── DRAW: the desktop ──
  const drawDesktop = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#1a7f7f'; g.fillRect(0, 0, W, H - TASKBAR_H);     // teal, the '95 default
    // dithered scanlines — every CRT this world paints gets one, so a "PC"
    // that skipped it would be the one screen in the room that looks flat
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let y = 0; y < H - TASKBAR_H; y += 2) g.fillRect(0, y, W, 1);

    ICONS.forEach((icon, i) => {
      const x = ICON_X, y = ICON_Y0 + i * ICON_PITCH;
      const sel = i === iconSel;
      const r = iconRect(i);
      if (sel) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(r.x, r.y, r.w, r.h); }
      // a plain BEVELLED SQUARE, not a drawn glyph — a wrong icon reads worse
      // than an abstract one, and the label under it is what actually tells
      // you what it opens
      g.fillStyle = '#d8d4c0'; g.fillRect(x, y, 24, 20);
      g.fillStyle = '#8a8578'; g.fillRect(x, y + 20, 24, 3);
      g.fillStyle = icon.key === 'catalog' ? '#7a3b30' : '#4a4a4a';
      g.fillRect(x + 3, y + 3, 18, 14);
      g.fillStyle = sel ? '#ffffff' : '#e8e2d0';
      g.font = font(6, sel); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText(icon.label, x + 12, y + 32);
    });

    // taskbar
    g.fillStyle = '#c3c0b4'; g.fillRect(0, H - TASKBAR_H, W, TASKBAR_H);
    g.fillStyle = '#e8e4d4'; g.fillRect(0, H - TASKBAR_H, W, 1);
    g.fillStyle = '#3a3830'; g.fillRect(4, H - TASKBAR_H + 3, 40, 10);
    g.fillStyle = '#e8e2d0'; g.font = font(6, true); g.textAlign = 'left';
    g.fillText('START', 8, H - TASKBAR_H + 10);
    const t = clockNow();
    const hh = String(((t.hour + 11) % 12) + 1).padStart(2, '0');
    const mm = String(t.minute).padStart(2, '0');
    g.fillStyle = '#2a2820'; g.textAlign = 'right';
    g.fillText(`${hh}:${mm} ${t.hour < 12 ? 'AM' : 'PM'}`, W - 6, H - TASKBAR_H + 10);
  };

  // ── DRAW: the catalog ──
  const drawCatalog = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#c3c0b4'; g.fillRect(0, 0, W, H);
    // title bar, Windows-blue
    g.fillStyle = '#000078'; g.fillRect(2, 2, W - 4, 12);
    g.fillStyle = '#ffffff'; g.font = font(7, true); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText('CARD CATALOG.EXE', 6, 11);
    drawCloseBox(g);
    // search field
    g.fillStyle = '#ffffff'; g.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    g.strokeStyle = '#5a5850'; g.strokeRect(FIELD.x + 0.5, FIELD.y + 0.5, FIELD.w - 1, FIELD.h - 1);
    g.fillStyle = '#111'; g.font = font(7); g.textAlign = 'left';
    const cursorOn = Math.floor(clockNow().totalMin / 1) % 2 === 0; // blinks with the game clock, not a second RAF
    g.fillText(`> ${query}${cursorOn ? '_' : ' '}`, FIELD.x + 4, FIELD.y + 9);
    drawButton(g, CLR_BTN, 'CLEAR', query.length > 0);

    const results = search(query);
    g.fillStyle = '#5a5850'; g.font = font(6); g.textAlign = 'left';
    g.fillText(`${results.length} of ${CATALOG.length} book${CATALOG.length === 1 ? '' : 's'}`, 6, 42);
    const rowH = 12, top = 48, maxRows = Math.floor((H - top - 16) / rowH);
    for (let i = 0; i < Math.min(results.length, maxRows); i++) {
      const b = results[i];
      const y = top + i * rowH;
      if (i % 2 === 0) { g.fillStyle = 'rgba(0,0,0,0.04)'; g.fillRect(6, y, W - 12, rowH); }
      g.fillStyle = '#1a1a1a'; g.font = font(6, true); g.textAlign = 'left';
      g.fillText(b.title, 8, y + 9);
      g.fillStyle = '#5a5850'; g.font = font(6);
      const yearS = b.year < 0 ? `${-b.year} BC` : String(b.year);
      const tail = `${b.author} · ${yearS}`;
      g.textAlign = 'right';
      g.fillText(tail, W - 8, y + 9);
    }
    if (results.length > maxRows) {
      g.fillStyle = '#5a5850'; g.font = font(6); g.textAlign = 'center';
      g.fillText(`… ${results.length - maxRows} more — narrow your search`, W / 2, H - 6);
    } else if (results.length === 0) {
      g.fillStyle = '#5a5850'; g.font = font(7); g.textAlign = 'center';
      g.fillText('no matches', W / 2, top + 20);
    }
  };

  // ── DRAW: minesweeper ──
  // MS_Y0 34 against the old 26: the board now ENDS at 34 + 9 x 22 = 232 inside
  // a 256-tall canvas. At 320 x 220 it ended at 223 and the bottom row was cut
  // off the canvas, on a board where the cursor could still be moved onto it.
  const CELL = 22, MS_X0 = (W - MS_COLS * CELL) / 2, MS_Y0 = 34;
  const MS_Y1 = MS_Y0 + MS_ROWS * CELL;
  const NUM_COL = ['', '#1848c0', '#187818', '#c01818', '#181878', '#781818', '#187878', '#282828', '#787878'];
  /** which grid cell a canvas pixel is in, or null. The ONE answer read by the
   *  painter's bounds, by `hot` and by `click` — a square cannot be drawn where
   *  a click does not land. */
  const msCellAt = (x: number, y: number): { r: number; c: number } | null => {
    if (x < MS_X0 || y < MS_Y0 || y >= MS_Y1) return null;
    const c = Math.floor((x - MS_X0) / CELL), r = Math.floor((y - MS_Y0) / CELL);
    if (c < 0 || c >= MS_COLS || r < 0 || r >= MS_ROWS) return null;
    return { r, c };
  };
  /** the inverse, for the painter and for a probe that clicks a named square */
  const msRectOf = (r: number, c: number): Rect =>
    ({ x: MS_X0 + c * CELL, y: MS_Y0 + r * CELL, w: CELL - 1, h: CELL - 1 });
  const drawMinesweeper = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#c3c0b4'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000078'; g.fillRect(2, 2, W - 4, 12);
    g.fillStyle = '#ffffff'; g.font = font(7, true); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText('MINESWEEP.EXE', 6, 11);
    drawCloseBox(g);

    const flags = ms.grid.reduce((n, row) => n + row.filter((c) => c.flag).length, 0);
    g.fillStyle = '#1a1a1a'; g.font = font(7, true); g.textAlign = 'left';
    g.fillText(`mines ${Math.max(0, MS_MINES - flags)}`, 6, 27);
    if (msFlagMode) drawButtonDown(g, FLAG_BTN, 'FLAG');
    else drawButton(g, FLAG_BTN, 'FLAG', !ms.dead && !ms.won && !ms.firstClick);
    drawButton(g, NEW_BTN, 'NEW', true);

    g.font = font(7, true); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (ms.dead) { g.fillStyle = '#901010'; g.fillText('BOOM — NEW, or R, to retry', W / 2, MS_Y1 + 14); }
    else if (ms.won) { g.fillStyle = '#106010'; g.fillText('CLEARED — NEW for another', W / 2, MS_Y1 + 14); }
    else {
      g.fillStyle = '#5a5850'; g.font = font(6);
      g.fillText(msFlagMode ? 'click a square to FLAG it' : 'click a square to dig · arrows · SPACE · F',
        W / 2, MS_Y1 + 14);
    }
    g.textAlign = 'left';

    for (let r = 0; r < MS_ROWS; r++) for (let c = 0; c < MS_COLS; c++) {
      const cell = ms.grid[r][c];
      // FROM `msRectOf`, which is also what `msCellAt` inverts — one authoring,
      // so a square cannot be painted where a click does not land
      const { x, y } = msRectOf(r, c);
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

  // ── THE MOUSE ─────────────────────────────────────────────────────────────
  //
  // The framework raycasts the pointer onto the CRT and hands the hit back in
  // THIS canvas's own pixels — the same coordinates the three `draw*` functions
  // above paint in — so this machine hit-tests the layout it drew and the
  // framework is never told where a control is. That seam is w41's; this is the
  // whole of using it.

  /** is there something PRESSABLE here? Drives the hand cursor, so it is true
   *  only where a click actually does something — w41's rule. */
  const hotAt = (x: number, y: number): boolean => {
    if (screen === 'desktop') return ICONS.some((_, i) => inRect(iconRect(i), x, y));
    if (screen === 'catalog') {
      if (inRect(CLOSE_BOX, x, y)) return true;
      return inRect(CLR_BTN, x, y) && query.length > 0;
    }
    if (inRect(CLOSE_BOX, x, y) || inRect(NEW_BTN, x, y)) return true;
    if (inRect(FLAG_BTN, x, y)) return !ms.dead && !ms.won && !ms.firstClick;
    const cell = msCellAt(x, y);
    if (!cell) return false;
    if (ms.dead || ms.won) return false;
    const c = ms.grid[cell.r][cell.c];
    return msFlagMode ? !c.open : !c.open && !c.flag;
  };

  /**
   * ONE DISPATCH. A click that means "dig" sends the same `' '` through `onKey`
   * that SPACE does, and a click on an icon sends `'enter'` — so a mouse and a
   * keyboard can never drift about what this machine does. `ct/atm.ts` and
   * `ct/slots.ts` route their faces the same way for the same reason.
   *
   * The two exceptions are honest ones and neither is a game action: TAB is the
   * window close box, and FLAG is a pointer MODE that no key has.
   */
  const clickAt = (x: number, y: number): void => {
    if (!hotAt(x, y)) return;                    // a dead control stays dead
    if (screen === 'desktop') {
      const i = ICONS.findIndex((_, n) => inRect(iconRect(n), x, y));
      if (i >= 0) { iconSel = i; onKey('enter'); }
      return;
    }
    if (inRect(CLOSE_BOX, x, y)) { onKey('tab'); return; }
    if (screen === 'catalog') {
      // CLEAR is `backspace` held down, which is exactly what it is on the
      // keyboard — not a second way to empty the field that could disagree.
      if (inRect(CLR_BTN, x, y)) { while (query.length) onKey('backspace'); }
      return;
    }
    if (inRect(NEW_BTN, x, y)) { onKey('r'); msFlagMode = false; panel?.repaint(); return; }
    if (inRect(FLAG_BTN, x, y)) { msFlagMode = !msFlagMode; panel?.repaint(); return; }
    const cell = msCellAt(x, y);
    if (!cell) return;
    // Where the ARROW KEYS would have put the cursor, then the same keystroke.
    ms.cx = cell.c; ms.cz = cell.r;
    onKey(msFlagMode ? 'f' : ' ');
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
        ? 'click an icon · arrows · ENTER · [E] step back'
        : screen === 'catalog'
          ? 'type to search · TAB desktop · [ESC] step back'
          : 'click a square · TAB desktop · [E] step back'),
      typing: () => screen === 'catalog',
      // ── ON THE CRT, NOT OVER THE CAMERA ────────────────────────────────
      //
      // *"i need the pc in the library to be like the atm too. intergrated
      // overlay. realistic setup."* Naming the mesh the picture belongs on is
      // the whole of the change: `draw` paints what it painted before, re-cut
      // to the face it is now on. See the block above `screenAhead`.
      //
      // 0.68 m and 46°, CHOSEN BY LOOKING at three settings rather than by
      // arithmetic — w55 recorded getting exactly this backwards by reasoning.
      // Frames in `/tmp/w64-pc/{a,b,c}-*.png`, from `w64-pc-look.mjs`:
      //
      //   0.55 / 42  the glass fills 52% of frame height and READS WELL, and
      //              the frame is then a monitor against a featureless brown
      //              field: the keyboard falls 7° below the bottom edge and
      //              the bench's 0.46 m back panel is all there is behind. It
      //              is a picture of a screen, which is the thing this whole
      //              series of items exists to stop.
      //   0.78 / 50  desk, keyboard, mouse mat, stair and wall all in shot —
      //              and the 6 px type is down to about 5 screen px. A
      //              catalogue you cannot read is not a catalogue.
      //   0.68 / 46  ← this. The glass is ~42% of frame height, the CRT's own
      //              beige case surrounds it, and the keyboard, the mouse and
      //              the desk edge come into the bottom of the frame at −30°,
      //              just inside the −32° bottom edge. `Twenty Thousand
      //              Leagues Under the Sea · Jules Verne · 1870` is legible in
      //              the shot at 1064 x 796.
      //
      // The comparison against the other tenants is a comparison of OBJECT
      // SIZES, not of taste: the glass is 0.24 m tall where a slot cabinet's
      // face is 0.91, so the slots' 1.15/58 here would read as a postage stamp
      // across a room.
      //
      // `crosstown.ts`'s focus controller clamps the eye to 1.05 m above the
      // floor and this face's centre is at 0.94, so the pose comes out at
      // (1082.94, 1.05) looking 9° DOWN at the glass — a head at a monitor.
      // Measured off the live camera, not predicted.
      surface: {
        mesh: () => {
          const seat = seatedAtComputer();
          if (!seat) return null;              // → the screen-space fallback
          const m = screenAhead(ctx.scene, seat, ctx.player.gy());
          screenMesh = m;
          faceSeen = m ? faceAspect(m) : null;
          // A STRETCHED SCREEN IS THE ONE FAILURE THIS CANNOT SEE BY ITSELF.
          // The canvas's aspect is a constant copied from `int-library.ts`
          // (see the note on W/H); if that file's CRT ever changes shape the
          // picture silently smears, which is exactly what w55 measured as the
          // difference between "a UI" and "the machine". So the live face is
          // measured on every open and disagreement is said out loud, and
          // `__librarypc.face()` publishes it so a check can go red on it.
          if (faceSeen !== null && Math.abs(faceSeen - W / H) / (W / H) > 0.02) {
            console.warn(`[ct-library-pc] the CRT is ${faceSeen.toFixed(3)}:1 and this`
              + ` canvas is ${(W / H).toFixed(3)}:1 — the picture will stretch.`
              + ' Re-cut W/H, or hoist the face size out of ct/int-library.ts.');
          }
          return m;
        },
        standoff: 0.68,
        fov: 46,
        hot: hotAt,
        click: clickAt,
      },
      draw,
      key: (k) => onKey(k),
      // GOING BACK TO THE DESKTOP IS NOT THE SAME AS LEAVING THE MACHINE. Every
      // panel in this world promises ESC always closes it — hud.ts enforces
      // that centrally, and this file must not fight it (§11 of the brief: a
      // panel you cannot close from every screen inside it is the worst bug
      // this project ships). So ESC keeps its one meaning everywhere — stand
      // up — and "back to the desktop" gets its own key (TAB) instead of
      // overloading ESC into a second, screen-dependent meaning.
      onClose: () => {
        dismissed = seatedAtComputer(); screen = 'desktop'; iconSel = 0;
        faceSeen = null; screenMesh = null;     // the picture is off the CRT again
        // the pointer mode is a mouse state, not a game state: leaving the
        // machine and coming back must not find the board still in FLAG
        msFlagMode = false;
      },
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
    // ITEM 157's own affordances, same shape as the rest of this object.
    /** the canvas the panel draws in, and the aspect of the CRT it last landed
     *  on — `null` until a diegetic open has happened. A probe asserts these
     *  agree; see `scripts/probes/w64-pc-face.mjs`. */
    face: () => ({ w: W, h: H, canvasAspect: W / H, meshAspect: faceSeen }),
    /** is the picture actually ON the machine right now, or has it fallen back
     *  to the screen-space cabinet? The whole item is this being true. */
    onMesh: () => faceSeen !== null,
    /** the CRT the picture is on right now, for a probe that clicks it */
    screenMesh: () => screenMesh,
    /** drive the mouse without a mouse: canvas pixels in, the same `hot`/`click`
     *  the framework calls out. Lets a check exercise the layout offline of
     *  camera easing, which is the race that cost w55 an hour. */
    hotAt: (x: number, y: number) => hotAt(x, y),
    clickAt: (x: number, y: number) => clickAt(x, y),
    flagMode: () => msFlagMode,
    /** the rectangles, so a probe clicks what the painter drew rather than a
     *  second copy of the layout */
    rects: () => ({
      icons: ICONS.map((_, i) => iconRect(i)), close: CLOSE_BOX,
      clear: CLR_BTN, field: FIELD, flag: FLAG_BTN, newGame: NEW_BTN,
      cell: (r: number, c: number) => msRectOf(r, c),
    }),
    catalogQuery: () => query,
    catalogResults: () => search(query).map((b) => b.title),
    minesweeper: () => ({
      cols: MS_COLS, rows: MS_ROWS, mines: MS_MINES,
      dead: ms.dead, won: ms.won, cx: ms.cx, cz: ms.cz,
      open: ms.grid.reduce((n, row) => n + row.filter((c) => c.open).length, 0),
    }),
  };
}
