import { takePointer, givePointerBack, type Purse } from './hud';
import { bagStock, bagTake, bagPut, give, roomFor, itemOf } from './inventory';
import { bagCapacity, bagWorn } from './wardrobe';

// ══ THE BAG, HELD OPEN ═════════════════════════════════════════════════════
//
// *"ok with looking down, right click should toggle between inventory (bag),
//  watch, and nothing (clear view looking down)."*, then *"make the bag much
//  bigger and let me interact with it with my mouse"*, then *"since right click
//  allows you to get in and out of your bag then we can lock mouse when we open
//  bag"*   (2026-08-05)
//
// **THE SAME KIND OF OBJECT AS THE WRISTWATCH.** Looking down and finding your
// watch there is a first-person thing this world already does; looking down and
// finding the bag you are wearing held open is the same gesture with a
// different object. Its own canvas at the bottom of the frame, sliding up on a
// transform — **not `makePanel`**, because a panel freezes the world, dims the
// room and takes the whole screen, and none of those are true of a bag you are
// holding while standing in a street. The world keeps running behind it.
//
// ── IT TAKES THE MOUSE, AND HIS OWN REASONING IS WHY THAT IS SAFE ─────────
//
// *"since right click allows you to get in and out of your bag then we can lock
// mouse when we open bag"* — the way in is the way out, so there is no pose to
// get stranded in. Opening releases pointer lock and shows a cursor; mouse-look
// stops; right-click cycles onward and gives the lock straight back.
//
// ⚠ **THE PITCH GATE CANNOT BE THE ONLY WAY OUT.** With mouse-look off he
// cannot look up past 65.5° to dismiss it, so right-click has to genuinely
// work — and it does, by a route this file is careful not to break: `main.ts`
// adds `rmb` to the key set from a **mousedown on the canvas**, and this file
// swallows only `click`, never `mousedown`. Swallowing mousedown at the window
// would kill the very button the exit depends on. See `onClick`.
//
// EVERY EXIT RUNS THROUGH ONE SEAM. `showBag(want)` is called every frame by
// the carousel, and the lock follows `want` — so cycling past the bag, looking
// back up, Escape, the worn bag changing at the mirror and the carousel falling
// back to `nothing` all release and restore through the same two lines. There
// is no second path that could forget.

/** the canvas, in texels, and the CSS pixels each is drawn at */
const BW = 320, BH = 200, SCALE = 3;
/**
 * HOW BIG ONE THING IN THE BAG IS, in texels. 64 at 3x is **192 CSS pixels a
 * side** — the drawer's own scale, and the number this whole session turned on:
 * an item at 4% of the frame is a smudge, one at a third of it is legible.
 * **It did not shrink when the layout changed**; the items overlap instead.
 */
const CELL = 64;
/** and how big it gets when you lift it out to look at it */
const LIFT = 132;

let wrap: HTMLDivElement | null = null;
let cv: HTMLCanvasElement | null = null;
let shown = false;
/** what he has lifted out of the bag to look at, or null */
let held: string | null = null;
/** the pointer, in canvas texels, or null when it is off the bag */
let ptr: { x: number; y: number } | null = null;
/** set by Escape, read and cleared by the carousel — see `bagEscaped` */
let escaped = false;
let purse: Purse | null = null;
let onPurse: (() => void) | null = null;

const CSS_HIDDEN = 'translateX(-50%) translateY(150%)';
const CSS_SHOWN = 'translateX(-50%) translateY(0)';

/** the purse the bag moves things into. Handed in once by the entry point. */
export function configureBag(o: { purse: Purse; refreshWallet: () => void }): void {
  purse = o.purse;
  onPurse = o.refreshWallet;
}

/** WHERE ITEM `i` LIES IN THE BAG — the painter and the hit-test share this,
 *  or you click a thing where a different one is drawn. */
function cellRect(i: number, n: number) {
  const m = MOUTH[bagWorn().kind] ?? MOUTH.tote;
  const inner = { x: m.x + 12, y: m.y + 16, w: BW - (m.x + 12) * 2, h: BH - m.y - 22 };
  const rows = n > 4 ? 2 : 1;
  const per = Math.ceil(n / rows) || 1;
  const row = Math.floor(i / per), col = i % per;
  const spread = per > 1 ? (inner.w - CELL) / (per - 1) : 0;
  return {
    x: Math.round(inner.x + col * spread),
    y: Math.round(inner.y + row * (inner.h - CELL) / Math.max(1, rows - 1 || 1)),
    w: CELL, h: CELL,
  };
}
const liftRect = () => ({ x: (BW - LIFT) / 2, y: (BH - LIFT) / 2, w: LIFT, h: LIFT });
const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** everything in the bag, one entry per thing, so a stack of two is two slots */
function laid(): string[] {
  const out: string[] = [];
  for (const s of bagStock()) for (let i = 0; i < s.n; i++) out.push(s.id);
  return out;
}

/** where the pointer is in canvas texels, or null if it is off the canvas */
function hit(e: MouseEvent): { x: number; y: number } | null {
  if (!cv) return null;
  const r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const x = (e.clientX - r.left) * (BW / r.width);
  const y = (e.clientY - r.top) * (BH / r.height);
  return x >= 0 && y >= 0 && x < BW && y < BH ? { x, y } : null;
}

function onMove(e: MouseEvent): void {
  ptr = hit(e);
  paint();
}

/**
 * ⚠ `click`, NOT `mousedown`, AND THAT IS LOAD-BEARING TWICE OVER.
 *
 *  · `main.ts` re-takes pointer lock on a CANVAS CLICK. Swallowing the click in
 *    the capture phase is what stops the cursor being snatched back the moment
 *    he touches the bag — without it the lock returns on the first click and
 *    mouse-look starts fighting him.
 *  · `main.ts` adds the `rmb` pseudo-key on a CANVAS MOUSEDOWN, and that is the
 *    key the carousel reads to let him OUT. A capture-phase swallow of
 *    mousedown would run before the canvas ever saw it and would strand him in
 *    the bag with no mouse-look and no exit — the worst bug this project ships.
 *    A right-click produces no `click` event at all, so this listener cannot
 *    touch it.
 */
function onClick(e: MouseEvent): void {
  if (e.button !== 0) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  const p = hit(e);
  if (!p) return;
  if (held) {
    // ON THE LIFTED THING: into your pockets, through the same `give` the whole
    // world uses. ANYWHERE ELSE: back in the bag. It cannot be destroyed — if
    // the pockets refuse it, it goes straight back.
    if (inRect(p.x, p.y, liftRect()) && purse && roomFor(purse, held) > 0) {
      if (bagTake(held)) {
        if (give(purse, held, 1) < 1) bagPut(held, bagCapacity());
        else onPurse?.();
      }
    }
    held = null;
    paint();
    return;
  }
  const items = laid();
  for (let i = 0; i < items.length; i++) {
    if (inRect(p.x, p.y, cellRect(i, items.length))) { held = items[i]; paint(); return; }
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key.toLowerCase() !== 'escape') return;
  // ESCAPE CLOSES IT, from every state including mid-lift. It does not release
  // the lock itself — it raises a flag the carousel reads, so the close runs
  // through `showBag(false)` like every other exit and there is one place that
  // hands the pointer back.
  escaped = true;
  held = null;
}

/** did Escape ask for the bag to close? Read once and cleared. */
export function bagEscaped(): boolean {
  const was = escaped;
  escaped = false;
  return was;
}

/** is the bag open right now — the carousel's own state, for the look freeze */
export function bagOpen(): boolean { return shown; }

function build(): void {
  wrap = document.getElementById('ct-bag') as HTMLDivElement | null;
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'ct-bag';
    // bottom-centre and BELOW the panel layer, because it is a held object and
    // not a cabinet. `pointer-events:none` on purpose: the clicks are read off
    // a window listener, so nothing here can swallow an event the world needs.
    wrap.style.cssText = 'position:fixed;left:50%;bottom:-8px;z-index:11;pointer-events:none;'
      + `transform:${CSS_HIDDEN};transition:transform .18s ease-out;`;
    cv = document.createElement('canvas');
    cv.width = BW; cv.height = BH;
    cv.style.cssText = `width:${BW * SCALE}px;height:${BH * SCALE}px;`
      + 'image-rendering:pixelated;display:block;';
    wrap.appendChild(cv);
    document.body.appendChild(wrap);
  } else {
    cv = wrap.firstChild as HTMLCanvasElement;
    cv.width = BW; cv.height = BH;
    cv.style.cssText = `width:${BW * SCALE}px;height:${BH * SCALE}px;`
      + 'image-rendering:pixelated;display:block;';
  }
}

/** one thing, in a box, from the world's own item art */
function item(g: CanvasRenderingContext2D, x: number, y: number, size: number, id: string): void {
  g.save();
  g.translate(x, y);
  g.scale(size / 24, size / 24);
  // `ItemDef.icon` DRAWS rather than blits, so scaling lands on the rects
  // themselves and the edges stay hard. That is why the art is a painter.
  try { itemOf(id).icon?.(g); } catch { /* an item with no art is not a crash */ }
  g.restore();
}

/**
 * A SOFT-CORNERED BAND — the shape everything here is built from.
 *
 * Stepped rows rather than `arcTo`, for the reason every curve in this world is
 * stepped: an antialiased edge on a flat-shaded surface is a second tone. The
 * corners are what stop a bag reading as a BOX, which is what the last one did.
 */
function band(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
              r: number, fill: string): void {
  g.fillStyle = fill;
  for (let i = 0; i < r; i++) {
    // a cosine step, so the corner rounds instead of chamfering flat
    const inset = Math.round(r - Math.sqrt(r * r - (r - i) * (r - i)));
    g.fillRect(Math.round(x + inset), Math.round(y + i), Math.round(w - inset * 2), 1);
    g.fillRect(Math.round(x + inset), Math.round(y + h - 1 - i), Math.round(w - inset * 2), 1);
  }
  g.fillRect(Math.round(x), Math.round(y + r), Math.round(w), Math.round(h - r * 2));
}

/**
 * ── WHAT EACH BAG'S MOUTH LOOKS LIKE ───────────────────────────────────────
 *
 * *"the bag that comes up when looking down on right click doesnt look like a
 *  bag try again."*   (2026-08-05)
 *
 * **IT WAS A BOX WITH A GRID IN IT, WHICH IS AN INVENTORY SCREEN.** A rectangle
 * with items in a tidy lattice at equal spacing is the one thing this project
 * has spent a whole session refusing to draw. What makes a bag read as a bag is
 * not its outline:
 *
 *   · THE MOUTH. You are looking DOWN into an open one, so the strongest cue is
 *     the opening itself — a soft-cornered gape with the lining showing at its
 *     rim and the interior receding into shadow below it. That is what was
 *     missing entirely.
 *   · SLUMP. Cloth does not hold a rectangle, so nothing here has a square
 *     corner and the rim is thicker at the near edge than the far one, because
 *     you are looking into it rather than at it.
 *   · ITS OWN HARDWARE, in its own `cloth` and `trim`: a backpack's drawstring
 *     eyelets, a tote's handles rising out of frame, a crossbody's flap, a
 *     clutch's clasp.
 *   · CONTENTS NESTED AND OVERLAPPING, sitting in the bag and against each
 *     other, not floating in a lattice with equal gaps.
 *
 * AND THE MOUTH'S SIZE IS THE CAPACITY, which is the part that makes this more
 * than decoration: a backpack gapes wide and holds 8, a clutch is a slim slot
 * and holds 2. You can see how much it takes by looking at it.
 */
const MOUTH: Record<string, { x: number; y: number; r: number }> = {
  pack: { x: 16, y: 30, r: 18 },      // round and deep
  tote: { x: 12, y: 38, r: 6 },       // a wide slot
  sling: { x: 40, y: 52, r: 14 },     // small, and flapped
  clutch: { x: 30, y: 74, r: 10 },    // a slim gape
};

function paint(): void {
  const g = cv?.getContext('2d');
  if (!g) return;
  const bag = bagWorn();
  const m = MOUTH[bag.kind] ?? MOUTH.tote;
  g.clearRect(0, 0, BW, BH);

  // ── THE BAG ITSELF, seen from above: cloth, slumped, running off the
  // bottom of the frame because it is against you.
  band(g, 4, 14, BW - 8, BH - 14, 20, bag.cloth);
  g.fillStyle = 'rgba(255,255,255,0.06)';                    // the light on its near wall
  g.fillRect(10, BH - 26, BW - 20, 12);

  // its hardware, per bag, and this is most of what tells them apart
  if (bag.kind === 'tote') {
    for (const x of [58, BW - 82]) { g.fillStyle = bag.trim; g.fillRect(x, 0, 22, 30); }
  } else if (bag.kind === 'pack') {
    g.fillStyle = bag.trim;                                   // drawstring eyelets
    for (let k = 0; k < 7; k++) g.fillRect(30 + k * 40, m.y - 10, 10, 8);
  } else if (bag.kind === 'sling') {
    band(g, 20, 8, BW - 40, 40, 10, bag.trim);                // the flap, thrown back
  } else if (bag.kind === 'clutch') {
    g.fillStyle = bag.trim; g.fillRect(BW / 2 - 24, m.y - 16, 48, 12);   // the clasp
  }

  // ── THE MOUTH: the lining at the rim, then the inside going dark ────────
  band(g, m.x, m.y, BW - m.x * 2, BH - m.y + 10, m.r, bag.trim);
  band(g, m.x + 7, m.y + 7, BW - (m.x + 7) * 2, BH - m.y - 4, Math.max(2, m.r - 5), '#20191a');
  g.fillStyle = 'rgba(0,0,0,0.35)';                          // it recedes
  g.fillRect(m.x + 8, m.y + 7, BW - (m.x + 8) * 2, 14);

  // ── AND WHAT IS IN IT, NESTED ──────────────────────────────────────────
  //
  // EVERYTHING AT ONCE AND NO SCROLLING. *"i want to be able to see all the
  // stuff i have in there at a glance. maybe scroll through stuff"* — the
  // "maybe" is a fallback and it is not needed: the largest bag holds 8, and 8
  // fit inside the mouth at the full 192 CSS px an item has had all along,
  // because they OVERLAP. Things in a bag lean on each other; a lattice with
  // equal gaps was the thing that made this read as a widget.
  const items = laid();
  items.forEach((id, i) => {
    if (held === id && items.indexOf(id) === i) return;
    const r = cellRect(i, items.length);
    const { x, y } = r;
    const hot = ptr && inRect(ptr.x, ptr.y, r) && !held;
    if (hot) { g.fillStyle = 'rgba(242,234,208,0.18)'; band(g, x - 3, y - 3, CELL + 6, CELL + 6, 6, 'rgba(242,234,208,0.18)'); }
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(x + 5, y + CELL - 8, CELL - 6, 8);            // it sits IN the bag
    item(g, x, y, CELL, id);
  });

  // ── AND WHAT HE HAS LIFTED OUT ─────────────────────────────────────────
  // Twice the size of the same thing in the bag, over a shadow of the whole
  // opening, so examining is holding it up rather than a tooltip about it.
  if (held) {
    g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(0, 0, BW, BH);
    const r = liftRect();
    item(g, r.x, r.y, LIFT, held);
  }
}

/**
 * Raise or lower it, and take or give back the mouse with it.
 *
 * ONE SEAM FOR EVERY EXIT. The carousel calls this every frame with what it
 * wants; the lock, the cursor, the listeners and the lifted item all follow
 * `want`, so cycling past the bag, looking back up, Escape, standing up and the
 * worn bag changing all close it the same way. Nothing else in this file
 * touches the pointer.
 */
export function showBag(want: boolean): void {
  if (!wrap) build();
  if (want) paint();
  if (want === shown) return;
  shown = want;
  wrap!.style.transform = want ? CSS_SHOWN : CSS_HIDDEN;
  if (want) {
    takePointer();
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
  } else {
    held = null;
    ptr = null;
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    givePointerBack();
  }
}

/** is there a bag to open at all? 0 capacity means the slot is empty */
export function hasBag(): boolean { return bagCapacity() > 0; }
