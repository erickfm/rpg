import * as THREE from 'three';
import { dither } from './paint';
import { makePanel, focusRay, type Panel } from './hud';
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

/** a rect painter in design units, rounded to whole pixels at any scale */
function scaler(g: CanvasRenderingContext2D, ox: number, oy: number, s: number) {
  return (x: number, y: number, w: number, h: number, fill: string) => {
    const x0 = Math.round(x * s), y0 = Math.round(y * s);
    g.fillStyle = fill;
    g.fillRect(ox + x0, oy + y0,
      Math.max(1, Math.round((x + w) * s) - x0), Math.max(1, Math.round((y + h) * s) - y0));
  };
}

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
export function paintFigure(g: CanvasRenderingContext2D, ox: number, oy: number, s: number): void {
  const box = scaler(g, ox, oy, s);
  const top = worn('top');
  const bottom = showing('bottom');
  const shoes = worn('shoes');
  const hat = worn('hat');
  const specs = worn('glasses');
  const watch = worn('watch');

  // SKIN FIRST, ALL OF IT, so an empty slot needs no special case anywhere —
  // it leaves what is underneath showing, and what is underneath is you.
  box(CX - HEAD_HW, HEAD_T, HEAD_HW * 2, HEAD_B - HEAD_T, SKIN);          // head
  box(CX - 3, HEAD_B - 1, 6, NECK_B - HEAD_B + 1, SKIN_LO);               // neck
  box(CX - TORSO_HW + 1, SHOULDER, (TORSO_HW - 1) * 2, WAIST - SHOULDER, SKIN);
  for (const sgn of [-1, 1]) {                                            // arms and hands
    box(sgn < 0 ? CX - TORSO_HW - ARM_W + 1 : CX + TORSO_HW - 1, ARM_T, ARM_W, HAND_B - ARM_T, SKIN);
  }
  box(CX - TORSO_HW + 1, WAIST, (TORSO_HW - 1) * 2, HIP_B - WAIST, SKIN); // hips
  for (const sgn of [-1, 1]) {                                            // legs
    box(sgn < 0 ? CX - LEG_GAP - LEG_HW * 2 : CX + LEG_GAP, HIP_B, LEG_HW * 2, LEG_B - HIP_B, SKIN);
  }
  // hair as one shape — this world draws a haircut as a silhouette and not as
  // strands, the way `ct/citizens.ts` paints five views of one
  box(CX - HEAD_HW, HEAD_T - 2, HEAD_HW * 2, 7, '#3a2c22');
  box(CX - HEAD_HW - 1, HEAD_T + 1, 1, 8, '#3a2c22');
  box(CX + HEAD_HW, HEAD_T + 1, 1, 8, '#3a2c22');
  box(CX - 4, EYE_Y, 2, 2, '#2a2016');                                    // the face, all of it
  box(CX + 2, EYE_Y, 2, 2, '#2a2016');
  box(CX - 2, EYE_Y + 6, 4, 1, '#8a5c46');

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
      box(lx, HIP_B, LEG_HW * 2, hem - HIP_B, bottom.cloth);
      if (bottom.id === 'track') box(sgn < 0 ? lx : lx + LEG_HW * 2 - 1, HIP_B, 1, hem - HIP_B, bottom.trim);
      box(lx, hem - 2, LEG_HW * 2, 2, bottom.trim);
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
      box(ax, ARM_T - 2, ARM_W, sleeveB - ARM_T + 2, top.cloth);
      box(ax, sleeveB - 2, ARM_W, 2, top.trim);                              // the cuff
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
    box(ax - 1, WRIST_T + 2, ARM_W + 2, 8, watch.cloth);
    box(ax - 1, WRIST_T + 4, ARM_W + 2, 4, watch.trim);
    box(ax, WRIST_T + 5, ARM_W, 2, watch.kind === 'digital' ? '#9cab8b' : '#e6e0cc');
  }

  // shoes
  for (const sgn of [-1, 1]) {
    const lx = sgn < 0 ? CX - LEG_GAP - LEG_HW * 2 : CX + LEG_GAP;
    if (shoes.kind === 'sneaker') {
      box(lx - 1, LEG_B - 4, LEG_HW * 2 + 2, FOOT_B - LEG_B + 4, shoes.cloth);
      box(lx - 1, FOOT_B - 2, LEG_HW * 2 + 2, 2, shoes.trim);
      box(lx - 1, LEG_B - 1, LEG_HW * 2 + 2, 1, shoes.trim);
    } else if (shoes.kind === 'sandal') {
      box(lx - 1, FOOT_B - 3, LEG_HW * 2 + 2, 3, shoes.cloth);
      box(lx, LEG_B, LEG_HW * 2, 1, shoes.trim);
      box(lx, LEG_B + 3, LEG_HW * 2, 1, shoes.trim);
    } else if (shoes.kind === 'boot') {
      box(lx - 1, LEG_B - 12, LEG_HW * 2 + 2, FOOT_B - LEG_B + 12, shoes.cloth);
      box(lx - 1, FOOT_B - 2, LEG_HW * 2 + 2, 2, shoes.trim);
    } else {
      box(lx - 1, LEG_B, LEG_HW * 2 + 2, FOOT_B - LEG_B, SKIN_HI);            // bare
    }
  }

  // the hat
  if (hat.kind === 'cap') {
    box(CX - HEAD_HW - 1, HEAD_T - 4, HEAD_HW * 2 + 2, 7, hat.cloth);
    box(CX - HEAD_HW - 3, HEAD_T + 2, HEAD_HW * 2 + 6, 2, hat.trim);          // the peak, head-on
    box(CX - 1, HEAD_T - 5, 2, 2, hat.trim);                                  // the button
  } else if (hat.kind === 'sun') {
    box(CX - HEAD_HW, HEAD_T - 6, HEAD_HW * 2, 8, hat.cloth);                 // crown
    box(CX - 13, HEAD_T + 1, 26, 3, hat.cloth);                               // brim
    box(CX - 13, HEAD_T + 3, 26, 1, 'rgba(0,0,0,0.20)');
    box(CX - HEAD_HW, HEAD_T - 1, HEAD_HW * 2, 2, hat.trim);                  // the band
  }

  // glasses
  if (specs.kind !== 'none') {
    for (const sgn of [-1, 1]) {
      const gx = sgn < 0 ? CX - 6 : CX + 1;
      box(gx, EYE_Y - 1, 5, 4, specs.cloth);
      box(gx, EYE_Y - 2, 5, 1, specs.trim);
      box(gx, EYE_Y + 3, 5, 1, specs.trim);
      box(sgn < 0 ? gx - 1 : gx + 5, EYE_Y - 1, 1, 4, specs.trim);
    }
    box(CX - 1, EYE_Y, 2, 1, specs.trim);                                     // the bridge
    box(CX - HEAD_HW - 1, EYE_Y, 2, 1, specs.trim);                           // the arms
    box(CX + HEAD_HW - 1, EYE_Y, 2, 1, specs.trim);
  }
}

// ══ THE RAIL ═══════════════════════════════════════════════════════════════
//
// *"the suitcase looks awful and all the little items dont make sense. try
//  again or come up with something better"*   (2026-08-04)
//
// **THE SECOND HALF IS THE DIAGNOSIS AND IT IS ABOUT SIZE.** The case held all
// eighteen garments at once, in a 6 x 3 grid on a lid 0.86 x 0.36 m. Measured
// against the locked view's own frame — 3.38 m wide at the wall — one cell was
// **4.2% of the picture**. A shirt drawn four percent of the way across the
// screen is a smudge with a collar-coloured pixel in it, and no amount of
// redrawing fixes that: the container was asking the medium for detail it does
// not have. It is the lesson the arm taught twice today — fewer, bigger,
// clearer shapes, never more detail.
//
// ── SO: ONE CATEGORY AT A TIME, ON A RAIL, AT SEVEN TIMES THE SIZE ────────
//
// Six categories at once is what forced everything to be tiny. Showing ONE
// leaves at most five garments to place, and five is a number this frame can
// draw properly: a hanging garment is **0.26 x 0.55 m — 8% of the frame's width
// and 29% of its height**, seven times the area a suitcase cell had.
//
// AND HANGING IS THE RIGHT POSE FOR THIS WORLD'S ART. A garment on a hook is
// tall, symmetrical and read entirely from its silhouette, which is exactly
// what flat-shaded painted planes are good at — it is how `ct/citizens.ts`
// draws a person and how the whole street draws everything else. A garment
// lying folded in a case is a rectangle seen at a grazing angle, which is the
// one shape this medium cannot say anything with.
//
// WHERE IT HANGS is the wall left of the mirror, above the bed's head: a
// batten of hooks in the one band of that wall which is in frame and empty —
// y RY+0.71…RY+1.30, between the mattress (RY+0.45) and the flyer (RY+1.31).
// Nothing had to move. A row of hooks over the bed is also just what a rented
// room with no wardrobe has in it.

/** the ray/plane solve, the only geometry this module does */
function hitPlane(origin: THREE.Vector3, dir: THREE.Vector3,
                  po: THREE.Vector3, pn: THREE.Vector3): THREE.Vector3 | null {
  const denom = dir.dot(pn);
  if (Math.abs(denom) < 1e-6) return null;
  const t = po.clone().sub(origin).dot(pn) / denom;
  return t > 0 ? origin.clone().addScaledVector(dir, t) : null;
}

/** how many hooks the batten carries. The biggest category is tops, at 5. */
const HOOKS = 5;
const HOOK_W = 0.26, HANG_H = 0.55;
/** texels on a hanging garment: 32 x 64 over 0.26 x 0.55 m, near enough square */
const HANG_TW = 32, HANG_TH = 64;

/**
 * WHAT HANGS AND WHAT SITS — and it is the whole of this pass.
 *
 * *"not bad but im not sure i like how things are hung?"*   (2026-08-04)
 *
 * **THREE OF THE SIX CATEGORIES DO NOT HANG FROM A PEG.** Shirts and trousers
 * do, and those read fine. A pair of sneakers dangling by its laces, a wristwatch
 * swinging from a hook and a pair of sunglasses hooked by one arm do NOT — they
 * are things that get PUT DOWN, and drawing them suspended is the sort of wrong
 * a person sees instantly and cannot name. Presenting all six the same way let
 * the three that do not suit it drag the whole row down.
 *
 * So the batten grew a shelf and the categories split by what you actually do
 * with them. Same wall, same hooks, same one-category-at-a-time rule, different
 * verb:
 *
 *     HANG   tops, bottoms — on a hanger, from the peg, hems where they fall
 *     SIT    shoes (a pair, side by side), hats, glasses, the watch — on the
 *            shelf, standing on their own feet
 *
 * ONE QUAD SIZE EITHER WAY, which is what makes this cheap: the plane spans the
 * hook down to the shelf, and the painter decides whether the garment starts at
 * the top of that canvas and falls, or stands on the bottom of it. The shelf
 * board is at the quads' bottom edge, so anything drawn touching the last row is
 * standing on real timber. No geometry changes, no second mesh, no re-layout.
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
  const B = HANG_TH;               // the last row: the shelf's top face
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

export interface WardrobeRail {
  /** the plane the garments hang on */
  railO: THREE.Vector3; railN: THREE.Vector3;
  /** which garment is at this point on that plane, if any */
  hookAt: (p: THREE.Vector3) => { slot: Slot; index: number } | null;
  /** hang a different category up */
  show: (slot: Slot) => void;
  /** redraw what is on the hooks — a worn garment leaves its hook empty */
  repaint: () => void;
}

/**
 * The batten and what is on it. `x` is its centre, `y` the hooks' line,
 * `wallZ` the plaster's room face.
 */
export function buildRail(scene: THREE.Scene, o: {
  x: number; y: number; wallZ: number;
  texM: (t: THREE.Texture) => THREE.Material;
}): WardrobeRail {
  const woodM = new THREE.MeshBasicMaterial({ color: 0x6b563c });
  const ironM = new THREE.MeshBasicMaterial({ color: 0x53535a });
  const RAIL_W = HOOKS * HOOK_W;
  const batten = new THREE.Mesh(new THREE.BoxGeometry(RAIL_W + 0.06, 0.05, 0.035), woodM);
  batten.position.set(o.x, o.y + 0.035, o.wallZ - 0.018);
  scene.add(batten);
  // ── AND THE SHELF UNDER IT ─────────────────────────────────────────────
  // Half the categories are things you PUT DOWN, not things you hang: shoes, a
  // hat, glasses, a watch. Its top face is exactly the bottom edge of the
  // garment planes, so an item drawn touching the last row of its canvas is
  // standing on real timber and needed no geometry of its own.
  const shelfY = o.y - HANG_H;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(RAIL_W + 0.06, 0.028, 0.10), woodM);
  shelf.position.set(o.x, shelfY - 0.014, o.wallZ - 0.05);
  scene.add(shelf);
  // two brackets, because a board on a wall with nothing holding it up is the
  // kind of thing this room would not have
  for (const dx of [-RAIL_W / 2 + 0.10, RAIL_W / 2 - 0.10]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.06), ironM);
    br.position.set(o.x + dx, shelfY - 0.05, o.wallZ - 0.032);
    scene.add(br);
  }
  const hookX = (i: number) => o.x - RAIL_W / 2 + HOOK_W * (i + 0.5);
  for (let i = 0; i < HOOKS; i++) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.04, 0.012), ironM);
    h.position.set(hookX(i), o.y - 0.01, o.wallZ - 0.032);
    scene.add(h);
  }

  // THE GARMENTS: one plane per hook, hanging 5 mm proud of the plaster, each
  // with its own canvas. Five meshes for the whole wardrobe — they are
  // REPAINTED when the category changes rather than built and thrown away.
  const railZ = o.wallZ - 0.005;
  const quads: { mesh: THREE.Mesh; cv: HTMLCanvasElement; tex: THREE.CanvasTexture }[] = [];
  for (let i = 0; i < HOOKS; i++) {
    const cv = document.createElement('canvas');
    cv.width = HANG_TW * 4; cv.height = HANG_TH * 4;
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const mat = o.texM(tex) as THREE.MeshBasicMaterial;
    mat.transparent = true; mat.alphaTest = 0.5;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(HOOK_W, HANG_H), mat);
    mesh.position.set(hookX(i), o.y - HANG_H / 2, railZ);
    mesh.rotation.y = Math.PI;      // this wall faces −z, like everything on it
    mesh.name = `wardrobe-hook-${i}`;
    scene.add(mesh);
    quads.push({ mesh, cv, tex });
  }

  let showing: Slot = 'top';
  /** what is on the hooks right now: everything in the category except the
   *  empty state, which is not a thing, and the one he has on. */
  let hung: { slot: Slot; index: number; g: Garment }[] = [];

  const repaint = () => {
    hung = options(showing)
      .map((g, index) => ({ slot: showing, index, g }))
      .filter((it) => it.index > 0 && wornIndex(showing) !== it.index);
    quads.forEach((q, i) => {
      const it = hung[i];
      q.mesh.visible = !!it;
      if (!it) return;
      const g = q.cv.getContext('2d');
      if (!g) return;
      paintHanging(g, q.cv.width, q.cv.height, it.g);
      q.tex.needsUpdate = true;
    });
  };
  repaint();

  const railO = new THREE.Vector3(o.x, o.y - HANG_H / 2, railZ);
  const railN = new THREE.Vector3(0, 0, -1);
  const hookAt = (p: THREE.Vector3) => {
    const dy = p.y - railO.y, dx = p.x - railO.x;
    if (Math.abs(dy) > HANG_H / 2 || Math.abs(dx) > RAIL_W / 2) return null;
    const i = Math.min(HOOKS - 1, Math.floor((dx + RAIL_W / 2) / HOOK_W));
    const it = hung[i];
    return it ? { slot: it.slot, index: it.index } : null;
  };

  return {
    railO, railN, hookAt, repaint,
    show: (slot) => { if (slot !== showing) { showing = slot; repaint(); } },
  };
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
  wardrobe: WardrobeRail;
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
    const z = zoneAt(MW / 2 - (p.x - c.x) / FIG_M, MH / 2 - (p.y - c.y) / FIG_M);
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
  /** the quad it is carried on, built once and parked when empty */
  let carry: THREE.Mesh | null = null;
  let carryCv: HTMLCanvasElement | null = null;
  let carryT: THREE.CanvasTexture | null = null;

  /** a carried garment is the same drawing at the same size it hangs at, so
   *  what he picked up and what he is holding are visibly one object */
  const CARRY_M = HOOK_W;
  const CARRY_D = 0.85;     // how far in front of the eye it hangs

  /** the glass's plane, in world space. Its normal is the mirror's own −z. */
  const glassPlane = () => {
    const m = o.mesh();
    if (!m) return null;
    m.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld).normalize();
    return { c, n };
  };

  const dropCarry = () => {
    if (carry) { carry.visible = false; }
  };

  const showCarry = (p: THREE.Vector3, eye: THREE.Vector3, gm: Garment) => {
    if (!carry) {
      carryCv = document.createElement('canvas');
      carryCv.width = HANG_TW * 4; carryCv.height = HANG_TH * 4;
      carryT = new THREE.CanvasTexture(carryCv);
      carryT.magFilter = THREE.NearestFilter; carryT.minFilter = THREE.NearestFilter;
      carry = new THREE.Mesh(new THREE.PlaneGeometry(CARRY_M, CARRY_M * HANG_TH / HANG_TW),
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
        hint: () => 'touch yourself to change what is on the rail',
        draw: (g, w, h) => {
          paintGlass(g, w, h);
          // ONE SCALE, BOTH AXES, and the remainder left as reflected room —
          // *"give me true proportions in the mirror i feel stretched"*. The
          // figure is 40 x 152 of square units and lands at whatever size fits
          // BOTH ways; there is no second number that could stretch it.
          paintFigure(g, Math.round((w - MW * FIG_S) / 2),
            Math.round((h - MH * FIG_S) / 2), FIG_S);
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
              // the glass's own rect, in its own axes. `right` is the mirror's
              // x because it hangs on a wall that faces −z.
              return Math.abs(d.x) <= o.glassW / 2 && Math.abs(d.y) <= o.glassH / 2;
            })();
            const w = o.wardrobe;
            const onRail = hitPlane(ray.origin, ray.dir, w.railO, w.railN);
            const hook = onRail ? w.hookAt(onRail) : null;
            /** the part of himself under the pointer, if he is on the glass */
            const bodyAt = () => {
              const p = gp && hitPlane(ray.origin, ray.dir, gp.c, gp.n);
              return p && onGlass ? bodySlotAt(p, gp!.c) : null;
            };
            const carryTo = () => showCarry(
              ray.origin.clone().addScaledVector(ray.dir, CARRY_D),
              ray.origin, options(held!.slot)[held!.index]);

            if (phase === 'down') {
              // OFF THE RAIL — unambiguous, so it is in his hand at once.
              if (hook) { held = { ...hook }; carryTo(); return true; }
              // ON HIMSELF — pending. See `pending`: a click changes the rail,
              // a drag takes the garment off, and the difference is GRAB_PX.
              const s = bodyAt();
              if (s) pending = { slot: s, index: wornIndex(s), x: e.clientX, y: e.clientY };
              return !!s;
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
                  wear(pending.slot, 0);
                  pending = null;
                  carryTo();
                  return true;
                }
                if (far) pending = null;      // nothing there to pull off
              }
              return !!hook || onGlass;
            }

            // phase === 'up'
            const h = held, pend = pending;
            held = null; pending = null;
            dropCarry();
            // A PRESS THAT NEVER MOVED IS A CHOICE OF CATEGORY. Touch your own
            // head and your hats are on the rail; touch your feet and your
            // shoes are. The mirror IS the category control — there is nothing
            // to draw for it, because you are already looking at the thing you
            // point at.
            if (!h && pend) { o.wardrobe.show(pend.slot); return false; }
            if (!h) return false;
            // ON THE GLASS he wears it. ANYWHERE ELSE — the rail, the bed, the
            // boards, off the window entirely — it goes back on its hook. Two
            // answers, and the one that means "put it on" is a target the size
            // of a full-length mirror.
            if (onGlass) wear(h.slot, h.index);
            else o.wardrobe.show(h.slot);
            return false;
          },
        },
        // NOTHING SURVIVES A CLOSE EXCEPT THE CLOTHES. Escape mid-drag drops
        // what is in his hand and parks the quad — no garment stuck to the
        // cursor, no half-state. The framework owns the rest of the exit:
        // Escape and `[E]` from every screen, the gate, the pointer lock, and
        // standing up.
        onOpen: () => { held = null; pending = null; dropCarry(); },
        onClose: () => { held = null; pending = null; dropCarry(); },
      });
      // the case's lining and the glass both follow the wardrobe, so anything
      // that dresses him later — a shop, a laundrette — moves both without
      // knowing either exists
      onWardrobeChange(() => { o.wardrobe.repaint(); if (panel?.isOpen()) panel.repaint(); });
    }
    panel.open();
  };
  return open;
}
