import { dither } from './paint';
import { makePanel, type Panel } from './hud';
import { viewAt } from './citizens';
import {
  SLOTS, options, cycle, showing, worn, wornIndex, wear,
  onWardrobeChange, type Slot, type Garment,
} from './wardrobe';

// ── THE MIRROR IN 301, AND THE PERSON IN IT ────────────────────────────────
//
// *"ok lets add an interactable for the mirror where the view goes into the
//  mirror and really you just see yourself with click and drag options to
//  change your outfit."*   (2026-08-04)
//
// **NOTHING IN CROSSTOWN REFLECTS.** The glass on the wall is a PAINTED cold
// copy of the room, the way the dead TV and the window glazing are, and a live
// render-to-texture here would be the only real reflection in the world. This
// module owns both halves of that pretence: `paintGlass`, the plate on the
// wall, and `mirrorPanel`, the dressing view you get when you press `[E]` at it.

/**
 * TEXELS PER METRE ON THE PLATE, and the reason this number exists at all.
 *
 * *"give me true proportions in the mirror i feel stretched"*   (2026-08-04)
 *
 * **HE IS RIGHT AND IT WAS THE PLATE.** The painted field was a fixed `20 x 64`
 * canvas — an aspect of 0.3125 — stretched onto whatever quad the frame
 * happened to be. It was 0.42 x 1.60 (0.2625) for most of today, so the image
 * was already squeezed 19% horizontally; the *"a bit wider and less tall"* pass
 * took the quad to 0.52 x 1.35 (0.385) and flipped that into a 23% STRETCH the
 * other way. Two numbers that had to be kept in step by hand, and nothing kept
 * them.
 *
 * So the canvas is DERIVED from the plate's metres at a fixed density and the
 * field is painted in fractions of its own W and H. Resize the frame and the
 * texels stay square by construction — there is no second number to update and
 * no way to desynchronise them again. Same class of fix as hoisting the
 * umbrella's grip and the lease's date: one fact, one place.
 *
 * 40 is chosen to land near the density the plate already had (the old field
 * was 48 x 40 px/m on its two axes — it could not be one number, which is the
 * bug) and to keep the canvas small: 0.62 x 1.45 of frame gives a 21 x 54
 * plate, a couple of hundred texels of painted glass.
 */
export const GLASS_PPM = 40;

/** The plate's canvas size for a glass `wM x hM` metres. Square texels, always. */
export function glassCanvas(wM: number, hM: number): { w: number; h: number } {
  return { w: Math.max(4, Math.round(wM * GLASS_PPM)), h: Math.max(4, Math.round(hM * GLASS_PPM)) };
}

/** THE PAINTED GLASS'S PALETTE — the room in 301, gone cold. One copy, read by
 *  the plate on the wall and by the glass inside the dressing panel. */
export const GLASS = {
  /** the room's wall, cooled */
  wall: '#98a3ac',
  /** its ceiling */
  ceil: '#7b848d',
  /** its floorboards — a full-length glass is mostly floor */
  boards: '#4a3a2b',
  /** where wall meets floor */
  skirt: '#33281d',
  /** the silvering, gone at the corners and worst along the bottom edge */
  rot: 'rgba(58,52,46,0.34)',
  /** the two sheen rakes that are what read as glass at this size */
  rakeNear: 'rgba(255,255,255,0.20)',
  rakeFar: 'rgba(255,255,255,0.11)',
} as const;

/**
 * THE MIRROR ON THE WALL — the cold painted copy of 301 you see from across
 * the room. `ct/apartment.ts` hangs it; this paints it.
 *
 * EVERY COORDINATE IS A FRACTION OF W OR H, which is the whole point: the same
 * drawing has to come out right on a 21 x 54 plate today and on whatever the
 * next resize asks for, without anybody re-typing a row number. The fractions
 * are the ones the approved 20 x 64 field used — ceiling to 5/64, horizon at
 * 40/64, skirting at 38/64, joints at 43/47/52/59 — so at the old size this
 * paints the plate he signed off, texel for texel.
 *
 * IT IS NOT A REFLECTION AND IS NOT TRYING TO BE. Nothing in CROSSTOWN
 * reflects. This is the same idiom as the dead TV screen and the window
 * glazing: pale wall above, boards below, two sheen rakes, silvering gone at
 * the corners. The rakes are what read as glass at this size; the horizon is
 * what stops it reading as a grey panel.
 */
export function paintGlass(g: CanvasRenderingContext2D, W: number, H: number): void {
  const bx = (fx: number, fy: number, fw: number, fh: number, fill: string) => {
    const x0 = Math.round(fx * W), y0 = Math.round(fy * H);
    g.fillStyle = fill;
    g.fillRect(x0, y0, Math.max(1, Math.round((fx + fw) * W) - x0),
      Math.max(1, Math.round((fy + fh) * H) - y0));
  };
  bx(0, 0, 1, 1, GLASS.wall);                       // the room, gone cold
  bx(0, 0, 1, 5 / 64, GLASS.ceil);                  // its ceiling
  bx(0, 40 / 64, 1, 24 / 64, GLASS.boards);         // its floorboards
  bx(0, 38 / 64, 1, 2 / 64, GLASS.skirt);           // the skirting line
  // board joints, opening up toward the bottom — the boards run away from you,
  // so the near ones read wider
  for (const y of [43, 47, 52, 59]) bx(0, y / 64, 1, 1 / 64, 'rgba(0,0,0,0.20)');
  // THE RAKES ARE THE ONE THING THAT IS AN ANGLE RATHER THAN A FRACTION, and
  // now that the texels are square it is a true one: 0.22 texels of run per
  // texel of drop, drawn a row at a time so the diagonal is hard pixels.
  const rake = (fx: number, fw: number, fill: string) => {
    g.fillStyle = fill;
    const w = Math.max(1, Math.round(fw * W));
    for (let y = 0; y < H; y++) g.fillRect(Math.round(fx * W + y * 0.22), y, w, 1);
  };
  rake(1 / 20, 4 / 20, GLASS.rakeNear);
  rake(9 / 20, 2 / 20, GLASS.rakeFar);
  // the silvering has gone at the corners, and worst along the bottom edge
  // where the damp got at it — it came with the flat
  for (const [x, y, w, h] of [[0, 0, 2, 5], [18, 4, 2, 4], [0, 26, 1, 7],
                              [19, 44, 1, 6], [0, 59, 4, 5], [15, 61, 5, 3]]) {
    bx(x / 20, y / 64, w / 20, h / 64, GLASS.rot);
  }
  // the grain, at the density the approved plate had — 30 specks per 20 x 64,
  // i.e. one per 42.7 texels — so it scales with the field instead of thinning
  // out or clotting when the frame is next resized.
  dither(g, W, H, Math.round((W * H) / 42));
}

// ══ AND THE MIRROR IS ONLY A MIRROR ════════════════════════════════════════
//
// It was a full-length dressing glass with a locked view, a reflection of your
// whole body painted on it, and — over four attempts — a suitcase, a rail and a
// held garment staged in the room around it. **All of that is gone.**
// *"lets make the mirror small and just a face mirror btw."* What is left above
// is the plate: a cold painted copy of the room, at the size of a thing you
// shave in. `[E]` at it opens the closet screen below, which is not in the room
// at all.

// ══ THE PAPER DOLL ═════════════════════════════════════════════════════════
//
// *"we see a little like sprite version of ourselves and we can apply the
//  clothes to the sprite."*  This is that sprite. It was painted as a
// reflection for a full-length mirror that no longer exists; what it always
// was underneath is a paper doll that can wear all six slots, so it survives
// the move to the closet screen unchanged.
//
// 40 x 152 design units, and the units are SQUARE. *"give me true proportions
// in the mirror i feel stretched"* — so the figure is drawn through one scale
// used on both axes and fitted INSIDE the glass with the remainder left as
// glass, never stretched to fill it. A body has fixed proportions whatever
// shape the thing it is reflected in happens to be.
const MW = 40, MH = 152;

const CX = 20;              // the centre line
const HEAD_T = 12, HEAD_B = 30, HEAD_HW = 7;
const EYE_Y = 20;
const NECK_B = 35;
const SHOULDER = 34, WAIST = 76, TORSO_HW = 12;
const ARM_T = 36, ARM_B = 78, ARM_W = 6;    // arms hang at CX ± (TORSO_HW…+ARM_W)
const HAND_B = 88;
const HIP_B = 92;
const LEG_B = 138, LEG_HW = 4, LEG_GAP = 3;  // legs at CX ± (LEG_GAP … +2*LEG_HW)
const FOOT_B = 146;
/** the wrist the watch is on: the figure's own left, our left of centre */
const WRIST_T = 68, WRIST_B = 80;

const SKIN = '#c9946a', SKIN_LO = '#a87a54', SKIN_HI = '#d8a67d';
const UNDIES = '#e9e6de', UNDIES_LO = '#d3cfc4';

/** A part of the reflection you can take a garment off. Rects are design units. */
interface Zone { slot: Slot; x0: number; y0: number; x1: number; y1: number }

/**
 * WHICH PART OF YOU IS WHICH GARMENT.
 *
 * ORDER MATTERS AND THE WATCH IS FIRST. The wrist sits inside the sleeve of the
 * top, so the two rects overlap by design — you are grabbing a watch that is ON
 * an arm that is IN a jacket. First match wins, so the smaller, more specific
 * thing is listed first. Everything else is disjoint.
 */
const ZONES: readonly Zone[] = [
  { slot: 'watch', x0: 0, y0: WRIST_T, x1: CX - TORSO_HW + 1, y1: WRIST_B },
  { slot: 'hat', x0: 6, y0: 0, x1: 34, y1: HEAD_T + 4 },
  { slot: 'glasses', x0: 8, y0: HEAD_T + 4, x1: 32, y1: NECK_B - 2 },
  { slot: 'top', x0: 0, y0: NECK_B - 2, x1: MW, y1: WAIST },
  { slot: 'bottom', x0: 2, y0: WAIST, x1: 38, y1: LEG_B - 4 },
  { slot: 'shoes', x0: 0, y0: LEG_B - 4, x1: MW, y1: MH },
];

/** The slot at this point in FIGURE design units, or null. */
function zoneAt(dx: number, dy: number): Slot | null {
  for (const z of ZONES) {
    if (dx >= z.x0 && dx < z.x1 && dy >= z.y0 && dy < z.y1) return z.slot;
  }
  return null;
}

/**
 * A rect painter in design units, rounded to whole pixels at any scale — and
 * the place the TURN happens.
 *
 * *"scroll to turn self in mirror?"* (2026-08-04.) `flip` mirrors a rect about
 * the centre line and `nf` squeezes it toward that line, and between them they
 * are the whole of a facing: a body seen at 45° is narrower than one seen
 * head-on and a body seen from the left is the one seen from the right,
 * reversed. Applied HERE rather than as a canvas transform because
 * `g.scale(0.55, 1)` would antialias every edge on the figure, and this world
 * does not have a second tone to spare — the arithmetic happens in design units
 * and the ROUNDING still happens last, so the pixels stay hard.
 */
function scaler(g: CanvasRenderingContext2D, ox: number, oy: number, s: number,
                posF = 1, sizeF = 1, flip = false) {
  return (x: number, y: number, w: number, h: number, fill: string) => {
    const mx = flip ? 2 * CX - x - w : x;
    // WHERE IT SITS AND HOW WIDE IT IS ARE TWO QUESTIONS. A rect's CENTRE moves
    // toward the body's own centre line as he turns — every part of a body does
    // — but its WIDTH is a fact about the part's own shape, and the two must
    // not share a factor. Scale them together and an arm detaches from a
    // narrowing torso, or stays attached and becomes a wire.
    const c = mx + w / 2, nw = w * sizeF;
    const nx = CX + (c - CX) * posF - nw / 2;
    const x0 = Math.round(nx * s), y0 = Math.round(y * s);
    g.fillStyle = fill;
    g.fillRect(ox + x0, oy + y0,
      Math.max(1, Math.round((nx + nw) * s) - x0), Math.max(1, Math.round((y + h) * s) - y0));
  };
}

/**
 * HOW WIDE THE BODY IS IN EACH OF THE FIVE PAINTED COLUMNS.
 *
 * `ct/citizens.ts` paints five views — front, 3/4, profile, 3/4 back, back —
 * and mirrors them for the far four sectors, which is how every person in this
 * world turns. **`viewAt` is imported rather than reimplemented**, so the
 * mirror steps through the same eight facings in the same order as the street
 * does, and a reflection cannot end up turning the opposite way from a citizen.
 *
 * What is NOT shared is the ATLAS. `citizenAtlas` takes a `Look` — jacket,
 * pants, skin, hair, fit — and cannot say hat, glasses, watch or shoes, which
 * is four of this wardrobe's six slots. So the figure stays this module's own
 * painter and only the CONVENTION is borrowed: eight stops, five distinct
 * drawings, no angles in between.
 */
/**
 * WIDE FLAT SPANS: shoulders, chest, hips, and the garments stretched over
 * them. These are what a turn really foreshortens — edge-on they nearly
 * vanish. It is also the factor every part's POSITION uses, because a body
 * rotating brings all of it toward the centre line together.
 */
const COL_SPAN = [1, 0.82, 0.55, 0.82, 1];
/**
 * ROUND THINGS: the head, the neck, arms, legs. A head is close to a ball in
 * plan and a limb is a cylinder — **from the side they are about as wide as
 * from the front**, just a different shape.
 *
 * *"i squish and distort in some"* was this, and only this: ONE factor was
 * applied to the whole drawing, so at 0.55 the head became a squashed egg and
 * the arms became wires. The head is the first thing the eye checks and it was
 * the thing being wrecked. 0.90 at profile is a tenth of the squeeze the
 * shoulders take.
 */
const COL_ROUND = [1, 0.96, 0.90, 0.96, 1];
/**
 * THINGS THAT ARE LONGER FRONT-TO-BACK THAN THEY ARE WIDE, which get BIGGER as
 * you turn, not smaller: a shoe, a cap's peak, a nose. A foot seen from the
 * front is 10 cm across and from the side it is 26 cm long, and drawing it
 * shrinking with the shoulders is exactly as wrong as the squashed head.
 */
const COL_DEEP = [1, 1.12, 1.30, 1.12, 1];

/**
 * ⚠ AND NONE OF THEM TOUCHES `y`. Height, head size top-to-bottom, the
 * shoulder line, every hem — all identical across all eight facings, because
 * turning does not change how tall you are. `scaler` takes `y` and `h` through
 * untouched and there is no vertical factor to add by accident.
 *
 * ⚠ NOR IS THE DESTINATION STRETCHED, which is the other way this world has
 * produced *"i feel stretched"* (the wall plate: a fixed canvas on a resized
 * quad). Checked rather than assumed: the figure is drawn through ONE `s` on
 * both axes, its canvas is derived from the glass's metres at a fixed density,
 * and the held garment's quad is 0.26 x 0.52 against a 1:2 canvas. Every
 * surface here is equal-scaled and padded, never fitted.
 */

/**
 * YOU, AS A LITTLE SPRITE — the body, the underwear under everything, and
 * whatever is worn over it. `s` scales BOTH axes, always.
 *
 * THE UNDERWEAR IS NOT A GARMENT AND IS DRAWN HERE. *"maximum naked must
 * include white undies."* An empty slot is not a state this painter has a
 * branch for: the vest and the briefs go down before any garment does, so
 * taking everything off leaves them showing. There is no index that means bare,
 * so there is nothing to forbid. See `ct/wardrobe.ts`'s header.
 */
export function paintFigure(g: CanvasRenderingContext2D, ox: number, oy: number, s: number,
                            sector = 0): void {
  const [col, flip] = viewAt(sector);
  /** 0 front, 1 three-quarter, 2 profile, 3 three-quarter back, 4 back */
  const facing = col;
  const span = COL_SPAN[col];
  /** WIDE SPANS — the torso, the hips, and the cloth stretched across them */
  const box = scaler(g, ox, oy, s, span, span, flip);
  /** LIMBS — carried by the torso's rotation, but a cylinder's own width */
  const limb = scaler(g, ox, oy, s, span, COL_ROUND[col], flip);
  /** THE HEAD AND WHAT IS ON IT — barely narrows, and does not slide inward
   *  with the shoulders either: it is already on the centre line. */
  const head = scaler(g, ox, oy, s, COL_ROUND[col], COL_ROUND[col], flip);
  /** DEEP THINGS — a shoe, a peak, a nose. These GROW as he turns. */
  const deep = scaler(g, ox, oy, s, span, COL_DEEP[col], flip);
  const top = worn('top');
  const bottom = showing('bottom');
  const shoes = worn('shoes');
  const hat = worn('hat');
  const specs = worn('glasses');
  const watch = worn('watch');

  // SKIN FIRST, ALL OF IT, so an empty slot needs no special case anywhere —
  // it leaves what is underneath showing, and what is underneath is you.
  head(CX - HEAD_HW, HEAD_T, HEAD_HW * 2, HEAD_B - HEAD_T, SKIN);         // head
  head(CX - 3, HEAD_B - 1, 6, NECK_B - HEAD_B + 1, SKIN_LO);              // neck
  box(CX - TORSO_HW + 1, SHOULDER, (TORSO_HW - 1) * 2, WAIST - SHOULDER, SKIN);
  for (const sgn of [-1, 1]) {                                            // arms and hands
    limb(sgn < 0 ? CX - TORSO_HW - ARM_W + 1 : CX + TORSO_HW - 1, ARM_T, ARM_W, HAND_B - ARM_T, SKIN);
  }
  box(CX - TORSO_HW + 1, WAIST, (TORSO_HW - 1) * 2, HIP_B - WAIST, SKIN); // hips
  for (const sgn of [-1, 1]) {                                            // legs
    limb(sgn < 0 ? CX - LEG_GAP - LEG_HW * 2 : CX + LEG_GAP, HIP_B, LEG_HW * 2, LEG_B - HIP_B, SKIN);
  }
  // hair as one shape — this world draws a haircut as a silhouette and not as
  // strands, the way `ct/citizens.ts` paints five views of one. TURNED AWAY it
  // is the whole head: the back of a head is hair, and that is what tells you
  // the figure has its back to you at all.
  const HAIR = '#3a2c22';
  head(CX - HEAD_HW, HEAD_T - 2, HEAD_HW * 2, facing >= 3 ? HEAD_B - HEAD_T + 2 : 7, HAIR);
  head(CX - HEAD_HW - 1, HEAD_T + 1, 1, 8, HAIR);
  head(CX + HEAD_HW, HEAD_T + 1, 1, 8, HAIR);
  // THE FACE, ALL OF IT, and it goes when you turn past three-quarters. In
  // PROFILE there is one eye and a nose standing outside the silhouette — the
  // nose is what says which way he is looking, and `ct/citizens.ts` draws its
  // profile the same way for the same reason.
  if (facing <= 2) {
    head(CX - 4, EYE_Y, 2, 2, '#2a2016');
    if (facing < 2) head(CX + 2, EYE_Y, 2, 2, '#2a2016');
    head(CX - 2, EYE_Y + 6, facing === 2 ? 2 : 4, 1, '#8a5c46');
  }
  if (facing === 2) deep(CX - HEAD_HW - 2, EYE_Y + 1, 2, 2, SKIN);         // the nose

  // the white undies, under everything, always
  box(CX - TORSO_HW + 1, WAIST - 16, (TORSO_HW - 1) * 2, HIP_B - WAIST + 16, UNDIES);
  box(CX - TORSO_HW + 1, HIP_B - 3, (TORSO_HW - 1) * 2, 3, UNDIES_LO);
  if (top.kind === 'vest') {                                              // the vest, when nothing is over it
    box(CX - 8, SHOULDER + 4, 16, WAIST - SHOULDER - 4, UNDIES);
    box(CX - 8, SHOULDER, 4, 6, UNDIES);
    box(CX + 4, SHOULDER, 4, 6, UNDIES);
    box(CX + 6, SHOULDER + 4, 2, WAIST - SHOULDER - 4, UNDIES_LO);
  }

  // ── the bottom half ────────────────────────────────────────────────────
  if (bottom.kind === 'trousers') {
    const leg = bottom.leg ?? 3;
    const hem = leg >= 3 ? LEG_B - 2 : leg === 2 ? 116 : 104;
    box(CX - TORSO_HW + 1, WAIST, (TORSO_HW - 1) * 2, HIP_B - WAIST + 2, bottom.cloth);
    box(CX - TORSO_HW + 1, WAIST, (TORSO_HW - 1) * 2, 3, bottom.trim);      // waistband
    for (const sgn of [-1, 1]) {
      const lx = sgn < 0 ? CX - LEG_GAP - LEG_HW * 2 : CX + LEG_GAP;
      limb(lx, HIP_B, LEG_HW * 2, hem - HIP_B, bottom.cloth);
      if (bottom.id === 'track') limb(sgn < 0 ? lx : lx + LEG_HW * 2 - 1, HIP_B, 1, hem - HIP_B, bottom.trim);
      limb(lx, hem - 2, LEG_HW * 2, 2, bottom.trim);
    }
  } else if (bottom.kind === 'skirt' || bottom.kind === 'dress') {
    // A SKIRT IS A CONE and this world draws a cone as stepped bands — the way
    // `ct/citizens.ts` flares its dress over the hips. Not a path: an
    // antialiased diagonal would be the only soft edge on the whole panel.
    const hem = bottom.kind === 'dress' ? 118 : 114;
    const top0 = bottom.kind === 'dress' ? SHOULDER + 2 : WAIST;
    for (let b = 0; b < 4; b++) {
      const y0 = top0 + ((hem - top0) * b) / 4, y1 = top0 + ((hem - top0) * (b + 1)) / 4;
      const hw = TORSO_HW - 1 + b * 2;
      box(CX - hw, y0, hw * 2, y1 - y0, bottom.cloth);
    }
    box(CX - TORSO_HW - 7, hem - 2, (TORSO_HW + 7) * 2, 2, bottom.trim);
  }

  // ── the top half ───────────────────────────────────────────────────────
  if (top.kind !== 'vest') {
    const hem = WAIST + (top.hem ?? 2);
    box(CX - TORSO_HW, SHOULDER - 1, TORSO_HW * 2, hem - SHOULDER + 1, top.cloth);
    box(CX - TORSO_HW, SHOULDER - 1, 2, hem - SHOULDER + 1, 'rgba(255,255,255,0.10)');
    box(CX + TORSO_HW - 2, SHOULDER - 1, 2, hem - SHOULDER + 1, 'rgba(0,0,0,0.16)');
    box(CX - TORSO_HW, SHOULDER - 1, TORSO_HW * 2, 2, top.trim);             // collar
    const sleeveB = top.sleeve === 2 ? ARM_B - 2 : ARM_T + 12;
    for (const sgn of [-1, 1]) {
      const ax = sgn < 0 ? CX - TORSO_HW - ARM_W + 1 : CX + TORSO_HW - 1;
      limb(ax, ARM_T - 2, ARM_W, sleeveB - ARM_T + 2, top.cloth);
      limb(ax, sleeveB - 2, ARM_W, 2, top.trim);                             // the cuff
    }
    if (top.kind === 'jacket') {
      box(CX - 1, SHOULDER + 1, 1, hem - SHOULDER - 1, 'rgba(0,0,0,0.22)');
      box(CX - 6, SHOULDER + 1, 5, 6, top.trim);                             // lapels
      box(CX + 1, SHOULDER + 1, 5, 6, top.trim);
    }
    if (top.kind === 'sweater') box(CX - TORSO_HW, hem - 3, TORSO_HW * 2, 3, top.trim);
  }

  // the watch, on the wrist the hud raises
  if (watch.kind !== 'none') {
    const ax = CX - TORSO_HW - ARM_W + 1;
    limb(ax - 1, WRIST_T + 2, ARM_W + 2, 8, watch.cloth);
    limb(ax - 1, WRIST_T + 4, ARM_W + 2, 4, watch.trim);
    limb(ax, WRIST_T + 5, ARM_W, 2, watch.kind === 'digital' ? '#9cab8b' : '#e6e0cc');
  }

  // shoes
  for (const sgn of [-1, 1]) {
    const lx = sgn < 0 ? CX - LEG_GAP - LEG_HW * 2 : CX + LEG_GAP;
    // A FOOT IS 10 cm ACROSS AND 26 cm LONG, so turning makes a shoe BIGGER.
    // `deep` is the only family that grows, and this is what it is for.
    if (shoes.kind === 'sneaker') {
      deep(lx - 1, LEG_B - 4, LEG_HW * 2 + 2, FOOT_B - LEG_B + 4, shoes.cloth);
      deep(lx - 1, FOOT_B - 2, LEG_HW * 2 + 2, 2, shoes.trim);
      deep(lx - 1, LEG_B - 1, LEG_HW * 2 + 2, 1, shoes.trim);
    } else if (shoes.kind === 'sandal') {
      deep(lx - 1, FOOT_B - 3, LEG_HW * 2 + 2, 3, shoes.cloth);
      deep(lx, LEG_B, LEG_HW * 2, 1, shoes.trim);
      deep(lx, LEG_B + 3, LEG_HW * 2, 1, shoes.trim);
    } else if (shoes.kind === 'boot') {
      deep(lx - 1, LEG_B - 12, LEG_HW * 2 + 2, FOOT_B - LEG_B + 12, shoes.cloth);
      deep(lx - 1, FOOT_B - 2, LEG_HW * 2 + 2, 2, shoes.trim);
    } else {
      deep(lx - 1, LEG_B, LEG_HW * 2 + 2, FOOT_B - LEG_B, SKIN_HI);            // bare
    }
  }

  // the hat
  if (hat.kind === 'cap') {
    head(CX - HEAD_HW - 1, HEAD_T - 4, HEAD_HW * 2 + 2, 7, hat.cloth);        // the crown
    // THE PEAK IS THE DEEPEST THING ON THE FIGURE — head-on it is a bar across
    // the brow, in profile it is the longest part of the silhouette. So it
    // grows AND it slides forward onto the face's side as he turns, which is
    // what says which way a capped head is looking.
    deep(CX - HEAD_HW - 3 - facing * 2, HEAD_T + 2, HEAD_HW * 2 + 6, 2, hat.trim);
    head(CX - 1, HEAD_T - 5, 2, 2, hat.trim);                                 // the button
  } else if (hat.kind === 'sun') {
    head(CX - HEAD_HW, HEAD_T - 6, HEAD_HW * 2, 8, hat.cloth);                // crown
    // A BRIM IS A DISC and a disc's silhouette is its diameter from every
    // angle, so it keeps the head's own factor rather than the shoulders'.
    head(CX - 13, HEAD_T + 1, 26, 3, hat.cloth);                              // brim
    head(CX - 13, HEAD_T + 3, 26, 1, 'rgba(0,0,0,0.20)');
    head(CX - HEAD_HW, HEAD_T - 1, HEAD_HW * 2, 2, hat.trim);                 // the band
  }

  // glasses
  if (specs.kind !== 'none') {
    for (const sgn of [-1, 1]) {
      const gx = sgn < 0 ? CX - 6 : CX + 1;
      head(gx, EYE_Y - 1, 5, 4, specs.cloth);
      head(gx, EYE_Y - 2, 5, 1, specs.trim);
      head(gx, EYE_Y + 3, 5, 1, specs.trim);
      head(sgn < 0 ? gx - 1 : gx + 5, EYE_Y - 1, 1, 4, specs.trim);
    }
    head(CX - 1, EYE_Y, 2, 1, specs.trim);                                    // the bridge
    // THE TEMPLES RUN FRONT TO BACK, so in profile they are the whole of a pair
    // of glasses — the one part that gets longer rather than shorter.
    deep(CX - HEAD_HW - 1, EYE_Y, 2, 1, specs.trim);
    deep(CX + HEAD_HW - 1, EYE_Y, 2, 1, specs.trim);
  }
}

/** the garment art's own grid. 1:2 and chunky on purpose — it is the shape a
 *  hanging shirt and a standing pair of shoes both fit. */
const HANG_TW = 32, HANG_TH = 64;

/**
 * ONE GARMENT, AND IT IS DRAWN THE WAY YOU WOULD PICK IT UP.
 *
 * *"not bad but im not sure i like how things are hung?"* was about a wall
 * rail that no longer exists, but the split it forced survives every
 * presentation since and is the reason this painter has two families: **a
 * shirt is held up by the shoulders and a shoe is set down on its soles.**
 * Drawing all six the same way is what looked wrong on the batten and would
 * look exactly as wrong in a tray.
 *
 *     HUNG   tops, bottoms — on a hanger, falling from the top of the frame
 *     SET    shoes (a pair), hats, glasses, the watch with its strap coiled —
 *            standing on the bottom of the frame, on their own feet
 *
 * ONE CANVAS EITHER WAY: the painter decides whether the garment starts at the
 * top and falls or stands on the last row. Nothing about the quad changes.
 */
function paintHanging(g: CanvasRenderingContext2D, ox: number, oy: number,
                      W: number, H: number, gm: Garment): void {
  const s = W / HANG_TW;
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    const x0 = Math.round(x * s), y0 = Math.round(y * s);
    g.fillStyle = fill;
    g.fillRect(ox + x0, oy + y0, Math.max(1, Math.round((x + w) * s) - x0),
      Math.max(1, Math.round((y + h) * s) - y0));
  };
  const C = 16;                    // the centre line
  const B = HANG_TH;               // the last row: what it stands on
  const WOOD = '#6b563c', WIRE = '#9a9aa2';

  /** THE HANGER, identical on every garment that uses one. A shoulder line and
   *  a wire hook: one more shape than a bare peg, and it is what makes a top
   *  read as HUNG rather than impaled. It also gives every top the same
   *  shoulder width, which is what lines the row up. */
  const hanger = () => {
    box(C - 1, 0, 2, 5, WIRE);
    box(C - 3, 0, 6, 2, WIRE);
    for (let r = 0; r < 5; r++) box(C - 3 - r * 2, 6 + r, 6 + r * 4, 1, WOOD);
  };

  switch (gm.kind) {
    // ── HUNG ───────────────────────────────────────────────────────────────
    case 'tee': case 'sweater': case 'jacket': case 'vest': {
      hanger();
      const long = gm.sleeve === 2;
      const hem = gm.kind === 'jacket' ? 49 : 43;
      box(C - 10, 11, 20, hem - 11, gm.cloth);                                  // the body
      box(C - 14, 11, 4, long ? 30 : 12, gm.cloth);                             // sleeves
      box(C + 10, 11, 4, long ? 30 : 12, gm.cloth);
      box(C - 14, long ? 39 : 21, 4, 2, gm.trim);                               // cuffs
      box(C + 10, long ? 39 : 21, 4, 2, gm.trim);
      box(C - 10, 11, 20, 3, gm.trim);                                          // collar
      box(C - 10, 11, 2, hem - 11, 'rgba(255,255,255,0.10)');
      box(C + 8, 11, 2, hem - 11, 'rgba(0,0,0,0.16)');
      if (gm.kind === 'jacket') box(C - 1, 14, 2, hem - 15, 'rgba(0,0,0,0.24)');
      if (gm.kind === 'sweater') box(C - 10, hem - 3, 20, 3, gm.trim);
      break;
    }
    case 'dress': {
      hanger();
      box(C - 8, 11, 16, 18, gm.cloth);                                         // bodice
      for (let b = 0; b < 4; b++) box(C - 8 - b * 2, 29 + b * 6, 16 + b * 4, 6, gm.cloth);
      box(C - 14, 51, 28, 2, gm.trim);
      break;
    }
    case 'trousers': {
      hanger();
      const hem = (gm.leg ?? 3) >= 3 ? 56 : 34;
      box(C - 9, 11, 18, 6, gm.trim);                                           // the waistband
      box(C - 9, 17, 8, hem - 17, gm.cloth);                                    // two legs
      box(C + 1, 17, 8, hem - 17, gm.cloth);
      if (gm.id === 'track') { box(C - 9, 17, 1, hem - 17, gm.trim); box(C + 8, 17, 1, hem - 17, gm.trim); }
      break;
    }
    case 'skirt': {
      hanger();
      box(C - 8, 11, 16, 4, gm.trim);
      for (let b = 0; b < 4; b++) box(C - 8 - b * 2, 15 + b * 6, 16 + b * 4, 6, gm.cloth);
      break;
    }

    // ── STOOD ON THE SHELF ─────────────────────────────────────────────────
    case 'sneaker': case 'boot': case 'sandal': {
      // A PAIR, side by side, toes toward you — which is how shoes are left,
      // and it doubles the silhouette so the category reads at a glance.
      const up = gm.kind === 'boot' ? 18 : gm.kind === 'sandal' ? 4 : 10;
      for (const x0 of [1, 17]) {
        box(x0, B - 5 - up, 14, up, gm.cloth);                                  // the upper
        box(x0, B - 5, 14, 3, gm.cloth);                                        // the foot
        box(x0, B - 2, 14, 2, gm.trim);                                         // the sole
        if (gm.kind === 'sandal') { box(x0 + 1, B - 11, 12, 2, gm.trim); box(x0 + 1, B - 8, 12, 2, gm.trim); }
        if (gm.kind === 'sneaker') box(x0, B - 8, 14, 2, gm.trim);              // the stripe
      }
      break;
    }
    case 'cap': {
      box(C - 11, B - 17, 22, 12, gm.cloth);                                    // the crown
      box(C - 16, B - 6, 16, 4, gm.trim);                                       // the peak, on the shelf
      box(C - 2, B - 20, 4, 3, gm.trim);                                        // the button
      break;
    }
    case 'sun': {
      box(C - 9, B - 21, 18, 12, gm.cloth);                                     // the crown
      box(C - 16, B - 9, 32, 6, gm.cloth);                                      // the brim
      box(C - 16, B - 5, 32, 2, 'rgba(0,0,0,0.22)');
      box(C - 9, B - 13, 18, 4, gm.trim);                                       // the band
      break;
    }
    case 'clear': case 'shades': {
      box(C - 14, B - 11, 11, 9, gm.cloth);                                     // the lenses
      box(C + 3, B - 11, 11, 9, gm.cloth);
      box(C - 14, B - 12, 11, 2, gm.trim); box(C + 3, B - 12, 11, 2, gm.trim);
      box(C - 14, B - 3, 11, 2, gm.trim); box(C + 3, B - 3, 11, 2, gm.trim);
      box(C - 3, B - 10, 6, 2, gm.trim);                                        // the bridge
      box(C - 16, B - 12, 2, 3, gm.trim); box(C + 14, B - 12, 2, 3, gm.trim);   // folded arms
      break;
    }
    case 'digital': case 'analog': {
      // THE STRAP COILED, which is what a watch does when you put it down.
      box(C - 9, B - 16, 18, 4, gm.cloth);
      box(C - 9, B - 16, 4, 14, gm.cloth);
      box(C + 5, B - 16, 4, 14, gm.cloth);
      box(C - 9, B - 4, 18, 4, gm.cloth);
      box(C - 7, B - 22, 14, 9, gm.trim);                                       // the case
      box(C - 5, B - 20, 10, 5, gm.kind === 'digital' ? '#9cab8b' : '#e6e0cc');
      break;
    }
    default:
      hanger();
      box(C - 9, 11, 18, 30, gm.cloth);
      box(C - 9, 41, 18, 3, gm.trim);
  }
}

// ══ THE CLOSET ═════════════════════════════════════════════════════════════
//
// *"lets make the mirror small and just a face mirror btw. i have an idea for a
//  new interface. now instead we fade to black and we see a little like sprite
//  version of ourselves and we can apply the clothes to the sprite and its cute
//  and '97 themed little imagination of outfit and watch and all that. have
//  more fun with it."*   (2026-08-04)
//
// ── FIVE PRESENTATIONS DIED TO GET HERE AND THEY ALL DIED OF THE SAME THING ─
//
//   · a SCREEN-SPACE PANEL      *"not diagetic. this is not an option."*
//   · a SUITCASE, 18 in the lid *"looks awful and all the little items dont
//                                make sense."* Each was 4.2% of the frame.
//   · a WALL BATTEN + shelf     *"not bad but im not sure i like how things
//                                are hung"*, then *"rail looks worse."*
//   · a HELD GARMENT            *"this setup sucks."*
//
// Every one of them staged this INSIDE A SMALL ROOM, where it competed with the
// mirror for the frame and had to survive being stared at in a world drawn at
// forty texels to the metre. **On black, at sprite scale, not one of those
// pressures exists.** So do not rebuild the room here: there is no wall, no
// floor, no furniture and no light on this screen, and that absence is the
// feature.
//
// ── AND YES, HE REVERSED HIMSELF, AND THE REVERSAL IS RIGHT ────────────────
//
// *"not diagetic. this is not an option"* was three hours ago and this is a
// screen over black. **His newer words outrank his earlier ones** — the rule is
// in CLAUDE.md and it is the most valuable thing a builder here does. His own
// framing is what dissolves the contradiction: this is not an interface
// pretending to be furniture, it is *"a little imagination"*. You look in a
// mirror and picture yourself in things. That is allowed to leave the room,
// and it is the only one of the six that ever was.
//
// ── AND IT IS ALLOWED TO BE FUN, WHICH NOTHING ELSE HERE IS ────────────────
//
// *"have more fun with it"* is an instruction, and it is the exact opposite of
// the note every other surface in this project carries. Fewer, clearer shapes
// is the law of the STREET — it is what the arm, the suitcase and the rail were
// all pulled up on. This screen is not the street. It is a 1997 dress-up
// screen: hot pink and cyan, chunky type, a starburst, a checkered border, a
// doll on a little stage. **Do not sober this up to match the rest of the
// world.**

/** the screen, in design px, and the CSS pixels each one is drawn at */
const SW = 320, SH = 180, SSCALE = 4;

/** the palette, and it is deliberately nothing like the street's */
const UI97 = {
  ink: '#fff4fb',
  hot: '#e0338c',        // the pink every box on a 1997 screen was
  cyan: '#3ad1e0',
  gold: '#ffd21e',
  deep: '#1a0f2a',       // the near-black the doll's stage sits on
  shade: '#2c1a44',
} as const;

/** the doll's stage, the tray of clothes, and the six tabs over it */
const STAGE = { x: 8, y: 22, w: 104, h: 150 };
const TABS = { x: 120, y: 22, w: 192, h: 18 };
const TRAY = { x: 120, y: 46, w: 192, h: 126 };
/** five garments across the tray, 1:2 like the art */
const CELL_W = 36, CELL_H = 72, CELL_GAP = 3;

const cellRect = (i: number) => ({
  x: TRAY.x + 4 + i * (CELL_W + CELL_GAP), y: TRAY.y + 16, w: CELL_W, h: CELL_H,
});
const tabRect = (i: number) => ({
  x: TABS.x + i * (TABS.w / SLOTS.length), y: TABS.y, w: TABS.w / SLOTS.length - 2, h: TABS.h,
});
const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** what the tabs are called. Three letters, because the tab is 30 px wide. */
const TAB_NAME: Record<Slot, string> = {
  top: 'TOP', bottom: 'LEG', shoes: 'FEET', hat: 'HAT', glasses: 'EYES', watch: 'TIME',
};

/** everything in a category except the empty state, which is not a thing */
const rackOf = (slot: Slot) => options(slot).slice(1);

export function mirrorPanel(): () => void {
  let panel: Panel | null = null;
  let cat: Slot = 'top';
  /** the garment on the cursor: which slot, which index, and where it is */
  let held: { slot: Slot; index: number } | null = null;
  let ptr: { x: number; y: number } | null = null;
  /** a press that has not travelled far enough to be a drag yet */
  let pending: { slot: Slot; index: number; x: number; y: number } | null = null;
  const GRAB_PX = 5;
  /** which way the doll is facing, 0…7 — the wheel still turns him */
  let facing = 0;
  /** a little life: the doll bobs, and the starburst spins */
  let t0 = 0;

  const repaint = () => panel?.repaint();

  /** the tray cell under this point — closed over `cat`, because the tray only
   *  ever shows one category and the cell IS the garment. */
  const cellAt = (x: number, y: number): { slot: Slot; index: number } | null => {
    const rack = rackOf(cat);
    for (let i = 0; i < rack.length; i++) {
      if (inRect(x, y, cellRect(i))) return { slot: cat, index: i + 1 };
    }
    return null;
  };
  const tabAt = (x: number, y: number): Slot | null => {
    for (let i = 0; i < SLOTS.length; i++) if (inRect(x, y, tabRect(i))) return SLOTS[i];
    return null;
  };
  /**
   * WHICH PART OF THE DOLL IS UNDER THIS POINT — the same `ZONES` the figure is
   * painted from, so what you can grab is exactly what you can see.
   *
   * The turn has to be undone first: at 55% and mirrored, a wrist is not where
   * the front-on grid says it is. Bands that run the full width do not care;
   * the watch is the one that does.
   */
  const dollSlotAt = (x: number, y: number): Slot | null => {
    const [col, flip] = viewAt(facing);
    let dx = (x - DOLL_X) / DOLL_S;
    dx = (dx - CX) / COL_SPAN[col] + CX;
    if (flip) dx = 2 * CX - dx;
    const z = zoneAt(dx, (y - DOLL_Y) / DOLL_S);
    if (!z) return null;
    return z === 'bottom' && worn('top').full ? 'top' : z;
  };

  /** the doll's own scale and origin inside the stage, one factor both axes */
  const DOLL_S = Math.min(STAGE.w / MW, (STAGE.h - 10) / MH);
  const DOLL_X = STAGE.x + Math.round((STAGE.w - MW * DOLL_S) / 2);
  const DOLL_Y = STAGE.y + 4;

  const paint = (g: CanvasRenderingContext2D, W: number, H: number) => {
    const now = performance.now() / 1000;
    if (!t0) t0 = now;
    const t = now - t0;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);

    // ── THE FRAME: a checkered border, which is the single most 1997 thing a
    // screen can wear, and it costs one loop.
    for (let x = 0; x < W; x += 8) {
      const c = (x / 8) % 2 ? UI97.hot : UI97.cyan;
      g.fillStyle = c; g.fillRect(x, 0, 8, 3); g.fillRect(x, H - 3, 8, 3);
    }
    for (let y = 0; y < H; y += 8) {
      const c = (y / 8) % 2 ? UI97.cyan : UI97.hot;
      g.fillStyle = c; g.fillRect(0, y, 3, 8); g.fillRect(W - 3, y, 3, 8);
    }

    // ── THE TITLE, with a star that turns. Nothing in this world has ever had
    // an animated flourish and this screen gets one.
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = UI97.gold;
    g.font = 'bold 11px ui-monospace, Menlo, monospace';
    g.fillText('CROSSTOWN CLOSET', W / 2, 12);
    for (const sx of [W / 2 - 62, W / 2 + 62]) {
      g.save(); g.translate(sx, 12); g.rotate(t * 1.1);
      g.fillStyle = UI97.gold;
      for (let k = 0; k < 4; k++) {
        g.save(); g.rotate((k / 4) * Math.PI); g.fillRect(-5, -1, 10, 2); g.restore();
      }
      g.restore();
    }

    // ── THE STAGE, and the doll on it ──────────────────────────────────
    g.fillStyle = UI97.deep;
    g.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
    g.fillStyle = UI97.shade;
    g.fillRect(STAGE.x, STAGE.y + STAGE.h - 12, STAGE.w, 12);      // the floor of it
    g.fillStyle = held ? UI97.gold : UI97.hot;                      // its rule
    g.fillRect(STAGE.x, STAGE.y, STAGE.w, 2);
    g.fillRect(STAGE.x, STAGE.y + STAGE.h - 2, STAGE.w, 2);
    g.fillRect(STAGE.x, STAGE.y, 2, STAGE.h);
    g.fillRect(STAGE.x + STAGE.w - 2, STAGE.y, 2, STAGE.h);
    // A LITTLE BOB. One texel, once a second and a half — enough that the doll
    // reads as a character rather than a diagram, and small enough that it
    // never fights the drag.
    const bob = Math.round(Math.sin(t * 2.2) * 0.5 - 0.5);
    g.fillStyle = 'rgba(0,0,0,0.45)';                               // his shadow
    g.fillRect(DOLL_X + 8, STAGE.y + STAGE.h - 13, Math.round(MW * DOLL_S) - 16, 3);
    paintFigure(g, DOLL_X, DOLL_Y + bob, DOLL_S, facing);

    // ── THE SIX TABS ───────────────────────────────────────────────────
    SLOTS.forEach((sl, i) => {
      const r = tabRect(i);
      const on = sl === cat;
      g.fillStyle = on ? UI97.hot : UI97.shade;
      g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = on ? UI97.gold : '#5b4a72';
      g.fillRect(r.x, r.y, r.w, 2);
      g.fillStyle = on ? UI97.ink : '#9a86b8';
      g.font = 'bold 8px ui-monospace, Menlo, monospace';
      g.fillText(TAB_NAME[sl], r.x + r.w / 2, r.y + r.h / 2 + 1);
    });

    // ── THE TRAY ───────────────────────────────────────────────────────
    g.fillStyle = UI97.deep;
    g.fillRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h);
    g.fillStyle = UI97.cyan;
    g.fillRect(TRAY.x, TRAY.y, TRAY.w, 2);
    g.fillRect(TRAY.x, TRAY.y + TRAY.h - 2, TRAY.w, 2);
    g.fillRect(TRAY.x, TRAY.y, 2, TRAY.h);
    g.fillRect(TRAY.x + TRAY.w - 2, TRAY.y, 2, TRAY.h);
    const rack = rackOf(cat);
    rack.forEach((gm, i) => {
      const r = cellRect(i);
      const idx = i + 1;
      const gone = wornIndex(cat) === idx || (held?.slot === cat && held.index === idx);
      g.fillStyle = gone ? '#150c22' : UI97.shade;
      g.fillRect(r.x, r.y, r.w, r.h);
      if (gone) {
        // AN EMPTY PEG, so a garment is in exactly one place at a time and you
        // can see where the one on the doll came from.
        g.fillStyle = '#3a2a56';
        for (let k = 0; k < r.h; k += 6) g.fillRect(r.x + r.w / 2 - 1, r.y + k, 2, 3);
        return;
      }
      paintHanging(g, r.x, r.y, r.w, r.h, gm);
    });
    // and what the tray is for, said once, in the tray
    g.fillStyle = UI97.cyan;
    g.font = 'bold 8px ui-monospace, Menlo, monospace';
    g.fillText('DRAG IT ONTO YOURSELF', TRAY.x + TRAY.w / 2, TRAY.y + TRAY.h - 10);

    // ── AND WHAT IS ON THE CURSOR ──────────────────────────────────────
    if (held && ptr) {
      const gm = options(held.slot)[held.index];
      if (gm) paintHanging(g, Math.round(ptr.x - CELL_W / 2), Math.round(ptr.y - CELL_H / 2),
        CELL_W, CELL_H, gm);
    }
  };

  const open = () => {
    if (!panel) {
      panel = makePanel({
        id: 'ct-closet', w: SW, h: SH, scale: SSCALE, chrome: 'none',
        // THE WORLD GOES OUT. See `PanelSpec.blackout`: the ordinary vignette
        // leaves the bedroom faintly visible around the canvas, and the seam
        // between the two blacks is the difference between a fade and a card
        // laid over the room. *"we fade to black"*.
        blackout: true,
        hint: () => 'drag a garment onto yourself · scroll to turn',
        draw: paint,
        wheel: (d) => { facing = (facing + d + 8) % 8; repaint(); },
        key: (k) => {
          // THE KEYBOARD DOES EVERYTHING THE POINTER DOES, so a trackpad, a
          // touchscreen or a stuck mouse can still finish. Escape and `[E]`
          // belong to the framework and nothing here can eat them.
          const i = SLOTS.indexOf(cat);
          if (k === 'arrowright') cat = SLOTS[(i + 1) % SLOTS.length];
          else if (k === 'arrowleft') cat = SLOTS[(i - 1 + SLOTS.length) % SLOTS.length];
          else if (k === 'arrowup') cycle(cat, 1);
          else if (k === 'arrowdown') cycle(cat, -1);
          else return;
          repaint();
        },
        surface: {
          // NO MESH — this screen is not painted on anything in the world, and
          // that is the whole point of it. The surface hooks are only how a
          // panel receives the pointer.
          hot: (x, y) => !!held || !!cellAt(x, y) || !!dollSlotAt(x, y) || !!tabAt(x, y),
          move: (x, y) => {
            ptr = { x, y };
            if (held) { repaint(); return; }
            if (pending) {
              if (Math.hypot(x - pending.x, y - pending.y) > GRAB_PX) {
                held = { slot: pending.slot, index: pending.index };
                // IT COMES OFF THE MOMENT THE DRAG STARTS — you are holding it
                // and the doll is visibly without it.
                if (wornIndex(pending.slot) === pending.index) wear(pending.slot, 0);
                pending = null;
                repaint();
              }
            }
          },
          click: (x, y) => {
            ptr = { x, y };
            const tab = tabAt(x, y);
            if (tab) { cat = tab; repaint(); return; }
            const c = cellAt(x, y);
            if (c) { pending = { ...c, x, y }; return; }
            const sl = dollSlotAt(x, y);
            if (sl && wornIndex(sl) > 0) pending = { slot: sl, index: wornIndex(sl), x, y };
          },
          up: (hit) => {
            const h = held, pend = pending;
            held = null; pending = null;
            // A PRESS THAT NEVER TRAVELLED is a tap: on a garment in the tray
            // it puts it on, which is the shortcut a dress-up screen should
            // have; on the doll it does nothing, because taking clothes off by
            // tapping yourself is how you undress by accident.
            if (!h && pend && wornIndex(pend.slot) !== pend.index) {
              cat = pend.slot; wear(pend.slot, pend.index);
            } else if (h) {
              // ON THE DOLL he wears it. ANYWHERE ELSE — the tray, the tabs,
              // the black, off the canvas entirely — it goes back on its peg,
              // which for something dragged off him means it stays off. That
              // is how you get to the white undies: drag it away and let go.
              if (hit && inRect(hit.x, hit.y, STAGE)) wear(h.slot, h.index);
            }
            ptr = hit;
            repaint();
          },
        },
        // NOTHING SURVIVES A CLOSE EXCEPT THE CLOTHES. Escape mid-drag drops
        // what is on the cursor — no ghost garment — and the framework owns the
        // rest of the way out: Escape and `[E]` from every state, the gate, the
        // pointer lock, and standing up.
        onOpen: () => { held = null; pending = null; ptr = null; facing = 0; cat = 'top'; t0 = 0; },
        onClose: () => { held = null; pending = null; ptr = null; },
      });
      onWardrobeChange(() => { if (panel?.isOpen()) panel.repaint(); });
      // THE STAR TURNS AND THE DOLL BOBS, so this screen repaints on its own —
      // the only one in the world that does. Cheap: a 320 x 180 canvas at 12 a
      // second, and only while it is up.
      setInterval(() => { if (panel?.isOpen()) panel.repaint(); }, 84);
    }
    panel.open();
  };
  return open;
}
