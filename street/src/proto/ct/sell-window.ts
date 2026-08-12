import * as THREE from 'three';
import { makePanel, type Panel, type Purse } from './hud';
import { pixTex, declareSurface, dither } from './paint';
import { fencePrice, itemOf, slots, takeOne } from './inventory';
import type { CtxBuild, Spot } from './ctx';

// ══ SELLING SOMETHING, THROUGH A WINDOW, ON A PAD ══════════════════════════
//
// *"pawn shop sell station needs a diagetic sell interface"*   (2026-08-11)
// *"selling stuff at the pawn shop is too many clicks. make it a bit
//  simpler"*                                                   (2026-08-11)
//
// The station was one line of HUD text — `[E] the loan counter — he doesn't
// want anything you're carrying` — under a hand-lettered sign that already
// tells you exactly what is supposed to happen: **LOANS & BUYING / HAND IT
// THROUGH THE WINDOW.** The fiction was printed on the wall and the interaction
// was a caption.
//
// ── WHAT THIS IS THE MIRROR OF ─────────────────────────────────────────────
//
// `ct/shop.ts` is the BUY counter: a stock list, a printed board, somebody
// behind it. This is the same shape pointed the other way — **your** goods, a
// ticket pad, and a man who prices them.
//
// ══ ONE TICKET, ONE SIGNATURE — WHY THE FLOW CHANGED ═══════════════════════
//
// The first pass made him look at ONE ARTICLE AT A TIME: the OFFERED column was
// ruled and blank *because he has not seen it yet*, you clicked a line to push
// that article through the slot, he wrote a figure, you clicked TAKE THE MONEY,
// the ticket stamped itself and came back — then you did it again for the next
// thing. Two clicks and three redraws PER ARTICLE, and the two clicks you spent
// discovering that he will not touch the wristwatch bought you nothing.
//
// **A PAWNBROKER PRICES THE LOT ON THE COUNTER, ONCE.** So the ticket now
// arrives WRITTEN UP: everything in your pockets down the left, what he pays
// for each written in the OFFERED column, and the lines he will not touch
// greyed with a dash where the figure would be. You tick the lines you are
// parting with — or tick the column head and take the lot — and you sign the
// ticket once. Whatever the total, it is **two clicks**: tick, sign.
//
// ⚠ AND THE JOKE SURVIVES PRINTING THE PRICES, which is what `bestFence`'s note
// in `ct/inventory.ts` was protecting when it argued against a sell-all: *"a
// 'sell all' would hide the pricing behind a single total — which is where the
// joke lives. You watch him give you fifty cents for the socks."* Nothing is
// hidden behind the total here. The socks are ON THE TICKET with their two
// dollars written next to them, in a column, next to the chequebook's thirty-
// two. A price list is a better place to watch that than a modal you have to
// spend a click to reach.
//
// ── THE SURFACE IS THE PAD, AND THE PAD IS ALREADY THERE ───────────────────
//
// The room built *"the pad the ticket is written on, and the pen tethered to
// it"* on the customer's side of the bars when the two stations were split. So
// nothing here invents a screen: `makePanel`'s `surface` hangs this canvas on
// that pad's own face and `crosstown.ts:poseFor` leans the eye over it, the
// same machinery the calendar, the drawer and the menu boards stand on. It is a
// HORIZONTAL face, so it is told which way to square up (`faceYaw`) — see the
// signed-zero note in `poseFor`, which is what a drawer's lining cost.
//
// ONE PAINTER, TWO SURFACES, exactly as `ct/shop.ts` states it: `padTexture()`
// paints the pad lying on the counter and `paintPad()` paints the panel, and
// they are the same function. The world one is drawn in the BLANK state — a pad
// of unwritten tickets, ruled, with the tick boxes PRINTED down its left margin
// because that is what a form has before anybody fills it in.
//
// ══ THE ONE RULE THIS FILE IS BUILT AROUND ═════════════════════════════════
//
// **THE ARTICLE NEVER LEAVES YOUR POCKETS UNTIL YOU SIGN.** A tick is a member
// of a `Set` in this closure and nothing else — no `takeOne`, no world change.
// So Escape, `[E]`, another panel opening, a teleport, a fade, or the framework
// closing this for any reason it has today or grows tomorrow can never eat a
// thing you were carrying, and a stray click on a LINE costs you nothing at all
// (it draws a tick you can see and click off again).
//
// ⚠ WHICH MEANS THERE IS EXACTLY ONE COMMITTING REGION ON THIS PANEL, and it is
// the same square inch the old TAKE THE MONEY box stood in: the box at the foot
// of the ticket. **It only EXISTS while at least one line is ticked** — with an
// empty ticket that rectangle is the form's printed TOTAL box and is not
// clickable — and it has the money printed inside it in red. Removing the
// confirm step would have made the row click the commit point, which is one
// mis-click from selling something you meant to keep and is a vending machine
// rather than a pawn shop. Ticking a form and signing it is FEWER clicks than
// the old flow AND a stricter safety property than a per-row sale.
//
// ⚠ AND THE PRICES ARE NOT HERE. `fencePrice` in `ct/inventory.ts` is the one
// notion of what this man pays, keyed on the loot table it has to stay honest
// against, and a second copy in a nicer interface is this codebase's most
// expensive habit (BUILDER-BRIEF §8). What he takes IS what that table prices:
// stolen goods, and only stolen goods. Everything else is greyed on the ticket
// with a line about why under your pointer.

// ── HIS MANNER ─────────────────────────────────────────────────────────────
//
// What he does while he decides, and what he says when he will not. Narration
// rather than dialogue, because a bald man behind bars who does not ask where
// you got it does not make conversation — the whole character of the station is
// that it is quick and that nothing is written down about you.
//
// These used to cost a click each to read: you pushed the article through and
// he told you. They are on HOVER now, so resting on a line is what makes him
// look up — the same lines, at nought clicks instead of two, and the refusals
// are readable without spending a transaction to find them.
//
// Keyed on the ids `FENCE` prices, with a fallback so an id nobody has written a
// line for still reads as a man looking at an object.
const TAKES: Record<string, string> = {
  CHEQUES: 'He reads the name printed on them, twice, and does not look up.',
  TRAINERS: 'He checks the soles. Not the box, not the tongue. The soles.',
  TOASTER: 'He turns it over, finds the flex wrapped round it, and grunts.',
  VHS: 'He does not ask what is on it. He does not want to know.',
  SOCKS: 'He does not take them out of the wrap.',
  CATALOGUE: 'There is a stack of them by his elbow already.',
};
const REFUSES: Record<string, string> = {
  WRISTWATCH: 'He taps the glass under your elbow. He sells watches. He has watches.',
  PACKAGE: 'He will not put a number on a box he has not been inside.',
  NEWSPAPER: 'He glances at the date and slides it back.',
  CEREAL: 'He is not a grocer.',
  SODA: 'He is not a grocer.',
};
const TAKES_ANY = 'He weighs it, turns it once under the lamp, and writes a figure.';
const REFUSES_ANY = 'He will not put a number on it.';

// ── the paper ──────────────────────────────────────────────────────────────
//
// The room's own card stock and its two inks — the same `#ded4b8` / `#3a2c22` /
// `#8a2c22` the NO CHECKS notice, the rate card and the two station boards are
// lettered in. A pawn ticket painted in a fourth palette would read as belonging
// to a different shop.
const PAPER = '#ded4b8', UNDER = '#c4b894', INK = '#3a2c22';
const RED = '#8a2c22', RULE = '#8a7450', DIM = '#6a5f4c';
const HOVER = 'rgba(58,44,34,0.13)';
const TICKED = 'rgba(138,44,34,0.09)';

/** the pad's canvas, in texels. 1000 per metre — you read this at 0.5 m. */
export const PAD_PX = 260, PAD_PY = 360;
export const PAD_PPM = 1000;

/** WHAT THE PAD IS SHOWING. `blank` is the object; `pad` is the transaction. */
type View =
  | { kind: 'blank' }
  | { kind: 'pad'; p: Purse };

/** what he just paid out, held for as long as the stamp is wet */
interface Stamp { total: number; n: number }

/**
 * EVERYTHING THE PAINTER AND THE HIT TEST BOTH NEED, in one value.
 *
 * The whole transaction is now four fields: which view, what your pointer is
 * on, which lines you have ticked, and whether the stamp is still wet. There is
 * no per-article screen to be in the middle of, which is most of why this got
 * simpler to use — and all of why it got simpler to close.
 */
interface PadState {
  v: View;
  ticket: number;
  hover: Region | null;
  ticked: Set<string>;
  stamp: Stamp | null;
}

interface Region { x: number; y: number; w: number; h: number; hit: Hit }
type Hit =
  | { do: 'tick'; id: string }        // put a tick against this line
  | { do: 'all' }                     // …or against every line he will pay for
  | { do: 'sign'; total: number }     // ⚠ THE ONLY REGION THAT CHANGES THE WORLD
  | { do: 'why'; id: string };        // a line he will not price. Inert.

const rect = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};

/** an item's 24 px icon, drawn at `k`× with its top left at x,y */
function icon(g: CanvasRenderingContext2D, id: string, x: number, y: number, k: number): void {
  const d = itemOf(id).icon;
  g.save(); g.translate(x, y); g.scale(k, k);
  if (d) d(g);
  else { rect(g, '#a8916c', 3, 5, 18, 15); rect(g, '#6a5a3c', 3, 11, 18, 2); }
  g.restore();
}

/** wrapped small print. Returns the y it finished on. */
function prose(g: CanvasRenderingContext2D, s: string, cx: number, y: number, w: number, rows = 3): number {
  const words = s.split(' ');
  let ln = '', r = 0;
  for (const word of words) {
    const t = ln ? `${ln} ${word}` : word;
    if (g.measureText(t).width > w && ln) {
      g.fillText(ln, cx, y + r * 10); ln = word; r++;
      if (r >= rows) break;
    } else ln = t;
  }
  if (r < rows) { g.fillText(ln, cx, y + r * 10); r++; }
  return y + r * 10;
}

/** trim a string until it fits `w` at the current font, ending in a full stop */
function fit(g: CanvasRenderingContext2D, s: string, w: number): string {
  if (g.measureText(s).width <= w) return s;
  let t = s;
  while (t.length > 1 && g.measureText(`${t}.`).width > w) t = t.slice(0, -1);
  return `${t}.`;
}

// ── the layout, derived once and used by both the painter and the hit test ──
//
// A region list rather than two parallel sets of coordinates: the thing you can
// click and the thing you can see are laid out by one function, so a button
// cannot drift off its own hit box (which is how a screen ends up with a control
// that looks pressable three pixels from where it is).

/** ONE LINE OF THE TICKET: the article, how many, and what the column says. */
interface Line { id: string; n: number; price: number; sum: number }

function lines(p: Purse): Line[] {
  return slots(p).map((id) => {
    const n = p.inv[id] ?? 0;
    const price = fencePrice(id);
    return { id, n, price, sum: price * n };
  });
}

const HEAD_Y = 66, HEAD_H = 14;
const LIST_Y = 82, LIST_BOT = 254;
/** the form's total box — printed always, signable only when it has a figure */
const BOX = { x: 18, y: 286, w: PAD_PX - 41, h: 34 };

function metrics(n: number): { rowH: number; fits: number } {
  const rowH = Math.max(16, Math.min(30, Math.floor((LIST_BOT - LIST_Y) / Math.max(1, n))));
  return { rowH, fits: Math.floor((LIST_BOT - LIST_Y) / rowH) };
}

/** the lines actually written on this sheet (the rest overflow onto the next) */
function shownLines(v: View): Line[] {
  if (v.kind !== 'pad') return [];
  const held = lines(v.p);
  return held.slice(0, metrics(held.length).fits);
}

/** what he would count out for the ticks currently on the sheet */
function ticketTotal(s: PadState): number {
  return shownLines(s.v)
    .filter((l) => l.price > 0 && s.ticked.has(l.id))
    .reduce((t, l) => t + l.sum, 0);
}

function regions(s: PadState): Region[] {
  const out: Region[] = [];
  if (s.v.kind !== 'pad') return out;
  const shown = shownLines(s.v);
  if (!shown.length) return out;
  const { rowH } = metrics(lines(s.v.p).length);
  // the column head is the tick-all — the standard place for it, and it lines up
  // down the margin with the boxes it drives.
  if (shown.some((l) => l.price > 0)) {
    out.push({ x: 10, y: HEAD_Y, w: PAD_PX - 24, h: HEAD_H, hit: { do: 'all' } });
  }
  shown.forEach((l, i) => {
    out.push({
      x: 10, y: LIST_Y + i * rowH, w: PAD_PX - 24, h: rowH,
      // A LINE HE WILL NOT PRICE IS STILL A REGION, so hovering it makes him say
      // why — but its `do` is inert and `hot()` leaves the cursor alone, so it
      // never looks pressable.
      hit: l.price > 0 ? { do: 'tick', id: l.id } : { do: 'why', id: l.id },
    });
  });
  const total = ticketTotal(s);
  if (total > 0) out.push({ ...BOX, hit: { do: 'sign', total } });
  return out;
}

function hitAt(s: PadState, x: number, y: number): Region | null {
  for (const r of regions(s)) {
    if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r;
  }
  return null;
}

/** does this region do anything if you press it? Drives the hand cursor. */
const pressable = (r: Region | null): boolean =>
  !!r && (r.hit.do === 'tick' || r.hit.do === 'all' || r.hit.do === 'sign');

/**
 * WHICH region this is, as a value rather than as an object.
 *
 * `regions()` builds a fresh list every call — the layout is derived, not
 * stored — so `hover === r` is false even when the pointer has not moved, and a
 * panel that repaints on every mouse move is a panel whose paper crawls. Two
 * regions are the same region when they do the same thing to the same article.
 */
const key = (r: Region | null): string => {
  if (!r) return '';
  const h = r.hit;
  return h.do === 'tick' || h.do === 'why' ? `${h.do}:${h.id}` : h.do;
};

// ── the painter ────────────────────────────────────────────────────────────

function masthead(g: CanvasRenderingContext2D, ticket: number): void {
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = RED; g.font = 'bold 16px monospace';
  g.fillText('CROSSTOWN', PAD_PX / 2 - 2, 22);
  g.font = 'bold 11px monospace';
  g.fillText('LOAN & BUYING CO.', PAD_PX / 2 - 2, 38);
  rect(g, RULE, 16, 46, PAD_PX - 36, 1);
  g.font = '9px monospace'; g.fillStyle = DIM;
  g.textAlign = 'left'; g.fillText('BUYING TICKET', 16, 58);
  g.textAlign = 'right'; g.fillText(`No. ${ticket}`, PAD_PX - 20, 58);
  rect(g, RULE, 16, 64, PAD_PX - 36, 1);
}

function tearOff(g: CanvasRenderingContext2D): void {
  // the perforation, and the pad's own printed instruction under it — the same
  // sentence as the board hanging over the window, because a pad printed for
  // this counter would say the same thing the counter says.
  g.fillStyle = RULE;
  for (let x = 14; x < PAD_PX - 18; x += 6) g.fillRect(x, 328, 3, 1);
  g.textAlign = 'center'; g.fillStyle = DIM; g.font = '8px monospace';
  g.fillText('HAND IT THROUGH THE WINDOW', PAD_PX / 2 - 2, 340);
}

/** a printed tick box, 10 px, with the tick in it if this line is going */
function tickBox(g: CanvasRenderingContext2D, x: number, y: number, on: boolean): void {
  g.strokeStyle = RULE; g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, 9, 9);
  if (!on) return;
  g.strokeStyle = RED; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 1.5, y + 5); g.lineTo(x + 4, y + 8); g.lineTo(x + 9, y + 1);
  g.stroke();
}

/**
 * THE PAD. One painter for the object lying on the counter and for the view you
 * lean over — see the head of this file.
 *
 * `hover`, the ticks and the stamp are the only things the VIEW has that the
 * counter cannot.
 */
function paintPad(g: CanvasRenderingContext2D, s: PadState): void {
  // the pad: the sheets underneath showing along two edges, the top one square
  // to the counter. Two rectangles, and it is what stops this reading as a
  // single card lying on wood.
  rect(g, UNDER, 0, 0, PAD_PX, PAD_PY);
  rect(g, PAPER, 0, 0, PAD_PX - 5, PAD_PY - 5);
  masthead(g, s.ticket);

  const held = s.v.kind === 'pad' ? lines(s.v.p) : [];
  const shown = shownLines(s.v);
  const sellable = shown.filter((l) => l.price > 0);
  const allOn = sellable.length > 0 && sellable.every((l) => s.ticked.has(l.id));

  // ── the column head, which is also the tick-all ──────────────────────────
  if (key(s.hover) === 'all') rect(g, HOVER, 10, HEAD_Y, PAD_PX - 24, HEAD_H);
  g.textBaseline = 'middle';
  if (sellable.length) tickBox(g, 16, HEAD_Y + 2, allOn);
  g.font = '8px monospace'; g.fillStyle = DIM;
  g.textAlign = 'left'; g.fillText(sellable.length ? 'ALL' : 'ARTICLE', 30, HEAD_Y + 8);
  g.textAlign = 'right'; g.fillText('OFFERED', PAD_PX - 20, HEAD_Y + 8);

  if (!held.length) {
    // A BLANK TICKET AND EMPTY POCKETS ARE THE SAME PICTURE, and they should be:
    // there is nothing to write on the form in either case. The ruled lines and
    // the boxes down the margin are what a form has before anybody fills it in,
    // and the one line over them is only there when it is YOU that is empty
    // rather than the pad.
    for (let i = 0; i < 7; i++) {
      tickBox(g, 16, 90 + i * 24, false);
      rect(g, RULE, 32, 100 + i * 24, PAD_PX - 52, 1);
    }
    if (s.v.kind === 'pad') {
      g.textAlign = 'center';
      g.fillStyle = DIM; g.font = '10px monospace';
      g.fillText('nothing on you to write down', PAD_PX / 2 - 2, 176);
    }
  } else {
    const { rowH } = metrics(held.length);
    shown.forEach((l, i) => {
      const y = LIST_Y + i * rowH;
      const on = l.price > 0 && s.ticked.has(l.id);
      if (on) rect(g, TICKED, 10, y, PAD_PX - 24, rowH);
      if (key(s.hover) === `tick:${l.id}` || key(s.hover) === `why:${l.id}`) {
        rect(g, HOVER, 10, y, PAD_PX - 24, rowH);
      }
      if (l.price > 0) tickBox(g, 16, y + Math.round(rowH / 2) - 5, on);

      const k = Math.min(1, (rowH - 6) / 24);
      icon(g, l.id, 30, y + (rowH - 24 * k) / 2, k);

      const size = Math.max(7, Math.min(11, Math.round(rowH * 0.42)));
      g.textAlign = 'left'; g.textBaseline = 'middle';
      // A LINE HE WILL NOT PRICE IS GREY, so the ticket reads at a glance as a
      // price list with some of it crossed off — which is what it is.
      g.fillStyle = l.price > 0 ? INK : DIM;
      g.font = `bold ${size}px monospace`;
      const nameX = 30 + 24 * k + 4;
      const name = itemOf(l.id).name.toUpperCase() + (l.n > 1 ? ` x${l.n}` : '');
      g.fillText(fit(g, name, PAD_PX - 72 - nameX), nameX, y + rowH / 2);

      g.textAlign = 'right';
      g.font = `bold ${Math.max(8, Math.min(11, Math.round(rowH * 0.44)))}px monospace`;
      g.fillStyle = l.price > 0 ? (on ? RED : INK) : DIM;
      g.fillText(l.price > 0 ? `$${l.sum.toFixed(2)}` : '—', PAD_PX - 20, y + rowH / 2);

      rect(g, RULE, 16, y + rowH - 1, PAD_PX - 36, 1);
    });
    if (held.length > shown.length) {
      g.textAlign = 'center'; g.fillStyle = DIM; g.font = '8px monospace';
      g.fillText(`+${held.length - shown.length} more, on the next ticket`, PAD_PX / 2 - 2, LIST_BOT + 8);
    }
  }

  // ── WHAT HE SAYS, under your pointer ─────────────────────────────────────
  //
  // The remarks that used to cost a click each. Two rows of small print, one
  // fixed strip, so nothing below it moves as the pointer runs down the list.
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = DIM; g.font = '8px monospace';
  const h = s.hover?.hit;
  let said = '';
  if (s.stamp) said = `${s.stamp.n} article${s.stamp.n === 1 ? '' : 's'} across the counter. He counts it out.`;
  else if (h?.do === 'tick') said = TAKES[h.id] ?? TAKES_ANY;
  else if (h?.do === 'why') said = REFUSES[h.id] ?? REFUSES_ANY;
  else if (h?.do === 'all') said = 'Every line he will pay for.';
  else if (h?.do === 'sign') said = 'He does not ask where you got it.';
  else if (held.length) said = 'Tick what you are selling. He signs for the lot.';
  if (said) prose(g, said, PAD_PX / 2 - 2, 266, PAD_PX - 44, 2);

  // ── the total box: printed on the form, signable when it has a figure ────
  const total = ticketTotal(s);
  g.strokeStyle = RULE; g.lineWidth = 1;
  g.strokeRect(BOX.x + 0.5, BOX.y + 0.5, BOX.w - 1, BOX.h - 1);
  if (s.stamp) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = RED; g.font = 'bold 15px monospace';
    g.fillText(`$${s.stamp.total.toFixed(2)}`, BOX.x + BOX.w / 2, BOX.y + BOX.h / 2 + 1);
  } else if (total > 0) {
    // ⚠ THE COMMIT. It exists only in this branch — see the head of this file.
    if (key(s.hover) === 'sign') rect(g, HOVER, BOX.x, BOX.y, BOX.w, BOX.h);
    g.strokeStyle = INK; g.lineWidth = 1;
    g.strokeRect(BOX.x + 2.5, BOX.y + 2.5, BOX.w - 5, BOX.h - 5);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = INK; g.font = 'bold 9px monospace';
    g.fillText('SIGN AND TAKE THE MONEY', BOX.x + BOX.w / 2, BOX.y + 11);
    g.fillStyle = RED; g.font = 'bold 15px monospace';
    g.fillText(`$${total.toFixed(2)}`, BOX.x + BOX.w / 2, BOX.y + 25);
  } else {
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = DIM; g.font = '8px monospace';
    g.fillText('TOTAL', BOX.x + 8, BOX.y + BOX.h / 2);
  }

  if (s.stamp) {
    // THE STAMP, across the ticket at the angle a hand puts one on.
    g.save();
    g.translate(PAD_PX / 2 - 2, 176); g.rotate(-0.22);
    g.strokeStyle = 'rgba(138,44,34,0.75)'; g.lineWidth = 3;
    g.strokeRect(-64, -22, 128, 44);
    g.fillStyle = 'rgba(138,44,34,0.85)'; g.font = 'bold 30px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('PAID', 0, 1);
    g.restore();
  }

  tearOff(g);
  // ── THE SPECKLE IS ON THE OBJECT, NOT ON THE VIEW ────────────────────────
  //
  // Every painted surface in this world carries `dither`, and this one does too
  // — once, on the texture lying on the counter. It is deliberately NOT drawn
  // into the panel: `dither` draws from `Math.random()`, and the panel repaints
  // on every hover change, so the noise would CRAWL across the paper as the
  // pointer moved. Grain that moves is not grain. This is the same class of
  // view-only difference as the hover wash — a wall cannot have one either.
  if (s.v.kind === 'blank') dither(g, PAD_PX, PAD_PY, Math.round((PAD_PX * PAD_PY) / 900));
}

/** THE PAD AS IT LIES ON THE COUNTER — a blank ticket. Hand it to `ctx.flat`. */
export function padTexture(): THREE.Texture {
  return declareSurface(
    pixTex(PAD_PX, PAD_PY, (g) => paintPad(g, {
      v: { kind: 'blank' }, ticket: 4471, hover: null, ticked: new Set(), stamp: null,
    })),
    'sign', PAD_PPM);
}

// ── the window ─────────────────────────────────────────────────────────────

export interface SellWindowSpec {
  /** panel DOM id, so `__hud.panel()` names the station */
  id: string;
  /** the pad mesh, resolved at OPEN time — see `ScreenSurface.mesh` */
  mesh: () => THREE.Object3D | null;
  /** how far the eye settles above the pad, along its normal */
  standoff: number;
  fov: number;
  /**
   * WHICH WAY TO SQUARE UP. A pad lying on a counter has a normal pointing at
   * the ceiling and therefore no heading of its own — the caller states it off
   * the COUNTER the pad is on. See `ScreenSurface.faceYaw`.
   */
  faceYaw: number;
  /** where the customer stands */
  stand: { x: number; z: number };
  /** the man behind the bars: where he is, and his sprite for the highlight */
  keeper: { x: number; z: number; obj?: THREE.Object3D };
  /** what the prompt calls the station. Keep the word "counter" or "window". */
  label: string;
  ok: () => boolean;
  r?: number;
}

export interface SellWindow {
  open: () => void;
  repaint: () => void;
  spot: Spot;
}

/**
 * A SELL STATION: a pad, a slot, and a man who prices the lot.
 *
 * Registers the `[E]`, builds the diegetic pad panel on first use, and owns the
 * transaction. The room supplies the pad it already put on the counter and the
 * man it already stood behind the bars, and nothing else.
 */
export function sellWindow(ctx: CtxBuild, spec: SellWindowSpec): SellWindow {
  let panel: Panel | null = null;
  const s: PadState = {
    v: { kind: 'pad', p: ctx.purse },
    ticket: 4471,
    hover: null,
    ticked: new Set<string>(),
    stamp: null,
  };
  let stampT: ReturnType<typeof setTimeout> | null = null;
  const repaint = () => panel?.repaint();

  const clearStamp = () => { if (stampT) { clearTimeout(stampT); stampT = null; } };
  /** back to a fresh ticket. NOTHING IS GIVEN BACK because nothing was taken. */
  const toPad = () => {
    clearStamp();
    s.v = { kind: 'pad', p: ctx.purse };
    s.ticked.clear();
    s.stamp = null;
    s.hover = null;
    repaint();
  };

  /**
   * ══ THE TRANSACTION, AND IT IS THE ONLY PLACE THE WORLD CHANGES ══════════
   *
   * The articles leave the pockets FIRST and the money moves only for the ones
   * that actually left — the opposite order pays out for something a concurrent
   * change could already have removed. Everything before this call has changed
   * no state at all, which is what makes Escape safe at every instant.
   */
  const sign = (): void => {
    if (s.v.kind !== 'pad') return;
    let total = 0, n = 0;
    for (const l of shownLines(s.v)) {
      if (l.price <= 0 || !s.ticked.has(l.id)) continue;
      // one `takeOne` per article, so a stack of six socks is six things off
      // the counter and six times two dollars, and a purse that changed under
      // us pays for what was actually there.
      for (let i = 0; i < l.n; i++) {
        if (!takeOne(ctx.purse, l.id)) break;
        total += l.price; n += 1;
      }
    }
    s.ticked.clear();
    s.hover = null;
    if (n === 0) { repaint(); return; }
    ctx.purse.cash += total;
    ctx.refreshWallet();
    s.ticket += 1;
    s.stamp = { total, n };
    repaint();
    // NO `hudNote` ON SUCCESS. *"i dont want descriptors for the items you pick
    // up"* — the receipt is the two things already on screen: the ticket comes
    // back stamped, and the cash figure in the caption goes up.
    clearStamp();
    stampT = setTimeout(() => { s.stamp = null; repaint(); }, 1600);
  };

  const click = (x: number, y: number): void => {
    const r = hitAt(s, x, y);
    if (!r) return;
    // any click clears a wet stamp — you are writing the next ticket
    if (s.stamp) { clearStamp(); s.stamp = null; }
    if (r.hit.do === 'tick') {
      // A TICK IS PANEL STATE AND NOTHING ELSE. See the head of this file.
      if (s.ticked.has(r.hit.id)) s.ticked.delete(r.hit.id);
      else s.ticked.add(r.hit.id);
      repaint();
    } else if (r.hit.do === 'all') {
      const sellable = shownLines(s.v).filter((l) => l.price > 0);
      const allOn = sellable.every((l) => s.ticked.has(l.id));
      s.ticked.clear();
      if (!allOn) for (const l of sellable) s.ticked.add(l.id);
      repaint();
    } else if (r.hit.do === 'sign') sign();
    else repaint();   // 'why': he has already told you, under your pointer
  };

  const open = (): void => {
    if (!panel) {
      panel = makePanel({
        id: spec.id,
        w: PAD_PX, h: PAD_PY, scale: 1, chrome: 'none',
        // NOT `silent`. The mirror may go without a caption because looking away
        // from a mirror is obvious; a station you are being SERVED at owes you
        // the way out in writing. It carries the money too, because "what did
        // that just get me" is the one question the ticket cannot answer on its
        // own — a pad does not know what is in your pocket.
        hint: () => `$${ctx.purse.cash.toFixed(2)} in hand`,
        draw: (g) => paintPad(g, s),
        surface: {
          mesh: spec.mesh,
          standoff: spec.standoff,
          fov: spec.fov,
          faceYaw: spec.faceYaw,
          hot: (x, y) => pressable(hitAt(s, x, y)),
          move: (x, y) => {
            const h = hitAt(s, x, y);
            if (key(h) !== key(s.hover)) { s.hover = h; repaint(); }
          },
          click,
        },
        // ⚠ EVERY WAY IN AND OUT LANDS ON A FRESH TICKET. Ticks you left on the
        // form when you walked away are not a promise you made, and a ticket
        // half-filled by somebody who has gone is not one he would keep behind
        // the bars. Nothing is given back here because nothing was ever taken.
        onOpen: toPad,
        onClose: toPad,
      });
    }
    panel.open();
  };

  const spot: Spot = {
    x: spec.stand.x, z: spec.stand.z,
    aimX: spec.keeper.x, aimZ: spec.keeper.z,
    r: spec.r ?? 1.0,
    obj: spec.keeper.obj,
    ok: spec.ok,
    // ── ONE WORDING, WHATEVER IS IN YOUR POCKETS ─────────────────────────────
    //
    // The old prompt named the best thing you were carrying and its price, and
    // went to *"he doesn't want anything you're carrying"* when you had nothing
    // — so the whole transaction was in a caption, and the station's own name
    // came and went with your pockets. `w103-pawn-served-spot` recorded exactly
    // that: a prompt's PLACE should not depend on what you are holding. The pad
    // does the naming and the pricing now, which is where a pawnbroker does it.
    label: () => spec.label,
    act: open,
  };
  ctx.spot(spot);

  return { open, repaint, spot };
}
