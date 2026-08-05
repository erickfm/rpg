import { bagStock, itemOf } from './inventory';
import { bagCapacity, bagWorn } from './wardrobe';

// ══ THE BAG, HELD OPEN ═════════════════════════════════════════════════════
//
// *"ok with looking down, right click should toggle between inventory (bag),
//  watch, and nothing (clear view looking down)."*   (2026-08-05)
//
// **THE SAME KIND OF OBJECT AS THE WRISTWATCH**, and that is the whole design
// argument. Looking down and finding your watch there is a first-person thing
// this world already does and he has approved all day; looking down and finding
// the bag you are wearing held open is the same gesture with a different
// object. Neither is a menu — they are things you are carrying, drawn where
// your hands are.
//
// SO IT IS BUILT THE WAY THE WATCH IS: its own canvas, `position:fixed` at the
// bottom of the frame, sliding up on a transform. Not `makePanel` — a panel
// freezes the world, takes the pointer and dims the room, which is right for a
// machine you stand at and wrong for something in your hands while you are
// still standing in a street.
//
// ── WHY IT IS ITS OWN MODULE ──────────────────────────────────────────────
//
// `ct/inventory.ts` imports `ct/hud.ts` at runtime, so the hud cannot import
// the item table back — GOTCHAS §28, a module in a cycle can be dropped from
// the BUILT BUNDLE ONLY, which is the failure that looks perfect in dev. This
// file imports both and is imported by the entry point, so the arrow runs one
// way and the bag can draw real items.

/** the canvas, in texels, and the CSS pixels each is drawn at */
const BW = 220, BH = 132, SCALE = 2;
/**
 * HOW BIG ONE THING IN THE BAG IS, in texels.
 *
 * 46 of a 220-wide canvas at 2x is **92 CSS pixels a side**. That is the number
 * that matters and it is why there is no grid here: the wardrobe spent a whole
 * session proving that an item at 4% of the frame is a smudge and one at 60% is
 * legible, and a bag with four big things in it beats one with twelve small
 * ones. If a bag holds more than fits across, the row is what fits — capacity
 * is a fact about the garment, not about the picture.
 */
const CELL = 46;

let wrap: HTMLDivElement | null = null;
let cv: HTMLCanvasElement | null = null;
let shown = false;

const CSS_HIDDEN = 'translateX(-50%) translateY(150%)';
const CSS_SHOWN = 'translateX(-50%) translateY(0)';

function build(): void {
  wrap = document.getElementById('ct-bag') as HTMLDivElement | null;
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'ct-bag';
    // bottom-centre, under the prompt and over the world — the wallet's own
    // corner, because it is the same kind of object and two held things should
    // not appear in two different places
    wrap.style.cssText = 'position:fixed;left:50%;bottom:-6px;z-index:11;pointer-events:none;'
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
  }
}

/**
 * PAINT THE BAG YOU ARE WEARING, open, with what is in it.
 *
 * The bag's own `cloth` and `trim` come off the garment, so the backpack, the
 * tote, the crossbody and the clutch are visibly four different bags rather
 * than one bag with four names — the same values the figure in the mirror is
 * drawn from.
 */
function paint(): void {
  const g = cv?.getContext('2d');
  if (!g) return;
  const bag = bagWorn();
  g.clearRect(0, 0, BW, BH);
  // the mouth of it, drawn as a shallow box you are looking down into: the far
  // wall in shadow, the near wall lit, the floor of the bag between them
  g.fillStyle = bag.trim; g.fillRect(0, 8, BW, BH - 8);
  g.fillStyle = bag.cloth; g.fillRect(6, 14, BW - 12, BH - 20);
  g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(6, 14, BW - 12, 10);   // its far wall
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(6, BH - 12, BW - 12, 6);
  // the two straps or handles, coming up out of frame — what says it is a bag
  // and not a box, and it is the one place the carry shows in first person
  g.fillStyle = bag.trim;
  for (const x of [26, BW - 34]) g.fillRect(x, 0, 8, 16);

  // ── AND WHAT IS IN IT ──────────────────────────────────────────────────
  //
  // `ItemDef.icon` is the world's own item art, painted in a 24 x 24 box —
  // the same drawing the wallet uses, so a thing looks like itself wherever
  // you meet it. Scaled up rather than redrawn: at CELL it is nearly four
  // times its authored size and stays hard-edged, because everything in this
  // world is drawn to be enlarged.
  const st = bagStock();
  const items: string[] = [];
  for (const s of st) for (let i = 0; i < s.n; i++) items.push(s.id);
  const pad = 6;
  const across = Math.max(1, Math.floor((BW - pad) / (CELL + pad)));
  items.slice(0, across).forEach((id, i) => {
    const x = pad + i * (CELL + pad), y = Math.round((BH - CELL) / 2) + 4;
    // a shadow in the bag under each thing, so they sit IN it rather than on it
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x + 3, y + CELL - 6, CELL, 6);
    g.save();
    g.translate(x, y);
    g.scale(CELL / 24, CELL / 24);
    // ⚠ `imageSmoothingEnabled` is irrelevant here — `icon` DRAWS rather than
    // blits, so the scale lands on the rects themselves and the edges stay
    // hard. That is why the item art is a painter and not a bitmap.
    try { itemOf(id).icon?.(g); } catch { /* an item with no art is not a crash */ }
    g.restore();
  });
}

/**
 * Raise or lower it. Called every frame by the carousel in `crosstown.ts`;
 * cheap when nothing has changed, because the transform is only written on a
 * transition and the canvas is only repainted while it is up.
 */
export function showBag(want: boolean): void {
  if (!wrap) build();
  if (want) paint();
  if (want === shown) return;
  shown = want;
  wrap!.style.transform = want ? CSS_SHOWN : CSS_HIDDEN;
}

/** is there a bag to open at all? 0 capacity means the slot is empty */
export function hasBag(): boolean { return bagCapacity() > 0; }
