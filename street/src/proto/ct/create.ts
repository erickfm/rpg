// ══ CHARACTER CREATION — THE FORM ON THE DESK ═══════════════════════════════
//
// *"new game should put me into character create menu no? what happened to
//  character create?"*   (2026-08-05)
//
// *"character creation looks so bad i hate the aesthetic, try another based off
//  of everything you know about my tastes in this game and this work you've
//  done with me. think a lot"*   (2026-08-08)
//
// *"not sure i like the character creation screen. its just a bit to jank.
//  lets get player on left, lets make the form simpler lets get the spider
//  plot looking a little nicer clearer, minimal"*   (2026-08-24)
// — which put the PHOTO ON THE LEFT and the sheet on the right, stripped the
//   desk's grain and the waiting ballpoint, thinned the letterhead, and cut
//   the chart to two rings. Layout only; every field and mechanic is as it was.
//
// *"i want to be able to interact with the form fully with mouse thanks. i
//  cant drag each thing in the spider plot nicely. lets make this nice! its
//  just too janky"* and *"cant jkust click intuitively. i want to be able to
//  click and change the options intuitively. also make sure all text is
//  readable"*   (2026-08-24, same session)
// — which made the chart's five points DRAGGABLE (through `specStep`, so the
//   pool and the cap still rule), printed ◀ ▶ on every steppable rule as
//   real click targets, made the L/R boxes clickable, gave the cursor honest
//   shapes, and retired every faint string for the dark print.
//
// ── WHY IT IS NO LONGER THE TELEVISION ─────────────────────────────────────
//
// The first aesthetic borrowed `ct/osd.ts` wholesale: the blue field, the
// inverse cursor, the static. The menu earned that look by BEING a VCR's own
// OSD — but nothing in 1997 made a person through an OSD, and he hated it. The
// rule everywhere else in this world is that a surface is the 1997 OBJECT the
// activity actually is (a menu is a sign, speech is a bubble at the speaker, a
// note is paper), so the question was: what object turns you into a resident?
//
// **A FORM.** The five immutables — hair, hair colour, height, build, skin —
// are the fields printed on a period ID card, almost verbatim. So this screen
// is a RESIDENT CARD APPLICATION lying on an oak desk, with an instant photo
// of you beside it:
//
//   · the paper is the world's own stock (`#f2ead0`, the most-used light value
//     in the game) on VOLT VILLAGE's oak — warm beige-and-wood, his palette
//   · the doll is now the PHOTO: full length against a cold grey wall with
//     height ticks (which is what makes HEIGHT read at a glance), in an
//     instant-film frame — ONE fixed front-on frame, the mugshot a card
//     wants. It turned with the scroll wheel for a day; *"dont allow for
//     rotation in the mirror and in the character create screen pls."*
//     (2026-08-09) removed that, here and at the mirror in 301 alike
//   · the name you type is hand-written on the photo's bottom border in blue
//     pen, because that is where a name goes on a photo
//   · HAND is two checkboxes, the selected field is a yellow HIGHLIGHTER
//     swipe, and BEGIN is the signature line at the foot
//   · and the signature is SIGNED — *"lets make it so you actually have to
//     sign for signature like you have to draw"* (2026-08-09). You put the
//     pen down on the line and draw; the ink is the world's blue biro, a
//     texel at a time. The ⌫ at the line's right end clears it to re-sign
//     (it replaced a red VOID at his word, 2026-08-10); enough ink
//     raises the red FILE box, which submits. Enter still auto-scrawls and
//     signs for keyboard players — the no-trap rule outranks the flourish.
//   · nothing is labelled that shows itself; the only instructions are the
//     small print a real form carries
//
// ── AND IT IS STILL ABOUT THE BODY, NOT THE CLOTHES ────────────────────────
//
// *"in character creation the options should simply be hair, height, build,
//  skin color, immutables. start them in some unisex boring outfit."*
//   (2026-08-05)
//
// The rows are `ct/body.ts`'s five immutables plus NAME and HAND; the outfit
// is set for him — `resetOutfit()`, plain navy long sleeve, jeans, sneakers.
// **Creation is for what you are stuck with.** Clothes are the mirror's job.
//
// THE FIGURE IN THE PHOTO IS STILL `ct/mirror.ts`'s. This screen owns NO
// painter of him: the same `paintFigure` that draws the reflection in 301
// draws the photo, front-on. There is one figure in this game.
//
// ⚠ WHY THIS IS ITS OWN FILE AND NOT PART OF `ct/osd.ts`. That module is a
// NEAR-LEAF — audio and nothing else — precisely so it cannot close an import
// cycle (GOTCHAS §28: dev looks perfect and the built artifact has no menu in
// it). Painting the figure needs `ct/mirror.ts`, which pulls THREE and
// `ct/hud.ts` behind it. So the arrow points THIS way — create imports osd,
// osd never imports create — and the handshake between them is a flag in
// `localStorage`, not a function call.
import {
  OW, OH, font,
  setting, setName, setHand, registerOsdBusy,
} from './osd';
import { paintFigure } from './mirror';
import { resetOutfit } from './wardrobe';
import { TRAITS, TRAIT_NAME, traitName, cycleTrait } from './body';
import { STAT_NAMES, STAT_LABEL, stat, specStep, pointsLeft } from './stats';
import { makeSigPad, paintBackspace, pixLine } from './signature';

/**
 * ── WHEN THIS RUNS, AND WHEN IT MUST NOT ──────────────────────────────────
 *
 * Three keys, and the order they are asked in is the whole rule:
 *
 *   `ct-create`   set by NEW GAME immediately before it reloads. This is the
 *                 handshake — it is how *"new game should put me into character
 *                 create"* is wired without `ct/osd.ts` importing this file.
 *                 Always wins, because he just asked for it.
 *   `ct-created`  you have made a character on this browser. Stops the screen
 *                 reappearing on every reload for somebody who left the name
 *                 blank, or who plays with storage that cannot hold a save.
 *   `ct-save`     `ct/save.ts`'s own LOCAL_KEY. A save present and no created
 *                 flag means a player from BEFORE this feature existed — they
 *                 have a character already, it is just one they never typed a
 *                 name into. They get the world, not a creation screen.
 *
 * ⚠ IT CANNOT OVERWRITE A GOOD SAVE and does not need a guard to manage it.
 * `ct/save.ts` holds `ready` false until a restore has been attempted, so the
 * `flush()` that `onWardrobeChange` fires while you are dressing here is a
 * no-op; and the only path that reaches this screen with a save present is the
 * one that has just deleted it.
 */
const PENDING = 'ct-create';
const CREATED = 'ct-created';
const SAVE_KEY = 'ct-save';

/** Every touch of storage is guarded — a sandboxed iframe can THROW on read
 *  rather than return null, and an exception here is a black page. */
function get(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function put(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* private mode */ }
}
function drop(k: string): void {
  try { localStorage.removeItem(k); } catch { /* private mode */ }
}

function wanted(): boolean {
  if (get(PENDING) === '1') return true;         // NEW GAME asked for it
  if (get(CREATED) === '1') return false;        // already made one here
  if (get(SAVE_KEY) !== null) return false;      // a player from before this
  return true;                                   // genuinely nobody yet
}

// ── THE SCREEN ─────────────────────────────────────────────────────────────

let wrap: HTMLDivElement | null = null;
let cv: HTMLCanvasElement | null = null;
let active = false;
/** the photo is front-on, always — see the header. `paintFigure`'s sector 0. */
const FACING = 0;
let sel = 0;
let name = '';
/** the chart axis being dragged (0…4, `STAT_NAMES` order), or null. While
 *  set, mousemove is the pen pulling that stat's point along its spoke. */
let dragK: number | null = null;
/** a drag ends in a click the browser fires anyway — swallow exactly one */
let justDragged = false;

/** the OSD is not allowed to open on top of this. Asked as a predicate, never
 *  raced as a listener — `ct/osd.ts` argues this out at `registerOsdBusy`. */
export function creating(): boolean { return active; }

/**
 * A ROW OF THE FORM. `NAME` types, `HAND` toggles its checkboxes, the five
 * trait rows cycle `ct/body.ts`'s racks, and the signature line leaves.
 * Nothing here holds a value of its own except the name — every other row is
 * a live read of the module that actually owns the thing, which is why the
 * photo can never disagree with the form beside it.
 */
type Line = { label: string; value: () => string; step: (d: number) => void };

const LINES: Line[] = [
  {
    label: 'NAME',
    value: () => name,
    // stepping the name row does nothing — you type into it. Left/Right here
    // deliberately no-ops rather than doing something surprising.
    step: () => { /* typed, not stepped */ },
  },
  {
    // NOT AN IMMUTABLE, and it stays anyway. Handedness is a fact about the
    // PERSON AT THE KEYBOARD rather than about the character — it is why it
    // lives in `ct-settings` beside the volume and not in the save — but it is
    // also the one thing a new player should be asked once, before he has spent
    // an hour with the watch on the wrong wrist. The menu still has it.
    label: 'HAND',
    value: () => (setting('hand') === 'left' ? 'LEFT' : 'RIGHT'),
    step: () => setHand(setting('hand') === 'left' ? 'right' : 'left'),
  },
  // ── THE FIVE YOU ARE STUCK WITH ────────────────────────────────────────
  //
  // HAIR AND ITS COLOUR ARE TWO ROWS, not one. Every other row on this form
  // is one axis with one answer, and folding a cut and a colour into a single
  // stepper would mean 56 combinations reachable only in order — you would step
  // through six colours of a bowl cut to see a ponytail. Two rows is the same
  // gesture he already knows, twice.
  ...TRAITS.map((t): Line => ({
    label: TRAIT_NAME[t],
    value: () => traitName(t),
    step: (d) => cycleTrait(t, d),
  })),
  // ── SECTION II: THE FIVE APTITUDES ─────────────────────────────────────
  //
  // *"you can spec them on start. make a spider chart actually."* (2026-08-08)
  //
  // Same gesture as every other row — ◀▶ steps, and `ct/stats.ts`'s
  // `specStep` is the budget: up only while the 30-point pool has a point
  // left, down only to 1. These rows are the short ruled lines on the left;
  // the PENTAGON printed beside them re-plots in ballpoint as they move,
  // because a chart that lags its own form is a broken instrument.
  ...STAT_NAMES.map((s): Line => ({
    label: STAT_LABEL[s],
    value: () => String(stat(s)),
    step: (d) => specStep(s, d),
  })),
  {
    label: 'SIGN',
    value: () => '',
    // NOT a stepper any more — the signature is drawn (`onDown`) or
    // auto-scrawled by Enter (`onKey`). A ◀▶ on this row starting the game
    // would be signing a form by nudging it.
    step: () => { /* signed, not stepped */ },
  },
];

/** row indexes the painter treats specially */
const ROW_NAME = 0, ROW_HAND = 1, ROW_SIGN = LINES.length - 1;
/** first trait row — from here to the signature, every row is steppable */
const ROW_TRAIT0 = 2;
/** first aptitude row — these get the short rule and the narrow highlighter */
const ROW_STAT0 = 2 + TRAITS.length;

// ── THE DESK, THE PAPER, THE PHOTO — every number is a texel ───────────────
//
// One 320x240 LAYOUT on a nearest-filtered canvas, the same trick as every
// readable surface in this project — but the field is a desk, not a signal.
//
// ⚠ THE BACKING STORE IS 2x THE LAYOUT — *"text on application needs to be
// clearer"* (2026-08-24). `font()` is a real vector monospace, not a bitmap
// face, and rasterising it at 8 px onto a 320-wide store threw the glyph
// detail away before the upscale ever saw it — no ink colour could fix that.
// The canvas is `OW*SS x OH*SS` and the painter runs under `setTransform(SS)`,
// so every coordinate in this file stays a 320x240 texel and the mouse maps
// through `OW / rect.width` untouched, while type rasterises at 16-20 real
// px and comes out clean. Rects are integers, so they land on whole device
// pixels and the desk, the ink and the figure look exactly as before.
const SS = 2;

/** the paper sheet — US-letter proportions, and deliberately NOT square.
 *  ON THE RIGHT OF THE DESK NOW — *"lets get player on left"* (2026-08-24)
 *  swapped the sheet and the photo, so every x on the sheet derives from
 *  `PAPER_X` and the whole page moved as one. */
const PAPER_X = 134, PAPER_Y = 8, PAPER_W = 172, PAPER_H = 226;
/** rows: baselines down the form. Uniform, because the click map divides by
 *  it. 13 px and not the old 17: SECTION II added five rows and a chart to
 *  the same sheet, and a second page would cost more than tighter type —
 *  this is still a municipal form, and municipal forms are cramped.
 *  ⚠ THE SIGNATURE ROW IS OFF THIS GRID — see `SIGN_Y`. */
const ROW_Y = 48, ROW_H = 13, ROW_X = PAPER_X + 10;
/** where typed values start, and where the ruled lines run to */
const VAL_X = PAPER_X + 56, LINE_R = PAPER_X + PAPER_W - 12;
/** aptitude rows stop their rule and highlighter here — wide enough to seat
 *  ◀ digit ▶ with air between them, and STILL short of the chart's CON
 *  label (which begins near paper + 79): the rule running under that label
 *  is the exact bug *"need more space down here too"* (2026-08-10) fixed. */
const STAT_R = PAPER_X + 78;
/** the pentagon: centre and outer radius (a value of 10), sharing the section
 *  with the five short rows. Every plotted point is `Math.round`ed — the
 *  blur lesson (`ct/body.ts`) applies to a chart as much as to a photo.
 *  ⚠ SIZED FOR AIR, TWICE AT HIS WORD. *"lets make sure the text isnt
 *  overlapping in places"* (2026-08-09) parted the bottom labels from the
 *  signature band by a texel; *"need more space down here too"* (2026-08-10)
 *  said a texel is not a margin. R 22 and centre 163 put the bottom labels'
 *  glyphs at 181…187 — five clear of the clerk's note, thirteen clear of the
 *  ink box — and the whole foot breathes; see the ladder at `SIGN_Y`. */
const CH_CX = PAPER_X + 124, CH_CY = 163, CH_R = 22;
/** the pen reaches this far when grabbing a plotted point, and this far from
 *  the centre before a press stops being "on the chart" at all — *"i cant
 *  drag each thing in the spider plot nicely"* (2026-08-24), so the targets
 *  are fat: an 8-texel halo on each dot, and anywhere on the printed
 *  instrument grabs the nearest axis by angle. */
const GRAB_R = 8, DISC_R = CH_R + 8;
/**
 * ── THE SIGNATURE IS DRAWN, NOT CLICKED ───────────────────────────────────
 *
 * *"lets make it so you actually have to sign for signature like you have to
 *  draw"*   (2026-08-09)
 *
 * The box is the blank of the line: X to the line's end, the strip above the
 * rule. Strokes are polylines in canvas texels, clamped to the box and drawn
 * through `pixLine` in the ballpoint's own blue — hard pixels, like every
 * other mark on this sheet. `SIG_MIN` is the ink that counts as a signature:
 * 50 texels of path, about two honest strokes — a single dot is not a
 * signature. Below it the FILE box does not appear and Enter auto-scrawls.
 *
 * THE MECHANIC ITSELF LIVES IN `ct/signature.ts` NOW — *"i want to sign
 * similar to game start for job app. and for loan"* (2026-08-09) spread it
 * to two more papers, and one pen serves all three. This screen keeps only
 * its geometry and its voice (the ⌫ at the line's end, the red FILE box).
 *
 * ── THE FOOT'S LADDER, WITH HONEST MARGINS — *"need more space down here
 * too"* (2026-08-10). Off the row grid, each band clear of the next:
 *
 *   181…187   the chart's DEX / CHA labels
 *   192…198   the clerk's red note, right-aligned          (4 clear above)
 *   200…213   the ink box, the X, the line, and FILE beside them in the
 *             office corner                                (2 clear above)
 *   215…221   APPLICANT SIGNATURE                          (2 clear above)
 *   224…230   the key legend                               (3 clear above)
 *   233       the sheet's bottom edge                      (3 clear above)
 */
const SIGN_Y = 210;
const SIG_X0 = PAPER_X + 24, SIG_X1 = PAPER_X + 122, SIG_Y0 = 200, SIG_Y1 = 212;
const SIG_MIN = 50;
const sigPad = makeSigPad({ x0: SIG_X0, y0: SIG_Y0, x1: SIG_X1, y1: SIG_Y1 }, SIG_MIN);
/** the office-use FILE box, up only once there is a signature — clicking it
 *  is what BEGIN used to be. BESIDE the line now, in the office's own corner,
 *  so the band under the line belongs to the captions alone. */
const FILE_X0 = PAPER_X + 128, FILE_X1 = PAPER_X + 160, FILE_Y0 = 200, FILE_Y1 = 212;
/** the ⌫, at the right end of the ink box, up once there is ink — clicking
 *  it clears to re-sign. It replaced a red VOID under the X at his word
 *  (see `paintBackspace`), and it lives INSIDE the pad's corner, so its
 *  region is asked before the pen's. */
const CLR_X0 = PAPER_X + 104, CLR_X1 = PAPER_X + 122, CLR_Y0 = 200, CLR_Y1 = 212;
/** the instant photo — frame, then the image inset with the fat film bottom.
 *  ON THE LEFT — *"lets get player on left"* (2026-08-24): you first, then
 *  the paperwork about you. */
const PH_X = 14, PH_Y = 24, PH_W = 106, PH_H = 158;
const IMG_X = PH_X + 8, IMG_Y = PH_Y + 8, IMG_W = 90, IMG_H = 116;
/** the figure in it: feet on this canvas row, scaled so VERY TALL keeps his
 *  head inside the frame (146 design units of foot line x 0.65 x 1.08 = 103) */
const FIG_S = 0.65, FOOT_Y = IMG_Y + IMG_H - 10;

// the palette: the world's paper on VOLT VILLAGE's oak, print in the boards'
// own brown, values in typewriter black, the pen in ballpoint blue
const OAK = '#7a5936', OAK_ALT = '#755231', OAK_JOINT = '#5c3e22';
const PAPER = '#f2ead0', PAPER_EDGE = '#d9cdac';
// PRINT is the form's light printed ink — LINES AND BOXES ONLY now. Every
// STRING on the sheet is PRINT_DK, typewriter TYPED, pen or stamp — *"make
// sure all text is readable"* (2026-08-24) retired faint type for good.
const PRINT = '#8a7c5e', PRINT_DK = '#4a3a2b', RULE = '#c9bc9a';
const TYPED = '#2f2a22';
const PEN = '#2b3f7e';
const STAMP_RED = '#a03428';
const WALL = '#98a3ac', WALL_TICK = '#87919b', FLOOR = '#7b848d';
const FILM = '#f6f3ea';

// The desk used to carry 90 seeded grain flecks and a ballpoint pen waiting
// by the paper. Both went 2026-08-24 — *"its just a bit to jank … minimal"* —
// the boards and their joints are texture enough, and the pen was furniture.

/** print a line of type, stepping the size down until it fits `maxW` — a name
 *  is the only thing long enough to need it, and clipping a name is worse */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number,
                 maxW: number, px: number, fill: string, center = false): void {
  for (let p = px; p >= 6; p--) {
    g.font = font(p);
    if (g.measureText(text).width <= maxW || p === 6) {
      g.fillStyle = fill;
      g.textAlign = center ? 'center' : 'left';
      g.textBaseline = 'alphabetic';
      g.fillText(text, x, y);
      g.textAlign = 'left';
      return;
    }
  }
}

// `pixLine` — the chart's rings and every pen stroke — is imported from
// `ct/signature.ts`, so the one instrument on the sheet has the same hard
// pixels as the ink beside it.

/** vertex k of a pentagon of radius r — k 0 at the top, then clockwise, the
 *  same order as the five rows: INT up, STR, CHA, DEX, CON. Rounded HERE so
 *  rings, spokes, plot and dots all agree on the same texel. */
function chVert(r: number, k: number): [number, number] {
  const a = -Math.PI / 2 + k * (2 * Math.PI / 5);
  return [Math.round(CH_CX + r * Math.cos(a)), Math.round(CH_CY + r * Math.sin(a))];
}

/** where axis k points — the unit the drag projects the pen onto */
function axisUnit(k: number): [number, number] {
  const a = -Math.PI / 2 + k * (2 * Math.PI / 5);
  return [Math.cos(a), Math.sin(a)];
}

/** the plotted point within `GRAB_R` of the pen, nearest first, or null */
function vertexAt(x: number, y: number): number | null {
  let best: number | null = null, bd = GRAB_R * GRAB_R;
  STAT_NAMES.forEach((s, k) => {
    const [vx, vy] = chVert((CH_R * Math.min(stat(s), 10)) / 10, k);
    const d = (x - vx) ** 2 + (y - vy) ** 2;
    if (d <= bd) { bd = d; best = k; }
  });
  return best;
}

/** the axis a press inside the chart's disc means, by ANGLE — grabbing the
 *  INT direction grabs INT even when every dot is huddled at the centre —
 *  or null when the press is off the instrument entirely */
function axisAt(x: number, y: number): number | null {
  const dx = x - CH_CX, dy = y - CH_CY;
  if (dx * dx + dy * dy > DISC_R * DISC_R) return null;
  const k = Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (2 * Math.PI / 5));
  return ((k % 5) + 5) % 5;
}

/**
 * The drag itself: project the pen onto the held axis, round to a value on
 * the 1…10 paper, and WALK the stat there through `specStep` — one point at
 * a time, so the creation pool and the desk's cap of 10 are the same law for
 * the mouse as for the arrow keys. When the pool runs dry the walk stops
 * short and the dot visibly refuses to follow the pen — that stall IS the
 * budget speaking; it is not a bug.
 */
function dragTo(x: number, y: number): void {
  if (dragK === null) return;
  const s = STAT_NAMES[dragK];
  const [ux, uy] = axisUnit(dragK);
  const t = (x - CH_CX) * ux + (y - CH_CY) * uy;
  const target = Math.max(1, Math.min(10, Math.round((t * 10) / CH_R)));
  for (let guard = 12; stat(s) !== target && guard > 0; guard--) {
    const before = stat(s);
    specStep(s, target > before ? 1 : -1);
    if (stat(s) === before) break;                       // pool dry or capped
  }
  paint();
}

/** an X in a checkbox, drawn a pixel at a time — a diagonal through the
 *  antialiaser would be the one soft edge on the sheet */
function checkbox(g: CanvasRenderingContext2D, x: number, y: number, on: boolean): void {
  // dark border — the boxes are the HAND row's click targets now, and a
  // target should look like one
  g.fillStyle = PRINT_DK;
  g.fillRect(x, y, 8, 1); g.fillRect(x, y + 7, 8, 1);
  g.fillRect(x, y, 1, 8); g.fillRect(x + 7, y, 1, 8);
  if (on) {
    g.fillStyle = TYPED;
    for (let i = 0; i < 4; i++) {
      g.fillRect(x + 2 + i, y + 2 + i, 1, 1);
      g.fillRect(x + 5 - i, y + 2 + i, 1, 1);
    }
  }
}

function paintCreate(g: CanvasRenderingContext2D): void {
  // ── the desk ─────────────────────────────────────────────────────────
  g.fillStyle = OAK;
  g.fillRect(0, 0, OW, OH);
  for (let b = 0; b * 34 < OH; b++) {
    if (b % 2 === 1) { g.fillStyle = OAK_ALT; g.fillRect(0, b * 34, OW, 34); }
    g.fillStyle = OAK_JOINT; g.fillRect(0, b * 34 + 33, OW, 1);
  }

  // ── the form ─────────────────────────────────────────────────────────
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(PAPER_X + 3, PAPER_Y + 3, PAPER_W, PAPER_H);
  g.fillStyle = PAPER;
  g.fillRect(PAPER_X, PAPER_Y, PAPER_W, PAPER_H);
  g.fillStyle = PAPER_EDGE;
  g.fillRect(PAPER_X, PAPER_Y + PAPER_H - 1, PAPER_W, 1);
  g.fillRect(PAPER_X + PAPER_W - 1, PAPER_Y, 1, PAPER_H);

  // letterhead — what the form is, said once, by the form. LEFT-ALIGNED,
  // with the form code alone on the right of the title line: centred, the
  // title's tail ran into the code's corner — *"form r9 in corner could use
  // a bit of space imo"* (2026-08-10) — and a municipal letterhead sits left
  // with its code across from it anyway. Ten texels of air between title and
  // code, guaranteed by alignment rather than by luck; the rule under it is
  // one texel now, not two — *"minimal"* (2026-08-24).
  fitText(g, 'CITY OF CROSSTOWN', ROW_X, 22, 100, 10, PRINT_DK);
  g.font = font(8); g.fillStyle = STAMP_RED;
  g.textAlign = 'right'; g.fillText('FORM R-9', LINE_R, 22); g.textAlign = 'left';
  fitText(g, 'RESIDENT CARD APPLICATION', ROW_X, 33, PAPER_W - 20, 8, PRINT_DK);
  g.fillStyle = PRINT_DK; g.fillRect(PAPER_X + 10, 38, PAPER_W - 20, 1);

  // ── SECTION II's printed instrument: the pentagon, then the pen ──────
  //
  // Drawn BEFORE the fields so the highlighter swipe lands over it the way a
  // marker lands over print. Rings and spokes are the form's own faint ink;
  // the applicant's spec goes on in ballpoint — dots at the five values,
  // pen-ruled joins, and a light blue wash inside (the wash is the one
  // path-filled shape here, and the pen lines over it keep its edge honest).
  const sectY = ROW_Y + (ROW_STAT0 - 1) * ROW_H + 4;     // between SKIN and INT
  g.fillStyle = RULE; g.fillRect(PAPER_X + 10, sectY, PAPER_W - 20, 1);
  g.fillStyle = RULE;
  for (let k = 0; k < 5; k++) {
    const [vx, vy] = chVert(CH_R, k);
    pixLine(g, CH_CX, CH_CY, vx, vy);                    // spokes
  }
  // TWO rings, not five. It printed rings at 2,4,6,8,10 and read as a web —
  // *"lets get the spider plot looking a little nicer clearer, minimal"*
  // (2026-08-24). A faint mid ring at 5 (the average man) and the printed
  // outer at 10 (the cap) are the only two values the chart has to say.
  for (const v of [5, 10]) {
    g.fillStyle = v === 10 ? PRINT : RULE;
    for (let k = 0; k < 5; k++) {
      const [ax, ay] = chVert((CH_R * v) / 10, k);
      const [bx, by] = chVert((CH_R * v) / 10, (k + 1) % 5);
      pixLine(g, ax, ay, bx, by);
    }
  }
  // axis labels at the five points — in the DARK print now, so they read
  // over the paper instead of fading into the rings
  g.font = font(8); g.fillStyle = PRINT_DK;
  const CH_LAB: [number, number, CanvasTextAlign][] = [
    [CH_CX, CH_CY - CH_R - 4, 'center'],                 // INT, above the top
    [CH_CX + 28, CH_CY - 5, 'left'],                     // STR
    [CH_CX + 18, CH_CY + 24, 'left'],                    // CHA
    [CH_CX - 18, CH_CY + 24, 'right'],                   // DEX
    [CH_CX - 28, CH_CY - 5, 'right'],                    // CON
  ];
  STAT_NAMES.forEach((s, k) => {
    const [lx, ly, al] = CH_LAB[k];
    g.textAlign = al; g.fillText(STAT_LABEL[s], lx, ly);
  });
  g.textAlign = 'left';
  // the plot: wash first, then pen lines, then the dots on top. The outer
  // ring is 10 and so is the desk's cap (*"cap 10 for creation, un cap during
  // gameplay"*, 2026-08-15 — `specStep`), so no dot can outrun the paper;
  // only TRAINING passes 10, and this form is never on screen again by then.
  const plot = STAT_NAMES.map((s, k) => chVert((CH_R * stat(s)) / 10, k));
  g.fillStyle = 'rgba(43,63,126,0.14)';
  g.beginPath();
  plot.forEach(([px, py], k) => { if (k === 0) g.moveTo(px, py); else g.lineTo(px, py); });
  g.closePath(); g.fill();
  g.fillStyle = PEN;
  plot.forEach(([ax, ay], k) => {
    const [bx, by] = plot[(k + 1) % 5];
    pixLine(g, ax, ay, bx, by);
  });
  // the dots are the drag handles now — the held one swells under the pen
  plot.forEach(([px, py], k) => {
    if (k === dragK) g.fillRect(px - 2, py - 2, 4, 4);
    else g.fillRect(px - 1, py - 1, 2, 2);
  });

  // ── the fields ───────────────────────────────────────────────────────
  let y = ROW_Y;
  LINES.forEach((l, i) => {
    if (i === ROW_SIGN) {
      // the signature line — SIGNED IN INK, see `SIG_X0`, and OFF THE ROW
      // GRID at `SIGN_Y`, which is where the foot's air comes from. The
      // strokes, the ⌫ and the FILE box paint after this loop so
      // the pen lies over the print and the highlighter, never under.
      y = SIGN_Y;
      g.font = font(12); g.fillStyle = PEN;
      g.fillText('X', ROW_X, y + 1);
      g.fillStyle = PRINT_DK; g.fillRect(SIG_X0, y + 3, SIG_X1 - SIG_X0, 1);
      g.font = font(8); g.fillStyle = PRINT_DK;
      g.fillText('APPLICANT SIGNATURE', ROW_X + 24, y + 11);
      // unspent aptitude points, flagged where a clerk would flag them — in
      // the office's own red, right-aligned in its own clear band of the
      // ladder (see `SIGN_Y`), four texels under the chart's labels and two
      // above the ink. Signing anyway is allowed; an average man is 5s
      // across the board.
      const pts = pointsLeft();
      if (pts > 0) {
        g.fillStyle = STAMP_RED;
        g.textAlign = 'right';
        g.fillText(`${pts} PTS TO PLACE`, LINE_R, SIGN_Y - 12);
        g.textAlign = 'left';
      }
    } else if (i >= ROW_STAT0) {
      // an aptitude row: same label, a SHORT rule (the chart owns the right
      // of this section), and the digit CENTRED on its rule — the mouse
      // steps a row by its halves now (left of centre down, right up), so
      // the value sits on the seam between the two
      g.font = font(8); g.fillStyle = PRINT_DK;
      g.fillText(l.label, ROW_X, y);
      g.fillStyle = RULE; g.fillRect(VAL_X - 2, y + 3, STAT_R - VAL_X + 2, 1);
      fitText(g, l.value(), VAL_X + 8, y, 14, 9, TYPED, true);
    } else {
      g.font = font(8); g.fillStyle = PRINT_DK;
      g.fillText(l.label, ROW_X, y);
      if (i === ROW_HAND) {
        checkbox(g, VAL_X, y - 8, setting('hand') === 'left');
        checkbox(g, VAL_X + 30, y - 8, setting('hand') !== 'left');
        g.font = font(8); g.fillStyle = PRINT_DK;
        g.fillText('L', VAL_X + 11, y);
        g.fillText('R', VAL_X + 41, y);
      } else if (i === ROW_NAME) {
        // the name is TYPED, so it stays left-aligned at the pen's start
        g.fillStyle = RULE; g.fillRect(VAL_X - 2, y + 3, LINE_R - VAL_X + 2, 1);
        const v = sel === 0 ? `${l.value()}_` : l.value();
        fitText(g, v, VAL_X + 2, y, LINE_R - VAL_X - 4, 9, TYPED);
      } else {
        // a trait row: value centred on the rule, same seam as the aptitudes
        g.fillStyle = RULE; g.fillRect(VAL_X - 2, y + 3, LINE_R - VAL_X + 2, 1);
        fitText(g, l.value(), (VAL_X + LINE_R) / 2, y, LINE_R - VAL_X - 24, 9, TYPED, true);
      }
    }
    // ── the stepper's ◀ ▶, printed at the ends of every steppable rule,
    // ALWAYS — *"i want to be able to click and change the options
    // intuitively"* (2026-08-24). A control you can only find by hovering
    // is a hidden hit zone, which is the jank he named; a printed arrow is
    // a button anyone's first click finds.
    if (i >= ROW_TRAIT0 && i < ROW_SIGN) {
      // the ◀ sits a step further left on aptitude rows: their short rule
      // has to seat ◀ 10 ▶ with air, and their labels (INT, STR…) are short
      // enough to spare it — trait labels (HAIR COL) are not
      const rr = i >= ROW_STAT0 ? STAT_R : LINE_R;
      g.font = font(8); g.fillStyle = PRINT_DK;
      g.textAlign = 'right';
      g.fillText('◀', i >= ROW_STAT0 ? VAL_X - 6 : VAL_X + 5, y);
      g.fillText('▶', rr, y);
      g.textAlign = 'left';
    }
    // ── the highlighter, on whichever field is in hand ───────────────
    // two overlapping strokes at low alpha, offset a texel, because one clean
    // rectangle is a UI and two lazy passes are a marker. On an aptitude row
    // the swipe stops where its rule does — a marker dragged across the
    // chart would say the CHART is in hand, and it is not.
    if (i === sel) {
      const swR = i >= ROW_STAT0 && i !== ROW_SIGN ? STAT_R + 4 : LINE_R;
      g.fillStyle = 'rgba(255,222,74,0.30)';
      g.fillRect(ROW_X - 4, y - 9, swR - ROW_X + 6, 12);
      g.fillRect(ROW_X - 2, y - 8, swR - ROW_X + 2, 12);
    }
    y += ROW_H;
  });

  // ── the signature's ink, over everything the pen would lie over ──────
  sigPad.paint(g, PEN);
  // the ⌫ at the line's right end, only once there is ink — click to re-sign
  if (!sigPad.blank()) paintBackspace(g, CLR_X0 + 2, CLR_Y0 + 1, STAMP_RED);
  // the FILE box, office red, up only when the ink counts — see `SIG_MIN`
  if (sigPad.signed()) {
    g.fillStyle = STAMP_RED;
    for (let dx = FILE_X0; dx < FILE_X1; dx += 4) {       // dashed border
      g.fillRect(dx, FILE_Y0, 2, 1); g.fillRect(dx, FILE_Y1, 2, 1);
    }
    for (let dy = FILE_Y0; dy < FILE_Y1; dy += 4) {
      g.fillRect(FILE_X0, dy, 1, 2); g.fillRect(FILE_X1, dy, 1, 2);
    }
    g.font = font(8);
    g.textAlign = 'center';
    g.fillText('FILE', (FILE_X0 + FILE_X1) / 2, FILE_Y1 - 3);
    g.textAlign = 'left';
  }

  // small print — the only instructions, and they are the form's own, in
  // the ladder's own clear band (see `SIGN_Y`). Dark print, not the old
  // faint — *"make sure all text is readable"* (2026-08-24)
  fitText(g, '▲▼ ◀▶ · DRAG CHART · ENTER SIGN', ROW_X, 230, LINE_R - ROW_X, 8, PRINT_DK);

  // ── the photo ────────────────────────────────────────────────────────
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(PH_X + 3, PH_Y + 3, PH_W, PH_H);
  g.fillStyle = FILM;
  g.fillRect(PH_X, PH_Y, PH_W, PH_H);
  // the picture: a cold wall with height ticks, a floor, and him on it —
  // clipped to the frame so VERY TALL crops like a photo instead of spilling
  // onto the film border
  g.save();
  g.beginPath(); g.rect(IMG_X, IMG_Y, IMG_W, IMG_H); g.clip();
  g.fillStyle = WALL; g.fillRect(IMG_X, IMG_Y, IMG_W, IMG_H);
  g.fillStyle = WALL_TICK;
  for (let ty = IMG_Y + IMG_H - 16; ty > IMG_Y + 4; ty -= 12) {
    g.fillRect(IMG_X, ty, ((IMG_Y + IMG_H - 16 - ty) / 12) % 2 === 0 ? 8 : 5, 1);
  }
  g.fillStyle = FLOOR; g.fillRect(IMG_X, IMG_Y + IMG_H - 14, IMG_W, 14);
  // HIM, PAINTED BY THE MIRROR'S OWN PAINTER — see the header. Origins are
  // integers, which `body.ts`'s blur lesson made non-negotiable.
  paintFigure(g,
    IMG_X + Math.round((IMG_W - 40 * FIG_S) / 2),
    FOOT_Y - Math.round(146 * FIG_S),
    FIG_S, FACING);
  g.restore();
  // the name, hand-written on the film's bottom border in pen — that is
  // where a name goes on a photo, and it is written as he types it
  const n = name.trim();
  if (n) fitText(g, n, PH_X + PH_W / 2, PH_Y + PH_H - 10, PH_W - 14, 9, PEN, true);
}

function paint(): void {
  const g = cv?.getContext('2d');
  if (!g || !active) return;
  // paint in layout texels on the 2x store — see `SS`
  g.setTransform(SS, 0, 0, SS, 0, 0);
  paintCreate(g);
}

function build(): void {
  if (wrap) return;
  wrap = document.createElement('div');
  wrap.id = 'ct-create';
  // z 45: above the OSD's own 40. Nothing may be in front of this while it is
  // up, because it is the only thing on screen that is being asked a question.
  wrap.style.cssText = 'position:fixed;inset:0;z-index:45;display:none;'
    + 'background:#000;align-items:center;justify-content:center;';
  cv = document.createElement('canvas');
  // 2x backing store, 320x240 layout — the type clarity fix, see `SS`
  cv.width = OW * SS; cv.height = OH * SS;
  cv.style.cssText = 'image-rendering:pixelated;display:block;'
    + 'width:min(100vw,133vh);height:min(75vw,100vh);';
  wrap.appendChild(cv);
  document.body.appendChild(wrap);
}

/**
 * ── LEAVING, AND WHY ESCAPE IS ONE OF THE WAYS ────────────────────────────
 *
 * **ESCAPE FINISHES AND DROPS YOU INTO THE WORLD.** That is the choice, and it
 * is made against this project's worst bug: *"a panel you cannot close"*. The
 * alternatives were both worse. Escape doing NOTHING leaves a full-screen desk
 * with one way out, and if the signature line ever fails to draw he is stuck
 * in front of the game he opened. Escape CANCELLING has nothing to cancel back
 * to — there is no world behind this that he was in a moment ago.
 *
 * And it costs nothing, because **there is no invalid character**. Every state
 * this form can be in is a dressed person, and a blank name is a blank name,
 * which the menu simply does not print. Escaping out of creation gives you the
 * defaults, which is precisely what NEW GAME gave you yesterday.
 */
function finish(): void {
  if (!active) return;
  active = false;
  setName(name.trim());
  put(CREATED, '1');
  drop(PENDING);
  if (wrap) wrap.style.display = 'none';
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('wheel', onWheel, true);
  window.removeEventListener('click', onClick, true);
  window.removeEventListener('mousedown', onDown, true);
  window.removeEventListener('mousemove', onMove, true);
  window.removeEventListener('mouseup', onUp, true);
}

/**
 * THE WHEEL DOES NOTHING HERE ANY MORE — *"dont allow for rotation in the
 * mirror and in the character create screen pls."* (2026-08-09). It used to
 * re-take the photo at the next of the eight facings. The listener STAYS,
 * as a swallow: this screen is the only thing being asked a question, and a
 * scroll leaking through it to whatever the world binds the wheel to would
 * be an input with an invisible effect.
 */
function onWheel(e: WheelEvent): void {
  if (!active) return;
  e.stopImmediatePropagation();
  e.preventDefault();
}

/** letters, digits, space, `_` and `-`, up to 20 — the same shape `ct/save.ts`
 *  accepts for a username, so a name typed here can never be one the server
 *  would refuse. */
const NAME_CH = /^[A-Za-z0-9 _-]$/;
const NAME_MAX = 20;

function onKey(e: KeyboardEvent): void {
  if (!active) return;
  const k = e.key.toLowerCase();
  if (k === 'escape' || k === 'enter') {
    // Enter on any row but the signature steps it; Enter on the signature —
    // auto-scrawling first if the line is blank, see `autoScrawl` — and
    // Escape from anywhere, leaves. See `finish`.
    if (k === 'escape') { finish(); }
    else if (sel === ROW_SIGN) { if (!sigPad.signed()) sigPad.autoScrawl(); finish(); }
    else if (sel !== 0) LINES[sel].step(1);
    else sel = Math.min(sel + 1, LINES.length - 1);
  } else if (k === 'arrowup') sel = (sel + LINES.length - 1) % LINES.length;
  else if (k === 'arrowdown') sel = (sel + 1) % LINES.length;
  else if (k === 'arrowright') LINES[sel].step(1);
  else if (k === 'arrowleft') LINES[sel].step(-1);
  else if (k === 'backspace') { sel = 0; name = name.slice(0, -1); }
  else if (e.key.length === 1 && NAME_CH.test(e.key)) {
    // ⚠ NO `W`/`S` ALIASES ON THIS SCREEN, and typing anywhere jumps to the
    // name. The menu can afford WASD because nothing there takes text; here a
    // `w` has to be a `w`. And a player who selects a trait row and starts
    // typing his name — which is the first thing anyone does — must see letters
    // appear rather than nothing at all, so the row follows the typing.
    sel = 0;
    if (name.length < NAME_MAX) name += e.key;
  } else return;
  // ⚠ CAPTURE PHASE AND `stopImmediatePropagation`, and it is load-bearing:
  // `src/main.ts` switches PROTO on `z`, `x` and any digit, and `fp.ts` walks
  // on WASD. Without this, typing "Max" would leave CROSSTOWN entirely.
  e.stopImmediatePropagation();
  e.preventDefault();
  if (active) paint();
}

/** a mouse event in canvas texels — the one mapping all four pointer
 *  handlers share, so they cannot disagree about where the pen is */
function at(e: MouseEvent): { x: number; y: number } {
  const r = cv!.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (OW / r.width),
    y: (e.clientY - r.top) * (OH / r.height),
  };
}

/**
 * ── THE PEN, AND THE HAND ON THE CHART ────────────────────────────────────
 * Down inside the signature box starts a stroke; down on the ⌫ clears it;
 * down on the chart — a dot's halo first, the disc's angle otherwise —
 * PICKS UP that stat's point, and the pen drags it along its spoke until
 * mouseup (`dragTo` above walks the value through `specStep`, so the pool
 * and the cap hold). Everything is swallowed — this screen is modal.
 */
function onDown(e: MouseEvent): void {
  if (!active || !cv) return;
  const { x, y } = at(e);
  e.stopImmediatePropagation();
  e.preventDefault();
  if (!sigPad.blank() && x >= CLR_X0 && x < CLR_X1 && y >= CLR_Y0 && y <= CLR_Y1) {
    sigPad.clear();
    paint();
    return;
  }
  const k = vertexAt(x, y) ?? axisAt(x, y);
  if (k !== null) {
    // the grab selects the row too, so the sheet and the chart agree about
    // what is in hand. Nothing moves until the pen does — a click that
    // lands and lifts on the same spot changes no number.
    dragK = k;
    sel = ROW_STAT0 + k;
    cv.style.cursor = 'grabbing';
    paint();
    return;
  }
  if (sigPad.down(x, y)) {
    sel = ROW_SIGN;
    paint();
  }
}

function onMove(e: MouseEvent): void {
  if (!active || !cv) return;
  const { x, y } = at(e);
  if (dragK !== null) {
    e.stopImmediatePropagation();
    e.preventDefault();
    dragTo(x, y);
    return;
  }
  if (sigPad.move(x, y)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    paint();
    return;
  }
  updateHover(x, y);
}

function onUp(e: MouseEvent): void {
  if (!active) return;
  if (dragK !== null) {
    dragK = null;
    justDragged = true;                      // the click that follows is spent
    e.stopImmediatePropagation();
    e.preventDefault();
    const { x, y } = at(e);
    updateHover(x, y);
    paint();
    return;
  }
  if (sigPad.up()) { e.stopImmediatePropagation(); e.preventDefault(); }
}

/**
 * The cursor tells the truth about what is under it — *"lets make this
 * nice!"* (2026-08-24): a grab hand over the chart, a pointer over anything
 * clickable, the I-beam over the name, crosshair over the signature box.
 * Hover never swallows the event — it only looks.
 */
function updateHover(x: number, y: number): void {
  let cur = 'default';
  if (vertexAt(x, y) !== null || axisAt(x, y) !== null) {
    cur = 'grab';
  } else if (!sigPad.blank() && x >= CLR_X0 && x < CLR_X1 && y >= CLR_Y0 && y <= CLR_Y1) {
    cur = 'pointer';
  } else if (sigPad.signed() && x >= FILE_X0 && x <= FILE_X1 && y >= FILE_Y0 && y <= FILE_Y1) {
    cur = 'pointer';
  } else if (x >= SIG_X0 && x <= SIG_X1 && y >= SIG_Y0 && y <= SIG_Y1) {
    cur = 'crosshair';
  } else if (x >= PAPER_X && x < PAPER_X + PAPER_W && y < SIG_Y0) {
    const i = Math.floor((y - (ROW_Y - 10)) / ROW_H);
    if (i >= 0 && i < ROW_SIGN) cur = i === ROW_NAME ? 'text' : 'pointer';
  }
  if (cv) cv.style.cursor = cur;
}

/**
 * ONE CLICK, ONE ANSWER — *"i want to be able to click and change the
 * options intuitively"* (2026-08-24). No select-then-step two-tap any more:
 * ◀ steps down, the value or ▶ steps on, the L and R boxes are the boxes
 * they look like, and clicking anything also puts it in hand. The photo is
 * INERT (it used to turn him — see `onWheel`); the chart belongs to the
 * DRAG (`onDown`), so a click there is a fumbled grab and does nothing; the
 * signature band is the pen's, so a click there only selects the row — FILE
 * is what submits, and only once the ink counts.
 */
function onClick(e: MouseEvent): void {
  if (!active || !cv) return;
  const { x, y } = at(e);
  e.stopImmediatePropagation();
  e.preventDefault();
  if (justDragged) { justDragged = false; return; }
  if (x >= PH_X && x < PH_X + PH_W && y >= PH_Y && y < PH_Y + PH_H) return;
  if (sigPad.signed() && x >= FILE_X0 && x <= FILE_X1 && y >= FILE_Y0 && y <= FILE_Y1) {
    finish();
    return;
  }
  if (vertexAt(x, y) !== null || axisAt(x, y) !== null) return;
  if (y >= SIG_Y0) {
    if (sel !== ROW_SIGN) { sel = ROW_SIGN; paint(); }
    return;
  }
  if (x < PAPER_X || x >= PAPER_X + PAPER_W) return;   // the desk is not a control
  const i = Math.floor((y - (ROW_Y - 10)) / ROW_H);
  if (i < 0 || i >= ROW_SIGN) return;
  sel = i;
  if (i === ROW_HAND) {
    // the checkboxes ARE the control: L's box and its letter, R's box and
    // its letter; a click elsewhere on the row flips it, which is the only
    // other thing a two-state row could mean
    if (x >= VAL_X - 4 && x < VAL_X + 24) setHand('left');
    else if (x >= VAL_X + 26 && x < VAL_X + 52) setHand('right');
    else LINES[i].step(1);
  } else if (i >= ROW_TRAIT0) {
    // ◀ under the cursor steps back; the value or the ▶ steps on — the
    // zones are exactly where the printed arrows sit, nothing hidden
    const rr = i >= ROW_STAT0 ? STAT_R : LINE_R;
    if (i >= ROW_STAT0) LINES[i].step(x < (VAL_X + rr) / 2 ? -1 : 1);
    else LINES[i].step(x <= VAL_X + 8 ? -1 : 1);
  }
  if (active) paint();
}

function start(): void {
  if (active) return;
  build();
  active = true;
  sel = 0;
  sigPad.clear();
  name = setting('name') || '';
  // *"start them in some unisex boring outfit."* — and it has to happen HERE
  // rather than at module load, because `ct-wardrobe` is its own storage key
  // and survives NEW GAME clearing the save. Without this you begin your new
  // life in the last character's jacket. See `STARTING` in `ct/wardrobe.ts`.
  resetOutfit();
  wrap!.style.display = 'flex';
  // capture, so this sees every key before the world, the proto switcher and
  // the OSD do — and `registerOsdBusy` below covers the one case ordering
  // cannot: a listener registered before this one.
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('wheel', onWheel, { capture: true, passive: false });
  window.addEventListener('click', onClick, true);
  window.addEventListener('mousedown', onDown, true);
  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('mouseup', onUp, true);
  paint();
}

/**
 * Called from `crosstown.ts` beside `installOsd()`.
 *
 * THE WORLD IS ALREADY BUILT AND RUNNING BEHIND THIS, deliberately. Gating the
 * first frame on a creation screen would mean editing the trunk's build order
 * for a screen that is up for twenty seconds once — and it would put a black
 * page behind anything that went wrong in here. A desk over a live world is
 * the same trick the menu already plays with its blue field.
 */
export function installCreate(): void {
  registerOsdBusy(creating);
  if (wanted()) start();
}

// a hook for a probe, and for getting back in without clearing storage by hand
(window as unknown as { __create: unknown }).__create = {
  start, finish, active: () => active,
  reset: () => { drop(CREATED); drop(PENDING); },
};
