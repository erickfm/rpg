// ══ CHARACTER CREATION — THE FORM ON THE DESK ═══════════════════════════════
//
// *"new game should put me into character create menu no? what happened to
//  character create?"*   (2026-08-05)
//
// *"character creation looks so bad i hate the aesthetic, try another based off
//  of everything you know about my tastes in this game and this work you've
//  done with me. think a lot"*   (2026-08-08)
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
//     instant-film frame — scroll and the photo is re-taken at another angle
//   · the name you type is hand-written on the photo's bottom border in blue
//     pen, because that is where a name goes on a photo
//   · HAND is two checkboxes, the selected field is a yellow HIGHLIGHTER
//     swipe, and BEGIN is the signature line at the foot
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
// draws the photo, at the same eight facings. There is one figure in this game.
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
/** which way he is standing in the photo, 0…7 — `viewAt`'s own eight stops,
 *  the same ones the mirror scrolls through, so he never lands between two
 *  painted angles. */
let facing = 0;
let sel = 0;
let name = '';

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
    step: () => finish(),
  },
];

/** row indexes the painter treats specially */
const ROW_NAME = 0, ROW_HAND = 1, ROW_SIGN = LINES.length - 1;
/** first aptitude row — these get the short rule and the narrow highlighter */
const ROW_STAT0 = 2 + TRAITS.length;

// ── THE DESK, THE PAPER, THE PHOTO — every number is a texel ───────────────
//
// One 320x240 nearest-filtered canvas, the same trick as every readable
// surface in this project — but the field is a desk, not a signal.

/** the paper sheet — US-letter proportions, and deliberately NOT square */
const PAPER_X = 14, PAPER_Y = 8, PAPER_W = 172, PAPER_H = 224;
/** rows: baselines down the form. Uniform, because the click map divides by
 *  it. 13 px and not the old 17: SECTION II added five rows and a chart to
 *  the same sheet, and a second page would cost more than tighter type —
 *  this is still a municipal form, and municipal forms are cramped. */
const ROW_Y = 50, ROW_H = 13, ROW_X = 24;
/** where typed values start, and where the ruled lines run to */
const VAL_X = 70, LINE_R = PAPER_X + PAPER_W - 12;
/** aptitude rows stop their rule and highlighter here — the chart owns the
 *  right half of the section */
const STAT_R = 100;
/** the pentagon: centre and outer radius (a value of 10), sharing the section
 *  with the five short rows. Every plotted point is `Math.round`ed — the
 *  blur lesson (`ct/body.ts`) applies to a chart as much as to a photo. */
const CH_CX = 138, CH_CY = 172, CH_R = 26;
/** the instant photo — frame, then the image inset with the fat film bottom */
const PH_X = 196, PH_Y = 24, PH_W = 106, PH_H = 158;
const IMG_X = PH_X + 8, IMG_Y = PH_Y + 8, IMG_W = 90, IMG_H = 116;
/** the figure in it: feet on this canvas row, scaled so VERY TALL keeps his
 *  head inside the frame (146 design units of foot line x 0.65 x 1.08 = 103) */
const FIG_S = 0.65, FOOT_Y = IMG_Y + IMG_H - 10;

// the palette: the world's paper on VOLT VILLAGE's oak, print in the boards'
// own brown, values in typewriter black, the pen in ballpoint blue
const OAK = '#7a5936', OAK_ALT = '#755231', OAK_JOINT = '#5c3e22';
const PAPER = '#f2ead0', PAPER_EDGE = '#d9cdac';
const PRINT = '#8a7c5e', PRINT_DK = '#4a3a2b', RULE = '#c9bc9a', FAINT = '#a4977a';
const TYPED = '#2f2a22';
const PEN = '#2b3f7e';
const STAMP_RED = '#a03428';
const WALL = '#98a3ac', WALL_TICK = '#87919b', FLOOR = '#7b848d';
const FILM = '#f6f3ea';

/** grain on the desk — SEEDED, not random, so a repaint on every keypress
 *  does not shimmer. One table for the life of the page. */
const FLECKS: { x: number; y: number; w: number; c: string }[] = (() => {
  let r = 1997;
  const nx = () => (r = (r * 48271) % 2147483647) / 2147483647;
  const out = [];
  for (let i = 0; i < 90; i++) {
    out.push({
      x: Math.floor(nx() * OW), y: Math.floor(nx() * OH),
      w: 5 + Math.floor(nx() * 10),
      c: nx() > 0.5 ? '#6b4a2c' : '#84603c',
    });
  }
  return out;
})();

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

/** a 1 px line plotted a texel at a time (Bresenham) — the chart's rings and
 *  pen strokes go through here so the one instrument on the sheet has the
 *  same hard pixels as the type around it. Caller sets `fillStyle`. */
function pixLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** vertex k of a pentagon of radius r — k 0 at the top, then clockwise, the
 *  same order as the five rows: INT up, STR, CHA, DEX, CON. Rounded HERE so
 *  rings, spokes, plot and dots all agree on the same texel. */
function chVert(r: number, k: number): [number, number] {
  const a = -Math.PI / 2 + k * (2 * Math.PI / 5);
  return [Math.round(CH_CX + r * Math.cos(a)), Math.round(CH_CY + r * Math.sin(a))];
}

/** an X in a checkbox, drawn a pixel at a time — a diagonal through the
 *  antialiaser would be the one soft edge on the sheet */
function checkbox(g: CanvasRenderingContext2D, x: number, y: number, on: boolean): void {
  g.fillStyle = PRINT;
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
  for (const f of FLECKS) { g.fillStyle = f.c; g.fillRect(f.x, f.y, f.w, 1); }

  // ── the form ─────────────────────────────────────────────────────────
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(PAPER_X + 3, PAPER_Y + 3, PAPER_W, PAPER_H);
  g.fillStyle = PAPER;
  g.fillRect(PAPER_X, PAPER_Y, PAPER_W, PAPER_H);
  g.fillStyle = PAPER_EDGE;
  g.fillRect(PAPER_X, PAPER_Y + PAPER_H - 1, PAPER_W, 1);
  g.fillRect(PAPER_X + PAPER_W - 1, PAPER_Y, 1, PAPER_H);

  // letterhead — what the form is, said once, by the form
  fitText(g, 'CITY OF CROSSTOWN', PAPER_X + PAPER_W / 2, 24, PAPER_W - 20, 10, PRINT_DK, true);
  fitText(g, 'RESIDENT CARD APPLICATION', PAPER_X + PAPER_W / 2, 34, PAPER_W - 20, 8, PRINT, true);
  g.fillStyle = PRINT_DK; g.fillRect(PAPER_X + 10, 38, PAPER_W - 20, 2);
  g.fillStyle = RULE; g.fillRect(PAPER_X + 10, 41, PAPER_W - 20, 1);
  g.font = font(8); g.fillStyle = STAMP_RED;
  g.textAlign = 'right'; g.fillText('FORM R-9', LINE_R, 16); g.textAlign = 'left';

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
  for (let v = 2; v <= 10; v += 2) {                     // rings at 2,4,6,8,10
    g.fillStyle = v === 10 ? PRINT : RULE;
    for (let k = 0; k < 5; k++) {
      const [ax, ay] = chVert((CH_R * v) / 10, k);
      const [bx, by] = chVert((CH_R * v) / 10, (k + 1) % 5);
      pixLine(g, ax, ay, bx, by);
    }
  }
  // axis labels, in the form's small print, at the five points
  g.font = font(8); g.fillStyle = PRINT;
  const CH_LAB: [number, number, CanvasTextAlign][] = [
    [CH_CX, CH_CY - CH_R - 4, 'center'],                 // INT, above the top
    [CH_CX + 28, CH_CY - 5, 'left'],                     // STR
    [CH_CX + 18, CH_CY + 30, 'left'],                    // CHA
    [CH_CX - 18, CH_CY + 30, 'right'],                   // DEX
    [CH_CX - 28, CH_CY - 5, 'right'],                    // CON
  ];
  STAT_NAMES.forEach((s, k) => {
    const [lx, ly, al] = CH_LAB[k];
    g.textAlign = al; g.fillText(STAT_LABEL[s], lx, ly);
  });
  g.textAlign = 'left';
  // the plot: wash first, then pen lines, then the dots on top
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
  for (const [px, py] of plot) g.fillRect(px - 1, py - 1, 2, 2);

  // ── the fields ───────────────────────────────────────────────────────
  let y = ROW_Y;
  LINES.forEach((l, i) => {
    if (i === ROW_SIGN) {
      // the signature line. Signing it is BEGIN — see `finish`.
      g.font = font(12); g.fillStyle = PEN;
      g.fillText('X', ROW_X, y + 1);
      g.fillStyle = PRINT_DK; g.fillRect(ROW_X + 14, y + 3, LINE_R - ROW_X - 14, 1);
      g.font = font(8); g.fillStyle = RULE;
      g.fillText('APPLICANT SIGNATURE', ROW_X + 14, y + 13);
      // unspent aptitude points, flagged where a clerk would flag them — in
      // the office's own red, sitting ON the empty end of the line you are
      // about to sign (the label below is wide; the line above is blank).
      // Signing anyway is allowed; an average man is 5s across the board.
      const pts = pointsLeft();
      if (pts > 0) {
        g.fillStyle = STAMP_RED;
        g.fillText(`${pts} PTS TO PLACE`, ROW_X + 18, y + 1);
      }
    } else if (i >= ROW_STAT0) {
      // an aptitude row: same label, a SHORT rule (the chart owns the right
      // of this section), and the value is one typed digit
      g.font = font(8); g.fillStyle = PRINT;
      g.fillText(l.label, ROW_X, y);
      g.fillStyle = RULE; g.fillRect(VAL_X - 2, y + 3, STAT_R - VAL_X + 2, 1);
      fitText(g, l.value(), VAL_X + 2, y, STAT_R - VAL_X - 4, 9, TYPED);
    } else {
      g.font = font(8); g.fillStyle = PRINT;
      g.fillText(l.label, ROW_X, y);
      if (i === ROW_HAND) {
        checkbox(g, VAL_X, y - 8, setting('hand') === 'left');
        checkbox(g, VAL_X + 30, y - 8, setting('hand') !== 'left');
        g.font = font(8); g.fillStyle = PRINT;
        g.fillText('L', VAL_X + 11, y);
        g.fillText('R', VAL_X + 41, y);
      } else {
        g.fillStyle = RULE; g.fillRect(VAL_X - 2, y + 3, LINE_R - VAL_X + 2, 1);
        const v = i === ROW_NAME && sel === 0 ? `${l.value()}_` : l.value();
        fitText(g, v, VAL_X + 2, y, LINE_R - VAL_X - 4, 9, TYPED);
      }
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

  // small print — the only instructions, and they are the form's own
  fitText(g, '▲▼ FIELD  ◀▶ CHANGE  SCROLL TURN  ENTER SIGN', ROW_X, 229, LINE_R - ROW_X, 8, FAINT);

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
    FIG_S, facing);
  g.restore();
  // the name, hand-written on the film's bottom border in pen — that is
  // where a name goes on a photo, and it is written as he types it
  const n = name.trim();
  if (n) fitText(g, n, PH_X + PH_W / 2, PH_Y + PH_H - 10, PH_W - 14, 9, PEN, true);

  // a ballpoint on the desk, waiting for the signature
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(224, 205, 46, 3);
  g.fillStyle = PEN; g.fillRect(226, 202, 36, 4);
  g.fillStyle = '#d8d4cc'; g.fillRect(262, 203, 6, 2);
  g.fillStyle = '#9a9690'; g.fillRect(268, 203, 2, 2);
}

function paint(): void {
  const g = cv?.getContext('2d');
  if (!g || !active) return;
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
  cv.width = OW; cv.height = OH;
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
    // Enter on any row but the signature steps it; Enter on the signature,
    // and Escape from anywhere, leaves. See `finish`.
    if (k === 'escape' || sel === ROW_SIGN) { finish(); }
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

/** *"scroll to turn self in mirror?"* — the same eight stops, here too: the
 *  photo is re-taken at the next angle */
function onWheel(e: WheelEvent): void {
  if (!active) return;
  facing = (facing + (e.deltaY > 0 ? 1 : -1) + 8) % 8;
  e.stopImmediatePropagation();
  e.preventDefault();
  paint();
}

/** click a field to select it, click it again to step it — and a click on the
 *  photo turns him, the pointer's copy of the scroll */
function onClick(e: MouseEvent): void {
  if (!active || !cv) return;
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * (OW / r.width);
  const y = (e.clientY - r.top) * (OH / r.height);
  e.stopImmediatePropagation();
  e.preventDefault();
  if (x >= PH_X && x < PH_X + PH_W && y >= PH_Y && y < PH_Y + PH_H) {
    facing = (facing + 1) % 8;
    paint();
    return;
  }
  const i = Math.floor((y - (ROW_Y - 10)) / ROW_H);
  if (i < 0 || i >= LINES.length) return;
  if (i === sel) LINES[sel].step(1); else sel = i;
  if (active) paint();
}

function start(): void {
  if (active) return;
  build();
  active = true;
  sel = 0; facing = 0;
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
