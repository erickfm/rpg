import { dither } from './paint';
import { makePanel, type Panel } from './hud';
import {
  SLOTS, SLOT_NAME, options, cycle, showing, worn, wornIndex, wear,
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
// *"for the mirror we need to be able to drag and drop items. each option is a
//  literal item. we can make the rest of the room kinda fade away so we cna
//  have a proper way to dress and style our character. right now it is click to
//  change and cycle through, but it should be a drag and drop sort of thing"*
//                                                              (2026-08-04)
//
// THREE CHANGES AND ONE OF THEM DECIDED THE SHAPE OF THE OTHER TWO.
//
// **IT IS NO LONGER PAINTED ON THE GLASS.** The first version was a diegetic
// panel: the eye eased onto the mirror and the panel's canvas was hung on the
// mirror's own mesh, which is the idiom the wall calendar established and which
// is still the right answer for a thing you READ. It cannot be the right answer
// for a thing you DRESS at. The glass is 0.52 m wide against 1.35 m tall, and
// no fov or stand-off changes what that costs: fitting its height to the frame
// leaves its width at about an eighth of the screen, because the strip is the
// mirror's own proportion. A rack of garments you pick up and carry does not
// fit in an eighth of a screen, and he asked for the room to fade away *"so we
// can have a proper way to dress"* — which is permission to take the screen.
//
// So it is a screen-space panel that DRAWS the mirror: his reflection in a
// timber frame on the left, everything he owns on the right, and the flat
// receded behind both. The framework's own vignette dims the world (`open()`
// raises it for any panel not painted on a mesh), and the canvas paints the
// room in the same cold palette as the glass, two shades down — so what he
// sees is the flat falling back, not a card laid over it.
//
// **EVERY OPTION IS A DRAWN GARMENT.** No labels, no swatches, no list. A cell
// holds a picture of the thing, painted from the same `cloth`/`trim` the figure
// wears it in and in the same silhouette, so the item in your hand and the item
// on your body are visibly one object.
//
// **AND THE RACK ONLY HOLDS WHAT YOU ARE NOT WEARING.** What you have on is on
// you; its cell stands empty, showing the bare hanger. That is what makes the
// drag literal — the garment is in exactly one place at a time and you move it
// between them.

/** the panel's canvas, and the CSS scale it is shown at (760 x 520 on screen) */
const PW = 380, PH = 260, PSCALE = 2;

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

// ── THE PANEL ──────────────────────────────────────────────────────────────
//
// LAYOUT, all derived from the two panel dimensions and each other. The mirror
// takes the left third because a person is tall and narrow; the rack takes the
// rest because six racks of garments are wide and shallow.
const FRAME = { x: 8, y: 6, w: 140, h: 248 };
/** the frame's own timber border. The glass is what is left inside it. */
const FB = 6;
const GLASSR = { x: FRAME.x + FB, y: FRAME.y + FB, w: FRAME.w - 2 * FB, h: FRAME.h - 2 * FB };
/**
 * ONE SCALE, BOTH AXES, AND THE REMAINDER LEFT AS GLASS.
 *
 * *"give me true proportions in the mirror i feel stretched"*. `Math.min` of
 * the two fits is the whole fix: the figure is 40 x 152 of square units and it
 * lands in the glass at whatever size fits BOTH ways, with the leftover width
 * showing the reflected room either side of him — which is what a mirror looks
 * like. Scaling the axes independently to fill the glass is the thing that
 * cannot happen here, because there is only one number.
 */
const FIG_S = Math.min(GLASSR.w / MW, GLASSR.h / MH);
const FIG_X = GLASSR.x + Math.round((GLASSR.w - MW * FIG_S) / 2);
const FIG_Y = GLASSR.y + Math.round((GLASSR.h - MH * FIG_S) / 2);

const RACK_X = 156, RACK_Y = 8;
const ROW_H = 40, CELL = 26, CELL_GAP = 4, LABEL_H = 8;

/** what is IN a slot's rack: everything but the empty state, which is not a
 *  thing you can hold. Index `i` here is wardrobe index `i + 1`. */
const rackOf = (slot: Slot) => options(slot).slice(1);

const cellRect = (row: number, i: number) => ({
  x: RACK_X + 2 + i * (CELL + CELL_GAP),
  y: RACK_Y + row * ROW_H + LABEL_H + 1,
  w: CELL, h: CELL,
});

const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** the rack cell under this panel pixel, or null */
function cellAt(x: number, y: number): { slot: Slot; index: number } | null {
  for (let row = 0; row < SLOTS.length; row++) {
    const slot = SLOTS[row];
    const items = rackOf(slot);
    for (let i = 0; i < items.length; i++) {
      if (inRect(x, y, cellRect(row, i))) return { slot, index: i + 1 };
    }
  }
  return null;
}

/**
 * The slot you have your hand on, on the figure — and the DRESS is the one
 * place this is not the zone's own slot. A dress fills the bottom slot, so a
 * hand on the legs of someone in a dress is a hand on the dress, which lives
 * in `top`. Resolved here so no caller repeats the rule.
 */
function bodySlotAt(x: number, y: number): Slot | null {
  const z = zoneAt((x - FIG_X) / FIG_S, (y - FIG_Y) / FIG_S);
  if (!z) return null;
  return z === 'bottom' && worn('top').full ? 'top' : z;
}

export function mirrorPanel(): () => void {
  let panel: Panel | null = null;
  /** the garment in his hand, and where it came off */
  let held: { slot: Slot; index: number; from: 'rack' | 'body' } | null = null;
  let ptr: { x: number; y: number } | null = null;
  /** the row the keyboard is on, so the panel is usable without a pointer */
  let keySlot: Slot | null = null;
  const repaint = () => panel?.repaint();

  const paint = (g: CanvasRenderingContext2D, W: number, H: number) => {
    // ── THE FLAT, RECEDED ────────────────────────────────────────────────
    // *"we can make the rest of the room kinda fade away."* Two halves, and
    // the framework owns the first: `open()` raises its vignette over the live
    // world for any panel not painted on a mesh, so the actual room behind
    // this canvas is already dimmed by 42-72%. What is drawn HERE is the same
    // room again, in the mirror's own cold palette taken several shades down,
    // so the panel reads as 301 falling back rather than as a card laid on top
    // of it — the boards still run away from you and the wall still meets them
    // at a skirting line, they have simply lost their light.
    g.fillStyle = '#2f3439'; g.fillRect(0, 0, W, H);            // the wall, gone dark
    g.fillStyle = '#22262a'; g.fillRect(0, 0, W, 18);           // its ceiling
    g.fillStyle = '#241c14'; g.fillRect(0, 196, W, H - 196);    // its boards
    g.fillStyle = '#191309'; g.fillRect(0, 193, W, 3);          // the skirting
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (const y of [208, 224, 244]) g.fillRect(0, y, W, 1);

    // ── THE MIRROR ───────────────────────────────────────────────────────
    g.fillStyle = '#3f3125';                                     // the timber frame
    g.fillRect(FRAME.x, FRAME.y, FRAME.w, FRAME.h);
    g.fillStyle = '#2c2119';                                     // its inner shadow
    g.fillRect(GLASSR.x - 1, GLASSR.y - 1, GLASSR.w + 2, GLASSR.h + 2);
    // the glass: the same painted room the plate on the wall carries, at this
    // panel's density — `paintGlass` is the one drawing of it in the codebase
    g.save();
    g.beginPath(); g.rect(GLASSR.x, GLASSR.y, GLASSR.w, GLASSR.h); g.clip();
    g.translate(GLASSR.x, GLASSR.y);
    paintGlass(g, GLASSR.w, GLASSR.h);
    g.restore();
    paintFigure(g, FIG_X, FIG_Y, FIG_S);
    // WHAT A DROP WOULD DO, shown while he is carrying something: the glass
    // gets a warm edge. A drop target you cannot see is a drag you have to
    // guess at, and this is the only target there is.
    if (held) {
      g.fillStyle = 'rgba(240,232,214,0.55)';
      for (const [x, y, w, h] of [
        [GLASSR.x, GLASSR.y, GLASSR.w, 1], [GLASSR.x, GLASSR.y + GLASSR.h - 1, GLASSR.w, 1],
        [GLASSR.x, GLASSR.y, 1, GLASSR.h], [GLASSR.x + GLASSR.w - 1, GLASSR.y, 1, GLASSR.h],
      ]) g.fillRect(x, y, w, h);
    }

    // ── THE RACK ─────────────────────────────────────────────────────────
    g.textBaseline = 'alphabetic';
    for (let row = 0; row < SLOTS.length; row++) {
      const slot = SLOTS[row];
      const items = rackOf(slot);
      g.fillStyle = slot === keySlot ? INK : 'rgba(239,232,214,0.45)';
      g.font = 'bold 7px ui-monospace, Menlo, monospace'; g.textAlign = 'left';
      g.fillText(SLOT_NAME[slot], RACK_X + 2, RACK_Y + row * ROW_H + 7);
      // what is ON him is not in the rack — its cell stands empty. That is
      // what makes the drag literal: one garment, one place, and you can see
      // where it came from while you are carrying it.
      const out = wornIndex(slot);
      for (let i = 0; i < items.length; i++) {
        const r = cellRect(row, i);
        const gone = out === i + 1 || (held?.slot === slot && held.index === i + 1);
        g.fillStyle = gone ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.06)';
        g.fillRect(r.x, r.y, r.w, r.h);
        if (gone) {
          g.fillStyle = 'rgba(239,232,214,0.20)';                // the bare hanger
          g.fillRect(r.x + 6, r.y + 12, 14, 1);
          g.fillRect(r.x + 12, r.y + 7, 2, 5);
        } else {
          paintItem(g, r.x + 1, r.y + 1, CELL - 2, items[i]);
        }
      }
    }

    // ── AND WHAT IS IN HIS HAND ──────────────────────────────────────────
    // Drawn last, over everything, at the pointer. Nothing else in the panel
    // moves while a garment is carried — the rack keeps its layout and the
    // figure keeps its pose — so the only thing the eye tracks is the item.
    if (held && ptr) {
      const gm = options(held.slot)[held.index];
      paintItem(g, Math.round(ptr.x - CELL / 2), Math.round(ptr.y - CELL / 2), CELL, gm);
    }
  };

  const open = () => {
    if (!panel) {
      panel = makePanel({
        id: 'ct-mirror', w: PW, h: PH, scale: PSCALE, chrome: 'none',
        // `chrome:'none'` because this canvas draws its own room, its own
        // mirror and its own rack, edge to edge. The framework's moulded beige
        // case around a picture of a bedroom would be the *"menus popping up"*
        // this project's design law is named for.
        hint: () => (held
          ? 'drop it on the mirror to put it on'
          : 'drag a garment onto the mirror — drag one off to take it off'),
        draw: paint,
        key: (k) => {
          // THE KEYBOARD DOES EVERYTHING THE POINTER DOES. A dressing screen
          // that can only be worked by dragging is one a trackpad, a
          // touchscreen or a stuck mouse cannot finish — and Escape and `[E]`
          // belong to the framework, so nothing here can eat the way out.
          const i = keySlot ? SLOTS.indexOf(keySlot) : -1;
          if (k === 'arrowdown') keySlot = SLOTS[(i + 1 + SLOTS.length) % SLOTS.length];
          else if (k === 'arrowup') keySlot = SLOTS[(i - 1 + SLOTS.length) % SLOTS.length];
          else if (k === 'arrowright') { if (keySlot) cycle(keySlot, 1); }
          else if (k === 'arrowleft') { if (keySlot) cycle(keySlot, -1); }
          else return;
          repaint();
        },
        surface: {
          // NO `mesh`, deliberately — see the block at the top of this section.
          // The surface hooks are how a panel receives the pointer; declaring
          // one without a mesh is what makes this a screen-space panel you can
          // still drag on.
          hot: (x, y) => !!held || !!cellAt(x, y) || !!bodySlotAt(x, y),
          move: (x, y) => { ptr = { x, y }; if (held) repaint(); },
          click: (x, y) => {
            ptr = { x, y };
            const c = cellAt(x, y);
            if (c && wornIndex(c.slot) !== c.index) {
              held = { ...c, from: 'rack' };
              keySlot = c.slot;
              repaint();
              return;
            }
            // OFF THE BODY. The garment comes off THE MOMENT YOU GRAB IT
            // rather than when you let go, because that is what pulling a
            // jumper over your head looks like — you are holding it and he can
            // see himself without it. Drop it back on the glass and it goes
            // straight back on.
            const s = bodySlotAt(x, y);
            if (s && wornIndex(s) > 0) {
              held = { slot: s, index: wornIndex(s), from: 'body' };
              keySlot = s;
              wear(s, 0);
              repaint();
            }
          },
          up: (hit) => {
            const h = held;
            held = null;
            if (!h) return;
            // ON THE GLASS: he wears it, whichever part of the reflection he
            // dropped it on — a garment knows its own slot, so a hat dropped
            // on the feet still goes on the head. Forgiving on purpose: making
            // him hit the right body part would be a second, invisible rule.
            if (hit && inRect(hit.x, hit.y, GLASSR)) wear(h.slot, h.index);
            // ANYWHERE ELSE — the rack, the floor, off the panel entirely, or
            // a button released after the pointer left the window — it goes
            // back on the rail. For something taken off the body that means it
            // stays off, which is how you get to the white undies: drag it
            // away and let go. For something picked off the rack it means
            // nothing happened.
            ptr = hit;
            repaint();
          },
        },
        // NOTHING SURVIVES A CLOSE EXCEPT THE CLOTHES. Escape mid-drag drops
        // whatever is in his hand — no ghost item, no half-state, and the
        // garment is simply off, which is a state he can see and undo. The
        // framework owns the rest of the exit: Escape and `[E]` from every
        // screen, the gate, the pointer lock, and standing up.
        onOpen: () => { held = null; ptr = null; keySlot = null; },
        onClose: () => { held = null; ptr = null; },
      });
      // if anything else ever dresses the player — a shop, a laundrette — the
      // glass follows without that thing knowing this panel exists
      onWardrobeChange(() => { if (panel?.isOpen()) panel.repaint(); });
    }
    panel.open();
  };
  return open;
}
