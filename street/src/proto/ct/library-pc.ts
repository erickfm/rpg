import { BUILD, ORDER as HOOK } from './ctx';
import type { CtxBuild } from './ctx';
import type { Panel } from './hud';

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
interface SeatRow { pose: object; label: string }
interface CtWindow { __ct?: { seated: () => object | null; seats: () => SeatRow[] } }
function seatedAtComputer(): object | null {
  const ct = (globalThis as unknown as CtWindow).__ct;
  if (!ct) return null;
  const pose = ct.seated();
  if (!pose) return null;
  return ct.seats().find((s) => s.pose === pose)?.label === SEAT_LABEL ? pose : null;
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
const W = 320, H = 220;
const TASKBAR_H = 16;
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
      const x = 12, y = 14 + i * 40;
      const sel = i === iconSel;
      if (sel) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x - 3, y - 3, 30, 36); }
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
    // search field
    g.fillStyle = '#ffffff'; g.fillRect(6, 18, W - 12, 12);
    g.strokeStyle = '#5a5850'; g.strokeRect(6.5, 18.5, W - 13, 11);
    g.fillStyle = '#111'; g.font = font(7); g.textAlign = 'left';
    const cursorOn = Math.floor(clockNow().totalMin / 1) % 2 === 0; // blinks with the game clock, not a second RAF
    g.fillText(`> ${query}${cursorOn ? '_' : ' '}`, 10, 27);

    const results = search(query);
    g.fillStyle = '#5a5850'; g.font = font(6);
    g.fillText(`${results.length} of ${CATALOG.length} book${CATALOG.length === 1 ? '' : 's'}`, 6, 40);
    const rowH = 12, top = 46, maxRows = Math.floor((H - top - 4) / rowH);
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
      hint: () => (screen === 'desktop'
        ? 'arrows select · ENTER open · ESC step back'
        : 'TAB desktop · ESC step back'),
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
