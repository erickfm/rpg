import * as THREE from 'three';
import { makePanel, type Panel, type Purse } from './hud';
import { pixTex, declareSurface, dither } from './paint';
import { fencePrice, itemOf, slots, takeOne } from './inventory';
import type { CtxBuild, Spot } from './ctx';

// ══ SELLING SOMETHING, THROUGH A WINDOW, ON A PAD ══════════════════════════
//
// *"pawn shop sell station needs a diagetic sell interface"*   (2026-08-11)
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
// ticket pad, and a man who has to look at a thing before he will name a price.
// It is a separate module rather than a flag on `shopCounter` because the two
// transactions differ in the only way that matters: a shop's board is a fixed
// list printed once, and a buying pad is written in front of you out of what is
// in your pockets, one article at a time.
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
// of unwritten tickets, which is what a pad on a counter is — and leaning in is
// what fills it in. A stale list of what you were carrying an hour ago would be
// worse than a blank form, and a blank form is not a compromise: it is the
// object.
//
// ══ THE ONE RULE THIS FILE IS BUILT AROUND ═════════════════════════════════
//
// **THE ARTICLE NEVER LEAVES YOUR POCKETS UNTIL YOU TAKE THE MONEY.** Pushing
// it through the slot is a state of this panel and nothing else — no `takeOne`,
// no world change. So Escape, `[E]`, another panel opening, a teleport, a fade,
// or the framework closing this for any reason it has today or grows tomorrow
// can never eat a thing you were carrying. The alternative (remove on hand-over,
// give back on close) has exactly one failure mode and it is unrecoverable from
// inside the game, which is the same argument `ct/shop.ts` makes for putting the
// item in the bag before the money leaves the purse.
//
// ⚠ AND THE PRICES ARE NOT HERE. `fencePrice` in `ct/inventory.ts` is the one
// notion of what this man pays, keyed on the loot table it has to stay honest
// against, and a second copy in a nicer interface is this codebase's most
// expensive habit (BUILDER-BRIEF §8). What he takes IS what that table prices:
// stolen goods, and only stolen goods. Everything else comes back under the
// bars with a line about why.

// ── HIS MANNER ─────────────────────────────────────────────────────────────
//
// What he does while he decides, and what he says when he will not. Narration
// rather than dialogue, because a bald man behind bars who does not ask where
// you got it does not make conversation — the whole character of the station is
// that it is quick and that nothing is written down about you.
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
const REFUSES_ANY = 'He pushes it back under the bars without a word.';

// ── the paper ──────────────────────────────────────────────────────────────
//
// The room's own card stock and its two inks — the same `#ded4b8` / `#3a2c22` /
// `#8a2c22` the NO CHECKS notice, the rate card and the two station boards are
// lettered in. A pawn ticket painted in a fourth palette would read as belonging
// to a different shop.
const PAPER = '#ded4b8', UNDER = '#c4b894', INK = '#3a2c22';
const RED = '#8a2c22', RULE = '#8a7450', DIM = '#6a5f4c';
const HOVER = 'rgba(58,44,34,0.13)';

/** the pad's canvas, in texels. 1000 per metre — you read this at 0.5 m. */
export const PAD_PX = 260, PAD_PY = 360;
export const PAD_PPM = 1000;

/** WHAT THE PAD IS SHOWING. `blank` is the object; the rest is the transaction. */
type View =
  | { kind: 'blank' }
  | { kind: 'pad'; p: Purse }
  | { kind: 'offer'; id: string; price: number }
  | { kind: 'paid'; id: string; price: number };

interface Region { x: number; y: number; w: number; h: number; hit: Hit }
type Hit =
  | { do: 'push'; id: string }        // hand this one through the slot
  | { do: 'take'; id: string; price: number }
  | { do: 'back' };                   // have it back / next article

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
      g.fillText(ln, cx, y + r * 11); ln = word; r++;
      if (r >= rows) break;
    } else ln = t;
  }
  if (r < rows) { g.fillText(ln, cx, y + r * 11); r++; }
  return y + r * 11;
}

// ── the layout, derived once and used by both the painter and the hit test ──
//
// A region list rather than two parallel sets of coordinates: the thing you can
// click and the thing you can see are laid out by one function, so a button
// cannot drift off its own hit box (which is how a screen ends up with a control
// that looks pressable three pixels from where it is).

function rows(p: Purse): { id: string; n: number }[] {
  return slots(p).map((id) => ({ id, n: p.inv[id] ?? 0 }));
}

const LIST_Y = 82, LIST_BOT = 322;

function regions(v: View): Region[] {
  const out: Region[] = [];
  if (v.kind === 'pad') {
    const held = rows(v.p);
    if (!held.length) return out;
    const rowH = Math.max(18, Math.min(30, Math.floor((LIST_BOT - LIST_Y) / held.length)));
    const fits = Math.floor((LIST_BOT - LIST_Y) / rowH);
    held.slice(0, fits).forEach((r, i) => {
      out.push({ x: 10, y: LIST_Y + i * rowH, w: PAD_PX - 24, h: rowH, hit: { do: 'push', id: r.id } });
    });
  } else if (v.kind === 'offer') {
    if (v.price > 0) {
      out.push({ x: 18, y: 286, w: 105, h: 34, hit: { do: 'take', id: v.id, price: v.price } });
      out.push({ x: 132, y: 286, w: 105, h: 34, hit: { do: 'back' } });
    } else {
      out.push({ x: 18, y: 286, w: PAD_PX - 41, h: 34, hit: { do: 'back' } });
    }
  } else if (v.kind === 'paid') {
    out.push({ x: 18, y: 286, w: PAD_PX - 41, h: 34, hit: { do: 'back' } });
  }
  return out;
}

function hitAt(v: View, x: number, y: number): Region | null {
  for (const r of regions(v)) {
    if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r;
  }
  return null;
}

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
  return h.do === 'back' ? 'back' : `${h.do}:${h.id}`;
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

/**
 * THE PAD. One painter for the object lying on the counter and for the view you
 * lean over — see the head of this file.
 *
 * `hover` is the only thing the VIEW has that the counter cannot: the line your
 * pointer is on.
 */
function paintPad(g: CanvasRenderingContext2D, v: View, ticket: number,
                  hover: Region | null): void {
  // the pad: the sheets underneath showing along two edges, the top one square
  // to the counter. Two rectangles, and it is what stops this reading as a
  // single card lying on wood.
  rect(g, UNDER, 0, 0, PAD_PX, PAD_PY);
  rect(g, PAPER, 0, 0, PAD_PX - 5, PAD_PY - 5);
  masthead(g, ticket);

  if (v.kind === 'blank' || v.kind === 'pad') {
    g.textBaseline = 'middle';
    g.font = '8px monospace'; g.fillStyle = DIM;
    g.textAlign = 'left'; g.fillText('ARTICLE', 16, 74);
    g.textAlign = 'right'; g.fillText('OFFERED', PAD_PX - 20, 74);

    const held = v.kind === 'pad' ? rows(v.p) : [];
    if (!held.length) {
      // A BLANK TICKET AND EMPTY POCKETS ARE THE SAME PICTURE, and they should
      // be: there is nothing to write on the form in either case. The ruled
      // lines are what a pad has before anybody writes on it, and the one line
      // over them is only there when it is YOU that is empty rather than the pad.
      g.fillStyle = RULE;
      for (let i = 0; i < 8; i++) g.fillRect(16, 96 + i * 26, PAD_PX - 36, 1);
      if (v.kind === 'pad') {
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = DIM; g.font = '10px monospace';
        g.fillText('nothing on you to write down', PAD_PX / 2 - 2, 188);
      }
    } else {
      const rowH = Math.max(18, Math.min(30, Math.floor((LIST_BOT - LIST_Y) / held.length)));
      const fits = Math.floor((LIST_BOT - LIST_Y) / rowH);
      held.slice(0, fits).forEach((r, i) => {
        const y = LIST_Y + i * rowH;
        if (hover && hover.hit.do === 'push' && hover.hit.id === r.id) {
          rect(g, HOVER, 10, y, PAD_PX - 24, rowH);
        }
        const k = Math.min(1, (rowH - 6) / 24);
        icon(g, r.id, 16, y + (rowH - 24 * k) / 2, k);
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillStyle = INK; g.font = `bold ${Math.min(12, Math.round(rowH * 0.44))}px monospace`;
        const name = itemOf(r.id).name.toUpperCase();
        g.fillText(name.length > 17 ? `${name.slice(0, 16)}.` : name, 16 + 24 * k + 6, y + rowH / 2);
        if (r.n > 1) {
          g.textAlign = 'right';
          g.fillStyle = DIM; g.font = '9px monospace';
          g.fillText(`x${r.n}`, PAD_PX - 62, y + rowH / 2);
        }
        // the offer column, unwritten — he has not seen it yet, and a price
        // printed before he looks would give away the whole station.
        rect(g, RULE, PAD_PX - 56, y + rowH / 2 + 5, 36, 1);
        rect(g, RULE, 16, y + rowH - 1, PAD_PX - 36, 1);
      });
      if (held.length > fits) {
        g.textAlign = 'center'; g.fillStyle = DIM; g.font = '8px monospace';
        g.fillText(`+${held.length - fits} more, one at a time`, PAD_PX / 2 - 2, LIST_BOT + 8);
      }
    }
  } else {
    // ── HE HAS IT ────────────────────────────────────────────────────────────
    const def = itemOf(v.id);
    // integer, because a non-integer translate turns every `fillRect` in an icon
    // into a pair of half-lit pixels — which at 3× is a smeared object.
    icon(g, v.id, Math.round((PAD_PX - 5) / 2 - 36), 84, 3);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = INK; g.font = 'bold 14px monospace';
    g.fillText(def.name.toUpperCase().slice(0, 20), PAD_PX / 2 - 2, 176);
    g.fillStyle = DIM; g.font = '9px monospace';
    const said = v.price > 0
      ? (TAKES[v.id] ?? TAKES_ANY)
      : (REFUSES[v.id] ?? REFUSES_ANY);
    prose(g, said, PAD_PX / 2 - 2, 198, PAD_PX - 44);

    // the box he writes the figure in
    g.fillStyle = RULE;
    g.fillRect(18, 232, PAD_PX - 41, 1); g.fillRect(18, 276, PAD_PX - 41, 1);
    g.fillRect(18, 232, 1, 45); g.fillRect(PAD_PX - 23, 232, 1, 45);
    g.textAlign = 'left'; g.fillStyle = DIM; g.font = '8px monospace';
    g.fillText('HE OFFERS', 26, 245);
    g.textAlign = 'right';
    g.fillStyle = RED; g.font = `bold ${v.price > 0 ? 24 : 20}px monospace`;
    g.fillText(v.price > 0 ? `$${v.price.toFixed(2)}` : 'NOTHING', PAD_PX - 32, 262);

    if (v.kind === 'paid') {
      // THE STAMP, across the ticket at the angle a hand puts one on.
      g.save();
      g.translate(PAD_PX / 2 - 2, 200); g.rotate(-0.22);
      g.strokeStyle = 'rgba(138,44,34,0.75)'; g.lineWidth = 3;
      g.strokeRect(-64, -22, 128, 44);
      g.fillStyle = 'rgba(138,44,34,0.85)'; g.font = 'bold 30px monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('PAID', 0, 1);
      g.restore();
    }

    // ── the two things you can do, drawn as stamped boxes ───────────────────
    for (const r of regions(v)) {
      if (key(hover) === key(r)) rect(g, HOVER, r.x, r.y, r.w, r.h);
      g.strokeStyle = INK; g.lineWidth = 1;
      g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      g.strokeStyle = RULE;
      g.strokeRect(r.x + 2.5, r.y + 2.5, r.w - 5, r.h - 5);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = r.hit.do === 'take' ? RED : INK;
      g.font = 'bold 10px monospace';
      const word = r.hit.do === 'take'
        ? 'TAKE THE MONEY'
        : v.kind === 'paid' ? 'NEXT ARTICLE'
          : v.price > 0 ? 'KEEP IT' : 'TAKE IT BACK';
      g.fillText(word, r.x + r.w / 2, r.y + r.h / 2 + 1);
    }
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
  if (v.kind === 'blank') dither(g, PAD_PX, PAD_PY, Math.round((PAD_PX * PAD_PY) / 900));
}

/** THE PAD AS IT LIES ON THE COUNTER — a blank ticket. Hand it to `ctx.flat`. */
export function padTexture(): THREE.Texture {
  return declareSurface(
    pixTex(PAD_PX, PAD_PY, (g) => paintPad(g, { kind: 'blank' }, 4471, null)),
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
 * A SELL STATION: a pad, a slot, and a man who has to look at it first.
 *
 * Registers the `[E]`, builds the diegetic pad panel on first use, and owns the
 * transaction. The room supplies the pad it already put on the counter and the
 * man it already stood behind the bars, and nothing else.
 */
export function sellWindow(ctx: CtxBuild, spec: SellWindowSpec): SellWindow {
  let panel: Panel | null = null;
  let view: View = { kind: 'pad', p: ctx.purse };
  let hover: Region | null = null;
  let ticket = 4471;
  let stampT: ReturnType<typeof setTimeout> | null = null;
  const repaint = () => panel?.repaint();

  const clearStamp = () => { if (stampT) { clearTimeout(stampT); stampT = null; } };
  const toPad = () => {
    clearStamp();
    view = { kind: 'pad', p: ctx.purse };
    hover = null;
    repaint();
  };

  /**
   * ══ THE TRANSACTION ══════════════════════════════════════════════════════
   *
   * The article leaves the pockets FIRST and the money moves only if it
   * actually left — the opposite order pays out for something a concurrent
   * change could already have removed. Everything before this point has changed
   * no state at all, which is what makes Escape safe from every screen.
   */
  const take = (id: string, price: number): void => {
    if (price <= 0) return;
    if (!takeOne(ctx.purse, id)) { toPad(); return; }
    ctx.purse.cash += price;
    ctx.refreshWallet();
    ticket += 1;
    view = { kind: 'paid', id, price };
    hover = null;
    repaint();
    // NO `hudNote` ON SUCCESS. *"i dont want descriptors for the items you pick
    // up"* — the receipt is the two things already on screen: the ticket comes
    // back stamped, and the cash figure in the caption goes up.
    clearStamp();
    stampT = setTimeout(toPad, 1600);
  };

  const click = (x: number, y: number): void => {
    const r = hitAt(view, x, y);
    if (!r) return;
    if (r.hit.do === 'push') {
      // HANDED THROUGH THE SLOT — and it is still in your pocket. See the rule
      // at the head of this file.
      clearStamp();
      view = { kind: 'offer', id: r.hit.id, price: fencePrice(r.hit.id) };
      hover = null;
      repaint();
    } else if (r.hit.do === 'take') take(r.hit.id, r.hit.price);
    else toPad();
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
        draw: (g) => paintPad(g, view, ticket, hover),
        surface: {
          mesh: spec.mesh,
          standoff: spec.standoff,
          fov: spec.fov,
          faceYaw: spec.faceYaw,
          hot: (x, y) => !!hitAt(view, x, y),
          move: (x, y) => {
            const h = hitAt(view, x, y);
            if (key(h) !== key(hover)) { hover = h; repaint(); }
          },
          click,
        },
        // ⚠ EVERY WAY IN AND OUT LANDS ON THE PAD. Opening mid-offer would show
        // a ticket for an article you handed over five minutes ago, and closing
        // mid-offer must not leave that state waiting behind the bars. Nothing
        // is given back here because nothing was ever taken.
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
