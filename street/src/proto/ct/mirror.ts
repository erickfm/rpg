import * as THREE from 'three';
import { dither } from './paint';
import { makePanel, focusRay, type Panel } from './hud';
import { viewAt } from './citizens';
import {
  SLOTS, options, showing, worn, wornIndex, wear,
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

// ══ THE DRESSING VIEW ══════════════════════════════════════════════════════
//
// *"so the recent wardrobe changes are not diagetic. this is not an option. i
//  liked the original view and how it locked us to that view with the mirror.
//  we just need to be creative and find a way to have clothes we can click and
//  drag. maybe a suitcase on the ground below the mirror?"*   (2026-08-04)
//
// **"THIS IS NOT AN OPTION" IS THE STRONGEST THING HE HAS SAID.** A screen-space
// dressing panel — a canvas over the camera with the mirror and a rack of
// garments drawn on it — was built and is DELETED. Nothing here draws a widget
// over the world any more, and nothing here should ever again: if the player
// can see it, it is an object standing in flat 301.
//
// ── SO WHAT IS ON SCREEN IS THE ROOM ───────────────────────────────────────
//
//   · `[E]` at the mirror LOCKS THE VIEW TO IT, which is the thing he said he
//     liked — the same `PanelSpec.surface` mechanism the wall calendar uses,
//     restored. The eye eases to standing height in front of the glass and
//     tilts down at it (`ScreenSurface.eyeY`, added for this), so the mirror
//     fills the middle of the frame and the FLOORBOARDS AT ITS FOOT are in
//     shot. That tilt is what makes the rest possible.
//   · THE GLASS IS THE PANEL. Its canvas is hung on the mirror's own mesh and
//     paints the reflection with you standing in it — `paintGlass` plus
//     `paintFigure`, the same two drawings as before.
//   · THE CLOTHES ARE IN A SUITCASE ON THE FLOOR UNDER IT, open, lid propped
//     back against the wall. His own suggestion, and it is the right one for a
//     reason beyond the interface: **he was kicked out of his mother's house
//     with what he could carry**, which this world already says in the lease,
//     the mailbox and the empty flat. He lives out of that case. It is not a
//     container that appears when you dress — it is standing in the corner of
//     301 for the whole game, open, with his clothes in it.
//
// ── AND THE DRAG HAPPENS IN THE WORLD ──────────────────────────────────────
//
// There is no canvas-space hit-testing here. The pointer is turned into a
// WORLD RAY (`focusRay`, off the locked camera) and intersected with two
// planes this module owns: the lid of the case, and the face of the mirror.
// Pick a garment off the lid, carry it — it hangs in the air in front of the
// eye, a real quad, tracking the pointer — and drop it on the glass to put it
// on. Drop it anywhere else and it goes back in the case.
//
// **THE TARGETS ARE DELIBERATELY ENORMOUS.** The whole face of the mirror means
// "wear it", not the four texels of yourself where that garment goes; anywhere
// that is not the mirror means "back in the case". A fiddly hitbox would be
// worse than the cycling he rejected, and there are only two answers to give.

// ── THE FIGURE ─────────────────────────────────────────────────────────────
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
const INK = '#efe8d6';

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
 * YOU, IN THE GLASS — the body, the underwear under everything, and whatever
 * is worn over it. `s` scales BOTH axes, always.
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

// ══ WHAT YOU ARE HOLDING ═══════════════════════════════════════════════════
//
// *"rail looks worse come up with something else."*   (2026-08-04)
//
// FOURTH ATTEMPT, AND THE FIRST THAT IS NOT A CONTAINER. Three have been
// rejected and they were all the same idea wearing different clothes:
//
//   · a SCREEN-SPACE PANEL   — *"not diagetic. this is not an option."*
//   · a SUITCASE, 18 garments in the lid — *"looks awful and all the little
//     items dont make sense."* Each one was 4.2% of the frame.
//   · a WALL BATTEN, hooks and a shelf — *"not bad but im not sure i like how
//     things are hung"*, then *"rail looks worse."*
//
// **EVERY ONE OF THEM PUT A PIECE OF FURNITURE IN A SMALL ROOM AND ASKED IT TO
// SURVIVE BEING STARED AT.** A case, a rail, a batten: each competes with the
// mirror for the frame, each has to be drawn well enough to hold up at a metre
// and a half, and each one buys nothing that the clothes themselves do not.
// The room told us as much twice — he had already asked for the flyer and the
// photographs off this wall because they *"make any idea look bad"*.
//
// SO THERE IS NO CONTAINER. **You hold ONE garment up against yourself**, which
// is what a person standing at a mirror actually does, and it is the only
// arrangement here that needs nothing built:
//
//   · it is the BIGGEST the garment can ever be — 0.26 x 0.52 m at arm's
//     length is **62% of the frame's height**, against 29% on the rail and
//     4.2% in the suitcase, and it is the thing the eye is meant to be on
//   · there is nothing to draw but the garment. No lid, no hooks, no shelf, no
//     brackets, nothing on the wall behind it
//   · it cannot compete with the mirror: it hangs at 25.6° off the axis and
//     the glass spans 7.6°, so they never touch
//   · and the flat is left alone. A rented room with a bed, a dresser and a
//     mirror does not also have a garment rail in it, which is part of why the
//     rail looked wrong
//
// TOUCH A PART OF YOURSELF IN THE GLASS and that category comes into your hand;
// touch it again and you are holding the next one. Drop what you are holding on
// the glass to put it on. Drag something off your reflection and it is in your
// hand instead. Nothing is stored anywhere, because there is nowhere to store
// it — the wardrobe is the truth and your hand is the only view onto it.

/** the ray/plane solve, the only geometry this module does */
function hitPlane(origin: THREE.Vector3, dir: THREE.Vector3,
                  po: THREE.Vector3, pn: THREE.Vector3): THREE.Vector3 | null {
  const denom = dir.dot(pn);
  if (Math.abs(denom) < 1e-6) return null;
  const t = po.clone().sub(origin).dot(pn) / denom;
  return t > 0 ? origin.clone().addScaledVector(dir, t) : null;
}

/** how big a garment is in his hands, in metres: 1:2, the shape of the art */
const HOLD_W = 0.26, HOLD_H = 0.52;
/** and in texels. 32 x 64 over 0.26 x 0.52 m — square, and chunky on purpose. */
const HANG_TW = 32, HANG_TH = 64;

/**
 * ONE GARMENT, HELD UP, AND IT IS DRAWN THE WAY YOU WOULD HOLD IT.
 *
 * *"not bad but im not sure i like how things are hung?"* was about the rail
 * and the rail is gone, but the halves it split into survive and are the
 * reason this painter has two families in it: **a shirt is held up by the
 * shoulders and a shoe is held out in the flat of your hand.** Presenting all
 * six the same way is what looked wrong on the batten and would look exactly
 * as wrong in a hand.
 *
 *     HUNG   tops, bottoms — on a hanger, falling from the top of the frame
 *     HELD   shoes (a pair), hats, glasses, the watch with its strap coiled —
 *            sitting on the bottom of the frame, on their own feet
 *
 * ONE CANVAS EITHER WAY: the painter decides whether the garment starts at the
 * top and falls or stands on the last row. Nothing about the quad changes.
 */
function paintHanging(g: CanvasRenderingContext2D, W: number, H: number, gm: Garment): void {
  const s = W / HANG_TW;
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    const x0 = Math.round(x * s), y0 = Math.round(y * s);
    g.fillStyle = fill;
    g.fillRect(x0, y0, Math.max(1, Math.round((x + w) * s) - x0),
      Math.max(1, Math.round((y + h) * s) - y0));
  };
  const C = 16;                    // the centre line
  const B = HANG_TH;               // the last row: his open hand
  const WOOD = '#6b563c', WIRE = '#9a9aa2';
  g.clearRect(0, 0, W, H);

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

// ══ THE PANEL: THE LOCKED VIEW, AND THE DRAG BETWEEN CASE AND GLASS ════════

/**
 * THE PANEL CANVAS'S DENSITY, in px per metre of glass.
 *
 * 200, five times the wall plate's own 40 — you are 1.95 m from it here rather
 * than across the room. Its SIZE is derived from the glass's metres at this
 * density and never typed, for the reason `glassCanvas` exists: a fixed canvas
 * on a resizable quad is what stretched the plate, and *"give me true
 * proportions in the mirror i feel stretched"* is not a note worth earning
 * twice.
 */
const PANEL_PPM = 200;

export function mirrorPanel(o: {
  /** the glass, resolved at open time — interiors are rebuilt as you move */
  mesh: () => THREE.Object3D | null;
  /** the glass's own size, for the drop test and the canvas's proportions */
  glassW: number; glassH: number;
  standoff: number; fov: number; eyeY: number;
}): () => void {
  const PW = Math.round(o.glassW * PANEL_PPM), PH = Math.round(o.glassH * PANEL_PPM);
  /** canvas px per design unit — one number, both axes (see `draw`) */
  const FIG_S = Math.min(PW / MW, PH / MH);
  /** …and the same thing in METRES of glass, which is what the world-space
   *  hit-test against the figure needs. */
  const FIG_M = FIG_S * o.glassW / PW;
  /**
   * WHICH GARMENT HE GRABBED OFF HIMSELF — the figure's zones, in world space.
   *
   * `p` is where the ray met the glass and `c` its centre, so the offset is in
   * metres across the mirror's face; the figure is drawn centred on that face,
   * so one division by `FIG_M` puts it back in design units and the same
   * `ZONES` the painter uses answer. The DRESS is the one place the answer is
   * not the zone's own slot: a dress fills the bottom slot, so a hand on the
   * legs of someone wearing one is a hand on the dress, which lives in `top`.
   */
  const bodySlotAt = (p: THREE.Vector3, c: THREE.Vector3): Slot | null => {
    // ⚠ THE SAME −x, for the same reason: the mirror hangs with `rotation.y =
    // PI`, so its texture's `u` runs along world −x. His watch is drawn on the
    // canvas's left and is grabbed on the world's right.
    //
    // AND THE HIT-TEST TURNS WITH HIM. The zones are written on the front-on
    // grid, so a figure squeezed to 55% and mirrored has to be undone before
    // they mean anything — otherwise his watch is grabbable where it is not
    // drawn, which is exactly the almost-but-not-quite the handrail was pulled
    // up on. Bands that run the full width (hat, top, bottom, shoes) do not
    // care; the wrist is the one that does.
    const [col, flip] = viewAt(facing);
    let dx = (MW / 2 - (p.x - c.x) / FIG_M - CX) / COL_SPAN[col] + CX;
    if (flip) dx = 2 * CX - dx;
    const z = zoneAt(dx, MH / 2 - (p.y - c.y) / FIG_M);
    if (!z) return null;
    return z === 'bottom' && worn('top').full ? 'top' : z;
  };
  let panel: Panel | null = null;
  /** the garment in his hand */
  let held: { slot: Slot; index: number } | null = null;
  /**
   * A HAND ON HIMSELF THAT HAS NOT MOVED YET.
   *
   * Touching a part of yourself in the glass does TWO things and they must not
   * be the same gesture. A CLICK hangs that category on the rail — *"show me my
   * hats"*. A DRAG pulls the garment off. So a press on the body is only
   * pending until the pointer travels `GRAB_PX`; browsing your own hats can
   * never undress you by accident, which the first arrangement did.
   */
  let pending: { slot: Slot; index: number; x: number; y: number } | null = null;
  const GRAB_PX = 6;
  /**
   * THE CATEGORY IN HIS HAND, and which of its garments.
   *
   * There is no container, so there is nothing to remember: `cat` is the part
   * of himself he last touched and `pick` is where he has got to in that
   * category's rack. Both are a VIEW onto `ct/wardrobe.ts` and neither is state
   * anybody else can see — which is the point of an arrangement with no
   * furniture in it.
   */
  let cat: Slot = 'top';
  let pick = 1;
  /** the next garment in `cat` he is not already wearing */
  const nextPick = (from: number, dir = 1): number => {
    const n = options(cat).length - 1;                 // the empty state is not a thing
    for (let k = 1; k <= n; k++) {
      const i = (((from - 1 + dir * k) % n) + n) % n + 1;
      if (wornIndex(cat) !== i) return i;
    }
    return from;
  };
  /**
   * WHICH WAY THE REFLECTION IS FACING, 0…7. *"scroll to turn self in mirror?"*
   *
   * FRONT-ON EVERY TIME HE WALKS UP. A mirror you left facing away three hours
   * ago is a state with no visible cause — the same reasoning that resets the
   * wall calendar's page on every open. It holds while the view is up, so he
   * can put a jacket on, turn, and look at the back of it.
   */
  let facing = 0;
  /** the quad it is carried on, built once and parked when empty */
  let carry: THREE.Mesh | null = null;
  let carryCv: HTMLCanvasElement | null = null;
  let carryT: THREE.CanvasTexture | null = null;

  const CARRY_D = 0.85;     // how far in front of the eye a DRAGGED garment goes
  /**
   * WHERE IT SITS WHEN HE IS NOT DRAGGING IT — his own hand, low and to the
   * left of the frame.
   *
   * DERIVED FROM THE LOCKED POSE, not placed by eye, because the pose is fixed
   * and known: the eye is `standoff` back along the glass's normal at `eyeY`,
   * looking at the glass's centre. 0.75 m along that look, 0.36 m to the
   * screen's left and 0.20 m down puts a 0.26 x 0.52 garment at **62% of the
   * frame's height** with its inner edge 17° off the axis, against a mirror
   * that spans 7.6° — enormous, and it never crosses the reflection.
   *
   * Screen-left is world +x: this glass hangs on a wall facing −z, so the
   * locked yaw is π and the camera's right is −x.
   */
  const restAt = (): { p: THREE.Vector3; eye: THREE.Vector3 } | null => {
    const gp = glassPlane();
    if (!gp) return null;
    const eye = gp.c.clone().addScaledVector(gp.n, o.standoff);
    eye.y += o.eyeY - 1.125;
    const f = gp.c.clone().sub(eye).normalize();
    const right = new THREE.Vector3(-1, 0, 0);
    const up = new THREE.Vector3().crossVectors(right, f).normalize();
    return {
      p: eye.clone().addScaledVector(f, 0.75)
        .addScaledVector(right, -0.36).addScaledVector(up, -0.20),
      eye,
    };
  };

  /** the glass's plane, in world space. Its normal is the mirror's own −z. */
  const glassPlane = () => {
    const m = o.mesh();
    if (!m) return null;
    m.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld).normalize();
    return { c, n };
  };

  /** put whatever he is holding back in his hand, at the rest pose */
  const restCarry = () => {
    const r = restAt();
    const gm = options(cat)[pick];
    if (!r || !gm || wornIndex(cat) === pick) { if (carry) carry.visible = false; return; }
    showCarry(r.p, r.eye, gm);
  };
  /** and take it out of the world entirely — the view is closing */
  const dropCarry = () => { if (carry) carry.visible = false; };

  const showCarry = (p: THREE.Vector3, eye: THREE.Vector3, gm: Garment) => {
    if (!carry) {
      carryCv = document.createElement('canvas');
      carryCv.width = HANG_TW * 4; carryCv.height = HANG_TH * 4;
      carryT = new THREE.CanvasTexture(carryCv);
      carryT.magFilter = THREE.NearestFilter; carryT.minFilter = THREE.NearestFilter;
      carry = new THREE.Mesh(new THREE.PlaneGeometry(HOLD_W, HOLD_H),
        new THREE.MeshBasicMaterial({
          map: carryT, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
        }));
      carry.renderOrder = 5;
      (o.mesh()?.parent ?? null)?.add(carry);
    }
    const g = carryCv!.getContext('2d');
    if (g) {
      paintHanging(g, carryCv!.width, carryCv!.height, gm);
      carryT!.needsUpdate = true;
    }
    carry.visible = true;
    carry.position.copy(p);
    carry.lookAt(eye);
  };

  const open = () => {
    if (!panel) {
      panel = makePanel({
        id: 'ct-mirror', w: PW, h: PH, chrome: 'none', scale: 1,
        // ONE LINE OF CHROME, and it is the only thing on screen that is not in
        // the room: the caption every panel in this world owes, saying how to
        // leave. The calendar and the ATM carry the same one and he has looked
        // at both. Everything else you can see is 301.
        hint: () => 'touch yourself for what to try on · scroll to turn',
        // ── THE WHEEL TURNS YOU ────────────────────────────────────────
        //
        // ONE NOTCH, ONE FACING, eight stops — `viewAt`'s own eight, so the
        // reflection steps through exactly the angles the atlas paints and
        // never lands between two of them.
        //
        // IT CANNOT STEAL THE ZOOM. Outside a panel the wheel is
        // `crosstown.ts`'s fov zoom, on a BUBBLE-phase listener; the gate this
        // panel installs is CAPTURE-phase and calls `stopImmediatePropagation`
        // plus `preventDefault` on every wheel event, so while the mirror is
        // up the world never sees one and the page cannot scroll under the
        // canvas either. Close the mirror and the zoom is exactly as it was.
        // That is the mechanism the wall calendar's page-turn already rides.
        //
        // ONLY THE FIGURE TURNS. The rail is meshes on a wall and this touches
        // nothing but the canvas hung on the glass — the garments cannot
        // follow him round, because they are not his.
        wheel: (d) => { facing = (facing + d + 8) % 8; panel?.repaint(); },
        draw: (g, w, h) => {
          paintGlass(g, w, h);
          // ONE SCALE, BOTH AXES, and the remainder left as reflected room —
          // *"give me true proportions in the mirror i feel stretched"*. The
          // figure is 40 x 152 of square units and lands at whatever size fits
          // BOTH ways; there is no second number that could stretch it.
          paintFigure(g, Math.round((w - MW * FIG_S) / 2),
            Math.round((h - MH * FIG_S) / 2), FIG_S, facing);
        },
        surface: {
          mesh: o.mesh,
          standoff: o.standoff,
          fov: o.fov,
          // STANDING HEIGHT, LOOKING DOWN — this is what puts the boards at the
          // foot of the glass in frame, and the suitcase with them.
          eyeY: o.eyeY,
          // ── EVERY POINTER EVENT, ANSWERED IN THE WORLD ──────────────────
          pointer: (e, phase) => {
            const ray = focusRay(e.clientX, e.clientY);
            if (!ray) return false;
            const gp = glassPlane();
            const onGlass = (() => {
              if (!gp) return false;
              const p = hitPlane(ray.origin, ray.dir, gp.c, gp.n);
              if (!p) return false;
              const d = p.clone().sub(gp.c);
              return Math.abs(d.x) <= o.glassW / 2 && Math.abs(d.y) <= o.glassH / 2;
            })();
            /** the part of himself under the pointer, if he is on the glass */
            const bodyAt = () => {
              const p = gp && hitPlane(ray.origin, ray.dir, gp.c, gp.n);
              return p && onGlass ? bodySlotAt(p, gp!.c) : null;
            };
            // IS HE POINTING AT THE THING IN HIS HAND? A distance from the ray
            // to its centre, not a rect on its plane — it is a billboard 0.26 m
            // across and the honest test for "am I on it" is a sphere. 0.17 m
            // is a shade wider than the garment, deliberately: this is the
            // grab, and a grab that needs precision is the fiddliness the
            // suitcase was killed for.
            const rest = restAt();
            const onHand = (() => {
              if (!rest || held) return false;
              const to = rest.p.clone().sub(ray.origin);
              const along = Math.max(0, to.dot(ray.dir));
              return ray.origin.clone().addScaledVector(ray.dir, along)
                .distanceTo(rest.p) < 0.17;
            })();
            const carryTo = () => showCarry(
              ray.origin.clone().addScaledVector(ray.dir, CARRY_D),
              ray.origin, options(held!.slot)[held!.index]);

            if (phase === 'down') {
              // OUT OF HIS OWN HAND — unambiguous, so it is being dragged at
              // once. There is nowhere it came from and nowhere for it to go
              // back to; letting go anywhere but the glass simply puts it back
              // in his hand.
              if (onHand) { held = { slot: cat, index: pick }; carryTo(); return true; }
              // ON HIMSELF — pending. A click changes what is in his hand, a
              // drag takes the garment off, and the difference is GRAB_PX.
              const sl = bodyAt();
              if (sl) pending = { slot: sl, index: wornIndex(sl), x: e.clientX, y: e.clientY };
              return !!sl;
            }

            if (phase === 'move') {
              if (held) { carryTo(); return true; }
              if (pending) {
                const far = Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > GRAB_PX;
                if (far && pending.index > 0) {
                  held = { slot: pending.slot, index: pending.index };
                  // IT COMES OFF THE MOMENT THE DRAG STARTS, which is what
                  // pulling a jumper over your head looks like: he is holding
                  // it and he can see himself without it.
                  cat = pending.slot; pick = pending.index;
                  wear(pending.slot, 0);
                  pending = null;
                  carryTo();
                  return true;
                }
                if (far) pending = null;      // nothing there to pull off
              }
              return onHand || onGlass;
            }

            // phase === 'up'
            const h = held, pend = pending;
            held = null; pending = null;
            // ── A PRESS THAT NEVER MOVED IS A HAND ON YOURSELF ─────────────
            //
            // Touch your own chest and your shirts are in your hand; touch it
            // again and you are holding the next one. Touch your feet and it is
            // shoes. **The mirror is the whole control** — there is nothing to
            // draw for it, because you are already looking at the thing you
            // point at, and that is what lets this arrangement have no
            // furniture in it at all.
            if (!h && pend) {
              pick = pend.slot === cat ? nextPick(pick) : (cat = pend.slot, nextPick(0));
              restCarry();
              return false;
            }
            if (!h) { restCarry(); return false; }
            // ON THE GLASS he wears it, and his hand moves on to the next thing
            // in that category so he can keep trying them. ANYWHERE ELSE — the
            // wall, the bed, the boards, off the window entirely — it is simply
            // back in his hand. Two answers, and the one that means "put it on"
            // is a target the size of a full-length mirror.
            if (onGlass) { wear(h.slot, h.index); cat = h.slot; pick = nextPick(h.index); }
            else { cat = h.slot; pick = h.index; }
            restCarry();
            return false;
          },
        },
        // NOTHING SURVIVES A CLOSE EXCEPT THE CLOTHES. Escape mid-drag drops
        // what is in his hand and parks the quad — no garment stuck to the
        // cursor, no half-state. The framework owns the rest of the exit:
        // Escape and `[E]` from every screen, the gate, the pointer lock, and
        // standing up.
        // FRONT-ON, A SHIRT IN HIS HAND, EVERY TIME HE WALKS UP. A mirror left
        // facing away with a sandal held out is a state with no visible cause
        // — the same reasoning that resets the wall calendar's page on open.
        onOpen: () => {
          held = null; pending = null; facing = 0;
          cat = 'top'; pick = nextPick(0);
          restCarry();
        },
        onClose: () => { held = null; pending = null; dropCarry(); },
      });
      // the glass and his hand both follow the wardrobe, so anything that
      // dresses him later — a shop, a laundrette — moves both without knowing
      // this view exists
      onWardrobeChange(() => {
        if (!panel?.isOpen()) return;
        panel.repaint();
        if (!held) restCarry();
      });
    }
    panel.open();
  };
  return open;
}
