import * as THREE from 'three';
import { dither } from './paint';
import { viewAt } from './citizens';
import { makePanel, type Panel } from './hud';
import {
  SLOTS, cycle, showing, worn, onWardrobeChange, type Slot,
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
/**
 * THE PANEL CANVAS'S DENSITY, in px per metre of glass — and the third report
 * of one bug is what put it here.
 *
 * *"give me true proportions in the mirror i feel stretched"*, then *"i squish
 * and distort in some"*, then *"ok but im still distorted in the mirror"*.
 * Two fixes shipped and neither landed, because both were aimed at the wrong
 * surface. **MEASURED, END TO END:**
 *
 *     the drawn figure   136 texels tall, 20-texel head → 6.8 heads, and
 *                        36 texels arm to arm → 1:3.8 of its height ✓
 *     figure → canvas    fitted at min(160/40, 608/152) = 4.0 on both axes ✓
 *     canvas → GLASS     canvas 160 x 608, aspect 0.2632
 *                        glass 0.52 x 1.35 m, aspect 0.3852
 *                        **⇒ x1.464 HORIZONTAL STRETCH. 46% TOO WIDE.**
 *
 * The figure was geometrically perfect right up to the last step, where a
 * FIXED 160 x 608 canvas was mapped onto a quad of a different shape — which
 * is precisely the fault `glassCanvas` was written to fix, applied to the WALL
 * PLATE and never to this panel. Two surfaces, one bug, one of them fixed.
 *
 * AND IT EXPLAINS WHY IT ARRIVED WHEN IT DID. At the glass he first saw
 * (0.42 x 1.60) the aspects were 0.2625 against 0.2632 — a stretch of x0.997,
 * invisible. *"a bit wider and less tall"* took the quad to 0.385 and opened
 * the gap; his complaint landed in the same breath, and I read it as the plate.
 *
 * So this canvas is DERIVED from the glass's metres, exactly as the plate's is,
 * and the two can no longer disagree. 200 px/m, five times the plate's 40 —
 * you are 1.9 m from it here rather than across the room.
 */
const PANEL_PPM = 200;
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

/** the slot under a CANVAS pixel of the panel — through the same fit the
 *  figure was drawn with, or the zones sit where he no longer does. */
function slotAtCanvas(px: number, py: number, W: number, H: number,
                      facing: number): Slot | null {
  const fit = figureFit(W, H);
  return zoneAt((px - fit.ox) / fit.s, (py - fit.oy) / fit.s, facing);
}

// ── THE PAINTER ────────────────────────────────────────────────────────────

/**
 * WHERE THE FIGURE SITS IN A CANVAS OF ANY SHAPE — one scale on both axes, the
 * remainder left as reflected room.
 *
 * `Math.min` is the whole of it, and it only started MEANING anything once the
 * canvas stopped being the figure's own shape: at 160 x 608 the two fits were
 * both 4.0 and the figure filled the canvas edge to edge, so nothing was ever
 * letterboxed and the quad's aspect went straight into his silhouette. Against
 * a canvas derived from a 0.52 x 1.35 glass the fits are 2.60 and 1.78, the
 * height binds, and he stands 71 px wide in 104 with reflected room either
 * side — which is what a person in a mirror looks like.
 */
function figureFit(W: number, H: number) {
  const s = Math.min(W / MW, H / MH);
  return { s, ox: Math.round((W - MW * s) / 2), oy: Math.round((H - MH * s) / 2) };
}

function paint(g: CanvasRenderingContext2D, W: number, H: number,
               hover: Slot | null, facing: number): void {
  // the glass: ONE drawing of it, shared with the plate on the wall
  paintGlass(g, W, H);
  const fit = figureFit(W, H);
  paintFigure(g, fit.ox, fit.oy, fit.s, facing);
  // EVERYTHING ELSE IS IN THE FIGURE'S SPACE, not the canvas's — the bracket
  // has to land on the body it is bracketing, and the body is no longer the
  // whole canvas.
  const u = (v: number) => Math.round(v * fit.s);
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    g.fillStyle = fill;
    g.fillRect(fit.ox + u(x), fit.oy + u(y), u(x + w) - u(x), u(y + h) - u(y));
  };

  // ── AND WHAT YOU ARE POINTING AT ───────────────────────────────────────
  //
  // *"you just click the highlighted part and it changes"* — so the highlight
  // is part of the design and not decoration, and it has one job: say THIS
  // PART IS CLICKABLE AND IT IS THE ONE YOU WILL CHANGE.
  //
  // A WASH PLUS A CLOSED OUTLINE. The wash alone was too quiet against a
  // reflection that is already pale grey; an outline alone reads as a crop
  // mark. Together they make a lit panel of you — warm, because everything
  // else on this glass is cold, so it cannot be mistaken for part of the room.
  //
  // ALL FOUR EDGES, where the old bracket drew only two. That was a scrub
  // gutter, pointing left and right at a gesture that no longer exists; a
  // closed box says "a thing", which is what a hat or a pair of shoes is.
  //
  // ONE UNIT THICK at the figure's own scale, so it is ~2 px on this canvas
  // and steps up with the mirror rather than being a hairline at one size and
  // a slab at another. Only ever ONE zone is lit: six labelled boxes on a
  // mirror is the menu this whole design exists to avoid.
  if (hover) {
    const z = zoneOf(hover);
    g.fillStyle = 'rgba(255,244,214,0.16)';
    g.fillRect(fit.ox + u(z.x0), fit.oy + u(z.y0), u(z.x1) - u(z.x0), u(z.y1) - u(z.y0));
    const line = 'rgba(246,238,214,0.72)';
    box(z.x0, z.y0, z.x1 - z.x0, 1, line);
    box(z.x0, z.y1 - 1, z.x1 - z.x0, 1, line);
    box(z.x0, z.y0, 1, z.y1 - z.y0, line);
    box(z.x1 - 1, z.y0, 1, z.y1 - z.y0, line);
  }
  // the caption strip is CHROME ON THE GLASS and spans it, so it is measured
  // off the canvas rather than off the figure standing in it
  const band = Math.round(H * 0.055);
  g.fillStyle = 'rgba(12,14,18,0.72)';
  g.fillRect(0, H - band, W, band);
  g.fillStyle = hover ? INK : 'rgba(239,232,214,0.62)';
  g.font = `bold ${Math.max(7, Math.round(band * 0.62))}px ui-monospace, Menlo, monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // the name of the thing you are about to change, or what to do if you are
  // not on anything. It is the one line of type on the glass and it names the
  // GARMENT rather than the slot — you can see which part is lit.
  g.fillText(hover ? showing(hover).name : 'CLICK TO CHANGE', W / 2, H - band / 2);
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

  // ── GLASSES, AND ONE OF THE TWO IS SEE-THROUGH ─────────────────────────
  //
  // *"regular glasses should be see through"*   (2026-08-04)
  //
  // SPECTACLES ARE A FRAME WITH NOTHING IN IT. The lens was a filled 5 x 4
  // block of `cloth`, which hid the eye behind it — that is a pair of
  // sunglasses whatever colour you paint it. Clear ones get all FOUR rims and
  // no fill, so the skin and the eye already drawn under them show through.
  //
  // NO TINT WAS NEEDED and none is drawn. A one-unit rim is 1.78 canvas px
  // here and about 5 screen px on a 1080p viewport — the frame is the most
  // legible thing on the face after the hair, so a "faint lens" would only be
  // a second tone on a surface that has fought to have one.
  //
  // AND THE INNER RIM IS NEW. The filled version could get away with three
  // sides because the fill closed the shape; an outline with a side missing
  // reads as a broken box, so a clear lens is a closed rectangle round the eye.
  //
  // ⚠ DRAW ORDER IS THE WHOLE FIX AND IT WAS ALREADY RIGHT: this block is the
  // LAST thing painted on the figure, over a finished face. Move it above the
  // eyes and a clear lens shows whatever the skin was at that moment instead.
  //
  // SUNGLASSES STAY OPAQUE. Dark lenses that hide the eyes are what makes them
  // read as sunglasses rather than as spectacles, and with one pair now empty
  // the two can no longer be confused: a rectangle you can see an eye through
  // against a solid black slab.
  if (specs.kind !== 'none') {
    const clear = specs.kind === 'clear';
    // FIVE OF THE EIGHT FACINGS NEEDED WORK, because both lenses used to be
    // painted at every angle — including from BEHIND, where a pair of glasses
    // was floating on the back of his head. A filled lens hid that as a dark
    // smudge; an empty frame would draw two boxes on his hair.
    //   · front and three-quarter (cols 0, 1): both lenses and the bridge
    //   · profile (col 2): the NEAR lens only — the far one is behind his
    //     nose, and the unmirrored profile faces −x, which is where the nose
    //     is drawn
    //   · three-quarter back and back (cols 3, 4): no lenses at all
    // The TEMPLES are drawn at every facing: they run over the ears and are
    // the only part of a pair of glasses you can see from behind.
    if (facing <= 2) {
      for (const sgn of [-1, 1]) {
        if (facing === 2 && sgn > 0) continue;
        const gx = sgn < 0 ? CX - 6 : CX + 1;
        if (!clear) head(gx, EYE_Y - 1, 5, 4, specs.cloth);                   // the dark lens
        head(gx, EYE_Y - 2, 5, 1, specs.trim);                                // rim, top
        head(gx, EYE_Y + 3, 5, 1, specs.trim);                                // rim, bottom
        head(sgn < 0 ? gx - 1 : gx + 5, EYE_Y - 1, 1, 4, specs.trim);         // rim, outer
        if (clear) head(sgn < 0 ? gx + 5 : gx - 1, EYE_Y - 1, 1, 4, specs.trim);  // and inner
      }
      if (facing < 2) head(CX - 1, EYE_Y, 2, 1, specs.trim);                  // the bridge
    }
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
  /** the glass's own size in metres — the canvas is derived from it, and the
   *  46% stretch this fixes is what happens when it is not. See `PANEL_PPM`. */
  glassW: number; glassH: number;
}): () => void {
  const PW = Math.round(o.glassW * PANEL_PPM), PH = Math.round(o.glassH * PANEL_PPM);
  let panel: Panel | null = null;
  let hover: Slot | null = null;
  /** which way the reflection is facing, 0…7. Front-on again on every open — a
   *  mirror left turned away is a state with no visible cause. */
  let facing = 0;
  const repaint = () => panel?.repaint();

  const open = () => {
    if (!panel) {
      panel = makePanel({
        id: 'ct-mirror', w: PW, h: PH, chrome: 'none', scale: 1,
        // `chrome:'none'` for the calendar's reason and more so: this canvas IS
        // the mirror's glass, edge to edge. A framework bezel would be a beige
        // plastic case drawn inside a wooden mirror frame.
        hint: () => 'click a part of yourself to change it',
        draw: (g, w, h) => paint(g, w, h, hover, facing),
        // ── THE WHEEL TURNS YOU ────────────────────────────────────────
        // *"scroll to turn self in mirror?"* — eight stops, `viewAt`'s own, so
        // the reflection steps through exactly the angles `ct/citizens.ts`
        // paints and never lands between two. It is not part of dressing and
        // never was — turning to look at the back of a jacket is its own thing.
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
          hot: (x, y) => slotAtCanvas(x, y, PW, PH, facing) !== null,
          // ── ONE VERB: CLICK ────────────────────────────────────────────
          //
          // *"get rid of drag to dress instead you just click the highlighted
          //  part and it changes. cycles through all the options for that
          //  category."*
          //
          // Hovering lights the part; clicking it steps that slot forward one
          // and wraps. The drag-to-scrub it replaces is DELETED rather than
          // left unreachable — its state, its `STEP` and its mouse-up branch
          // are gone, so there is one gesture in this panel and no second path
          // through the wardrobe that could disagree with it.
          move: (x, y) => {
            const z = slotAtCanvas(x, y, PW, PH, facing);
            if (z !== hover) { hover = z; repaint(); }
          },
          click: (x, y) => {
            const z = slotAtCanvas(x, y, PW, PH, facing);
            if (!z) return;
            hover = z;
            // `cycle` WRAPS OVER THE WHOLE RACK INCLUDING INDEX 0, and index 0
            // is the empty state — so clicking your chest enough times takes
            // the top off, which is the only way to undress now that dragging
            // a garment away is gone. It cannot go further than that: the
            // white vest and the white briefs ARE index 0 rather than options
            // sitting above a bare body, so *"maximum naked"* is a floor you
            // reach and cannot pass. See `ct/wardrobe.ts`'s header.
            cycle(z, 1);
            repaint();
          },
        },
        // NOTHING IS REMEMBERED ACROSS OPENINGS except the clothes, which are
        // the point. Nothing starts lit, so walking up to the mirror never
        // highlights a part of you that you last touched an hour ago and
        // cannot remember choosing.
        onOpen: () => { hover = null; facing = 0; },
      });
      // and if something else dresses the player — a shop, a laundrette, a
      // debug hook — the glass follows without that thing knowing it exists
      onWardrobeChange(() => { if (panel?.isOpen()) panel.repaint(); });
    }
    panel.open();
  };
  return open;
}
