import * as THREE from 'three';
import { BUILD, type CtxBuild } from './ctx';
import { declareSurface, pixTex } from './paint';
import { APT_X0, APT_Z0, ST0 } from './apartment';
import { citizenSprite } from './citizens';
import { UI, makePanel, type Panel } from './hud';

// ── TENANCY ───────────────────────────────────────────────────────────────
//
// You live at 301. That has been true since the world had a spawn point, and
// nothing has ever asked anything of you for it. This is the other half:
//
//   *"rent that must be paid to a landlord, and letters waiting at the
//    mailboxes when he comes in off the street"*
//
// The letters come first, and that ordering is the desk's: **the letters are
// how he finds out he owes rent.** A landlord who materialises in the lobby
// demanding money you were never told about is a bug with a face on it. So the
// notice arrives in a box you can see from the front door, and the man comes
// afterwards.
//
// ── WHAT THIS FILE DOES NOT OWN ───────────────────────────────────────────
//
// The BUILDING is C's (`ct/apartment.ts`) and the MONEY is K's (`ct/hud.ts`'s
// `Purse`, spent through `ctx.purse` the way `ct/int-bodega.ts` spends it).
// Neither is edited here and neither is duplicated here — there is exactly one
// wallet in this world and this file is not a second one.
//
// C already built the bank of boxes: a real box with 0.10 m of carcass and a
// painted 3 x 4 grid of doors, standing on the east wall a metre inside the
// front door, because *"a bank of mailboxes is the one thing in a walk-up lobby
// you stand right beside"*. It was dressing. This gives one of those twelve
// doors — yours — a lock, a hinge, a name card and something behind it.
//
// ── THE CLOCK RULE ────────────────────────────────────────────────────────
//
// Rent is a clock feature, and in this world the clock does not merely tick:
// `ctx.clock.advance()` moves it eight hours in a second and a half when you
// sleep, and `__ct.clock(h, m)` snaps it. So NOTHING HERE ACCUMULATES. Every
// quantity below is a pure function of `ctx.clock.now().totalMin`:
//
//     what day is it            floor(totalMin / 1440)
//     what is in the box        mailFor(day) for every day since you last looked
//     what do you owe           the due dates that have passed, less what you paid
//
// A per-frame `if (hour === 11) deliverTheMail()` would drop a day whenever the
// player slept straight past eleven o'clock — which is EVERY night, since
// sleeping runs to 07:00 the following morning through a ramp that can cross
// several hours in one frame. Deriving instead of accumulating makes sleeping
// through a week and walking through a week the same code path, and it is the
// only version that can be tested by snapping the clock (GOTCHAS §30: the
// render loop advances in frames, not milliseconds).

export const ORDER = BUILD.PROPS + 6;      // after ct/inventory.ts (+5) adopts its litter

// ── the lease ─────────────────────────────────────────────────────────────

/**
 * The terms, in one place, because every one of them is quoted somewhere the
 * player can read it and a number that appears in two places will disagree.
 *
 * $45 a week is a 1997 walk-up studio at the cheap end, and it is set against
 * the economy that exists rather than against realism: you start with $14.50
 * (`crosstown.ts`) and a box of cereal costs $2.50 (`ct/int-bodega.ts`). A
 * realistic $325 a month would be a debt you could never clear, which is a
 * failure state rather than a feature. Tune it here.
 *
 * FIRST DUE ON DAY 2, weekly after that. The game opens at 13:20 on day 0, so
 * a purely weekly cycle would put the first demand two and a half real hours
 * away and nobody would ever see it. Day 2 says you moved in most of a week
 * ago, which is also why there is already a notice in the box the first time
 * you walk in.
 */
export const RENT = {
  amount: 45,
  /** the first rent day */
  firstDay: 2,
  /** and every this-many days after it */
  everyDays: 7,
  /** the notice lands this many days before the money is due */
  noticeLead: 2,
  /** the flat, the landlord, and the man's name on the bottom of the notice */
  flat: '301',
  landlord: 'V. OKONKWO',
  building: 'No. 227',
} as const;

/** The `n`th rent day, counting from 0. Day 2, 9, 16, 23 … */
export function dueDay(n: number): number { return RENT.firstDay + n * RENT.everyDays; }

/** How many rent days have arrived by `day` — i.e. `dueDay(n) <= day` for n < this. */
export function duePeriodsBy(day: number): number {
  if (day < RENT.firstDay) return 0;
  return Math.floor((day - RENT.firstDay) / RENT.everyDays) + 1;
}

// ── the tenancy's own state ───────────────────────────────────────────────
//
// Three numbers, and they are the only things in this file that are remembered
// rather than derived. Session-scoped, like C's `doorShut` — this world has no
// save, and inventing one here would be a second thing to get wrong.

/** rent days settled so far. `paidPeriods === duePeriodsBy(day)` means square. */
let paidPeriods = 0;
/** the last day whose post you have taken out of the box. -1 = you never have. */
let collectedDay = -1;
/** mail you have taken but not thrown away, newest last. */
const HELD: Letter[] = [];
/** how many letters you keep before the old ones go out with the rest. */
const KEEP = 8;

/** What you owe right now, in dollars. */
export function owed(day: number): number {
  return Math.max(0, duePeriodsBy(day) - paidPeriods) * RENT.amount;
}

/**
 * Settle up, out of `ctx.purse`. Returns what actually changed hands.
 *
 * PARTIAL PAYMENT IS ALLOWED and it is deliberate: a landlord who will only
 * take the full amount turns "you are $3 short" into a locked door, and the
 * player has no way to see how close they were. Money moves in whole rent
 * periods, so paying $45 of a $90 arrears clears the older week and leaves the
 * newer one standing — which is what the second notice will then say.
 *
 * The landlord himself is the next item; this is the verb he will call, put
 * here now so the notice can quote a figure that is real rather than painted.
 */
export function payRent(ctx: CtxBuild, day: number): number {
  let paid = 0;
  while (owed(day) > 0 && ctx.purse.cash >= RENT.amount) {
    ctx.purse.cash = Math.round((ctx.purse.cash - RENT.amount) * 100) / 100;
    paidPeriods++;
    paid += RENT.amount;
  }
  if (paid > 0) ctx.refreshWallet();
  return paid;
}

// ── what comes through the door ───────────────────────────────────────────

export interface Letter {
  /** the day it was delivered — what sorts the pile and dates the notice */
  day: number;
  /** who it is from, printed across the top */
  from: string;
  /** the body, ALREADY BROKEN INTO LINES. Wrapping 8 px monospace at runtime
   *  is a solved problem nobody needs solved twice; these are written to fit. */
  lines: string[];
  /** a rent notice is graded differently — it gets the stamp and the figure */
  kind: 'rent' | 'late' | 'junk' | 'receipt' | 'hand';
}

/**
 * A deterministic 0…1 from a day and a salt.
 *
 * NOT `ct/rng.ts`. That stream's ORDER is load-bearing at BUILD time and one
 * extra draw moves every tree in the world (GOTCHAS §2). NOT `Math.random()`
 * either, which `ct/inventory.ts` correctly uses for a package roll — a package
 * is rolled once when you steal it, but the mail for a given day is asked for
 * repeatedly, every frame the box decides how many envelopes to show. Unseeded
 * there would make the post flicker.
 */
function hash01(day: number, salt: number): number {
  // Two rounds of xor-multiply. The first version of this was one round off a
  // plain `day * K + salt` and it looked fine — until the first five days it
  // was asked about all came back under 0.21 and the mailbox stood empty for
  // most of a week. A weak avalanche is invisible in the constants and obvious
  // in the world, and only counting the outcomes over 200 days found it.
  let h = Math.imul(day ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x165667b1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * The junk. 1997, and there is a lot of it — the user's standing note about
 * the television is *"lots of things so it doesnt get to repetative"*, and a
 * mailbox is the same problem: you open it every day.
 *
 * These are written as they would be printed, in their own voice, because the
 * joke of junk mail is the register rather than the content.
 */
const JUNK: { from: string; lines: string[] }[] = [
  { from: 'GRAND PRIZE CLEARING HOUSE', lines: [
    'MR OCCUPANT — YOU MAY ALREADY HAVE',
    'WON ONE (1) OF THESE PRIZES:',
    '   A. $1,000,000.00',
    '   B. A LUGGAGE SET',
    'RETURN THE GOLD SEAL IN 10 DAYS.',
  ] },
  { from: 'VIDEO 2000 — MEMBER SERVICES', lines: [
    'Our records show two (2) tapes',
    'overdue on your account. Late fees',
    'now stand at $6.50 and are rising.',
    'Please return them.',
  ] },
  { from: 'CITY LIGHT & POWER', lines: [
    'ACCOUNT 227-3-01',
    'AMOUNT DUE $18.44',
    'Meter read 04/11. Estimated.',
    'Late charge applies after the 28th.',
    'Do not send cash through the mail.',
  ] },
  { from: 'PALERMO PIZZA — 2 BLOCKS DOWN', lines: [
    'LARGE PIE + 2 SODAS ..... $9.99',
    'WE DELIVER TILL 2AM',
    'ASK ABOUT THE BUCKET OF WINGS',
    '(coupon expired 03/97)',
  ] },
  { from: 'A POSTCARD', lines: [
    'The weather here is exactly the',
    'same as the weather there. I have',
    'eaten nothing but shrimp.',
    'Back Thursday. Feed nothing.',
    '                        — DEB',
  ] },
  { from: 'HANDWRITTEN, NO STAMP', lines: [
    'BOILER OFF SATURDAY 8AM UNTIL IT',
    'IS FIXED. NO HOT WATER. SORRY.',
    'DO NOT CALL ME ABOUT IT.',
    '                  — THE SUPER',
  ] },
  { from: 'ADDRESSED TO 302', lines: [
    'A seed catalogue. Your neighbour',
    'has one window, it faces a wall,',
    'and he gets this every month',
    'without fail.',
  ] },
  { from: 'FIRST FEDERAL SAVINGS', lines: [
    'YOU ARE PRE-APPROVED for a line',
    'of credit up to $2,500 at a',
    'variable rate of 24.9% APR.',
    'No obligation. No fee.',
  ] },
  { from: 'CRIMEWATCH — 14TH PRECINCT', lines: [
    'THERE HAVE BEEN BREAK-INS ON',
    'THIS BLOCK. LOCK YOUR DOOR. DO',
    'NOT BUZZ ANYONE IN THAT YOU DO',
    'NOT KNOW.',
  ] },
  { from: 'THE MAIL-ORDER CATALOGUE', lines: [
    'Four hundred pages. Trainers,',
    'tube socks, a toaster, and a',
    'small appliance you cannot make',
    'out from the picture.',
  ] },
  { from: 'DR. R. HALVERSEN, D.D.S.', lines: [
    'THIS IS A REMINDER that you are',
    'due for a cleaning. Our records',
    'show your last visit was 1993.',
    'Please call for an appointment.',
  ] },
  { from: 'A CHAIN LETTER', lines: [
    'DO NOT BREAK THE CHAIN. Copy',
    'this letter twenty (20) times',
    'and send it on. A man in OHIO',
    'broke it and lost his job in',
    'nine days.',
  ] },
  { from: 'SOMEBODY ELSE ENTIRELY', lines: [
    'Wrong street, right number.',
    'Someone named MARGUERITE is',
    'owed $312 by a garage, and now',
    'you know that.',
  ] },
  { from: 'PENNY SAVER — WEEKLY', lines: [
    'CARS · APPLIANCES · ROOMS TO LET',
    '"1977 SEDAN, RUNS, $400 OBO"',
    '"WANTED: DRUMMER. NO TIMEWASTERS"',
    'Twelve pages, four classified.',
  ] },
];

/** Sunday. No delivery, and the box should feel like it has a week in it. */
function noDelivery(day: number): boolean { return day % 7 === 6; }

/**
 * Everything delivered on `day`, in the order it sits in the box.
 *
 * PURE — same day in, same letters out, for ever. That is what lets the box
 * decide how much post to show without remembering anything, and it is what
 * lets a check assert on tomorrow's mail without waiting for tomorrow.
 *
 * The one thing it is NOT pure in is the late notice, which asks what you have
 * paid. That is correct rather than a leak: a late notice for a week you went
 * and settled was never sent, so it should not be sitting in the box when you
 * come back down.
 */
function mailFor(day: number): Letter[] {
  const out: Letter[] = [];
  if (day < 0 || noDelivery(day)) return out;

  // the notice, `noticeLead` days before each rent day
  const n = (day - RENT.firstDay + RENT.noticeLead) / RENT.everyDays;
  if (Number.isInteger(n) && n >= 0) {
    const due = dueDay(n);
    out.push({
      day, kind: 'rent', from: `${RENT.landlord} — MANAGING AGENT`,
      lines: [
        `RE: APT ${RENT.flat}, ${RENT.building}`,
        '',
        `RENT OF $${RENT.amount.toFixed(2)} DUE IN ${RENT.noticeLead} DAYS.`,
        'I collect in person. I am in the',
        'hall or on the stairs. Cash only.',
        '',
        'Do not put it in the box.',
        `                      — ${RENT.landlord}`,
      ],
    });
  }

  // and one for every rent day that has gone by unpaid. Written the day after,
  // and again every third day, because a landlord who posts one every morning
  // is a landlord who fills your box with nothing else.
  const late = duePeriodsBy(day) - paidPeriods;
  if (late > 0) {
    const since = day - dueDay(duePeriodsBy(day) - 1);
    if (since > 0 && since % 3 === 1) {
      out.push({
        day, kind: 'late', from: `${RENT.landlord} — SECOND NOTICE`,
        lines: [
          `RE: APT ${RENT.flat}. ARREARS $${(late * RENT.amount).toFixed(2)}.`,
          '',
          `${since} DAY${since === 1 ? '' : 'S'} LATE. I have knocked.`,
          'I know you are in there — the light',
          'is on and the television is on.',
          '',
          'Find me. Do not make me find you.',
        ],
      });
    }
  }

  // …and the junk, nought to two pieces, which is what makes opening the box
  // worth doing on a day when nobody wants anything from you.
  // Measured over 200 days rather than assumed from the constants: 50 empty,
  // 82 with one piece, 40 with two. A box that is empty a third of the time is
  // what makes the days it is not worth walking down for.
  const count = hash01(day, 1) < 0.30 ? 0 : hash01(day, 2) < 0.72 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const j = JUNK[Math.floor(hash01(day, 11 + i * 7) * JUNK.length) % JUNK.length];
    if (out.some((l) => l.from === j.from)) continue;         // not twice in one day
    out.push({ day, kind: 'junk', from: j.from, lines: j.lines });
  }
  return out;
}

/**
 * What is in the box RIGHT NOW.
 *
 * Every day from the one after you last emptied it up to today, plus today's
 * only once the post has actually been. Sleep through four days and four days
 * of mail is waiting, without a single line of code knowing that you slept —
 * which is the whole argument for deriving it (see the clock rule above).
 */
function waiting(totalMin: number): Letter[] {
  const day = Math.floor(totalMin / 1440);
  const hour = (totalMin % 1440) / 60;
  const last = hour >= POST_HOUR ? day : day - 1;
  const out: Letter[] = [];
  // A cap on the walk-back, so a clock snapped to day 400 by a probe does not
  // build four hundred days of post. Two weeks is more than a player can
  // accumulate by sleeping and it keeps the loop honestly bounded.
  const from = Math.max(collectedDay + 1, last - 13);
  for (let d = from; d <= last; d++) out.push(...mailFor(d));
  return out;
}

/** When the post comes. Eleven in the morning, so a night's sleep to 07:00
 *  lands you BEFORE it and going down for the mail is a thing you choose. */
const POST_HOUR = 11;

// ── the bank of boxes ─────────────────────────────────────────────────────
//
// C's, at `ct/apartment.ts` — the carcass, its pressed lip and the shelf under
// it. These seven numbers are COPIED from that file and copying a coordinate is
// the defect this project has now hit five times (GOTCHAS §20). Two things stop
// it here, and the second is the one that matters:
//
//   1. the position is expressed off C's own exported `APT_X0`/`APT_Z0`, so the
//      walk-up can move without any of this following it by hand
//   2. `findBank()` SNAPS to the real mesh at build time and warns if it is not
//      where this says. C moving the bank shows up as a console warning, not as
//      a letter hanging in mid-air three metres from a wall
//
// Asked C for a published descriptor in `notes/N-asks.md`; when it lands, the
// literals below go and the snap stays.
const BANK = {
  lx: 2.28, y: 1.4, lz: 1.3,          // ct/apartment.ts, `mail.position.set`
  d: 0.10, h: 1.0, w: 1.5,            // its BoxGeometry
  cols: 4, rows: 3,                   // the painted grid, 3 rows of 4
  /** the door cells in texels of C's 48 x 32 painted face */
  tex: { w: 48, h: 32, x0: 3, y0: 3, dx: 11, dy: 9, cw: 9, ch: 7 },
  /**
   * WHICH CELL IS 301 — a column per floor, reading away from the front door.
   *
   *     c = 0 1 2 3   floors 1 2 3 4, c=0 nearest the street door
   *     r = 0         the super's, and three that have never been let
   *     r = 1         101 201 301 401      <- the `01` flats
   *     r = 2         102 202 302 402
   *
   * C painted twelve identical doors and said nothing about which is whose, so
   * this is a declaration rather than a reading of it. Two things decided the
   * row, and both were found by standing there rather than by reasoning:
   *
   *   - the TOP row is at 1.70 m, which is eye height on this rig, so the post
   *     riding out of the slot is seen exactly edge-on and reads as a scratch
   *     on the wall. The middle row is at 1.42 m and you look down onto it
   *   - the top row has 0.09 m of carcass above it before the pressed lip.
   *     There is nowhere for a stuffed box to overflow TO
   */
  me: { c: 2, r: 1 },
} as const;

// ── the numerals ──────────────────────────────────────────────────────────
//
// THIS FONT IS C's, copied glyph for glyph from `ct/apartment.ts`'s `DIGIT`,
// which is private to that module. The user: *"numbered to match the doors
// upstairs"* — and matching means the same numerals, not merely the same
// numbers. C's own comment says why they are a bitmap and not `fillText`:
// *"Anything meant to be READ at this texel density has to be drawn as
// texels"*, because a canvas font antialiases into smear.
//
// A copied table is a table that can drift, so `notes/N-asks.md` asks C to
// export it. Until then this is the lesser of two wrongs: the alternative is
// a second, different-looking numeral in the same building.
const DIGIT: Record<string, number[]> = {
  '0': [0b1111, 0b1001, 0b1001, 0b1001, 0b1111],
  '1': [0b0010, 0b0110, 0b0010, 0b0010, 0b0111],
  '2': [0b1111, 0b0001, 0b1111, 0b1000, 0b1111],
  '3': [0b1111, 0b0001, 0b0111, 0b0001, 0b1111],
  '4': [0b1001, 0b1001, 0b1111, 0b0001, 0b0001],
  '5': [0b1111, 0b1000, 0b1111, 0b0001, 0b1111],
  '6': [0b1111, 0b1000, 0b1111, 0b1001, 0b1111],
  '7': [0b1111, 0b0001, 0b0010, 0b0010, 0b0010],
  '8': [0b1111, 0b1001, 0b1111, 0b1001, 0b1111],
  '9': [0b1111, 0b1001, 0b1111, 0b0001, 0b1111],
};

/**
 * The number plate, and why it is painted DENSER than the bank it hangs on.
 *
 * C's door plates upstairs run about 30 px/m and the bank's own face is 32,
 * so the obvious move is to match the neighbour. It does not work: at 32 px/m
 * one of C's glyphs is 0.16 m tall and `301` is 0.44 m wide — wider than the
 * whole 0.28 m mailbox door. The physical plate on a bank of boxes is a third
 * the size of the one on a flat door, and the numerals shrink with it.
 *
 * So what is matched is the GLYPH — five texels tall, four wide, a five-texel
 * pitch, C's exact bitmap — and the density follows from making that glyph fit
 * a mailbox. GOTCHAS §4 is a floor and not a ceiling: it forbids detail too
 * fine for its surface, and this is the same detail on a smaller surface. The
 * building already goes to 67 px/m on the entrance buzzer.
 */
const NUM = { ppm: 145, pad: 2, glyphH: 5, pitch: 5, glyphW: 4, border: 1 } as const;

/** the plate's texel size for `num` — C's 18 x 9 for three digits, plus a rim */
function plateTexels(num: string) {
  return {
    w: NUM.border * 2 + NUM.pad * 2 + num.length * NUM.pitch - (NUM.pitch - NUM.glyphW),
    h: NUM.border * 2 + NUM.pad * 2 + NUM.glyphH,
  };
}

/**
 * C's door plate, at a mailbox's size.
 *
 * The palette is `ct/apartment.ts`'s `doorTexN` verbatim — `#8a7440` brass,
 * `#a89056` lit top edge, `#5e4e28` shadow under, `#2e2616` ink, and the four
 * fixing screws — because C's own comment records what happens when it is not:
 * *"It used to be a near-white rectangle — brighter than anything else indoors,
 * so it pulled the eye off the door it labels."*
 *
 * My first version made exactly that mistake in the negative — a black plate
 * with bright gold numerals, which was the highest-contrast object on the whole
 * bank and pulled the eye off the one box with post in it. Standing in the
 * lobby is what showed it: C's real 102 door plate is visible in the same frame
 * as the boxes, and the two did not look like they came from the same building.
 *
 * The one addition is a DARK RIM. C's plate reads because it is lighter than
 * its brown door; these sit on brass doors of nearly the same value, so without
 * an edge the plate dissolves into the box.
 */
function plateTex(num: string): THREE.Texture {
  const { w, h } = plateTexels(num);
  const b = NUM.border;
  return declareSurface(pixTex(w, h, (g) => {
    g.fillStyle = '#241f1a'; g.fillRect(0, 0, w, h);                    // the rim
    g.fillStyle = '#8a7440'; g.fillRect(b, b, w - 2 * b, h - 2 * b);    // brass
    g.fillStyle = '#a89056'; g.fillRect(b, b, w - 2 * b, 1);            // lit top edge
    g.fillStyle = '#5e4e28'; g.fillRect(b, h - b - 1, w - 2 * b, 1);    // shadow under it
    g.fillStyle = '#6a5a30';                                            // four fixing screws
    g.fillRect(b + 1, b + 1, 1, 1); g.fillRect(w - b - 2, b + 1, 1, 1);
    g.fillRect(b + 1, h - b - 2, 1, 1); g.fillRect(w - b - 2, h - b - 2, 1, 1);
    g.fillStyle = '#2e2616';
    for (let i = 0; i < num.length; i++) {
      const rows = DIGIT[num[i]] ?? [];
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < NUM.glyphW; c++) {
          if (rows[r] & (1 << (NUM.glyphW - 1 - c))) {
            g.fillRect(b + NUM.pad + i * NUM.pitch + c, b + NUM.pad + r, 1, 1);
          }
        }
      }
    }
  }), 'detail');
}

/** How wide and tall that plate is in metres — derived from the glyph, never typed. */
function plateSize(num: string) {
  const t = plateTexels(num);
  return { w: t.w / NUM.ppm, h: t.h / NUM.ppm };
}

/**
 * Which flat each painted cell belongs to — a column per floor, reading away
 * from the street door, and `null` for the four that have never been let.
 *
 * Built from the same rule `ct/apartment.ts` builds its own doors from — four
 * floors, an `01` and an `02` on each landing — rather than from eight typed
 * strings. C's `DOORS` array is private to that module, so this is the
 * convention copied and not the list; `notes/N-asks.md` asks for it to be
 * published, and the moment it is, this function reads it instead.
 */
function flatAt(c: number, r: number): string | null {
  if (r === 1 || r === 2) return `${c + 1}${r === 1 ? '01' : '02'}`;
  return null;
}

/** the -x face of the bank: the one turned into the hall, C's material index 1 */
function bankFace(bx: number): number { return bx - BANK.d / 2; }

/** Centre of painted cell (c, r) on that face, in world metres. */
function cell(bx: number, by: number, bz: number, c: number, r: number) {
  const T = BANK.tex;
  const mz = BANK.w / T.w, my = BANK.h / T.h;              // metres per texel
  // u runs along +z on a box's -x face and v=1 is its top, and a canvas texture
  // is uploaded flipY so canvas row 0 lands there. So column 0 is at low z and
  // row 0 is the TOP row. (Derived from BoxGeometry.buildPlane rather than
  // guessed — a mirrored read here is GOTCHAS §33 with the numbers swapped.)
  return {
    z: bz - BANK.w / 2 + (T.x0 + c * T.dx + T.cw / 2) * mz,
    y: by + BANK.h / 2 - (T.y0 + r * T.dy + T.ch / 2) * my,
    w: T.cw * mz, h: T.ch * my,
  };
}

/**
 * Find C's bank in the scene and answer with WHERE IT ACTUALLY IS.
 *
 * The seed is derived; the answer is measured. A mesh is the bank if it is a
 * box of exactly the carcass's three dimensions standing within a metre of the
 * seed — three numbers agreeing to the millimetre is not something the lobby
 * has by accident, and the proximity test keeps it from matching a box of the
 * same size somewhere else in the world.
 */
function findBank(scene: THREE.Scene): { x: number; y: number; z: number; found: boolean } {
  const seed = { x: APT_X0 + BANK.lx, y: BANK.y, z: APT_Z0 + BANK.lz };
  const hits: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const p = (m.geometry as THREE.BoxGeometry)?.parameters as
      { width?: number; height?: number; depth?: number } | undefined;
    if (!p) return;
    const same = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-4;
    if (!same(p.width, BANK.d) || !same(p.height, BANK.h) || !same(p.depth, BANK.w)) return;
    if (m.position.distanceTo(new THREE.Vector3(seed.x, seed.y, seed.z)) > 1.0) return;
    hits.push(m);
  });
  if (hits.length === 1) {
    const p = hits[0].position;
    const drift = p.distanceTo(new THREE.Vector3(seed.x, seed.y, seed.z));
    if (drift > 1e-3) {
      console.warn(`[tenancy] the bank of boxes has moved ${drift.toFixed(3)} m from where `
        + 'ct/tenancy.ts expects it. Following the mesh; update BANK.lx/lz.');
    }
    return { x: p.x, y: p.y, z: p.z, found: true };
  }
  // Loud, because a mailbox built against a bank that is not there is exactly
  // the shape GOTCHAS §34 warns about: nothing fails, and the letters simply
  // hang on a blank wall where nobody walks.
  console.warn(`[tenancy] found ${hits.length} candidate mailbox banks near `
    + `(${seed.x.toFixed(2)}, ${seed.z.toFixed(2)}) — expected exactly 1. `
    + 'Building 301 at the derived position; ct/apartment.ts may have changed.');
  return { ...seed, found: false };
}

// ── the letter, held open in front of you ─────────────────────────────────
//
// ON K's SHARED PANEL FRAMEWORK, not on a cabinet of my own. I built one first
// — a canvas sliding up from the bottom of the frame with two thumbs on the
// near corners, copied from the pockets — and it was the wrong call twice over.
// The desk had already said so in my queue (*"K is building one shared
// full-screen panel framework; if rent needs a screen, use that rather than
// rolling your own"*), and K's own reasoning is better than mine was:
//
//   *"Three panels built three times is three different-looking UIs in one
//    small hand-made world, and that is the kind of thing this user spots in
//    one screenshot."*
//
// What moving onto it deleted, all of which I had written or was about to:
// the DOM element, the open/close transforms, the ESC handler, the wheel
// listener, the two thumbs, and the pair of asks I had filed with K for a way
// to close the wallet. `chrome: 'cloth'` is the framework's own word for a
// thing you HOLD rather than stand at, which is what a letter is.
//
// And it buys one thing I had not built at all: THE WORLD FREEZES behind it.
// Reading your post while the street walks on behind you was not something I
// had noticed was wrong.

/** the sheet's own size, in canvas texels. The bezel is the framework's. */
const SHEET = { w: 192, h: 178 };
/**
 * The widest line the sheet can hold, MEASURED rather than remembered.
 *
 * 172 px of paper between the margins at 8 px monospace, whose advance is
 * 0.6 em. The first draft sliced at 40 and the landlord's signature came off
 * the right-hand edge of the page — visible in the first screenshot of it and
 * in nothing else, because a clipped line still renders perfectly.
 */
const COLS = Math.floor((SHEET.w - 20) / (8 * 0.6));      // = 35

let page = 0;
/** what you are reading: the pile you last took out of the box */
let reading: Letter[] = [];
/** set by `register`, so the notice can print a live figure */
let CTX: CtxBuild | null = null;
let PANEL: Panel | null = null;

const fill = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};

/** Paint the SHEET. The framework has already drawn everything around it, and
 *  the origin is the screen's own top left. */
function drawLetter(g: CanvasRenderingContext2D, w: number, h: number): void {
  const l = reading[page];
  if (!l) return;

  // cheap paper gone slightly yellow, and the crease it was folded on
  fill(g, l.kind === 'junk' ? '#ddd8c4' : '#e6e1cd', 0, 0, w, h);
  fill(g, '#f2eeda', 0, 0, w, 2);
  fill(g, '#c8c2ab', 0, h - 3, w, 3);
  // The fold, at the thirds — everything that comes through a letterbox has
  // been folded. FAINT: the first version was a 0.28 grey line with a highlight
  // under it, which crosses the body at whatever line it lands on and reads as
  // a STRIKETHROUGH rather than as a crease. There is no arrangement of body
  // text that guarantees it falls in a gap, so the fix is to make it a shade of
  // paper rather than a mark on it.
  for (const cy of [h / 3, (h * 2) / 3]) fill(g, 'rgba(120,112,90,0.11)', 0, Math.round(cy), w, 1);

  // the sender, across the top, under a rule
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#2b2620'; g.font = UI.font(8, true);
  g.fillText(l.from.slice(0, COLS), 10, 14);
  fill(g, '#8d8672', 10, 20, w - 20, 1);

  // the body, in the typewriter it would have been typed on
  g.fillStyle = '#332d25'; g.font = UI.font(8);
  let y = 36;
  for (const line of l.lines) { g.fillText(line.slice(0, COLS), 10, y); y += 12; }

  // Anything from the landlord quotes the figure that is actually outstanding,
  // read off the clock at the moment you unfold it rather than baked in when it
  // was written.
  if (l.kind !== 'junk' && CTX) {
    const day = Math.floor(CTX.clock.now().totalMin / 1440);
    const bal = owed(day);
    y += 6;
    fill(g, '#c9c3ac', 10, y - 10, w - 20, 16);
    g.fillStyle = '#2b2620'; g.font = UI.font(8, true);
    // WHAT THIS BAND MAY NOT SAY is "PAID IN FULL", which is what the first
    // version printed the moment `owed()` came back 0 — including on the day
    // the notice arrives, two days BEFORE any money is due. A notice that
    // congratulates you for paying rent you have not been asked for yet is
    // worse than no band at all: it is the feature telling you it is finished
    // with you. Nothing outstanding and paid up are different sentences.
    g.fillText(bal > 0 ? `OUTSTANDING NOW: $${bal.toFixed(2)}` : 'NOTHING OUTSTANDING TODAY', 14, y + 1);
    // the stamp. Rotated, off-square and half off the edge of the text, the way
    // a rubber stamp lands on a desk.
    if (bal > 0) {
      g.save();
      g.translate(w - 52, h - 34);
      g.rotate(-0.17);
      g.strokeStyle = 'rgba(150,46,38,0.75)'; g.lineWidth = 2;
      g.strokeRect(-30, -12, 60, 24);
      g.fillStyle = 'rgba(150,46,38,0.85)'; g.font = UI.font(9, true);
      g.textAlign = 'center';
      g.fillText('PAST DUE', 0, 3);
      g.restore();
      g.textAlign = 'left';
    }
  }
}

function buildPanel(): void {
  if (PANEL) return;
  PANEL = makePanel({
    id: 'ct-letter', w: SHEET.w, h: SHEET.h, chrome: 'cloth',
    // No title stamped in the bezel: the sender is printed at the top of the
    // paper, where a letter puts it, and a second name above the sheet would
    // be the building labelling your post for you.
    hint: () => (reading.length > 1
      ? `${page + 1} of ${reading.length}   scroll to turn`
      : 'the only one today'),
    draw: drawLetter,
    // The wheel turns the page, the same gesture the pockets use to choose.
    // ESC is the framework's and needs no line here.
    wheel: (d) => { page = (page + (d > 0 ? 1 : reading.length - 1)) % reading.length; PANEL?.repaint(); },
    key: (k) => {
      if (k === 'arrowright' || k === 'arrowdown') page = (page + 1) % reading.length;
      else if (k === 'arrowleft' || k === 'arrowup') page = (page + reading.length - 1) % reading.length;
      else return;
      PANEL?.repaint();
    },
  });
}

function showLetters(pile: Letter[]): void {
  if (!pile.length) return;
  reading = pile;
  page = 0;
  buildPanel();
  PANEL?.open();
}

// ── the world ─────────────────────────────────────────────────────────────

export function register(ctx: CtxBuild): void {
  CTX = ctx;
  const { scene } = ctx;
  const bank = findBank(scene);
  const faceX = bankFace(bank.x);
  const me = cell(bank.x, bank.y, bank.z, BANK.me.c, BANK.me.r);

  const mat = (c: number) => new THREE.MeshBasicMaterial({ color: c });
  // C's own painted door colour and its shadow line, so the one door with
  // hardware on it reads as the same bank rather than as a different object
  // screwed onto it (ct/apartment.ts's mailT: #8a7a4e over #5e5236).
  const brass = mat(0x8a7a4e), brassDark = mat(0x5e5236), iron = mat(0x241f1a);

  const group = new THREE.Group();
  group.name = 'tenancy-301-box';
  scene.add(group);
  const add = <T extends THREE.Object3D>(m: T): T => { group.add(m); return m; };

  // THE DOOR, proud of the face rather than painted on it. C's argument for
  // making the carcass a box instead of a plane applies twice over to the one
  // door you stand in front of and put a key in.
  const DOOR_T = 0.022;
  const door = add(new THREE.Mesh(new THREE.BoxGeometry(DOOR_T, me.h, me.w), brass));
  door.position.set(faceX - DOOR_T / 2, me.y, me.z);
  // the pull, along the top edge — this is a bottom-hinged door, which is what
  // a bank of boxes has and what lets the post stick out of the top when there
  // is more of it than fits
  const pull = add(new THREE.Mesh(new THREE.BoxGeometry(DOOR_T + 0.008, 0.018, me.w - 0.03), brassDark));
  pull.position.set(faceX - DOOR_T / 2, me.y + me.h / 2 - 0.014, me.z);
  // hinge knuckles on the bottom edge, so which way it opens is visible
  for (const dz of [-me.w / 2 + 0.05, me.w / 2 - 0.05]) {
    const k = add(new THREE.Mesh(new THREE.BoxGeometry(DOOR_T + 0.006, 0.016, 0.035), brassDark));
    k.position.set(faceX - DOOR_T / 2, me.y - me.h / 2 + 0.008, me.z + dz);
  }
  // the lock. A keyhole with nothing around it is a dot; a cylinder escutcheon
  // with a dark slot in it is a lock.
  const esc = add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 8), brassDark));
  esc.rotation.z = Math.PI / 2;
  esc.position.set(faceX - DOOR_T - 0.003, me.y - 0.055, me.z + me.w / 2 - 0.050);
  const slot = add(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.004), iron));
  slot.position.set(faceX - DOOR_T - 0.007, me.y - 0.055, me.z + me.w / 2 - 0.050);
  // ── EVERY BOX NUMBERED, TO MATCH THE DOORS UPSTAIRS ─────────────────────
  //
  // The user, directly. Eight flats and twelve boxes: the four that get no
  // plate are the four that have never been let, and leaving them BARE rather
  // than blank-plated is what makes that legible at a glance — a plate with
  // nothing on it reads as a plate somebody forgot to fill in.
  //
  // Plates go on 301's proud door as well as on C's eleven painted cells, so
  // the x depends on which one it is. Both are derived from the same face.
  const PLATE_DY = 0.040;                       // above the cell's centre line
  for (let c = 0; c < BANK.cols; c++) {
    for (let r = 0; r < BANK.rows; r++) {
      const num = flatAt(c, r);
      if (!num) continue;
      const q = cell(bank.x, bank.y, bank.z, c, r);
      const sz = plateSize(num);
      const mine = c === BANK.me.c && r === BANK.me.r;
      const p = add(new THREE.Mesh(new THREE.PlaneGeometry(sz.w, sz.h),
        new THREE.MeshBasicMaterial({ map: plateTex(num) })));
      // ry = −π/2 faces −x and sends u along +z, which is the viewer's right
      // from out in the hall — so the numerals read left to right without the
      // texture being flipped. GOTCHAS §35: the rotation has already done the
      // mirroring, and flipping as well is what puts it back.
      p.rotation.y = -Math.PI / 2;
      p.position.set((mine ? faceX - DOOR_T : faceX) - 0.0015, q.y + PLATE_DY, q.z);
    }
  }

  // the name card, behind its little window — a scrap of card with a hand on
  // it, not letters. The NUMBER is the plate above; this is the thing under it
  // that says somebody actually lives here.
  const winF = add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.036, 0.086), iron));
  winF.position.set(faceX - DOOR_T - 0.002, me.y - 0.055, me.z - 0.045);
  const cardT = declareSurface(pixTex(12, 6, (g) => {
    g.fillStyle = '#ded7c0'; g.fillRect(0, 0, 12, 6);
    g.fillStyle = '#4a4335';                       // a hand, not letters
    g.fillRect(2, 2, 7, 1); g.fillRect(2, 4, 5, 1);
  }), 'detail');
  const card = add(new THREE.Mesh(new THREE.PlaneGeometry(0.076, 0.026),
    new THREE.MeshBasicMaterial({ map: cardT })));
  card.rotation.y = -Math.PI / 2;
  card.position.set(faceX - DOOR_T - 0.007, me.y - 0.055, me.z - 0.045);

  // ── THE POST, STICKING OUT ──────────────────────────────────────────────
  //
  // The whole of the user's ask is *"letters waiting at the mailboxes when he
  // comes in off the street"* — WAITING, and seen on the way in. A locked box
  // with the mail sealed invisibly inside is more accurate and satisfies none
  // of it, so the box is stuffed: envelopes ride up out of the gap above the
  // door, which is what a real one does on a Thursday.
  //
  // Three at most. Beyond three they stop reading as envelopes and start
  // reading as a white block, and the count is in the prompt anyway.
  //
  // THEY STAND UP. The first cut laid them flat like post on a doormat and
  // pitched them a few degrees, which is what mail on a table does — and at
  // 4 mm thick, seen from a player's eye, every one of them was a white LINE.
  // A screenshot from the arrival spot is what showed it; no amount of reading
  // the numbers would have. Mail riding out of a slot is nearly upright with
  // its face turned into the room, so that is what these are: a fan of cream
  // rectangles leaning out over the door, each one further out and taller than
  // the one behind it.
  const SHOW = 3;
  const paper = [0xe8e2d0, 0xd8cfae, 0xdedac6];    // white, manila, and a greyer white
  const LEAN = [0.30, 0.42, 0.22];                 // radians from vertical, top toward −x
  const RISE = [0.086, 0.070, 0.098];              // how far each stands out of the slot
  const envs: THREE.Mesh[] = [];
  for (let i = 0; i < SHOW; i++) {
    const e = add(new THREE.Mesh(new THREE.BoxGeometry(0.006, RISE[i], 0.132), mat(paper[i])));
    // hinged at the top edge of the door and leaned out from there, so the
    // bottom of every envelope disappears into the same slot however far it
    // has ridden up. Rotating about z sends local +y to (−sin, cos), which is
    // out into the hall and up — a MESH rotation, not a camera one (GOTCHAS
    // §33: the same number means opposite things).
    const th = LEAN[i], half = RISE[i] / 2;
    const pivotX = faceX - 0.011 - i * 0.006;
    e.rotation.z = th;
    e.rotation.y = (i - 1) * 0.09;
    e.position.set(pivotX - Math.sin(th) * half,
      me.y + me.h / 2 + Math.cos(th) * half - 0.006,
      me.z + (i - 1) * 0.014);
    e.visible = false;
    envs.push(e);
  }

  // ── the interaction ─────────────────────────────────────────────────────
  //
  // You stand in front of the bank, on the hall side. `ok()` gates on the FLOOR
  // and not on the address: floor 3 is directly above this spot, so a radius
  // test alone would offer you your mailbox through the ceiling while you stood
  // in your own kitchen.
  const STAND_X = faceX - 0.62;
  ctx.spot({
    x: STAND_X, z: me.z, r: 0.95,
    obj: door,
    ok: () => ctx.player.gy() < 0.5 && ctx.player.x() > 100,
    label: () => {
      const w = waiting(ctx.clock.now().totalMin).length;
      if (w > 0) return `open your mailbox — ${w} letter${w === 1 ? '' : 's'}`;
      if (HELD.length) return `read your mail (${HELD.length})`;
      return `your mailbox — ${RENT.flat} — nothing in it`;
    },
    act: () => {
      const { totalMin } = ctx.clock.now();
      const w = waiting(totalMin);
      if (w.length) {
        const hour = (totalMin % 1440) / 60;
        collectedDay = Math.floor(totalMin / 1440) - (hour >= POST_HOUR ? 0 : 1);
        HELD.push(...w);
        while (HELD.length > KEEP) HELD.shift();
        showLetters(w);                       // what you just took out
      } else if (HELD.length) {
        showLetters([...HELD].reverse());     // newest first, on a second look
      }
    },
  });

  // The envelopes are the only thing here that has to move, and what they show
  // is a pure function of the clock — so this hook decides nothing, it only
  // renders what `waiting()` already answers.
  buildPanel();
  ctx.onFrame(() => {
    const n = waiting(ctx.clock.now().totalMin).length;
    for (let i = 0; i < SHOW; i++) envs[i].visible = i < Math.min(n, SHOW);
  });

  // NO KEY LISTENERS HERE. The framework owns ESC, the wheel and the arrows,
  // and it swallows everything else while the sheet is up — so pressing E again
  // cannot re-trigger the box you are standing at, which my own listener did
  // nothing about.

  // ── THE LANDLORD ────────────────────────────────────────────────────────
  //
  // *"rent that must be paid to a landlord"* — a man, in the hall, who takes
  // cash. Not a menu and not a slot in the wall, because the notice he sent
  // says so in his own words: *"I collect in person. I am in the hall or on the
  // stairs. Cash only."* A feature that contradicts its own letter is worse
  // than one that has no letter.
  //
  // HE IS DRAWN FROM THE ATLAS (GOTCHAS §21). Four people in this world are
  // cardboard because nothing told their authors `ct/citizens.ts` existed, and
  // the user spotted every one of them: *"the people inside these places are
  // always flat and not like the people on the street"*. This is three lines
  // and a hook, and he turns to watch you through eight angles.
  //
  // Deliberately nothing like C's hermit two floors up, who is the nearest
  // other person in this building: the hermit is a yellowed undershirt, long
  // grown-out hair and `grime: 1`. This is a pressed grey overcoat, short hair,
  // clean. Two men in one walk-up should not read as the same texture.
  //
  // WHERE HE STANDS, and why he moved. C measured it and filed it before it
  // bit anybody (`notes/C-package-vs-rent-for-N.md`): he was at `APT_Z0 + 4.4`
  // with a 1.15 m trigger, which put 101's landing parcel — at (200.25, −15.69),
  // derived from that door's own frame — 0.38 m from his centre and therefore
  // ENTIRELY INSIDE his circle. It worked, because selection is nearest-wins
  // and you approach the parcel. It worked the way GOTCHAS §8 describes things
  // working right up until they do not, and it had already cost C's own check a
  // false red.
  //
  // C offered to bias the parcel to the far side of its jamb. Declined: the
  // parcel is derived from a door that has been there for weeks and the man is
  // three hours old, so the man moves. He is at the FOOT OF THE STAIRS now,
  // 2.32 m from the parcel — further apart than the two radii added together,
  // so neither circle reaches the other's centre and they do not even overlap.
  //
  // It is a better place for him anyway. His own notice says *"I am in the hall
  // or on the stairs"*, and you cannot go up to your flat without passing him.
  const LL_X = APT_X0 + 0.62;      // west side of the lobby, off the wall
  const LL_Z = APT_Z0 + 6.6;       // at the foot of the stairs, clear of 101's door
  const LL_FACING = Math.PI;       // atan2(vx, vz): π looks −z, at the front door
  const landlord = citizenSprite(
    { jacket: '#3f4048', pants: '#2b2f36', skin: '#5a3a22', hair: '#1c1410',
      fit: 'coat', cut: 'short', build: 1 },
    { facing: LL_FACING, h: 1.06, w: 1.06 },
  );
  landlord.mesh.position.set(LL_X, 0, LL_Z);     // the atlas puts the origin at the FEET
  landlord.mesh.visible = false;
  scene.add(landlord.mesh);

  // He is SOLID while he is standing there, the same way C's hermit is —
  // otherwise the man you owe money to is a hologram you walk through. The AABB
  // is registered once and parked at 999 when he is away, because `ctx.obstacle`
  // takes a box at build time and a person who comes and goes cannot be a
  // second registration.
  const llBox = ctx.obstacle({ minX: 999, maxX: 999, minZ: 999, maxZ: 999 });

  /**
   * Is he in the hall right now?
   *
   * When you owe him money, between seven in the morning and ten at night. He
   * is not a fixture — a landlord standing in the lobby of a building where
   * nobody owes him anything is scenery, and one standing there at four in the
   * morning is a different genre.
   *
   * Derived from the clock like everything else here, so sleeping past him is
   * the same code path as walking past him.
   */
  function landlordIn(totalMin: number): boolean {
    const day = Math.floor(totalMin / 1440);
    const hour = (totalMin % 1440) / 60;
    return owed(day) > 0 && hour >= 7 && hour < 22;
  }

  /** the lane past him. Wide enough that he is pressure and not a wall — the
   *  2 m sidewalk lane is sacred outside and the principle holds indoors. */
  const LL_HALF_X = 0.30, LL_HALF_Z = 0.22;

  ctx.onFrame(({ px, pz, dt, gy }) => {
    const { totalMin } = ctx.clock.now();
    const here = landlordIn(totalMin);
    landlord.mesh.visible = here;
    if (here) landlord.update(px, pz, dt);
    // WITHHELD IF YOU ARE ALREADY STANDING IN IT — C's rule for the hermit and
    // for the landing packages, and it is not a nicety: a collider that appears
    // around the player shoves them, and being shoved by a man materialising is
    // the kind of thing that reads as the world breaking.
    const inIt = Math.abs(px - LL_X) < LL_HALF_X + 0.36 && Math.abs(pz - LL_Z) < LL_HALF_Z + 0.36;
    const solid = here && !inIt && gy < 0.5;
    llBox.minX = solid ? LL_X - LL_HALF_X : 999;
    llBox.maxX = solid ? LL_X + LL_HALF_X : 999;
    llBox.minZ = solid ? LL_Z - LL_HALF_Z : 999;
    llBox.maxZ = solid ? LL_Z + LL_HALF_Z : 999;
  });

  /** A receipt is a letter you were handed rather than posted. Same sheet. */
  function receipt(day: number, amount: number): Letter {
    const weeks = Math.round(amount / RENT.amount);
    return {
      day, kind: 'receipt', from: `${RENT.landlord} — RECEIVED`,
      lines: [
        `RECEIVED OF APT ${RENT.flat}`,
        '',
        `THE SUM OF $${amount.toFixed(2)},`,
        `being ${weeks === 1 ? "one week's" : `${weeks} weeks'`} rent.`,
        '',
        'Signed in pencil, on the back of an',
        'envelope from his coat pocket.',
      ],
    };
  }

  /**
   * What he gives you when you cannot pay: a slip, not a sentence.
   *
   * The first version narrated — *"He counts what you have. He does not take
   * it."* — on a sheet of paper held in both thumbs, which is a category
   * error: an object you are holding cannot describe the man holding it out.
   * It looked wrong the moment it was on screen and read fine in the source.
   *
   * So it is the DOCUMENT a landlord with a carbon book actually produces, and
   * the outstanding figure comes off the live band below it rather than being
   * typed into the body twice.
   */
  function shortSlip(day: number): Letter {
    return {
      day, kind: 'hand', from: `${RENT.landlord} — NOTE OF ACCOUNT`,
      lines: [
        `APT ${RENT.flat}`,
        '',
        'RECEIVED TODAY ............ $0.00',
        '',
        'Torn out of a carbon book he keeps',
        'in his coat, and handed to you.',
        '',
        '"Come back when you have it."',
      ],
    };
  }

  ctx.spot({
    // He is the object, so the prompt and the highlight name the same man.
    // r 0.95, not the 1.15 it was. C's second question — *"1.15 is the largest
    // radius on that landing and I do not know whether it is deliberate"* — and
    // the honest answer is that it was not: I picked it because a man is wide.
    // The door's is 0.95 and the parcel's is 0.95, so this is 0.95.
    x: LL_X, z: LL_Z, r: 0.95,
    obj: landlord.mesh,
    ok: () => landlordIn(ctx.clock.now().totalMin) && ctx.player.gy() < 0.5,
    // THE FIGURE IS IN THE PROMPT, both ways round. K's rule, and it is the
    // difference between a refusal you understand and a key that does nothing:
    // *"the refusal is in the caption you are already reading."*
    label: () => {
      const day = Math.floor(ctx.clock.now().totalMin / 1440);
      const bal = owed(day);
      const cash = ctx.purse.cash;
      if (cash >= RENT.amount) {
        const weeks = Math.min(Math.floor(cash / RENT.amount), bal / RENT.amount);
        return `pay the rent — $${(weeks * RENT.amount).toFixed(2)}`;
      }
      return `rent is $${bal.toFixed(2)} — you are $${(RENT.amount - cash).toFixed(2)} short`;
    },
    act: () => {
      const day = Math.floor(ctx.clock.now().totalMin / 1440);
      const paid = payRent(ctx, day);
      // PRESSING IT ALWAYS ANSWERS. A key that does nothing and explains
      // nothing is how a player concludes the whole feature is broken
      // (`ct/inventory.ts` on the same point). Short of the money you get the
      // man's answer, on paper, because `ct/hud.ts` publishes no module-level
      // `note()` yet — asked for in notes/N-asks.md.
      const l = paid > 0 ? receipt(day, paid) : shortSlip(day);
      HELD.push(l);
      while (HELD.length > KEEP) HELD.shift();
      showLetters([l]);
    },
  });

  // ── THE SECOND NOTICE, UNDER YOUR DOOR ──────────────────────────────────
  //
  // The desk's steer on what being late should feel like, and it is the right
  // one: *"make being late feel like a consequence rather than a game-over. A
  // second notice under the door is more in keeping than a lockout."*
  //
  // So when the rent is actually LATE — not merely due today — there is a slip
  // of paper on your own floorboards when you wake up. He came up. You did not
  // answer. He will come again. Nothing is taken from you and nothing is
  // barred; the building simply knows.
  //
  // IT IS A FLAT DECAL, NOT A BILLBOARD (GOTCHAS §3). `board()` turns to face
  // the camera, so a slip drawn in side view stands up on end as a card the
  // moment you look down at it — which is precisely how you look at something
  // on the floor. Painted from ABOVE and laid flat.
  //
  // Anchored off C's own doorway arithmetic — `ct/apartment.ts` cuts the 301
  // opening at `AZI(3.5) ± DOOR_GAP / 2` in the wall at `AX(0)` — expressed off
  // the exported constants so the walk-up can move. Same class of copy as the
  // bank of boxes, and covered by the same ask in notes/N-asks.md.
  //
  // 0.11 x 0.16 m painted at 11 x 16 texels — 100 px/m BOTH WAYS. The first
  // cut was a 16 x 11 texture on a 0.108 x 0.155 m plane, which is 148 px/m
  // across and 71 down: rectangular texels on a hand-painted world, which is
  // GOTCHAS §5 in miniature. Take the repeat from the surface's real metres.
  const SLIP = {
    x: APT_X0 - 0.15,          // just inside the wall at AX(0), on the room side
    z: APT_Z0 + 3.5,           // the centre of the opening
    y: 2 * ST0 + 0.012,        // floor 3, a hair proud of the boards
    w: 0.16, d: 0.11,
  };
  const slipT = declareSurface(pixTex(11, 16, (g) => {
    g.fillStyle = '#e2ddc8'; g.fillRect(0, 0, 11, 16);
    g.fillStyle = '#cdc7b0'; g.fillRect(0, 8, 11, 1);          // the fold, seen from above
    g.fillStyle = '#c6c0a8'; g.fillRect(0, 15, 11, 1);         // the shadowed far edge
    g.fillStyle = '#4a4335';                                    // type, at this size
    g.fillRect(2, 3, 7, 1); g.fillRect(2, 5, 5, 1);
    g.fillRect(2, 11, 7, 1); g.fillRect(2, 13, 4, 1);
  }), 'detail');
  const slip = new THREE.Mesh(new THREE.PlaneGeometry(SLIP.d, SLIP.w),
    new THREE.MeshBasicMaterial({ map: slipT }));
  slip.rotation.x = -Math.PI / 2;      // flat on the boards, painted from above
  slip.rotation.z = 0.19;              // shoved under at an angle, as paper is
  slip.position.set(SLIP.x, SLIP.y, SLIP.z);
  slip.visible = false;
  scene.add(slip);

  /** the last day whose under-door slip you picked up. -1 = never. */
  let slipTakenDay = -1;

  /** Is there one on the floor right now? Late, and you have not picked
   *  today's up. Derived, like everything else here. */
  function slipDown(totalMin: number): boolean {
    const day = Math.floor(totalMin / 1440);
    // LATE, not merely due: he posts a notice before the rent day and comes up
    // the stairs after it. A slip on the mat the same morning the rent falls
    // due would be a landlord who cannot count.
    const late = owed(day) > 0 && day > dueDay(duePeriodsBy(day) - 1);
    return late && slipTakenDay !== day;
  }

  ctx.onFrame(() => { slip.visible = slipDown(ctx.clock.now().totalMin); });

  ctx.spot({
    x: SLIP.x, z: SLIP.z, r: 0.8,
    obj: slip,
    // FLOOR 3, and not the lobby three storeys below it — the mailbox and this
    // slip sit within a metre of each other in x and z and are separated only
    // by which floor you are standing on.
    ok: () => slipDown(ctx.clock.now().totalMin) && Math.abs(ctx.player.gy() - 2 * ST0) < 0.5,
    label: () => 'pick up the slip of paper',
    act: () => {
      const day = Math.floor(ctx.clock.now().totalMin / 1440);
      slipTakenDay = day;
      const l: Letter = {
        day, kind: 'hand', from: 'PUSHED UNDER YOUR DOOR',
        lines: [
          `APT ${RENT.flat}.`,
          '',
          'I came up. You were not in, or you',
          'were in and did not answer.',
          '',
          'I will come again tomorrow.',
          `                      — ${RENT.landlord}`,
        ],
      };
      HELD.push(l);
      while (HELD.length > KEEP) HELD.shift();
      showLetters([l]);
    },
  });

  // Test affordance, the same shape and the same reason as `__ct` and `__inv`:
  // the tenancy is a handful of closure locals and there is no other way to ask
  // what is in the box from outside. READ ONLY, except for `pay` — a probe that
  // could set `paidPeriods` could make its own assertions come true, and the
  // one write it does get is the same verb the landlord will call.
  (window as unknown as { __rent: unknown }).__rent = {
    day: () => Math.floor(ctx.clock.now().totalMin / 1440),
    owed: () => owed(Math.floor(ctx.clock.now().totalMin / 1440)),
    paidPeriods: () => paidPeriods,
    dueDay: (n: number) => dueDay(n),
    /** what is in the box this instant */
    waiting: () => waiting(ctx.clock.now().totalMin).map((l) => ({ day: l.day, kind: l.kind, from: l.from })),
    /** what a given day delivers, without waiting for it */
    mailOn: (d: number) => mailFor(d).map((l) => ({ day: l.day, kind: l.kind, from: l.from, lines: l.lines })),
    /** the widest line the sheet holds. A letter that overruns it is CLIPPED,
     *  silently and identically to one that fits — so a check needs the number
     *  and the text, not a picture of one letter that happened to be short. */
    cols: COLS,
    held: () => HELD.map((l) => ({ day: l.day, kind: l.kind, from: l.from })),
    /** the population floor, GOTCHAS §34: 0 junk kinds means the table is gone */
    junkKinds: () => JUNK.length,
    /**
     * Where the box actually IS, so a probe never hand-types it (§20).
     *
     * WORLD position, not `door.position`. The two are equal today because the
     * group sits at the origin, and reporting the local one meant a probe that
     * dragged the group three metres down the lobby was told the box had not
     * moved. My own mutation test found that: it broke the world exactly as
     * intended and the check stayed green, which is GOTCHAS §27 in one line.
     */
    box: () => {
      const w = door.getWorldPosition(new THREE.Vector3());
      return { x: w.x, y: w.y, z: w.z, stand: { x: STAND_X, z: me.z }, snapped: bank.found };
    },
    envelopes: () => envs.filter((e) => e.visible).length,
    /** the two slips he hands over, so the overrun check can measure them too:
     *  they never go through mailFor() and were invisible to it. */
    slips: () => [receipt(0, RENT.amount), shortSlip(0)].map((l) => ({ from: l.from, lines: l.lines })),
    /** the slip under 301's door: where it is and whether it is on the floor */
    slip: () => ({ x: SLIP.x, z: SLIP.z, y: SLIP.y,
      down: slipDown(ctx.clock.now().totalMin), visible: slip.visible }),
    /** the landlord: where he is, whether he is in the hall, and his box */
    landlord: () => ({
      x: LL_X, z: LL_Z, in: landlordIn(ctx.clock.now().totalMin),
      visible: landlord.mesh.visible,
      solid: llBox.minX < 900,
      /** the clear lane past him, against the 0.72 m player. GOTCHAS §29:
       *  this is a RAW GAP on an EMPTY lobby, quoted the way the rest of the
       *  project quotes one. */
      lane: (APT_X0 + 2.395) - (LL_X + LL_HALF_X),
    }),
    reading: () => (PANEL?.isOpen() ? { page, of: reading.length } : null),
    pay: () => payRent(ctx, Math.floor(ctx.clock.now().totalMin / 1440)),
    /**
     * A FIXTURE, not a fake: put `n` dollars in the purse so the paying path
     * can be measured at all.
     *
     * The purse starts at $14.50 and a week's rent is $45, so without this
     * every clause about money leaving the wallet is a verdict over an empty
     * set — green because it never happened (GOTCHAS §34). `ct/atm.ts` is the
     * one thing in the world that adds cash, and driving K's machine to fund my
     * own check would redden this suite every time K's ATM moved.
     *
     * It sets up a PRECONDITION and cannot make any assertion true: whether
     * exactly $45 leaves, whether the arrears clear, and whether a refusal
     * takes nothing are all still the code's answer. Same class as
     * `__ct.warp` and `__ct.clock`, which write the world for the same reason.
     */
    stage: (n: number) => { ctx.purse.cash = n; ctx.refreshWallet(); return ctx.purse.cash; },
  };
}
