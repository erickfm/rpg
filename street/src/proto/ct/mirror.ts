import * as THREE from 'three';
import { dither } from './paint';
import { viewAt } from './citizens';
import { makePanel, type Panel } from './hud';
import {
  SLOTS, cycle, showing, worn, wornIndex, wear, onWardrobeChange, type Slot,
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
// wall, and `mirrorPanel`, the view you get when you press `[E]` at it.
//
// ── AND IT IS BACK TO EXACTLY THIS, AFTER FIVE PRESENTATIONS ──────────────
//
// *"ok wait i have it, go back to the diagetic mirror but pre rack"*, then
// *"pre suitcase pls"*.   (2026-08-04)
//
// Between that first quote and this one the wardrobe was tried as a suitcase
// on the boards, a wall batten with hooks and a shelf, a garment held up in
// your own hands, a black-out sprite closet and a mail-order catalogue page.
// **All five are deleted and this is the one he asked to have back**, in his
// own words at the time: *"i liked the original view and how it locked us to
// that view with the mirror."* He has an idea to build on it.
//
// THREE THINGS FROM THOSE FIVE SURVIVE, because they are FIXES rather than
// presentation and dropping them would re-break faults he has already
// reported:
//
//   · `glassCanvas` — the plate's canvas derived from its metres, from *"give
//     me true proportions in the mirror i feel stretched"*
//   · PER-PART FORESHORTENING on the figure, from *"i squish and distort in
//     some"* — see `COL_SPAN`/`COL_ROUND`/`COL_DEEP`
//   · the EIGHT FACINGS on the wheel, from *"scroll to turn self in mirror?"*

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
//     liked — the same `PanelSpec.surface` mechanism the wall calendar uses.
//     The eye eases onto the glass and the fov leans 88 -> 52, which is the
//     attention narrowing: no dimmer, because a wash over a diegetic view is
//     the modal backdrop he rejected.
//   · THE GLASS IS THE PANEL. Its canvas is hung on the mirror's own mesh and
//     paints the reflection with you standing in it — `paintGlass` plus
//     `paintFigure`, one drawing of each shared with the plate on the wall.
//   · THE CONTROLS ARE YOUR OWN BODY. Six zones laid over the reflection where
//     that garment actually is — the crown is the hat, the face is the
//     glasses, the wrist is the watch. Drag sideways across one to scrub that
//     slot's rack; a click without a drag steps one forward. **There is no
//     container of clothes anywhere**, which is the whole of what he asked for
//     when he said *"pre suitcase"*.

// ── THE FIGURE ─────────────────────────────────────────────────────────────
//
// 40 x 152 design units, and the units are SQUARE. *"give me true proportions
// in the mirror i feel stretched"* — so the figure is drawn through one scale
// used on both axes and fitted INSIDE the glass with the remainder left as
// glass, never stretched to fill it. A body has fixed proportions whatever
// shape the thing it is reflected in happens to be.
const MW = 40, MH = 152;
/** canvas pixels per design unit, and the panel canvas that falls out of it.
 *  4 → 160 x 608, five times the wall plate's own density: you are 1.9 m from
 *  the glass here rather than across the room. */
const S = 4;
const PW = MW * S, PH = MH * S;
/** the caption strip along the bottom of the glass */
const BAND_T = 146;
const INK = '#efe8d6';

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
function zoneAt(dx: number, dy: number, facing = 0): Slot | null {
  // UNDO THE TURN FIRST. The zones are written on the front-on grid, so at 55%
  // and mirrored a wrist is not where they say it is. The bands that run the
  // full width do not care; the watch is the one that does.
  const [col, flip] = viewAt(facing);
  let x = (dx - CX) / COL_SPAN[col] + CX;
  if (flip) x = 2 * CX - x;
  for (const z of ZONES) {
    if (x >= z.x0 && x < z.x1 && dy >= z.y0 && dy < z.y1) return z.slot;
  }
  return null;
}

function zoneOf(slot: Slot): Zone {
  return ZONES.find((z) => z.slot === slot) as Zone;
}

/** the slot under a CANVAS pixel of the panel */
function slotAtCanvas(px: number, py: number, facing: number): Slot | null {
  return zoneAt(px / S, py / S, facing);
}

// ── THE PAINTER ────────────────────────────────────────────────────────────

function paint(g: CanvasRenderingContext2D, W: number, H: number,
               hover: Slot | null, facing: number): void {
  const u = (v: number) => Math.round(v * (W / MW));
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    g.fillStyle = fill;
    g.fillRect(u(x), u(y), u(x + w) - u(x), u(y + h) - u(y));
  };
  // the glass: ONE drawing of it, shared with the plate on the wall
  paintGlass(g, W, H);
  // and you, in it. ONE SCALE ON BOTH AXES, remainder left as reflected room —
  // *"give me true proportions in the mirror i feel stretched"*.
  const fs = Math.min(W / MW, H / MH);
  paintFigure(g, Math.round((W - MW * fs) / 2), Math.round((H - MH * fs) / 2), fs, facing);

  // ── AND WHAT YOUR HAND IS ON ───────────────────────────────────────────
  //
  // Only ever the hovered slot: a mirror with six labelled boxes drawn on it is
  // the menu this design exists to avoid. Hover one and you get a bracket round
  // it, an arrow at each edge of the glass saying which way it scrubs, and the
  // garment's name in the strip along the bottom.
  if (hover) {
    const z = zoneOf(hover);
    const cy = (z.y0 + z.y1) / 2;
    g.fillStyle = 'rgba(240,232,214,0.10)';
    g.fillRect(u(z.x0), u(z.y0), u(z.x1) - u(z.x0), u(z.y1) - u(z.y0));
    for (const y of [z.y0, z.y1 - 1]) box(z.x0, y, z.x1 - z.x0, 1, 'rgba(240,232,214,0.55)');
    // the two arrows, stepped rather than drawn as triangles for the reason the
    // skirt's bands are stepped: nothing on this glass may be antialiased
    for (let k = 0; k < 4; k++) {
      box(1 + k, cy - (3 - k), 1, (3 - k) * 2 + 1, INK);
      box(MW - 2 - k, cy - (3 - k), 1, (3 - k) * 2 + 1, INK);
    }
  }
  box(0, BAND_T, MW, MH - BAND_T, 'rgba(12,14,18,0.72)');
  g.fillStyle = hover ? INK : 'rgba(239,232,214,0.62)';
  g.font = `bold ${u(4.2)}px ui-monospace, Menlo, monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(hover ? showing(hover).name : 'DRAG TO DRESS', u(CX), u(BAND_T + 3.2));
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

// ── THE PANEL ──────────────────────────────────────────────────────────────

/**
 * Build the mirror's view. `mesh` is resolved at OPEN time — `ct/apartment.ts`
 * rebuilds its interiors as the player moves, so a reference captured at build
 * time can outlive the object it names (`ScreenSurface.mesh` says so, and the
 * degrade path is the screen-space cabinet rather than a crash).
 *
 * Returns the opener to hand straight to `ctx.spot({ act })`.
 */
export function mirrorPanel(mesh: () => THREE.Object3D | null, o: {
  standoff: number; fov: number;
}): () => void {
  let panel: Panel | null = null;
  let hover: Slot | null = null;
  /** which way the reflection is facing, 0…7. Front-on again on every open — a
   *  mirror left turned away is a state with no visible cause. */
  let facing = 0;
  /** the drag in progress: which slot, where it started, and what was on then */
  let drag: { slot: Slot; x0: number; i0: number; last: number; moved: boolean } | null = null;
  /**
   * How far you drag to change one garment, in canvas pixels.
   *
   * 20 of the 160 across the glass, so a drag from one edge to the other steps
   * eight — more than any rack holds, i.e. every option in a slot is reachable
   * in one gesture without lifting the button. Smaller and a twitch changes
   * your trousers; larger and the longest rack needs two drags.
   */
  const STEP = 20;

  const repaint = () => panel?.repaint();

  const open = () => {
    if (!panel) {
      panel = makePanel({
        id: 'ct-mirror', w: PW, h: PH, chrome: 'none', scale: 1,
        // `chrome:'none'` for the calendar's reason and more so: this canvas IS
        // the mirror's glass, edge to edge. A framework bezel would be a beige
        // plastic case drawn inside a wooden mirror frame.
        hint: () => 'drag across yourself to change what you are wearing',
        draw: (g, w, h) => paint(g, w, h, hover, facing),
        // ── THE WHEEL TURNS YOU ────────────────────────────────────────
        // *"scroll to turn self in mirror?"* — eight stops, `viewAt`'s own, so
        // the reflection steps through exactly the angles `ct/citizens.ts`
        // paints and never lands between two. It used to scrub the hovered
        // rack, which the DRAG already does and does better.
        //
        // It cannot steal the world's zoom: that listener is BUBBLE-phase and
        // this panel's gate is CAPTURE-phase with `stopImmediatePropagation`,
        // so while the mirror is up the world never sees a wheel event.
        wheel: (d) => { facing = (facing + d + 8) % 8; repaint(); },
        key: (k) => {
          // THE KEYBOARD DOES EVERYTHING THE MOUSE DOES. A panel that can only
          // be worked with a pointer is one a player with a trackpad, a
          // touchscreen or a stuck mouse cannot leave a state in — and Escape
          // and `[E]` are the framework's, so nothing here can eat the way out.
          const i = hover ? SLOTS.indexOf(hover) : -1;
          if (k === 'arrowdown') hover = SLOTS[(i + 1 + SLOTS.length) % SLOTS.length];
          else if (k === 'arrowup') hover = SLOTS[(i - 1 + SLOTS.length) % SLOTS.length];
          else if (k === 'arrowright') { if (hover) cycle(hover, 1); }
          else if (k === 'arrowleft') { if (hover) cycle(hover, -1); }
          else return;
          repaint();
        },
        surface: {
          mesh,
          standoff: o.standoff,
          fov: o.fov,
          hot: (x, y) => slotAtCanvas(x, y, facing) !== null,
          move: (x, y) => {
            if (drag) {
              // SCRUB. Measured from where the button went down and from the
              // index it went down ON, not incrementally — an incremental
              // version drifts, and dragging back to where you started must put
              // back what you started in. `last` is the step count already
              // applied, so a mousemove that has not crossed a step boundary
              // does nothing at all: `wear` writes to storage and wakes the hud.
              const steps = Math.round((x - drag.x0) / STEP);
              if (steps !== 0) drag.moved = true;
              if (steps !== drag.last) {
                drag.last = steps;
                wear(drag.slot, drag.i0 + steps);
                repaint();
              }
              return;
            }
            const z = slotAtCanvas(x, y, facing);
            if (z !== hover) { hover = z; repaint(); }
          },
          click: (x, y) => {
            const z = slotAtCanvas(x, y, facing);
            if (!z) return;
            hover = z;
            // `showing` rather than `wornIndex`: while a dress is on, the
            // bottoms slot is the dress, and a drag that started from the
            // trousers still in the drawer would jump.
            const i0 = showing(z) === worn(z) ? wornIndex(z) : -1;
            drag = { slot: z, x0: x, i0, last: 0, moved: false };
            repaint();
          },
          // THE BUTTON CAME UP — anywhere, including off the glass, which is
          // where a drag that runs out of mirror ends. A click is a drag that
          // never moved, so the two gestures cost one branch between them and
          // neither can swallow the other.
          up: () => {
            const d = drag;
            drag = null;
            if (!d) return;
            if (!d.moved) { cycle(d.slot, 1); repaint(); }
          },
        },
        // NOTHING IS REMEMBERED ACROSS OPENINGS except the clothes, which are
        // the point. The hand starts on nothing, so walking up to the mirror
        // never shows a bracket round a part of you that you last touched an
        // hour ago and cannot remember choosing.
        onOpen: () => { hover = null; drag = null; facing = 0; },
        onClose: () => { drag = null; },
      });
      // and if something else dresses the player — a shop, a laundrette, a
      // debug hook — the glass follows without that thing knowing it exists
      onWardrobeChange(() => { if (panel?.isOpen()) panel.repaint(); });
    }
    panel.open();
  };
  return open;
}
