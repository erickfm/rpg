import { takePointer, givePointerBack, type Purse } from './hud';
import { bagStock, bagTake, bagPut, give, roomFor, itemOf } from './inventory';
import { bagWorn } from './wardrobe';

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
// ⚠ THE CANVAS GREW WITH THE SPRITES, WHICH IS THE WHOLE OF WHY 8 STILL FIT.
// *"i want all the sprites to be a bit bigger in the bag"* — and the mouth is
// what bounds them, so raising `CELL` alone would have spent the increase on
// overlap: measured, 64 -> 76 inside a 320-wide canvas takes the backpack's
// eight from 38% overlapped to 53%, which is most of each item hidden. Growing
// the canvas 320 x 200 -> 368 x 230 in step holds the overlap at 39% while the
// sprite gains 19%. Eight still fit at a glance, no scrolling, nothing shrinks.
const BW = 368, BH = 230, SCALE = 3;

/**
 * ── THE CANVAS IS THE WHOLE SCREEN, AND THE BAG SITS IN THE CORNER OF IT ───
 *
 * *"also drag to drop should extend to full view, so the item doesnt just
 *  become invisible after a radius away from the bag"*   (2026-08-05)
 *
 * HE IS DESCRIBING A CLIP, AND HE IS EXACTLY RIGHT. The dragged item was drawn
 * into the bag's own 368 x 230 canvas at the cursor's position, and `hit()`
 * returned NULL the moment the cursor left that canvas — so past the bag's
 * edge there was no position to draw at and the thing in his hand disappeared.
 * The drop still worked; only the picture was wrong, which is the worst kind
 * of wrong because it reads as the item being destroyed.
 *
 * SO THE CANVAS NOW COVERS THE VIEWPORT and the bag is drawn into the bottom
 * centre of it under a translate. Everything downstream is untouched: `layout`
 * still works in the bag's own 368 x 230 space, `hit()` still returns that
 * space — it simply no longer refuses to go outside it, so the coordinates go
 * negative to the left and past 368 to the right and the item follows the
 * cursor to the corners of the screen.
 *
 * `pointer-events:none` on the wrap is what makes a full-screen canvas safe:
 * it cannot swallow a click the world needs, and every listener here is on the
 * window anyway.
 */
let VW = BW, VH = BH;            // the canvas, in texels — tracks the window
/** where the bag's own origin sits inside that canvas */
const originX = () => Math.round((VW - BW) / 2);
const originY = () => VH - BH;
/**
 * HOW BIG ONE THING IN THE BAG IS, in texels. 64 at 3x is **192 CSS pixels a
 * side** — the drawer's own scale, and the number this whole session turned on:
 * an item at 4% of the frame is a smudge, one at a third of it is legible.
 * **It did not shrink when the layout changed**; the items overlap instead.
 */
// 76 at 3x is 228 CSS px a side, up from 192. See `BW`.
//
// ⚠ 96 NOW, AND THE HIGHLIGHT DID NOT GROW WITH IT.
// *"the surrounding highlighting of the object is too big. i would prefer the
//  item be bigger without making the highlighting bigger. too much blank space
//  essentially"*   (2026-08-05)
//
// The highlight used to be an OUTSET — `r.x - 3, r.w + 6` — so it was always
// bigger than the cell, and the cell was already bigger than the art inside it.
// Two layers of air round every object. It is an INSET now (`HL_HUG`), which
// hugs the thing instead of floating round it, and the cell went 76 -> 96 in
// the same move. Net, at 3x CSS: the item gains 26% (228 -> 288 px a side) and
// the highlight lands at 224 px, which is 4 px SMALLER than the old cell it
// used to wrap with 18 px to spare. Bigger object, smaller highlight, exactly
// the sentence.
// …AND BACK TO 88 WHEN THE PIPS CAME OUT. The blank space he was naming was
// between the highlight and the object, and `HL_HUG` is what actually fixed it;
// 96 was me spending the whole increase on the cell as well, which cost columns
// — the backpack's mouth held two at 96 and holds three at 88. Still +16% on
// the 76 it was. The rule this file keeps relearning: fix the thing he named.
const CELL = 88;
/** how far the highlight sits INSIDE the cell, as a fraction of it. The art is
 *  drawn in a 24-unit box and typically fills 18-20 of it, so a hug at 78% of
 *  the cell lands ON the object rather than floating round it or cropping it. */
const HL_HUG = 0.11;
/** the air between cells in the grid */
const CELL_GAP = 6;
/** The option plates. `PLATE` is the letters' own paper from `ct/tenancy.ts`
 *  and `PLATE_INK` its typewriter ink — sampled from the world rather than
 *  invented, and the same in every bag so legibility never depends on cloth.
 *  See the note at the plates in `paintOver`. */
const PLATE = '#e6e1cd', PLATE_INK = '#2b2620';
const PLATE_W = 78, PLATE_H = 19, PLATE_PX = 11;
/** …and the floor it may shrink to in a small bag — 54 at 3x is 162 CSS px a
 *  side. A clutch's contents are smaller than a backpack's, which is the point
 *  of a clutch, but never small enough to stop being legible. Raised 42 -> 54
 *  with `CELL`, in the same ratio, so a clutch gained what a backpack did. */
const CELL_MIN = 54;
/** and how big it gets when you lift it out to look at it */
const LIFT = 160;
/** …and how big it is on the cursor on its way out of the bag */
const DRAG = 72;

let wrap: HTMLDivElement | null = null;
let cv: HTMLCanvasElement | null = null;
let shown = false;
/** what he has lifted out of the bag to look at, or null */
let held: string | null = null;
/**
 * ── THE ITEM HE HAS OPENED THE OPTIONS ON ─────────────────────────────────
 *
 * *"on click on item i want options for it. just like a little menu integrated
 *  no like close up view how it currently is. options could be like drop, use,
 *  etc"*   (2026-08-05)
 *
 * Clicking used to lift a thing straight to a close-up. Now it offers the
 * VERBS, and the close-up is one of them — demoted from the default to a
 * choice, which is exactly what he asked for.
 *
 * **"INTEGRATED" IS THE WORD THIS IS BUILT AROUND.** The options are not a
 * context menu floating over the game; they are stencilled plates on the bag's
 * own lining, in the bag's own `trim`, inside its mouth, at the item they
 * belong to. Same materials and palette as everything else in the view.
 *
 * ⚠ AND THEY ARE WORDS, WHICH IS WORTH NAMING RATHER THAN CROSSING QUIETLY.
 * Icons for DROP and EXAMINE at this size would be two unreadable smudges —
 * that is the lesson five wardrobe presentations paid for — so the honest
 * choice was type printed ON the object rather than pictograms nobody can
 * read. If he wants them wordless the answer is not smaller icons, it is
 * fewer verbs.
 */
let menu: { id: string; i: number } | null = null;
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
/**
 * A DRAG JUST ENDED, SO THE `click` THAT FOLLOWS IT IS NOT A CLICK.
 *
 * *"i want to be able to unclick by clicking. i click and im holding it but i
 *  cant unclick"*   (2026-08-05)
 *
 * **THIS IS WHY HE COULD NOT DESELECT, AND THE GUARD I WROTE FOR IT WAS DEAD.**
 * A browser fires `mouseup` and then `click`. Any press that travels more than
 * `GRAB_PX` becomes a drag — which is most real mouse clicks — so the sequence
 * was: the drag starts and clears the options, `onUp` settles the item back and
 * clears `dragging`, and then the trailing `click` arrives, finds no options
 * open, falls through to the item loop and SELECTS IT AGAIN. Every attempt to
 * unclick re-clicked. The old guard tested `dragging === null`, which `onUp`
 * had already made true a moment earlier, so it could never fire.
 *
 * A flag set at the end of the drag and consumed by the next click is the fix:
 * it is the one thing that survives between the two events.
 */
let afterDrag = false;
const GRAB_PX = 6;
/**
 * ── THE FIRST VISIBLE ROW ──────────────────────────────────────────────────
 *
 * *"also should be able to scroll in bag. like rows of items"*   (2026-08-05)
 *
 * It used to be true that everything fitted — eight in a backpack, two rows,
 * no scrolling — and that was the argument for not building this. Cells went
 * 76 -> 96 for the other half of the same message, which is what changed: a
 * grid of 96s does not put eight in a mouth any more, so the rows have to move.
 *
 * IT CLAMPS AND DOES NOT WRAP. Wrapping costs you the one thing a scroll tells
 * you for free — how much is left — and a bag with four things in it that
 * scrolls for ever is a bag you cannot count. At the top the wheel does
 * nothing; at the bottom likewise. A bag whose contents all fit (a clutch
 * always, a backpack when it is half empty) never scrolls and shows no pips.
 *
 * RE-CLAMPED IN `layout` RATHER THAN AT THE WHEEL, because the contents change
 * under it: drop the last two things while scrolled to the bottom and the band
 * you are looking at stops existing. Clamping where the row count is actually
 * known is the only place that cannot go stale.
 */
let scroll = 0;

// ⚠ NO `translateX(-50%)` ANY MORE, and no `150%` either. The wrap used to be
// a bag-sized box pinned at `left:50%`, so both were relative to the BAG. It is
// the whole viewport now, and a 150% slide would push it a screen and a half
// down while the -50% would put it off to one side. The slide is expressed in
// the bag's own height in CSS pixels instead, which is the distance that was
// always meant: far enough that the bag clears the bottom edge, and no further.
const CSS_HIDDEN = `translateY(${BH * SCALE}px)`;
const CSS_SHOWN = 'translateY(0)';

/** the purse the bag moves things into. Handed in once by the entry point. */
export function configureBag(o: {
  purse: Purse; refreshWallet: () => void; drop: (id: string) => boolean;
}): void {
  purse = o.purse;
  onPurse = o.refreshWallet;
  dropOut = o.drop;
}


// CENTRED IN THE VIEWPORT, not in the bag. The wash behind it covers the whole
// screen now, so an object centred on a 368 x 230 patch at the bottom of it
// would sit oddly low in its own spotlight. Expressed in bag space, because
// that is the space `paint` is translated into.
const liftRect = () => ({
  x: (VW - LIFT) / 2 - originX(), y: (VH - LIFT) / 2 - originY(), w: LIFT, h: LIFT,
});
const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** everything in the bag, one entry per thing, so a stack of two is two slots */
function laid(): string[] {
  const out: string[] = [];
  if (!purse) return out;
  for (const s of bagStock(purse)) for (let i = 0; i < s.n; i++) out.push(s.id);
  return out;
}

/**
 * Where the pointer is IN THE BAG'S OWN SPACE — the same 368 x 230 every
 * coordinate in this file is written in, with its origin at the bag's top left.
 *
 * ⚠ IT NO LONGER REFUSES TO GO OUTSIDE THAT BOX, and that is the fix for *"the
 * item doesnt just become invisible after a radius away from the bag"*. It used
 * to return null past the bag's edge, which left the drag with no position to
 * draw at. Off to the left is negative x now, off to the right is past 368, and
 * the item follows the cursor to the corners of the screen. Null still means
 * one thing and one thing only: there is no canvas to measure against.
 *
 * Everything that used to read null as "off the bag" asks `inRect` against the
 * bag's own rect instead, which is what it actually meant.
 */
function hit(e: MouseEvent): { x: number; y: number } | null {
  if (!cv) return null;
  const r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return {
    x: (e.clientX - r.left) * (VW / r.width) - originX(),
    y: (e.clientY - r.top) * (VH / r.height) - originY(),
  };
}
/** is a bag-space point on the bag at all — what `hit() === null` used to mean */
const onBag = (p: { x: number; y: number } | null) =>
  !!p && p.x >= 0 && p.y >= 0 && p.x < BW && p.y < BH;

function onMove(e: MouseEvent): void {
  ptr = hit(e);
  // PROMOTE A PRESS INTO A DRAG once it has travelled. The lifted-to-examine
  // state and the dragging state are different things: one is held up to your
  // eye, the other is being carried out of the bag, so a drag never enters the
  // examine view and cannot be left there.
  if (pending && ptr && Math.hypot(ptr.x - pending.x, ptr.y - pending.y) > GRAB_PX) {
    dragging = pending.id;
    held = null;
    menu = null;
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
  pending = null;
  if (!id) return;
  afterDrag = true;                 // the `click` behind this one is not one
  const items = laid();
  const L = layout(items.length);
  const inside = p && inRect(p.x, p.y, L.mouth);
  if (!inside && purse && bagTake(purse, id)) {
    // OUT OF THE STORE AND INTO THE WORLD. `bagTake` first, so the item is
    // never in two places; if the world refuses to build it, it goes straight
    // back rather than vanishing.
    if (!dropOut?.(id)) bagPut(purse!, id);
    else onPurse?.();
  }
  paint();
}

function onClick(e: MouseEvent): void {
  if (e.button !== 0) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  // A CLICK THAT ENDED A DRAG IS NOT ALSO A CLICK — see `afterDrag`. Consumed
  // here, so the next genuine press is unaffected.
  if (afterDrag) { afterDrag = false; pending = null; return; }
  const p = hit(e);
  pending = null;
  // OFF THE BAG ALTOGETHER PUTS EVERYTHING AWAY. `hit()` no longer returns null
  // for that (it has to keep reporting a position so a drag can leave the bag),
  // so the question is asked directly — which is what the old null test meant.
  if (!onBag(p)) { menu = null; held = null; paint(); return; }
  if (!p) return;
  if (held) {
    // ON THE LIFTED THING: into your pockets, through the same `give` the whole
    // world uses. ANYWHERE ELSE: back in the bag. It cannot be destroyed — if
    // the pockets refuse it, it goes straight back.
    // ⚠ A CLICK OUT OF THE CLOSE-UP PUTS IT BACK AND DOES NOTHING ELSE. It used
    // to POCKET the thing if the click landed on it, which is a second hidden
    // verb on the same gesture he is trying to use to cancel — exactly the
    // "i'm holding it and i can't unclick" trap. Taking it into your pockets is
    // a verb and belongs on a plate with the others, not on a stray click.
    held = null;
    menu = null;
    paint();
    return;
  }
  // ── A PLATE, IF THE OPTIONS ARE UP ──────────────────────────────────────
  if (menu) {
    const opts = verbsFor(menu.id);
    const rects = plateRects(menu.i, opts.length);
    for (let k = 0; k < opts.length; k++) {
      if (!inRect(p.x, p.y, rects[k])) continue;
      const v = opts[k];
      const id = menu.id;
      menu = null;
      if (v === 'EXAMINE') held = id;
      else if (v === 'DROP') {
        // THE SAME DROP THE DRAG USES — `bagTake` then `dropLoose`, landing at
        // his feet with its own pick-up spot. Not a second path: one verb, one
        // implementation, so a thing dropped from the menu and a thing dragged
        // out are the same object in the same place.
        if (purse && bagTake(purse, id)) { if (!dropOut?.(id)) bagPut(purse, id); else onPurse?.(); }
      } else if (purse && itemOf(id).use && v === itemOf(id).use!.verb.toUpperCase()) {
        // ── USING A THING MAY TURN IT INTO ANOTHER THING ──────────────────
        //
        // The parcel is the first tenant of this: OPEN takes the sealed box out
        // of the bag, rolls its contents AT THAT MOMENT, and puts what it
        // found back in the same slot the box vacated. So the bag can never be
        // too full to hold the result — the thing making room IS the thing
        // being replaced.
        //
        // An act that returns nothing consumes the item outright, which is what
        // eating something will do.
        if (bagTake(purse, id)) {
          const got = itemOf(id).use!.act(purse);
          if (typeof got === 'string') bagPut(purse, got);
          onPurse?.();
        }
      }
      paint();
      return;
    }
    // ANYWHERE ELSE DISMISSES WITHOUT ACTING — including the item itself, which
    // is the click-to-unclick he asked for: click to pick it, click it again to
    // put it down. Nothing is dropped, nothing is used, it simply settles back.
    menu = null;
    paint();
    return;
  }
  const items = laid();
  const LL = layout(items.length);
  // ⚠ THE VISIBLE BAND ONLY, or a row scrolled out of sight is still clickable
  // where its rectangle used to be — the classic trap in bolting a scroll onto
  // a hit-test that works by rectangle.
  for (let i = LL.from; i < LL.to; i++) {
    if (inRect(p.x, p.y, LL.at(i))) {
      // an explicit toggle as well as the dismiss above, so the intent survives
      // whatever the branch order becomes later
      const open = menu as { id: string; i: number } | null;
      menu = open && open.i === i ? null : { id: items[i], i };
      paint();
      return;
    }
  }
}

/**
 * WHICH VERBS THIS THING ACTUALLY SUPPORTS — never a dead option.
 *
 * EXAMINE and DROP are true of everything: anything can be looked at and
 * anything can be put on the floor. USE appears only where the item table
 * declares one, and nothing declares one yet — see `ItemDef.use` for what that
 * still needs.
 */
function verbsFor(id: string): string[] {
  const v = ['EXAMINE', 'DROP'];
  if (itemOf(id).use) v.splice(1, 0, itemOf(id).use!.verb.toUpperCase());
  return v;
}

/** where the plates sit: stacked under the item, or above it if the mouth runs
 *  out — a clutch's opening is short and the options still have to land in it */
function plateRects(i: number, n: number, wIn = PLATE_W) {
  const L = layout(laid().length);
  const r = L.at(i);
  const w = wIn, h = PLATE_H, gap = 3;
  const below = r.y + r.h + 2;
  // ⚠ CLAMPED INTO THE OPENING, NOT ALLOWED TO ESCAPE ABOVE IT. The old rule
  // was "below the item, or above it if the mouth runs out", and `above` put
  // the stack on the LID — which is how EXAMINE and DROP ended up printed on
  // the crossbody's flap in his shot, off the lining they are supposed to be
  // stencilled on. Now it prefers below, falls back to above, and then clamps
  // the whole stack inside the mouth either way.
  const stack = n * (h + gap);
  const lo = L.mouth.y + 3, hi = L.mouth.y + L.mouth.h - 3 - stack;
  const want = below + stack <= L.mouth.y + L.mouth.h - 3 ? below : r.y - stack - 2;
  const top = Math.max(lo, Math.min(want, Math.max(lo, hi)));
  const x = Math.min(Math.max(r.x + r.w / 2 - w / 2, L.mouth.x + 4), L.mouth.x + L.mouth.w - w - 4);
  return Array.from({ length: n }, (_, k) => ({ x, y: top + k * (h + gap), w, h }));
}

/** the press that a drag or a lift both start from */
function onDown(e: MouseEvent): void {
  if (e.button !== 0) return;
  const p = hit(e);
  if (!onBag(p) || !p) return;
  const items = laid();
  const L = layout(items.length);
  // the visible band only — see the same guard in `onClick`
  for (let i = L.from; i < L.to; i++) {
    if (inRect(p.x, p.y, L.at(i))) { pending = { id: items[i], i, x: p.x, y: p.y }; return; }
  }
}

function onKey(e: KeyboardEvent): void {
  const k = e.key.toLowerCase();
  /**
   * ── `E` PUTS THE BAG DOWN ────────────────────────────────────────────────
   *
   * *"e overlay should go away and pressing e should close bag"*  (2026-08-05)
   *
   * OUTRIGHT, NOT PEELING, AND THAT IS A DECISION. Escape peels — options, then
   * the close-up, then the bag — because Escape means "back". `E` is the key
   * that OPENS things in this world, and pressing it while holding a bag reads
   * as "done with this", not as "back one step". So it closes the whole thing
   * from any state, including with the options up or an item lifted.
   *
   * ⚠ AND IT MUST NOT ALSO OPEN A DOOR. `E` is a HELD key: `main.ts` puts it
   * into a key-state map on keydown and the world's spot picker polls that map.
   * Swallowing the keydown in the CAPTURE phase on `window` — which runs before
   * anything else in the document sees it — means the key never enters the map
   * at all, so no spot behind the bag can fire on the same press. The matching
   * keyup then clears a key that was never set, which is harmless.
   *
   * IT DOES NOT TOUCH THE POINTER ITSELF. Same as Escape: it raises `escaped`
   * and the carousel closes the bag through `showBag(false)`, which is the one
   * seam that owns the lock, the cursor, the listeners and the lifted item.
   * Right-click, looking back up, Escape, standing up, the worn bag changing,
   * and now `E` all leave through it, so mouse-look comes back on every one.
   */
  if (k === 'e') {
    e.stopImmediatePropagation();
    e.preventDefault();
    escaped = true;
    menu = null;
    held = null;
    return;
  }
  if (k !== 'escape') return;
  // ESCAPE PEELS ONE LAYER AT A TIME and never adds a second way out: the
  // options first, then the close-up, then the bag itself. Only that last step
  // touches the carousel, so the pointer is still handed back by the one seam
  // that has always done it.
  if (menu || held) { menu = null; held = null; paint(); e.stopImmediatePropagation(); return; }
  // ESCAPE CLOSES IT, from every state including mid-lift. It does not release
  // the lock itself — it raises a flag the carousel reads, so the close runs
  // through `showBag(false)` like every other exit and there is one place that
  // hands the pointer back.
  escaped = true;
  held = null;
}

/**
 * THE WHEEL SCROLLS THE ROWS. It is swallowed while the bag is up, exactly the
 * way the mirror takes it to turn the figure and the letter takes it to turn the
 * page — the world's fov zoom is the default, never the only claim on it.
 * `passive: false` because a wheel listener that cannot `preventDefault` cannot
 * stop the page reacting.
 */
function onWheel(e: WheelEvent): void {
  e.stopImmediatePropagation();
  e.preventDefault();
  // NOTHING TO SCROLL IS NOT AN ERROR — a clutch holds two and never has a
  // second row. `layout` re-clamps, so this only has to move in the right
  // direction.
  scroll += e.deltaY > 0 ? 1 : -1;
  paint();
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
    // FULL-SCREEN AND BELOW THE PANEL LAYER, because it is a held object and
    // not a cabinet. `pointer-events:none` on purpose, and doubly so now that
    // it covers the viewport: the clicks are read off window listeners, so
    // nothing here can swallow an event the world needs.
    wrap.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:11;'
      + `pointer-events:none;transform:${CSS_HIDDEN};transition:transform .18s ease-out;`;
    cv = document.createElement('canvas');
    wrap.appendChild(cv);
    document.body.appendChild(wrap);
  } else {
    cv = wrap.firstChild as HTMLCanvasElement;
  }
  fit();
}

/**
 * Size the canvas to the window.
 *
 * ONE TEXEL IS `SCALE` CSS PIXELS, always — the canvas grows and shrinks with
 * the window rather than being stretched to it, so the bag's art keeps the same
 * chunk on screen at every window size and `image-rendering:pixelated` stays
 * honest. The bag itself does not move relative to the bottom edge: `originY`
 * is `VH - BH`, so it stays seated on the bottom of the frame.
 */
function fit(): void {
  if (!cv) return;
  VW = Math.max(BW, Math.ceil(window.innerWidth / SCALE));
  VH = Math.max(BH, Math.ceil(window.innerHeight / SCALE));
  cv.width = VW; cv.height = VH;
  cv.style.cssText = `width:${VW * SCALE}px;height:${VH * SCALE}px;`
    + 'image-rendering:pixelated;display:block;';
}
function onResize(): void { fit(); paint(); }

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
/**
 * ── AND THEN: MOSTLY INVENTORY, NOT MOSTLY BAG ─────────────────────────────
 *
 * *"all the bags are too much bag btw. should be mostly inventory, not mostly
 *  bag"*   (2026-08-05)
 *
 * The container was winning the picture. These four numbers are the mouth as a
 * fraction of the bag, and they have been opened up so the INSIDE is most of
 * what he sees — measured as mouth area over bag area:
 *
 *              was      now
 *   pack       49%      62%
 *   tote       40%      75%
 *   sling      22%      46%
 *   clutch     35%      62%
 *
 * ⚠ OPENED, NOT DELETED — and this is the tension, because the version before
 * these four shapes existed was rejected for being *"a box with a grid in it"*.
 * The mouth, the slump and each bag's own hardware are what made four bags read
 * as four bags and he approved that. So every tell is still here and still
 * named; each one is THINNER. The pack's straps 18 -> 11, its eyelets 8x7 ->
 * 6x5, the tote's handles 6% of the width -> 4.5%, the sling's flap half the
 * body -> a third of it, the clutch's clasp bar 16 -> 11, and the lining rim
 * inside the mouth 6 -> 3. You can still name one with the contents taken out.
 * The sling stays the least open of the four because most of a crossbody IS
 * flap; that is the bag, not the drawing.
 */
/**
 * ⚠ `size` IS THE BAG'S CHARACTER NOW, NOT ITS CAPACITY.
 *
 * *"each bag has inf capacity"*   (2026-08-05)
 *
 * The whole view used to scale on `bagCapacity()` — 72% at 2 up to 100% at 8 —
 * and the comment above boasted that capacity read three ways: the bag's size,
 * its mouth, and how much was in it. NONE OF THAT IS TRUE ANY MORE and nobody
 * should try to restore the link, because there is no number left to link to.
 *
 * A backpack is still bigger than a clutch, and that is now simply what a
 * backpack is. Same order, same feel, different reason: it is drawn from the
 * KIND rather than derived from a capacity that no longer exists.
 */
type Kind = { ix: number; iy: number; ih: number; r: number; size: number };
const KIND: Record<string, Kind> = {
  pack: { ix: 0.045, iy: 0.15, ih: 0.76, r: 0.26, size: 1.00 },
  tote: { ix: 0.045, iy: 0.10, ih: 0.82, r: 0.05, size: 0.94 },
  sling: { ix: 0.10, iy: 0.36, ih: 0.58, r: 0.13, size: 0.86 },
  clutch: { ix: 0.07, iy: 0.18, ih: 0.72, r: 0.11, size: 0.76 },
  /**
   * ── AND NO BAG AT ALL, WHICH IS A REAL STOP NOW ─────────────────────────
   *
   * The bag is the only view onto what he carries (see `hasBag`), so it opens
   * with nothing on his shoulder too — showing his pockets, six kinds of thing.
   * `ix`/`iy` are 0 and `ih` is 1, so the "mouth" IS the whole footprint: the
   * painter draws no body, no rim and no hardware for this kind, and what is
   * left is the things themselves in the frame. Nothing to name a bag by,
   * because there is no bag.
   */
  none: { ix: 0, iy: 0, ih: 1, r: 0, size: 0.86 },
};
/**
 * ── THREE ACROSS ───────────────────────────────────────────────────────────
 *
 * *"maybe 3 slots each row?"*   (2026-08-05)
 *
 * PINNED, NOT DERIVED. The column count used to fall out of how many cells fit
 * the mouth, which gave three in a backpack and two in everything else — the
 * grid changed shape when he changed bags, and a row of two beside a row of
 * three is not a grid, it is two layouts. Three is the count and the CELL is
 * what gives way: it is sized so three fit whatever the mouth is, still capped
 * at `CELL` and floored at `CELL_MIN`.
 */
const COLS = 3;

/**
 * ONE LAYOUT, READ BY THE PAINTER AND THE HIT-TEST. They cannot drift, which
 * is what stops you clicking a thing where a different one is drawn.
 */
function layout(n: number) {
  const kind = bagWorn().kind;
  const K = KIND[kind] ?? KIND.tote;
  // THE BAG'S OWN CHARACTER, not a capacity — see `KIND`.
  const bw = Math.round((BW - 28) * K.size), bh = Math.round((BH - 30) * K.size);
  const bx = Math.round((BW - bw) / 2), by = BH - 10 - bh;
  const mouth = {
    x: Math.round(bx + bw * K.ix), y: Math.round(by + bh * K.iy),
    w: Math.round(bw * (1 - 2 * K.ix)), h: Math.round(bh * K.ih),
  };
  // Things shrink to what the mouth can hold rather than the mouth growing to
  // fit them — a clutch is small and that is the point of it.
  // BOUNDED BY THE INNER HEIGHT, not by the mouth's — a cell taller than the
  // space it is drawn into would be clipped at the lining on its FIRST row, and
  // the clip is supposed to be what says "there is more below", not what eats
  // the row you are looking at.
  // …AND `PEEK` IS RESERVED OFF THE BOTTOM, which is what makes the clipped row
  // below actually show. Measured across all four bags before this line
  // existed: the pack left 48 texels of the next row visible and the tote 44,
  // but the SLING left exactly 0 — its mouth is short, the cell got clamped to
  // the full inner height, and one row filled it to the texel. A signal that
  // works on three bags out of four is not a signal. Reserving the strip
  // unconditionally costs a bag with nothing below it 16 texels of empty
  // lining, which is what room left in a bag looks like anyway.
  const PEEK = 16;
  const inner0 = mouth.h - 16;
  const innerW = mouth.w - 16;
  // ⚠ THREE ACROSS DECIDES THE CELL, not the other way round — see `COLS`. The
  // cell is the smallest of what the width allows for three, what the height
  // allows for one plus the peek, and `CELL`; floored at `CELL_MIN` so a small
  // bag's contents never stop being legible.
  const cell = Math.max(CELL_MIN, Math.min(
    CELL,
    Math.floor((innerW - (COLS - 1) * CELL_GAP) / COLS),
    inner0 - PEEK,
  ));
  // ── A REAL GRID, AND A BAND OF IT VISIBLE ──────────────────────────────
  //
  // They used to LEAN ON EACH OTHER: one or two rows spread across the mouth's
  // width whatever the count, overlapping by 39% at eight. At `CELL` 96 that
  // would be most of each item hidden behind the next, so it is a grid on a
  // fixed pitch now and the rows that do not fit are scrolled to rather than
  // overlapped. *"like rows of items"* is the ask and it is also the fix.
  const inner = { x: mouth.x + 8, w: innerW, y: mouth.y + 8, h: inner0 };
  const pitch = cell + CELL_GAP;
  const cols = COLS;
  const visRows = Math.max(1, Math.floor((inner.h + CELL_GAP) / pitch));
  const totalRows = Math.max(1, Math.ceil(n / cols));
  const maxScroll = Math.max(0, totalRows - visRows);
  // ⚠ CLAMPED HERE, where the row count is actually known — see `scroll`. Drop
  // the last two things while scrolled to the bottom and the band you were
  // looking at stops existing; nothing at the wheel can catch that.
  if (scroll > maxScroll) scroll = maxScroll;
  if (scroll < 0) scroll = 0;
  // centre a short row rather than leaving it hanging left, which is what the
  // old spread did for free and is worth keeping
  const used = Math.min(cols, n) * pitch - CELL_GAP;
  const x0 = Math.round(inner.x + Math.max(0, (inner.w - used) / 2));
  const at = (i: number) => ({
    x: Math.round(x0 + (i % cols) * pitch),
    y: Math.round(inner.y + (Math.floor(i / cols) - scroll) * pitch),
    w: cell, h: cell,
  });
  /** the slice of `items` that is actually on screen. The painter AND both
   *  hit-tests walk this, so a row scrolled out of sight cannot be clicked —
   *  which is the whole trap in adding a scroll to a view that hit-tests by
   *  rectangle. */
  const from = scroll * cols;
  const to = Math.min(n, (scroll + visRows) * cols);
  return { bx, by, bw, bh, mouth, kind, cell, at, r: Math.round(bw * K.r),
           cols, from, to, inner };
  // `visRows`, `totalRows` and `maxScroll` are NOT returned any more: the pips
  // were the only reader and they are gone. They still do their work above,
  // where the clamp needs them.
}

function paint(): void {
  const g = cv?.getContext('2d');
  if (!g) return;
  const bag = bagWorn();
  const items = laid();
  const L = layout(items.length);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, VW, VH);
  // EVERYTHING BELOW IS IN THE BAG'S OWN SPACE. The canvas is the viewport now
  // (see `VW`), and this one translate is the whole cost of that — no
  // coordinate in this file had to move. It is also what lets the dragged item
  // be drawn at a bag-space position that is off the bag entirely.
  g.translate(originX(), originY());

  // ── NO BAG: THE THINGS THEMSELVES, AND NOTHING ROUND THEM ──────────────
  //
  // The one kind that draws no container at all. Every branch below is skipped
  // — no body, no mouth, no rim, no hardware — because there is nothing on his
  // shoulder to draw and inventing one would be a lie about what he is wearing.
  // A soft well behind the grid is the whole set: enough to read the items
  // against, nothing that claims to be an object. See `KIND.none`.
  if (L.kind === 'none') {
    band(g, L.inner.x - 10, L.inner.y - 10, L.inner.w + 20, L.inner.h + 20, 12,
      'rgba(20,17,16,0.62)');
    paintItems(g, L, items);
    paintOver(g, L, bag, items);
    return;
  }

  // ── THE HARDWARE THAT GOES BEHIND THE BODY ─────────────────────────────
  // THINNER, NOT GONE — see the note on `KIND`. These are the tells that make
  // four bags read as four bags, and he approved them; they are just no longer
  // eating the frame the contents want.
  if (L.kind === 'pack') {
    // both shoulder straps, down the sides, disappearing behind it. 18 -> 11.
    for (const x of [L.bx - 4, L.bx + L.bw - 7]) {
      band(g, x, L.by + L.bh * 0.18, 11, L.bh * 0.9, 5, bag.trim);
    }
  } else if (L.kind === 'tote') {
    // two handles standing off the rim — the tote's whole tell. 6% -> 4.5%.
    for (const x of [L.bx + L.bw * 0.22, L.bx + L.bw * 0.72]) {
      band(g, Math.round(x), L.by - 17, Math.max(3, Math.round(L.bw * 0.045)), 34, 3, bag.trim);
    }
  }

  // ── THE BODY ───────────────────────────────────────────────────────────
  //
  // *"not the biggest fan of all the rectangle lines. at the top, bottom of
  //  items, below the bag, etc. please remove em"*   (2026-08-05)
  //
  // TWO STRIPS USED TO LIE ON THIS SHAPE — a white 6% "light on the near wall"
  // and a black 18% "shadow under it" — and both are gone. They were hard-edged
  // rectangles painted ONTO a rounded silhouette, which is the one thing this
  // world's flat shading cannot absorb: a stepped corner reads as a shape and a
  // square band across it reads as a mark. `band` already gives the bag its
  // form, and cloth against the room behind it is enough.
  band(g, L.bx, L.by, L.bw, L.bh, L.r, bag.cloth);

  // ── THE MOUTH: lining at the rim, then the inside going dark ───────────
  // THE RIM IS 3 TEXELS, NOT 6. It is a bezel round the contents and it was
  // costing twice what it needed to on all four sides.
  //
  // AND THE BAR ACROSS THE TOP OF THE OPENING IS GONE with the rest of them —
  // a 35% black rectangle whose job was "the inside is deeper at the back". On
  // an interior that is already #20191a it bought almost no depth and read as
  // exactly what he named: a line across the top.
  band(g, L.mouth.x, L.mouth.y, L.mouth.w, L.mouth.h, Math.round(L.r * 0.6), bag.trim);
  band(g, L.mouth.x + 3, L.mouth.y + 3, L.mouth.w - 6, L.mouth.h - 6,
    Math.max(2, Math.round(L.r * 0.4)), '#20191a');

  // ── AND THE HARDWARE THAT GOES IN FRONT ────────────────────────────────
  if (L.kind === 'pack') {
    g.fillStyle = bag.trim;                                  // drawstring eyelets, 8x7 -> 6x5
    const n = 6, step = (L.mouth.w - 16) / (n - 1);
    for (let i = 0; i < n; i++) g.fillRect(Math.round(L.mouth.x + 8 + i * step) - 3, L.mouth.y - 4, 6, 5);
  } else if (L.kind === 'sling') {
    // the flap, thrown back over the top. Most of a crossbody IS flap, so this
    // one stays the least open of the four — but a third of the body rather
    // than a half, which is what was sitting on the contents.
    const fh = Math.round(L.bh * 0.34);
    band(g, L.bx + 4, L.by - 6, L.bw - 8, fh, Math.round(L.r * 0.8), bag.trim);
    // the 20% black strip that used to sit under the flap's edge went with the
    // others — the flap's own trim against the cloth already reads as an edge
    band(g, Math.round(L.bx + L.bw / 2 - 10), L.by + fh - 8, 20, 15, 4, bag.cloth);
    g.fillStyle = '#2a2620';                                 // the buckle
    g.fillRect(Math.round(L.bx + L.bw / 2 - 6), L.by + fh - 4, 12, 7);
  } else if (L.kind === 'clutch') {
    band(g, L.bx + 10, L.by - 3, L.bw - 20, 11, 4, bag.trim);   // the clasp bar, 16 -> 11
    g.fillStyle = '#d8cfb4';
    g.fillRect(Math.round(L.bx + L.bw / 2 - 4), L.by - 1, 8, 7);   // its stud
  }

  paintItems(g, L, items);
  paintOver(g, L, bag, items);
}

type Lay = ReturnType<typeof layout>;

/**
 * THE GRID, wherever it is drawn. Factored out because the no-bag view paints
 * it too and there must not be two copies of a hit-tested layout's painter.
 */
function paintItems(g: CanvasRenderingContext2D, L: Lay, items: string[]): void {
  // ── WHAT IS IN IT ──────────────────────────────────────────────────────
  //
  // ⚠ THE DARK BAR UNDER EACH ITEM IS GONE, and it was the one on his list
  // worth thinking about before cutting. It was a 30% black rectangle along the
  // bottom of every cell, captioned *"it sits IN the bag"* — a contact shadow,
  // there to stop things floating. It does not do that job here. A contact
  // shadow works by being darker than the ground it lands on, and the ground is
  // #20191a: at 30% over near-black there is almost no shadow left to read, so
  // what survived was its EDGES — a hard horizontal bar under each object,
  // which is exactly what he is looking at in the shot.
  //
  // NOTHING REPLACED IT, deliberately. The interior is a dark well inside a lit
  // rim inside a body, all rounded; an object drawn on that is already inside
  // something. It is the same lesson the mirror paid for five times — when a
  // device is not working, the answer is to remove it, not to swap it for a
  // different device.
  //
  // ONE ROW PAST THE FOLD, CLIPPED. `L.to` is the slice that fits; the loop
  // runs one row further and the clip cuts it at the lining. That is what says
  // there is more underneath now that the pips are gone — you see the tops of
  // the things below, which is what looking into a bag actually looks like, and
  // it is contents rather than a mark. Nothing is clickable there: both
  // hit-tests still stop at `L.to`.
  g.save();
  g.beginPath();
  g.rect(L.inner.x - 2, L.inner.y - 2, L.inner.w + 4, L.inner.h + 4);
  g.clip();
  for (let i = L.from; i < Math.min(items.length, L.to + L.cols); i++) {
    const id = items[i];
    if ((held === id || dragging === id) && items.indexOf(id) === i) continue;
    const r = L.at(i);
    // the one the options are open on lifts clear of the others
    if (menu && menu.i === i) { r.y -= 4; }
    if (menu?.i === i || (ptr && inRect(ptr.x, ptr.y, r) && !held && !menu)) {
      // ⚠ AN INSET, NOT AN OUTSET — see `HL_HUG`. It hugs the object instead of
      // floating round it, and it is smaller in absolute texels than the one it
      // replaces even though the object it sits on grew. It is a rounded band
      // in the bag's own light, not one of the rectangles: it stays.
      const p = Math.round(r.w * HL_HUG);
      band(g, r.x + p, r.y + p, r.w - p * 2, r.h - p * 2, 6, 'rgba(242,234,208,0.18)');
    }
    item(g, r.x, r.y, r.w, id);
  }
  g.restore();
}

/** the cursor's load, the option plates and the close-up — everything that
 *  goes OVER the grid, in every presentation */
function paintOver(g: CanvasRenderingContext2D, L: Lay,
                   bag: { cloth: string; trim: string }, items: string[]): void {
  // ── WHAT IS ON THE CURSOR, ON ITS WAY OUT ──────────────────────────────
  // No dimming behind it: he is moving a thing, not examining one, and the bag
  // has to stay legible so he can see whether he is still over its mouth.
  //
  // ⚠ THE DROP SHADOW UNDER THE CURSOR WENT WITH THE OTHER BARS. It was the
  // same rectangle in a different place — 28% black, hard-edged, drawn under a
  // thing being carried once it was clear of the mouth — and it was the only
  // one of them with a job the picture was not already doing: it said "let go
  // here and it lands". THE BAG SAYS THAT BETTER. Being outside the mouth is
  // the signal, and the mouth is right there. `L2` and the `out` test went with
  // it; nothing else read them.
  if (dragging && ptr) {
    // ⚠ AT `ptr`, WHICH IS NOW ALLOWED TO BE ANYWHERE. This one line is what he
    // was actually reporting: `ptr` used to be null off the bag's canvas and
    // nothing got drawn. Grown 56 -> 72 with `CELL`, so the thing in his hand is
    // the size of the thing he took.
    item(g, Math.round(ptr.x - DRAG / 2), Math.round(ptr.y - DRAG / 2), DRAG, dragging);
  }

  // ── THE OPTIONS, STENCILLED ON THE LINING ──────────────────────────────
  //
  // The item they belong to LIFTS 4 texels and keeps its warm wash, so he can
  // see which thing he is acting on without the close-up he is replacing.
  //
  // ── WHAT IS THIS THING — ON HOVER, IN THE SAME PLACE ───────────────────
  //
  // *"hover on item in bag should say what the item is. like cereal or
  //  whatever"*   (2026-08-05)
  //
  // THE NAME PREVIEWS WHERE THE VERBS WILL COMMIT. It is the same plate, in the
  // same idiom, at the same anchor `plateRects` gives the options — so hovering
  // shows you WHAT, clicking replaces it with WHAT YOU CAN DO. They cannot
  // fight for the space because they are never up together: this branch is
  // guarded on `!menu && !held`, and opening the options is what takes the
  // hover's place. One spot, two states, and the eye never has to move.
  //
  // ⚠ THIS IS NOT THE DESCRIPTOR HE TURNED DOWN. *"i dont want descriptors for
  // the items you pick up"* was about the world narrating events at him
  // unprompted, and those notes are still deleted. This is the opposite
  // direction: he points at a thing and asks what it is. So it is the NAME and
  // nothing else — `ItemDef.name`, the single field the [E] prompts already
  // word themselves from, upper-cased. No blurb, no stack count, no sentence.
  //
  // THE PLATE SIZES TO THE WORD rather than the word to the plate: "PAIR OF
  // TRAINERS" does not fit the 78 the verbs use, and shrinking the type to make
  // it fit would undo the legibility fix directly above. Measured, padded and
  // clamped into the mouth by the same `plateRects` that clamps the options.
  if (!menu && !held && ptr) {
    for (let i = L.from; i < L.to; i++) {
      if (!inRect(ptr.x, ptr.y, L.at(i))) continue;
      const label = itemOf(items[i]).name.toUpperCase();
      g.font = `bold ${PLATE_PX}px ui-monospace, Menlo, monospace`;
      const w = Math.min(L.mouth.w - 12, Math.ceil(g.measureText(label).width) + 16);
      const r = plateRects(i, 1, w)[0];
      band(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 5, bag.trim);
      band(g, r.x, r.y, r.w, r.h, 4, PLATE);
      g.fillStyle = PLATE_INK;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
      break;
    }
  }
  //
  // ── AND THEY HAVE TO BE READABLE, WHICH THEY WERE NOT ──────────────────
  //
  // *"also the options on item are hard to read"*   (2026-08-05)
  //
  // THE PLATE WAS PAINTED IN `bag.trim` AND THE INK WAS #20191a. Both are dark,
  // and worse, `trim` is the same colour as the flap or lid they land on — so
  // in the crossbody's shot the plate did not separate from the bag at all and
  // what was left was near-black type on dark brown. Measured as a contrast
  // ratio (WCAG relative luminance, ink against its own plate):
  //
  //                      was           now
  //     backpack        1.30 : 1     11.43 : 1
  //     tote            4.10 : 1     11.43 : 1
  //     crossbody       1.13 : 1     11.43 : 1
  //     clutch          1.15 : 1     11.43 : 1
  //
  // Only the tote ever cleared 3:1, and only because its trim happens to be a
  // pale straw; the crossbody sat at 1.13, which is invisible. All four are
  // identical now and the plate stands 13.18 : 1 off the lining behind it.
  // THE PLATE IS ITS OWN COLOUR — `PLATE`, the letters' paper
  // from `ct/tenancy.ts`, so all four read identically and none of them depends
  // on what the bag is made of.
  //
  // STILL PART OF THE OBJECT, which he approved and which is not negotiable. A
  // pale paper label stitched to a lining is a real thing on a real bag — it is
  // the care label — and it is keylined in the bag's OWN trim so it belongs to
  // this bag rather than floating over it. Bigger, too: 62 x 15 at 9 px was
  // sized against a 76 cell and these sit beside 88s.
  if (menu) {
    const opts = verbsFor(menu.id);
    plateRects(menu.i, opts.length).forEach((r, k) => {
      band(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 5, bag.trim);   // stitched on
      band(g, r.x, r.y, r.w, r.h, 4, PLATE);
      g.fillStyle = PLATE_INK;
      g.font = `bold ${PLATE_PX}px ui-monospace, Menlo, monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(opts[k], r.x + r.w / 2, r.y + r.h / 2 + 1);
    });
  }

  // ── AND WHAT HE HAS LIFTED OUT ─────────────────────────────────────────
  // The wash covers the WHOLE canvas, which is now the whole viewport — a
  // close-up that dimmed a 368 x 230 rectangle in the middle of a lit room
  // would read as a stain rather than as attention.
  if (held) {
    g.fillStyle = 'rgba(0,0,0,0.42)';
    g.fillRect(-originX(), -originY(), VW, VH);
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
    scroll = 0;                    // always open at the top
    takePointer();
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.addEventListener('resize', onResize);
  } else {
    held = null;
    ptr = null;
    pending = null;
    dragging = null;
    menu = null;
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('mousedown', onDown, true);
    window.removeEventListener('mouseup', onUp, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('wheel', onWheel, true);
    window.removeEventListener('resize', onResize);
    givePointerBack();
  }
}

/**
 * ── IS THERE ANYTHING TO LOOK AT — WHICH IS ALWAYS ────────────────────────
 *
 * This used to be `bagCapacity() > 0`, and it was the carousel's way of asking
 * "is a bag worn". Capacity is gone (*"each bag has inf capacity"*) so that
 * test no longer exists — but the bigger reason it changed is the one-store
 * fix above it: THE BAG IS THE ONLY VIEW ONTO WHAT HE IS CARRYING.
 *
 * Which forces the pockets question that has been open since *"user inventory,
 * bag inventory, and dresser inventory"*, and this is the answer:
 *
 *   THE STORE IS ALWAYS HIS POCKETS. THE BAG IS A VIEW ONTO THEM, AND WEARING
 *   ONE IS WHAT LIFTS THE LIMIT.
 *
 * With a bag on he can carry anything and the view draws the bag round it.
 * With NO bag on he can still carry six kinds of thing — `POCKETS`, which is
 * what a pair of trouser pockets holds — and the view opens anyway, drawing
 * the things with no bag round them. Look down, right-click, and there is what
 * you have, either way.
 *
 * ⚠ SO IT RETURNS TRUE ALWAYS, and that is deliberate rather than lazy. The
 * one state that must not exist is him owning something he cannot see or reach;
 * a stop that disappears with the bag would create it every time he took a bag
 * off with things in it. The name is kept because 20 lines of carousel read it.
 */
export function hasBag(): boolean { return true; }
// ⚠ AND IT HAS NO CALLERS AS OF 2026-08-05. The carousel was the only one, and
// *"i want right click to still toggle watch"* replaced it with two plain
// booleans — E for the bag, right-click for the watch, no stop list to build
// and nothing conditional on whether a bag is worn. Kept exported and kept
// TRUE, because the sentence it now states is the one that matters: there is
// always something to look at down there, so the view is always reachable.
