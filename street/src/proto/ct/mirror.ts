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

// ── THE ITEMS ──────────────────────────────────────────────────────────────
//
// *"each option is a literal item."* One garment, painted in a 24-unit square,
// in ITS OWN `cloth` and `trim` and in the silhouette the figure wears it in —
// a tee is a torso with sleeves whether it is on a hanger or on him. That is
// what makes a drag read as moving one object rather than choosing an option.
const IW = 24;

/** Paint garment `gm` into a `size`-square cell at (x0, y0). */
function paintItem(g: CanvasRenderingContext2D, x0: number, y0: number, size: number,
                   gm: Garment): void {
  const box = scaler(g, x0, y0, size / IW);
  switch (gm.kind) {
    case 'tee': case 'sweater': case 'jacket': case 'vest': {
      const sl = gm.sleeve === 2 ? 12 : 5;
      box(7, 5, 10, 14, gm.cloth);                       // the body
      box(3, 5, 4, sl, gm.cloth);                        // the sleeves
      box(17, 5, 4, sl, gm.cloth);
      box(3, 5 + sl - 2, 4, 2, gm.trim);                 // their cuffs
      box(17, 5 + sl - 2, 4, 2, gm.trim);
      box(9, 4, 6, 2, gm.trim);                          // the collar
      if (gm.kind === 'jacket') box(11, 6, 2, 13, 'rgba(0,0,0,0.22)');
      if (gm.kind === 'sweater') box(7, 17, 10, 2, gm.trim);
      break;
    }
    case 'dress': {
      box(9, 4, 6, 5, gm.cloth);
      for (let b = 0; b < 3; b++) box(8 - b * 2, 9 + b * 4, 8 + b * 4, 4, gm.cloth);
      box(2, 19, 20, 2, gm.trim);
      break;
    }
    case 'trousers': {
      const len = (gm.leg ?? 3) >= 3 ? 14 : 7;
      box(7, 4, 10, 3, gm.trim);                         // the waistband
      box(7, 7, 4, len, gm.cloth);                       // two legs
      box(13, 7, 4, len, gm.cloth);
      if (gm.id === 'track') { box(7, 7, 1, len, gm.trim); box(16, 7, 1, len, gm.trim); }
      break;
    }
    case 'skirt': {
      box(8, 5, 8, 3, gm.trim);
      for (let b = 0; b < 3; b++) box(8 - b * 2, 8 + b * 3, 8 + b * 4, 3, gm.cloth);
      break;
    }
    case 'sneaker': case 'boot': {
      const up = gm.kind === 'boot' ? 9 : 5;
      box(5, 17 - up, 11, up, gm.cloth);                 // the upper, side on
      box(4, 17, 16, 3, gm.cloth);                       // the foot
      box(4, 19, 16, 2, gm.trim);                        // the sole
      break;
    }
    case 'sandal': {
      box(4, 17, 16, 2, gm.cloth);
      box(4, 19, 16, 2, gm.trim);
      box(7, 13, 3, 4, gm.cloth);                        // two straps
      box(13, 13, 3, 4, gm.cloth);
      break;
    }
    case 'cap': {
      box(6, 8, 12, 6, gm.cloth);                        // the crown
      box(4, 14, 16, 2, gm.trim);                        // the peak
      box(11, 7, 2, 2, gm.trim);                         // the button
      break;
    }
    case 'sun': {
      box(7, 6, 10, 6, gm.cloth);
      box(2, 12, 20, 3, gm.cloth);                       // the brim
      box(7, 10, 10, 2, gm.trim);                        // the band
      break;
    }
    case 'clear': case 'shades': {
      box(3, 10, 7, 5, gm.cloth);                        // two lenses
      box(14, 10, 7, 5, gm.cloth);
      box(3, 9, 7, 1, gm.trim); box(14, 9, 7, 1, gm.trim);
      box(3, 15, 7, 1, gm.trim); box(14, 15, 7, 1, gm.trim);
      box(10, 11, 4, 1, gm.trim);                        // the bridge
      break;
    }
    case 'digital': case 'analog': {
      box(10, 3, 4, 18, gm.cloth);                       // the strap
      box(7, 9, 10, 7, gm.trim);                         // the case
      box(9, 11, 6, 3, gm.kind === 'digital' ? '#9cab8b' : '#e6e0cc');
      break;
    }
    default:
      // A GARMENT WHOSE KIND NOBODY DREW STILL HAS TO BE PICKABLE. A blank
      // cell is a bug you can see; a crash is one that eats the panel.
      box(5, 5, 14, 14, gm.cloth);
      box(5, 17, 14, 2, gm.trim);
  }
}

// ══ THE SUITCASE ═══════════════════════════════════════════════════════════
//
// One base lying open on the boards and one lid propped back against the wall
// under the mirror. Two boxes and a painted plane — this world's whole
// vocabulary — and the garments are PAINTED INTO THE LINING the same way the
// gig flyer is painted on the wall and the month is painted on the calendar.
// A separate mesh per garment would be eighteen objects and eighteen draw
// calls to say what one canvas says.

/** how wide the case is. Bounded by the bed's collider at x −1.15 against a
 *  mirror centred on −0.72: 0.86 is exactly the clear plaster there. */
const CASE_W = 0.86;
/** the base: shallow, and SHALLOW IN DEPTH ON PURPOSE. The north wall holds
 *  the player 0.3456 m off it, so a case 0.30 deep sits entirely inside the
 *  strip he can never walk into and needs no collider — the same argument the
 *  mirror's own note makes for hanging without one. */
const CASE_D = 0.30, CASE_H = 0.10;
/** the lid, and the angle it leans back at. 0.36 x 42° puts its top edge
 *  RY+0.368 and 0.06 m off the plaster — under the mirror frame's bottom
 *  (RY+0.40) and clear of its 0.05 m of proudness, so the two never meet. */
const LID_H = 0.36, LID_TILT = 42 * Math.PI / 180;
/** the lining's canvas, at 300 px/m — dense enough to draw a garment on. */
const LID_PPM = 300;
/** the grid the clothes are packed in. 6 x 3 holds all 18, which is every
 *  garment in the wardrobe that is not the underwear. */
const GRID_C = 6, GRID_R = 3;

/** the ray/plane solve, the only geometry this file does */
function hitPlane(origin: THREE.Vector3, dir: THREE.Vector3,
                  po: THREE.Vector3, pn: THREE.Vector3): THREE.Vector3 | null {
  const denom = dir.dot(pn);
  if (Math.abs(denom) < 1e-6) return null;
  const t = po.clone().sub(origin).dot(pn) / denom;
  return t > 0 ? origin.clone().addScaledVector(dir, t) : null;
}

/** every garment in the case, in packing order: the empty states are not
 *  things, so they are not in here. Cell `i` is `FLAT[i]`. */
function flatRack(): { slot: Slot; index: number; g: Garment }[] {
  const out: { slot: Slot; index: number; g: Garment }[] = [];
  for (const slot of SLOTS) {
    options(slot).forEach((g, i) => { if (i > 0) out.push({ slot, index: i, g }); });
  }
  return out;
}

export interface WardrobeCase {
  /** the lid's plane, for the ray to meet */
  lidO: THREE.Vector3; lidN: THREE.Vector3; lidR: THREE.Vector3; lidU: THREE.Vector3;
  /** which garment is at this point on the lid's plane, if any */
  cellAt: (p: THREE.Vector3) => { slot: Slot; index: number } | null;
  /** redraw the lining — a pocket is empty when its garment is being worn */
  repaint: () => void;
}

/**
 * Build the case. `x` is the column it stands in, `floorY` the boards, `wallZ`
 * the plaster's room face; it packs itself against all three.
 */
export function buildCase(scene: THREE.Scene, o: {
  x: number; floorY: number; wallZ: number;
  /** the module's own `texM` — DoubleSide basic material off a texture */
  texM: (t: THREE.Texture) => THREE.Material;
}): WardrobeCase {
  const leather = new THREE.MeshBasicMaterial({ color: 0x4a3325 });
  const leatherLo = new THREE.MeshBasicMaterial({ color: 0x3a2718 });
  const zb = o.wallZ - CASE_D / 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(CASE_W, CASE_H, CASE_D), leather);
  base.position.set(o.x, o.floorY + CASE_H / 2, zb);
  scene.add(base);
  // the two catches on the front lip, because a case without them is a box
  for (const dx of [-0.22, 0.22]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.02), leatherLo);
    c.position.set(o.x + dx, o.floorY + CASE_H - 0.02, zb - CASE_D / 2 - 0.008);
    scene.add(c);
  }

  // ── THE LID ────────────────────────────────────────────────────────────
  // Hinged at the base's ROOM-side lip and fallen back against the plaster, so
  // its lining faces up and out — toward an eye that is standing and looking
  // down. Built with `lookAt` rather than Euler angles: three rotations in an
  // unstated order is how a face ends up pointing into a wall.
  const lidN = new THREE.Vector3(0, Math.sin(LID_TILT), -Math.cos(LID_TILT)).normalize();
  // ⚠ THE LID'S OWN +x IS WORLD −x, AND THE HIT-TEST HAS TO AGREE WITH IT.
  // `Object3D.lookAt` builds the basis as x = up × z, so with the face looking
  // into the room (−z) the mesh's local +x — which is the direction the
  // texture's `u` runs — points at world −x. A hit-test written off world +x
  // would be a perfect mirror image of the picture: every garment pickable
  // where a different one is drawn, and only the middle column right.
  const lidR = new THREE.Vector3(-1, 0, 0);
  const lidU = new THREE.Vector3().crossVectors(lidN, lidR).normalize();
  const hinge = new THREE.Vector3(o.x, o.floorY + CASE_H, o.wallZ - CASE_D);
  const lidO = hinge.clone().addScaledVector(lidU, LID_H / 2);

  const LW = Math.round(CASE_W * LID_PPM), LH = Math.round(LID_H * LID_PPM);
  const cell = { w: LW / GRID_C, h: LH / GRID_R };
  const FLAT = flatRack();
  const lidCv = document.createElement('canvas');
  lidCv.width = LW; lidCv.height = LH;
  const lidT = new THREE.CanvasTexture(lidCv);
  lidT.magFilter = THREE.NearestFilter; lidT.minFilter = THREE.NearestFilter;

  const repaint = () => {
    const g = lidCv.getContext('2d');
    if (!g) return;
    // THE LINING: striped ticking, which is what the inside of every case made
    // before 1980 looks like, and the one place a bit of colour belongs in a
    // room this drab.
    g.fillStyle = '#7d6a52'; g.fillRect(0, 0, LW, LH);
    g.fillStyle = '#8d7a60';
    for (let x = 0; x < LW; x += 14) g.fillRect(x, 0, 7, LH);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, LW, 6);      // the fold at the hinge
    g.fillStyle = '#5d4a34';                                         // the lid's own border
    g.fillRect(0, 0, LW, 4); g.fillRect(0, LH - 4, LW, 4);
    g.fillRect(0, 0, 4, LH); g.fillRect(LW - 4, 0, 4, LH);
    FLAT.forEach((it, i) => {
      const cx = (i % GRID_C) * cell.w, cy = Math.floor(i / GRID_C) * cell.h;
      const size = Math.min(cell.w, cell.h) - 8;
      const px = Math.round(cx + (cell.w - size) / 2), py = Math.round(cy + (cell.h - size) / 2);
      if (wornIndex(it.slot) === it.index) {
        // WORN — so the pocket it came out of is empty, and stays where it
        // was. A garment is in exactly one place at a time and you can see
        // both of them: the gap in the case and the thing on you.
        g.fillStyle = 'rgba(0,0,0,0.26)';
        g.fillRect(px, py, size, size);
        return;
      }
      paintItem(g, px, py, size, it.g);
    });
    dither(g, LW, LH, Math.round((LW * LH) / 900));
    lidT.needsUpdate = true;
  };
  repaint();

  const lid = new THREE.Mesh(new THREE.PlaneGeometry(CASE_W, LID_H), o.texM(lidT));
  lid.position.copy(lidO);
  lid.lookAt(lidO.clone().add(lidN));
  lid.name = 'wardrobe-case-lid';
  scene.add(lid);

  /** the point on the lid, in the lid's own metres, then in cells */
  const cellAt = (p: THREE.Vector3) => {
    const d = p.clone().sub(lidO);
    const u = d.dot(lidR) + CASE_W / 2;          // 0…CASE_W, left to right
    const v = LID_H / 2 - d.dot(lidU);           // 0…LID_H, top down
    if (u < 0 || v < 0 || u > CASE_W || v > LID_H) return null;
    const c = Math.min(GRID_C - 1, Math.floor((u / CASE_W) * GRID_C));
    const r = Math.min(GRID_R - 1, Math.floor((v / LID_H) * GRID_R));
    const it = FLAT[r * GRID_C + c];
    return it ? { slot: it.slot, index: it.index } : null;
  };

  return { lidO, lidN, lidR, lidU, cellAt, repaint };
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
  wardrobe: WardrobeCase;
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
  /** the quad it is carried on, built once and parked when empty */
  let carry: THREE.Mesh | null = null;
  let carryCv: HTMLCanvasElement | null = null;
  let carryT: THREE.CanvasTexture | null = null;

  const CARRY_M = 0.13;     // how big a carried garment is, in metres
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
      carryCv.width = 48; carryCv.height = 48;
      carryT = new THREE.CanvasTexture(carryCv);
      carryT.magFilter = THREE.NearestFilter; carryT.minFilter = THREE.NearestFilter;
      carry = new THREE.Mesh(new THREE.PlaneGeometry(CARRY_M, CARRY_M),
        new THREE.MeshBasicMaterial({ map: carryT, transparent: true, side: THREE.DoubleSide }));
      carry.renderOrder = 5;
      (o.mesh()?.parent ?? null)?.add(carry);
    }
    const g = carryCv!.getContext('2d');
    if (g) {
      g.clearRect(0, 0, 48, 48);
      paintItem(g, 0, 0, 48, gm);
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
        hint: () => 'drag a garment onto the glass',
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
            const onLid = hitPlane(ray.origin, ray.dir, w.lidO, w.lidN);
            const cell = onLid ? w.cellAt(onLid) : null;

            if (phase === 'down') {
              // OUT OF THE CASE. A pocket whose garment is already on him is
              // empty and holds nothing to pick up.
              if (cell && wornIndex(cell.slot) !== cell.index) {
                held = { ...cell };
              } else if (onGlass) {
                // OFF HIMSELF. The whole glass is the grab, not the four
                // texels the garment occupies — but WHICH garment needs the
                // part of him he grabbed, so that is read off the figure's own
                // zones, and the dress rule lives in `bodySlotAt`.
                const gp2 = gp && hitPlane(ray.origin, ray.dir, gp.c, gp.n);
                const s = gp2 ? bodySlotAt(gp2, gp!.c) : null;
                if (s && wornIndex(s) > 0) {
                  held = { slot: s, index: wornIndex(s) };
                  // IT COMES OFF THE MOMENT HE GRABS IT, which is what pulling
                  // a jumper over your head looks like: he is holding it and he
                  // can see himself without it.
                  wear(s, 0);
                }
              }
              if (held) {
                showCarry(ray.origin.clone().addScaledVector(ray.dir, CARRY_D),
                  ray.origin, options(held.slot)[held.index]);
                return true;
              }
              return false;
            }

            if (phase === 'move') {
              if (held) {
                showCarry(ray.origin.clone().addScaledVector(ray.dir, CARRY_D),
                  ray.origin, options(held.slot)[held.index]);
                return true;
              }
              // the pointing hand over anything he could pick up
              return (!!cell && wornIndex(cell.slot) !== cell.index) || onGlass;
            }

            // phase === 'up'
            const h = held;
            held = null;
            dropCarry();
            if (!h) return false;
            // ON THE GLASS he wears it. ANYWHERE ELSE — the lid, the boards,
            // the wall, off the window entirely — it goes back in the case.
            // Two answers, and the one that means "put it on" is a target the
            // size of a full-length mirror.
            if (onGlass) wear(h.slot, h.index);
            return false;
          },
        },
        // NOTHING SURVIVES A CLOSE EXCEPT THE CLOTHES. Escape mid-drag drops
        // what is in his hand and parks the quad — no garment stuck to the
        // cursor, no half-state. The framework owns the rest of the exit:
        // Escape and `[E]` from every screen, the gate, the pointer lock, and
        // standing up.
        onOpen: () => { held = null; dropCarry(); },
        onClose: () => { held = null; dropCarry(); },
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
