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
/** …and the floor it may shrink to in a small bag. 34 at 3x is still 102 CSS
 *  px a side — a clutch's contents are smaller than a backpack's, which is the
 *  point of a clutch, but never small enough to stop being legible. */
const CELL_MIN = 34;
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
/** put one on the ground at his feet. Supplied by the entry point, because
 *  only it has the ctx a world object has to be registered against. */
let dropOut: ((id: string) => boolean) | null = null;
/**
 * A PRESS THAT HAS NOT TRAVELLED YET — the same shape the mirror used before
 * click-to-cycle replaced it. A press with no travel LIFTS the thing to look at
 * it; a press that moves DRAGS it, and where you let go decides what happens.
 * 6 px, so a hand that shakes on a click does not throw your dinner on the
 * floor.
 */
let pending: { id: string; i: number; x: number; y: number } | null = null;
let dragging: string | null = null;
const GRAB_PX = 6;

const CSS_HIDDEN = 'translateX(-50%) translateY(150%)';
const CSS_SHOWN = 'translateX(-50%) translateY(0)';

/** the purse the bag moves things into. Handed in once by the entry point. */
export function configureBag(o: {
  purse: Purse; refreshWallet: () => void; drop: (id: string) => boolean;
}): void {
  purse = o.purse;
  onPurse = o.refreshWallet;
  dropOut = o.drop;
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
  // PROMOTE A PRESS INTO A DRAG once it has travelled. The lifted-to-examine
  // state and the dragging state are different things: one is held up to your
  // eye, the other is being carried out of the bag, so a drag never enters the
  // examine view and cannot be left there.
  if (pending && ptr && Math.hypot(ptr.x - pending.x, ptr.y - pending.y) > GRAB_PX) {
    dragging = pending.id;
    held = null;
    pending = null;
  }
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
/**
 * ── LETTING GO ─────────────────────────────────────────────────────────────
 *
 * OUTSIDE THE MOUTH IS THE FLOOR. That is the whole rule and it is why the
 * mouth had to be a real shape first: you drag a thing up out of the opening
 * and let go, and it is on the ground. Release back inside and it settles into
 * the bag, unchanged.
 *
 * ⚠ THE POINTER CANNOT BE STRANDED BY THIS. The drag ends on `mouseup`, which
 * this file listens for on the WINDOW — so a release off the canvas, off the
 * window, or with the bag closing under it all end the drag. Nothing about the
 * lock is touched here; `showBag(false)` is still the only thing that gives it
 * back, and it clears `dragging` with everything else.
 */
function onUp(e: MouseEvent): void {
  if (e.button !== 0) return;
  const id = dragging;
  const p = hit(e);
  dragging = null;
  if (!id) return;
  const items = laid();
  const L = layout(items.length);
  const inside = p && inRect(p.x, p.y, L.mouth);
  if (!inside && bagTake(id)) {
    // OUT OF THE STORE AND INTO THE WORLD. `bagTake` first, so the item is
    // never in two places; if the world refuses to build it, it goes straight
    // back rather than vanishing.
    if (!dropOut?.(id)) bagPut(id, bagCapacity());
    else onPurse?.();
  }
  paint();
}

function onClick(e: MouseEvent): void {
  if (e.button !== 0) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  // a click that ended a drag is not also a lift
  if (pending === null && dragging === null && ptr === null) return;
  const p = hit(e);
  if (!p) { pending = null; return; }
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
    if (inRect(p.x, p.y, layout(items.length).at(i))) { held = items[i]; paint(); return; }
  }
}

/** the press that a drag or a lift both start from */
function onDown(e: MouseEvent): void {
  if (e.button !== 0) return;
  const p = hit(e);
  if (!p) return;
  const items = laid();
  const L = layout(items.length);
  for (let i = 0; i < items.length; i++) {
    if (inRect(p.x, p.y, L.at(i))) { pending = { id: items[i], i, x: p.x, y: p.y }; return; }
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
 * ── WHAT EACH BAG IS, AND WHY FOUR SIZES WERE NOT ENOUGH ───────────────────
 *
 * *"the problem is the edge exists top, left, right, but not bottom, which
 *  make the shape incomplete. also the shape is the same across all bags. also
 *  different sized bags should have different sizes"*   (2026-08-05)
 *
 * THREE FAULTS, AND THE FIRST WAS MY OWN CHOICE BACKFIRING. The bag slid up
 * from the bottom of the frame and ran off it, deliberately, so it would feel
 * HELD rather than displayed — and the price was a silhouette with no bottom
 * edge, which reads as an unfinished shape rather than an object. **The
 * complete shape wins.** The whole bag is in frame now with 10 texels of air
 * under it, so it closes on all four sides. It still rises into view, which is
 * what made it feel carried; it simply stops before the edge.
 *
 * AND SIZE ALONE DOES NOT DIFFERENTIATE. I reported the mouth's width as the
 * capacity and he is right that it does not read: four of one shape at four
 * scales is one bag. So they differ in STRUCTURE — outline, rim, hardware —
 * and you should be able to name one with the contents taken out:
 *
 *   BACKPACK   round and deep, a big round cinched collar, drawstring eyelets
 *              round it, and both shoulder straps down the sides
 *   TOTE       wide, shallow, square-cornered cloth, two handles rising off
 *              the rim, no flap and no fastening at all
 *   CROSSBODY  small, most of it under a flap thrown back over the top, with
 *              a buckle on the flap's tongue
 *   CLUTCH     slim, no strap and no handle anywhere, a clasp bar across the
 *              top edge with a stud in the middle
 *
 * THE WHOLE VIEW SCALES WITH THE BAG, not just the mouth inside a fixed
 * footprint: `hold` 2 draws at 72% and `hold` 8 at 100%, so a clutch is small
 * in frame and a backpack fills it. Capacity is legible three ways now — the
 * bag's size, its mouth, and how much is in it.
 */
type Kind = { ix: number; iy: number; ih: number; r: number };
const KIND: Record<string, Kind> = {
  pack: { ix: 0.16, iy: 0.26, ih: 0.56, r: 0.26 },
  tote: { ix: 0.06, iy: 0.16, ih: 0.46, r: 0.05 },
  sling: { ix: 0.18, iy: 0.54, ih: 0.34, r: 0.13 },
  clutch: { ix: 0.10, iy: 0.28, ih: 0.44, r: 0.11 },
};

/**
 * ONE LAYOUT, READ BY THE PAINTER AND THE HIT-TEST. They cannot drift, which
 * is what stops you clicking a thing where a different one is drawn.
 */
function layout(n: number) {
  const kind = bagWorn().kind;
  const k = 0.72 + 0.28 * Math.min(1, Math.max(0, (bagCapacity() - 2) / 6));
  const bw = Math.round((BW - 28) * k), bh = Math.round((BH - 30) * k);
  const bx = Math.round((BW - bw) / 2), by = BH - 10 - bh;
  const K = KIND[kind] ?? KIND.tote;
  const mouth = {
    x: Math.round(bx + bw * K.ix), y: Math.round(by + bh * K.iy),
    w: Math.round(bw * (1 - 2 * K.ix)), h: Math.round(bh * K.ih),
  };
  // things lean on each other inside the mouth rather than sitting in a
  // lattice, and they shrink to what the mouth can hold rather than the mouth
  // growing to fit them — a clutch is small and that is the point of it.
  const cell = Math.max(CELL_MIN, Math.min(CELL, mouth.h - 10));
  const rows = n > 4 ? 2 : 1;
  const per = Math.ceil(n / rows) || 1;
  const inner = { x: mouth.x + 8, w: mouth.w - 16 };
  const spread = per > 1 ? (inner.w - cell) / (per - 1) : 0;
  const rowGap = rows > 1 ? Math.max(10, mouth.h - cell - 12) / (rows - 1) : 0;
  const at = (i: number) => ({
    x: Math.round(inner.x + (i % per) * spread),
    y: Math.round(mouth.y + 8 + Math.floor(i / per) * rowGap),
    w: cell, h: cell,
  });
  return { bx, by, bw, bh, mouth, kind, cell, at, r: Math.round(bw * K.r) };
}

function paint(): void {
  const g = cv?.getContext('2d');
  if (!g) return;
  const bag = bagWorn();
  const items = laid();
  const L = layout(items.length);
  g.clearRect(0, 0, BW, BH);

  // ── THE HARDWARE THAT GOES BEHIND THE BODY ─────────────────────────────
  if (L.kind === 'pack') {
    // both shoulder straps, down the sides, disappearing behind it
    for (const x of [L.bx - 6, L.bx + L.bw - 12]) {
      band(g, x, L.by + L.bh * 0.18, 18, L.bh * 0.9, 8, bag.trim);
    }
  } else if (L.kind === 'tote') {
    // two handles standing off the rim — the tote's whole tell
    for (const x of [L.bx + L.bw * 0.22, L.bx + L.bw * 0.72]) {
      band(g, Math.round(x), L.by - 20, Math.round(L.bw * 0.06), 40, 4, bag.trim);
    }
  }

  // ── THE BODY ───────────────────────────────────────────────────────────
  band(g, L.bx, L.by, L.bw, L.bh, L.r, bag.cloth);
  g.fillStyle = 'rgba(255,255,255,0.06)';                    // light on the near wall
  g.fillRect(L.bx + 10, L.by + L.bh - 22, L.bw - 20, 12);
  g.fillStyle = 'rgba(0,0,0,0.18)';                          // and its own shadow under it
  g.fillRect(L.bx + 14, L.by + L.bh - 4, L.bw - 28, 6);

  // ── THE MOUTH: lining at the rim, then the inside going dark ───────────
  band(g, L.mouth.x, L.mouth.y, L.mouth.w, L.mouth.h, Math.round(L.r * 0.6), bag.trim);
  band(g, L.mouth.x + 6, L.mouth.y + 6, L.mouth.w - 12, L.mouth.h - 12,
    Math.max(2, Math.round(L.r * 0.4)), '#20191a');
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(L.mouth.x + 7, L.mouth.y + 6, L.mouth.w - 14, 12);

  // ── AND THE HARDWARE THAT GOES IN FRONT ────────────────────────────────
  if (L.kind === 'pack') {
    g.fillStyle = bag.trim;                                  // drawstring eyelets
    const n = 6, step = (L.mouth.w - 16) / (n - 1);
    for (let i = 0; i < n; i++) g.fillRect(Math.round(L.mouth.x + 8 + i * step) - 4, L.mouth.y - 5, 8, 7);
  } else if (L.kind === 'sling') {
    // the flap, thrown back over the top — most of this bag is flap
    band(g, L.bx + 4, L.by - 6, L.bw - 8, Math.round(L.bh * 0.5), Math.round(L.r * 0.8), bag.trim);
    g.fillStyle = 'rgba(0,0,0,0.20)';
    g.fillRect(L.bx + 8, L.by + Math.round(L.bh * 0.5) - 10, L.bw - 16, 5);
    band(g, Math.round(L.bx + L.bw / 2 - 12), L.by + Math.round(L.bh * 0.5) - 8, 24, 18, 4, bag.cloth);
    g.fillStyle = '#2a2620';                                 // the buckle
    g.fillRect(Math.round(L.bx + L.bw / 2 - 7), L.by + Math.round(L.bh * 0.5) - 3, 14, 9);
  } else if (L.kind === 'clutch') {
    band(g, L.bx + 10, L.by - 4, L.bw - 20, 16, 5, bag.trim);   // the clasp bar
    g.fillStyle = '#d8cfb4';
    g.fillRect(Math.round(L.bx + L.bw / 2 - 5), L.by - 1, 10, 9);   // its stud
  }

  // ── WHAT IS IN IT ──────────────────────────────────────────────────────
  items.forEach((id, i) => {
    if ((held === id || dragging === id) && items.indexOf(id) === i) return;
    const r = L.at(i);
    if (ptr && inRect(ptr.x, ptr.y, r) && !held) {
      band(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 6, 'rgba(242,234,208,0.18)');
    }
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(r.x + 5, r.y + r.h - 8, r.w - 6, 8);          // it sits IN the bag
    item(g, r.x, r.y, r.w, id);
  });

  // ── WHAT IS ON THE CURSOR, ON ITS WAY OUT ──────────────────────────────
  // No dimming behind it: he is moving a thing, not examining one, and the bag
  // has to stay legible so he can see whether he is still over its mouth.
  if (dragging && ptr) {
    const L2 = layout(laid().length);
    const out = !inRect(ptr.x, ptr.y, L2.mouth);
    if (out) {
      // a shadow on the floor under it, which is the only thing that says
      // "let go here and it lands"
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(Math.round(ptr.x - 26), Math.round(ptr.y + 20), 52, 8);
    }
    item(g, Math.round(ptr.x - 28), Math.round(ptr.y - 28), 56, dragging);
  }

  // ── AND WHAT HE HAS LIFTED OUT ─────────────────────────────────────────
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
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
  } else {
    held = null;
    ptr = null;
    pending = null;
    dragging = null;
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('mousedown', onDown, true);
    window.removeEventListener('mouseup', onUp, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    givePointerBack();
  }
}

/** is there a bag to open at all? 0 capacity means the slot is empty */
export function hasBag(): boolean { return bagCapacity() > 0; }
