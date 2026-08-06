import * as THREE from 'three';
import { BUILD, type CtxBuild, type Spot } from './ctx';
import { declareSurface, pixTex } from './paint';
import { APT_X0, APT_Z0, ST0 } from './apartment';
import { citizenSprite } from './citizens';
import { UI, makePanel, screenFocusReady, hudNote, type Panel } from './hud';
import { defineItem, bagPut, pocketsFull, fullWhy } from './inventory';
import {
  RENT, dateOf, dueDay, duePeriodsBy, isRentDay,
  nextDueDay, noDelivery, noticeDay,
} from './calendar';

export { RENT, dueDay, duePeriodsBy } from './calendar';

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
//
// THE TERMS AND THE DATE MATH ARE NO LONGER HERE. They are `ct/calendar.ts`, a
// leaf module that imports nothing, because the wall calendar in 301 rings the
// same rent days this file collects them on and the two used to be separate
// copies — `ct/apartment.ts` carried a hand-typed `LEASE` block and a Gregorian
// epoch of its own, with a comment saying it could not import this file without
// closing a cycle (this one imports `APT_X0` from it). The leaf breaks that:
// both files import the calendar and neither imports the other.
//
// What changed in the cycle itself, and why:
//
//   *"per year i want there to be 4 months kinda like stardew where each month
//    is a season, spring, summer, fall, winter"*
//   *"remove the mom paying my rent stuff forget about that. rent is due on the
//    5th."*   (2026-08-05)
//
// So: FOUR MONTHS IN A YEAR, each one a season, 28 days each. Rent is due on
// the 5th of each — four payments a year, one per season, always on a FRIDAY
// (*"make rent due on the 5th instead of the 1st ty"*, 2026-08-05; 28 is a whole
// number of weeks, so the 1st is a Monday for ever and the 5th is a Friday for
// ever). Day 0 is SPRING 1 and the first rent day is SPRING 5, day 4 — so the
// world does not open ON a rent day, it opens four days short of one.
//
// ⚠ NOBODY HAS PAID THAT FIRST MONTH FOR YOU. The prepaid-month conceit and the
// pink carbon that explained it are both gone at his instruction; `paidPeriods`
// starts at 0 and `RENT` no longer carries a `prepaidMonths` to seed it from.
// So the FIRST rent you owe is $500 on day 4, SPRING 5, out of your own pocket,
// and the whole apparatus fires in the first season rather than the second: the
// notice on SPRING 2 (day 1), then arrears, the PAST DUE stamp, the slip under
// your door and the landlord at the foot of the stairs.
//
// AND HE VERY LIKELY CANNOT PAY IT — measured, not feared: roughly $401 is
// reachable in a season against a $500 bill (see `RENT.amount`). That is not a
// failure state and it is not a bug to fix here. Nothing evicts. Arrears simply
// accrue and the man waits in the lobby, which is pressure rather than a wall.

// ── the tenancy's own state ───────────────────────────────────────────────
//
// Three numbers, and they are the only things in this file that are remembered
// rather than derived. Session-scoped, like C's `doorShut` — this world has no
// save, and inventing one here would be a second thing to get wrong.

/**
 * Rent days settled so far. `paidPeriods === duePeriodsBy(day)` means square.
 *
 * IT STARTS AT 0, AND THAT IS THE WHOLE OPENING OF THE GAME — *"remove the mom
 * paying my rent stuff forget about that. rent is due on the 5th."* It used to
 * be seeded from `RENT.prepaidMonths`, which is why the first season was silent;
 * that field no longer exists. So `duePeriodsBy(0)` is 0 and the balance is 0
 * for four days, then day 4 (SPRING 5) makes it 1 against 0 paid and $500 is
 * outstanding. Every downstream thing that reads `owed()` — the landlord's
 * presence, the stamp on the notice, the slip under your door — turns on in the
 * FIRST season now, without any of them knowing why.
 *
 * ⚠ IT IS STILL NOT SAVED. `ct/save.ts` restores the clock and the purse but has
 * no tenancy slice, so a returning player finds the DATE advanced and this back
 * at 0. That gap got worse, not better, with this change: it used to restore a
 * player as prepaid (arrears the wrong way round), and now it restores one as
 * having never paid anything — so a player who settled a season comes back to
 * the landlord asking for it again. Named rather than fixed; the two-line slice
 * `ct/save.ts` sketches at its foot is the fix when someone is asked for it.
 */
let paidPeriods = 0;
/** the last day whose post you have taken out of the box. -1 = you never have. */
let collectedDay = -1;
/** mail you have taken but not thrown away, newest last. */
const HELD: Letter[] = [];
/**
 * ══ WHAT HE HAS ALREADY TAKEN OUT OF THE BOX ══════════════════════════════
 *
 * *"do the click through mail flow... make it now. never wait."* (2026-08-05)
 *
 * Keyed `day|from`, which identifies a piece uniquely — `mailFor` is pure and
 * never yields the same sender twice on one day (the junk picker refuses it by
 * name). This is what makes PARTIAL PROGRESS work: take two of three, walk
 * away, and the third is still in the box tomorrow.
 *
 * ⚠ IT IS WHY `collectedDay` NO LONGER ADVANCES ON OPENING THE BOX. That flag
 * is a high-water mark over WHOLE DAYS and cannot express "he took two of
 * these". It still bounds the 14-day walk-back, and it now advances only when a
 * pile is emptied — so nothing it covers can be a piece he never took.
 */
const POCKETED = new Set<string>();
const keyOf = (l: Letter) => `${l.day}|${l.from}`;
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
 * periods, so paying one period of a two-period arrears clears the older one and leaves the
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
  /**
   * WHICH PIECE OF PAPER THIS IS, by name.
   *
   * *"the mail is too homogenous. everything is a weird letter the same exact
   *  format. also none of them look like actual letters. every letter from a
   *  different sender should be unique. there could also be flyers, and junk
   *  mail, and stuff mixed in"*   (2026-08-05)
   *
   * HE IS RIGHT AND THE CAUSE IS ONE PAINTER. `drawLetter` drew every piece
   * with the same sender rule, the same 8 px body and the same creases, so a
   * bank statement and a takeaway menu were one picture with different words —
   * and the FORMAT is most of what tells you what a piece of mail is before you
   * read a word of it.
   *
   * So a piece names its own drawing here and `ART` looks it up; anything that
   * names nothing gets `drawTyped`, which is exactly today's letter and is what
   * the short slip from the landlord's hand still uses. Its content and
   * behaviour are untouched — it does real work.
   */
  art?: string;
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
 *
 * ── WHAT A PIECE OF MAIL MAY SAY ─────────────────────────────────────────
 *
 * *"this makes no sense. delete this"*   (2026-08-05), on a piece that read
 * *"Wrong street, right number. Someone named MARGUERITE is owed $312 by a
 * garage, and now you know that."*
 *
 * ⚠ EVERY LINE HERE IS INK ON PAPER THAT SOMEBODY SENT. It is not a caption
 * about the paper. That entry described the situation to the reader in the
 * second person — "and now you know that" — which is a voice nobody in this
 * world is speaking in, and it read as a stage direction rather than as post.
 * Deleted, painter and all.
 *
 * THE TEST, for the next entry: could this text be PRINTED OR WRITTEN on the
 * object? A flyer says what the shop sells. A statement lists figures. The
 * super's note is what the super wrote. If a line explains the object, or
 * addresses "you", or knows what you can and cannot make out, it is narration
 * and it does not belong in this table.
 *
 * THE LENGTH OF THIS TABLE IS PART OF THE SEED. The picker below indexes it by
 * `hash01(day, …) * JUNK.length`, so adding or removing an entry reshuffles
 * WHICH piece lands on which day for every day in the world. It does not change
 * HOW MANY pieces arrive (salts 1 and 2, independent of the table) and it does
 * not touch the rent notice, which is on its own `noticeLead` schedule. Nothing
 * outside this file reads the table; the `junkKinds` probe surface derives its
 * count from it.
 *
 * It has gone 14 -> 13 (the clearing house), 13 -> 16 (three new formats) and
 * now 16 -> 15. Each of those reshuffled WHICH piece lands on which day and
 * none of them changed HOW MANY arrive.
 */
const JUNK: { from: string; lines: string[]; art?: string }[] = [
  // ── the three that are not letters, and do not look like one ────────────
  { from: 'VIDEO HUT', art: 'flyer-video', lines: [
    'BLOOD HARBOUR II  (18)',
    'THE LONG WEEKEND  (15)',
    'KARATE DOG  (PG)',
    'Two for one, Tuesdays.',
  ] },
  { from: 'THE DINER', art: 'menu-diner', lines: [
    'ALL DAY',
    'Two eggs, any way|1.95',
    'Short stack|2.25',
    'Grilled cheese|2.50',
    'Chili, cup|1.75',
    'AFTER SIX',
    'Meatloaf plate|4.95',
    'Liver + onions|4.50',
    'Coffee, bottomless|0.65',
    'Pie, slice|1.25',
  ] },
  { from: 'FOR THE PREVIOUS TENANT', art: 'envelope-prev', lines: [
    'D. R. KOVACS',
    'APT 301, 227 W 19TH',
    'THIS CITY',
  ] },
  { from: 'VIDEO 2000 — MEMBER SERVICES', art: 'dotmatrix-video2000', lines: [
    'Our records show two (2) tapes',
    'overdue on your account. Late fees',
    'now stand at $6.50 and are rising.',
    'Please return them.',
  ] },
  { from: 'CITY LIGHT & POWER', art: 'bill-utility', lines: [
    'ACCOUNT 227-3-01',
    'AMOUNT DUE $18.44',
    'Meter read 04/11. Estimated.',
    'Late charge applies after the 28th.',
    'Do not send cash through the mail.',
  ] },
  { from: 'PALERMO PIZZA — 2 BLOCKS DOWN', art: 'flyer-pizza', lines: [
    'LARGE PIE + 2 SODAS ..... $9.99',
    'WE DELIVER TILL 2AM',
    'ASK ABOUT THE BUCKET OF WINGS',
    '(coupon expired 03/97)',
  ] },
  { from: 'A POSTCARD', art: 'postcard', lines: [
    'The weather here is exactly the',
    'same as the weather there. I have',
    'eaten nothing but shrimp.',
    'Back Thursday. Feed nothing.',
    '                        — DEB',
  ] },
  { from: 'HANDWRITTEN, NO STAMP', art: 'note-super', lines: [
    'BOILER OFF SATURDAY 8AM UNTIL IT',
    'IS FIXED. NO HOT WATER. SORRY.',
    'DO NOT CALL ME ABOUT IT.',
    '                  — THE SUPER',
  ] },
  { from: 'ADDRESSED TO 302', art: 'catalogue-302', lines: [
    'A seed catalogue. Your neighbour',
    'has one window, it faces a wall,',
    'and he gets this every month',
    'without fail.',
  ] },
  { from: 'FIRST FEDERAL SAVINGS', art: 'letterhead-bank', lines: [
    'YOU ARE PRE-APPROVED for a line',
    'of credit up to $2,500 at a',
    'variable rate of 24.9% APR.',
    'No obligation. No fee.',
  ] },
  { from: 'CRIMEWATCH — 14TH PRECINCT', art: 'notice-precinct', lines: [
    'THERE HAVE BEEN BREAK-INS ON',
    'THIS BLOCK. LOCK YOUR DOOR. DO',
    'NOT BUZZ ANYONE IN THAT YOU DO',
    'NOT KNOW.',
  ] },
  { from: 'THE MAIL-ORDER CATALOGUE', art: 'catalogue-order', lines: [
    'Four hundred pages. Trainers,',
    'tube socks, a toaster, and a',
    'small appliance you cannot make',
    'out from the picture.',
  ] },
  { from: 'DR. R. HALVERSEN, D.D.S.', art: 'card-dentist', lines: [
    'THIS IS A REMINDER that you are',
    'due for a cleaning. Our records',
    'show your last visit was 1993.',
    'Please call for an appointment.',
  ] },
  { from: 'A CHAIN LETTER', art: 'chain-letter', lines: [
    'DO NOT BREAK THE CHAIN. Copy',
    'this letter twenty (20) times',
    'and send it on. A man in OHIO',
    'broke it and lost his job in',
    'nine days.',
  ] },
  { from: 'PENNY SAVER — WEEKLY', art: 'classified-penny', lines: [
    'CARS · APPLIANCES · ROOMS TO LET',
    '"1977 SEDAN, RUNS, $400 OBO"',
    '"WANTED: DRUMMER. NO TIMEWASTERS"',
    'Twelve pages, four classified.',
  ] },
];

// ⚠ THERE IS NO DAY-0 LETTER ANY MORE. `prepaidReceipt()` — the pink carbon
// from his mother, with its own `carbon-prepaid` painter — lived here and was
// deleted at his instruction: *"remove the mom paying my rent stuff forget
// about that."* It existed only to explain why day one was silent, and day one
// is not silent now; a letter about a payment that never happened is worse than
// no letter. The first thing the box holds is the ordinary notice on day 1.
// Git history has both the letter and the painter if the conceit ever returns.

// `noDelivery` is the calendar's now — day 0 is a Monday and Sunday is day 6,
// which is the fact the whole week in this world is pinned to. Re-exported from
// there rather than re-derived here.

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

  // The notice, `noticeLead` days before the next 1st — and it names the season
  // it is for rather than only counting days, because a wall calendar four steps
  // away is showing that same word and the two must say the same thing.
  //
  // `duePeriodsBy(day)` is the index of the NEXT rent day whenever `day` is not
  // one itself, and of the one after when it is — which is the period this
  // notice should be warning about either way.
  const n = duePeriodsBy(day);
  if (day === noticeDay(n)) {
    const due = dueDay(n);
    const left = due - day;
    out.push({
      day, kind: 'rent', art: 'notice-agent', from: `${RENT.landlord} — MANAGING AGENT`,
      lines: [
        `RE: APT ${RENT.flat}, ${RENT.building}`,
        '',
        `RENT OF $${RENT.amount.toFixed(2)} IS DUE ON THE 5TH`,
        `OF ${dateOf(due).season} — ${left} DAY${left === 1 ? '' : 'S'} FROM TODAY.`,
        '',
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
        day, kind: 'late', art: 'notice-agent', from: `${RENT.landlord} — SECOND NOTICE`,
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
  // ⚠ MINUS WHAT HE HAS ALREADY POCKETED. `mailFor` is pure and will happily
  // hand back a piece he took an hour ago; `POCKETED` is the only thing that
  // knows he did. Filtered HERE rather than at the box so the count in the
  // prompt, the pile the panel shows and the envelopes on the bank all agree.
  return out.filter((l) => !POCKETED.has(keyOf(l)));
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

/** the sheet's own DRAWING SPACE, in its own units. The bezel is the
 *  framework's. Not the canvas size any more — see `LETTER_SS`. */
const SHEET = { w: 192, h: 178 };
/**
 * ── READABILITY ────────────────────────────────────────────────────────────
 * The user: *"letters should be more readable similar treatment we gave to the
 * text in the tv ads"* (2026-08-04). That treatment is `TV_SS` in
 * `ct/apartment.ts`, and the long note there is the argument; this is the same
 * move on a different surface.
 *
 * IT IS A SUPERSAMPLE, NOT A BIGGER SHEET, and getting that backwards is the
 * trap. Raising `SHEET` alone would leave every coordinate in `drawLetter` —
 * the 10 px margin, the 14 px sender baseline, the 12 px line pitch, the stamp
 * at `w - 52` — drawing a small letter in the corner of a big page, and the
 * type would come out SMALLER on screen, not clearer. Instead the CANVAS is
 * `LETTER_SS` times bigger and `drawLetter` paints under
 * `setTransform(SS,0,0,SS,0,0)`, so every rule, band and glyph keeps its exact
 * size and position on the paper and only the SAMPLING of it gets finer.
 * 192x178 -> 576x534. THE DRAWN GLYPH SIZE IS UNCHANGED.
 *
 * WHY IT WAS MUSH. The body is `UI.font(8)` — an 8 px font resolved on a grid
 * where a lower-case stroke is barely one texel wide, so each glyph was mostly
 * antialiased fringe, and the sheet is then magnified hard: 0.2596 m of paper
 * held at 0.42 m under a 55 deg fov fills about 59% of the frame, so one canvas
 * texel spans ~3.5 screen pixels. Grey fringe blown up 3.5x is the smear he is
 * looking at. At SS 3 the same 8 px glyph is resolved across 24 texels.
 *
 * 3 RATHER THAN 2 for the reason the television gives: the letters are drawn
 * with integer coordinates and integer font sizes, so an integer factor keeps
 * every edge on a texel boundary, and 3 is where an 8 px face has enough grid
 * under it to hold a stroke.
 *
 * STILL NEAREST — the framework's own filtering is untouched, and a soft page
 * in this flat would read as blurry rather than sharp. ASPECT UNTOUCHED: 192:178
 * and 576:534 are the same ratio, so the plane below stays derived and correct.
 *
 * COST IS NOTHING. 9x the fill, but a letter repaints on OPEN and on a PAGE
 * TURN — not per frame, unlike the television — so this is nine times a paint
 * that happens when a hand moves.
 */
const LETTER_SS = 3;
/** the canvas the framework actually allocates, and the space clicks arrive in */
const PANEL_W = SHEET.w * LETTER_SS;
const PANEL_H = SHEET.h * LETTER_SS;
/**
 * The roll on the page — see the note by `sheet.rotateZ` below. A CONSTANT
 * because the sheet is now re-aimed on every open and the roll has to be
 * re-applied each time; a literal typed in two places is the same defect as a
 * coordinate typed in two places (GOTCHAS §20).
 */
const SHEET_ROLL = 0.035;

/**
 * WHERE THE PAPER HANGS WHILE YOU READ IT — and why it is per-interaction.
 *
 * ⚠ THE SHEET IS THE POSE. `ct/hud.ts` hands this mesh to `crosstown.ts`'s
 * focus controller, and `poseFor` derives EVERYTHING from it: the eye goes
 * `standoff` back along the page's own normal, and — this is the part that
 * bit — **the FEET are moved to `c + normal * 0.95`**. The player is put in
 * front of the paper, not the paper in front of the player.
 *
 * There is one sheet and there were three [E]s using it, all pointing at the
 * single build-time position by the mailbox. Two of those three are nowhere
 * near it: the landlord stands five metres down the lobby at the foot of the
 * stairs, and the slip under your door is on FLOOR 3, directly above the boxes.
 * Reading the slip therefore did exactly what the user reported —
 *
 *   *"its bugged i cant read it and i teleport to outside my apt?"*
 *
 * — because `rig.sit` put his feet at the mailbox's x/z, which three storeys up
 * is the landing OUTSIDE 301, and the eye, clamped to floor 3's ground by
 * `poseFor`'s "a person is still a person" clamp, ended up staring at the
 * floorboards with the page three storeys below them. ONE cause, both symptoms:
 * the paper was in the wrong room.
 *
 * So each interaction says where the page it opens is held. The rule for
 * picking one: the reader must end up standing 0.95 m back along `yaw`'s normal
 * ON THE SAME FLOOR, with nothing between that eye and the page.
 */
type Hold = { x: number; y: number; z: number; yaw: number };
/**
 * WHERE A LETTER IS HELD WHEN HE READS IT OUT OF HIS BAG — which is anywhere.
 *
 * The three existing holds are places in the world (the box, the landlord's
 * hands, the slip under his door) because those reads happen at those places.
 * A piece out of the bag has no place, so it is held in front of HIM: 0.42 m
 * along his own facing at chest height, which is `standoff` and where a person
 * holds something they are reading. Same reason and the same number.
 */
function holdInFront(ctx: CtxBuild): Hold {
  const yaw = ctx.player.yaw();
  return {
    // 0.42 m along his own facing — `standoff`, the distance a person holds
    // something they are reading. `(sin yaw, -cos yaw)` is the direction he is
    // looking; see `PlayerRef.yaw`.
    x: ctx.player.x() + Math.sin(yaw) * 0.42,
    y: ctx.player.gy() + 1.42,
    z: ctx.player.z() - Math.cos(yaw) * 0.42,
    // ⚠ `-yaw`, NOT `yaw + PI`, AND THAT ONE SIGN IS THE WHOLE BUG.
    //
    // *"reading letters from my bag turns me around?"*   (2026-08-05)
    //
    // The route HAD a Hold — I wrote this in `27fda3d1` — and the Hold was
    // wrong, which is worse than missing because it looked handled. A plane's
    // default normal is +z, so `rotation.y = t` points it at `(sin t, cos t)`.
    // For the page to FACE HIM its normal must point back along his line of
    // sight, `(-sin yaw, +cos yaw)`, and that is `t = -yaw`. `yaw + PI` gives
    // `(-sin yaw, -cos yaw)` — the z term flipped, so the page faced AWAY.
    //
    // `poseFor` then did exactly its job: it stood the eye off along the sheet's
    // normal, which put him on the far side of his own letter looking back at
    // himself. Facing north he was spun 180 degrees.
    //
    // CHECKED AGAINST A KNOWN-GOOD HOLD rather than reasoned alone: the mailbox
    // sheet is built at `rotation.y = -PI/2` "into the hall", and the reader
    // stands on the -x side looking +x, i.e. yaw = +PI/2. `-yaw` = -PI/2. It
    // agrees. So do HOLD_HALL and HOLD_301.
    yaw: -yaw,
  };
}
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
/** is the open pile the BOX's, or a re-read of the archive? Only the first is
 *  takeable — see the note in `takeCurrent`. */
let readingLive = false;
/** set by `register`, so the notice can print a live figure */
let CTX: CtxBuild | null = null;
let PANEL: Panel | null = null;
/**
 * THE PAPER ITSELF, as an object in the lobby — see the block above
 * `buildPanel`. Built by `register` (it needs the bank's measured face) and
 * read by the panel's `surface.mesh()` at open time, which is exactly the
 * indirection `ScreenSurface` was shaped for: the module cannot see this mesh
 * when it registers the panel, and does not have to.
 */
let sheet: THREE.Mesh | null = null;

const fill = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c; g.fillRect(x, y, w, h);
};

/** Paint the SHEET. The framework has already drawn everything around it, and
 *  the origin is the screen's own top left.
 *
 *  THE ARGUMENTS ARE IGNORED ON PURPOSE. The framework passes the CANVAS size,
 *  which is `LETTER_SS` times the drawing space; everything below is written in
 *  sheet units and the transform does the rest. See `LETTER_SS`. */
function drawLetter(g: CanvasRenderingContext2D): void {
  const l = reading[page];
  if (!l) return;
  // ══ THE SUPERSAMPLE IS APPLIED HERE, ONCE, FOR EVERY PAINTER ═══════════
  //
  // *"i like this but again this is not an original letter or flyer."* — on a
  // piece that HAS its own painter and was not showing it.
  //
  // ⚠ THE DISPATCH WAS NEVER THE BUG. Every `art` key in JUNK resolves, none is
  // missing, and there is one reading path. THE SCALE WAS. `g.scale(LETTER_SS,
  // LETTER_SS)` lived inside `drawTyped` — so the typewritten letter was
  // composed at 192x178 on the 576x534 canvas correctly, and all sixteen
  // bespoke painters, which are written in the same 192x178 units, drew at a
  // THIRD of that size in the top-left corner of the sheet. The rest of the
  // canvas went unpainted and the sheet's `alphaTest` cut it away.
  //
  // Sixteen correct drawings, none of them reachable at the right size, and the
  // one piece that DID look right was the only one still using drawTyped —
  // which is exactly the shape of "they all look the same" he reported three
  // times running.
  //
  // So it is hoisted out of `drawTyped` to here, where every branch gets it.
  // `scale`, NOT `setTransform`: the framework's screen-space fallback
  // (`ct/hud.ts:1422`) does `g.translate(SX, SY)` first to seat the page in the
  // cabinet's recess, and `setTransform` would wipe that. Both call sites wrap
  // this in `g.save()`/`g.restore()`, so nothing accumulates across repaints.
  g.save();
  g.scale(LETTER_SS, LETTER_SS);
  (ART[l.art ?? ''] ?? drawTyped)(g, l);
  g.restore();
  // ── WHICH ONE OF HOW MANY, PRINTED ON IT ────────────────────────────────
  // Bottom right, in the corner a page number goes in, small and grey — so the
  // pile says how deep it is without the framework's caption saying it. Only
  // when there IS a pile: one piece of post does not need to be numbered, and
  // "1 of 1" is the sort of line that makes a world feel like a form.
  // Drawn AFTER the piece so it lands on the paper rather than under it, and
  // inside the same `LETTER_SS` scale every piece is composed at.
  if (reading.length > 1) {
    g.save();
    g.scale(LETTER_SS, LETTER_SS);          // its own, since the dispatch closed
    g.fillStyle = 'rgba(90,84,70,0.75)';
    g.font = UI.font(7);
    g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillText(`${page + 1}/${reading.length}`, SHEET.w - 6, SHEET.h - 6);
    g.restore();
  }
}

/** the space a piece of mail is drawn into, in sheet units. A piece may use all
 *  of it or a corner of it; what it leaves is cut away (see the sheet's
 *  material). */
const PAPER = { w: SHEET.w, h: SHEET.h };

/** every piece's own painter, by `Letter.art` */
const ART: Record<string, (g: CanvasRenderingContext2D, l: Letter) => void> = {};


// ══ THE PIECES THAT ARE NOT LETTERS ════════════════════════════════════════
//
// *"the mail is too homogenous … there could also be flyers, and junk mail, and
//  stuff mixed in"*   (2026-08-05)
//
// EACH ONE IS ITS OWN DRAWING, not a parameter on a shared one. What tells you
// what a piece of mail is, before you read a word, is its PAPER and its
// LAYOUT — so these differ in stock colour, in shape, in how much of the space
// they fill, and in what marks they carry. `Letter.art` names one; anything
// unnamed is `drawTyped`, which is the typewritten letter this file has always
// drawn and which the landlord's handed-over short slip keeps.
//
// THEY COME OFF THE STREET'S OWN BUSINESSES, which is the move that made the
// television ads work and costs nothing because the shops already exist:
// VIDEO HUT, the DINER, the PAWN shop, the BODEGA, SLEEP CENTER.
//
// LEGIBILITY IS NOT NEGOTIABLE. `LETTER_SS` supersamples all of this 3x at
// unchanged glyph size, and every piece below is written in the same 8-9 px
// faces the letter uses. A cheap flyer is a LOOK — coarse colour, heavy rules,
// a smudged second plate — never an excuse for type you cannot read.

/** the fold every piece that came through a letterbox carries */
function creases(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n = 2): void {
  for (let i = 1; i <= n; i++) {
    fill(g, 'rgba(120,112,90,0.11)', x, Math.round(y + (h * i) / (n + 1)), w, 1);
  }
}
/** a sheet of stock: the paper, its lit top edge and its shaded bottom */
function stock(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
               paper: string, hi: string, lo: string): void {
  fill(g, paper, x, y, w, h);
  fill(g, hi, x, y, w, 2);
  fill(g, lo, x, y + h - 3, w, 3);
}

/**
 * ══ EVERY PIECE ITS OWN SHAPE ══════════════════════════════════════════════
 *
 * *"yea so the changes are way too subtle basically none of the dimensions
 *  should be square unless its like a note or a post-it"*   (2026-08-05)
 *
 * HE FOUND THE CAUSE UNDER ALL OF IT, and it is not the printing. FIFTEEN
 * PIECES SHARED ONE SILHOUETTE. `PAPER` is 192x178 — 1.08:1, near enough
 * square — and eleven of the fifteen painters filled it edge to edge, so every
 * toner band, skew, crease and blotch was decoration on the same card. Shape is
 * the first thing the eye resolves and the only thing it resolves BEFORE
 * reading, and there was exactly one of it. That is why three rounds of finer
 * texture changed nothing he could see: the differences were all downstream of
 * the one thing that had none.
 *
 * ALMOST NOTHING IN REAL MAIL IS SQUARE. Paper is long. A letter is 1:1.29, a
 * legal sheet 1:1.65, a #10 envelope 2.29:1 on its side, an appointment card
 * about 1.75:1, a till docket narrower still. THE SQUARE THINGS ARE NOTES —
 * which is why the super's note is the one square piece in this table, and
 * being the only one makes it the most recognisable object in the box instead
 * of the most generic.
 *
 * SO THIS TABLE IS THE DRAWING. No two pieces share an aspect; the set runs
 * from 2.26:1 landscape to 1:2.53 portrait; and every painter takes its
 * rectangle from here rather than typing its own percentage of the sheet, so
 * the spread can be read off in one place and corrected in one place
 * (GOTCHAS §20 — a number that has to agree with another number belongs in one
 * of them). THE SPACE AROUND A PIECE IS NEVER PAINTED and the sheet's
 * `alphaTest` cuts it away, so these are genuinely different sizes of paper
 * rather than framed insets on one card.
 *
 * ⚠ LAYOUT FOLLOWS SHAPE, AND THAT IS THE PART THAT BITES. A 68-unit ribbon
 * does not hold a 30-character line. Every painter below FLOWS its copy
 * (`flow`/`wrapTo`, which measure the real face at the real width) instead of
 * slicing at `COLS` — that constant is 35, measured against the full 192 sheet,
 * and it is now wrong for fourteen of the fifteen. Slicing at `COLS` on a
 * narrow piece is the carbon's overflow bug on a different piece of paper, and
 * the whole point of `wrapTo` existing is that it cannot happen again.
 *
 * ⚠ AND THE TYPE GETS SMALLER AS THE PAPER GETS NARROWER, on purpose. A 6 px
 * face is 18 texels tall at `LETTER_SS` 3 and this file already sets small
 * print at 6; what is NOT allowed is 6 px that has been squeezed or clipped,
 * which is why the narrow pieces flow to more lines rather than to shorter
 * ones. Legibility is the constraint the shape has to fit inside, not the
 * other way round.
 */
const SHAPES: Record<string, { w: number; h: number }> = {
  // ── LANDSCAPE: the things that are wider than they are tall ──────────────
  'envelope-prev':       { w: 190, h:  84 },   // 2.26 : 1   a #10 window envelope
  'card-dentist':        { w: 132, h:  80 },   // 1.65 : 1   an appointment card
  'postcard':            { w: 168, h: 108 },   // 1.56 : 1   a 6x4 postcard
  'flyer-pizza':         { w: 188, h: 136 },   // 1.38 : 1   a half-sheet flyer
  'dotmatrix-video2000': { w: 192, h: 152 },   // 1.26 : 1   a fanfold tractor sheet
  // ── THE ONE SQUARE THING, AND IT IS A NOTE ───────────────────────────────
  'note-super':          { w: 104, h: 100 },   // 1.04 : 1   torn off a legal pad
  // ── PORTRAIT: everything that came off a ream ────────────────────────────
  'catalogue-order':     { w: 154, h: 172 },   // 1 : 1.12   400 pages, and thick
  'classified-penny':    { w: 148, h: 178 },   // 1 : 1.20   a free weekly tabloid
  'catalogue-302':       { w: 138, h: 178 },   // 1 : 1.29   a seed catalogue
  'letterhead-bank':     { w: 126, h: 178 },   // 1 : 1.41   proper letter stock
  'bill-utility':        { w: 116, h: 178 },   // 1 : 1.53   a statement with a stub
  'menu-diner':          { w: 104, h: 178 },   // 1 : 1.71   a takeaway menu
  'notice-precinct':     { w:  94, h: 178 },   // 1 : 1.89   a legal-size notice
  'flyer-video':         { w:  84, h: 178 },   // 1 : 2.12   a long handbill
  'chain-letter':        { w:  68, h: 172 },   // 1 : 2.53   a copied ribbon
};

/**
 * The rectangle a piece occupies, centred in the drawing space.
 *
 * CENTRED rather than corner-anchored because the sheet's plane is the whole
 * 192x178 and the framework aims the eye at its middle — an off-centre piece
 * would hang to one side of the reader's gaze for no reason. A piece that wants
 * to sit high (the super's note is pinned, not posted) offsets from here.
 */
function paper(art: string): { x: number; y: number; w: number; h: number } {
  const s = SHAPES[art] ?? { w: PAPER.w, h: PAPER.h };
  return {
    x: Math.round((PAPER.w - s.w) / 2),
    y: Math.round((PAPER.h - s.h) / 2),
    w: s.w,
    h: s.h,
  };
}

/** `flow`, but CENTRED on `cx` — the half of the split that separates a printed
 *  public notice from a typed page. Same measure-and-wrap as `flow`, same
 *  returned y, so whatever comes next is placed off the foot of this. */
function flowMid(g: CanvasRenderingContext2D, cx: number, y: number, w: number,
                 lines: readonly string[], px: number, ink: string, bold = false): number {
  g.font = UI.font(px, bold);
  g.fillStyle = ink;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const lead = px + 4;
  let cy = y;
  for (const raw of lines) {
    if (!raw.trim()) { cy += Math.round(lead * 0.5); continue; }
    for (const seg of wrapTo(g, raw.trim(), w)) { g.fillText(seg, cx, cy); cy += lead; }
  }
  g.textAlign = 'left';
  return cy;
}

/**
 * ── THE VIDEO HUT FLYER: A LONG CHEAP HANDBILL ─────────────────────────────
 * 84 x 178, 1:2.12 — the narrowest thing in the box bar the chain letter, and
 * that is honest: a video shop's new-releases sheet is a strip run off cheap so
 * it fits under a wiper or through a slot. Goldenrod stock edge to edge,
 * printed in two plates on a press that does not quite register, so the red
 * sits 1 texel off the black. Titles stack DOWN the strip with the rating under
 * each — the wide two-column layout it used to have does not exist at 86 units,
 * and that is the shape doing the design.
 */
ART['flyer-video'] = (g, l) => {
  const P = paper('flyer-video'), IN = 6, TW = P.w - IN * 2;
  const cx = P.x + P.w / 2;
  stock(g, P.x, P.y, P.w, P.h, '#e8d38a', '#f4e3a8', '#c9b168');
  creases(g, P.x, P.y, P.w, P.h, 2);
  // the banner, in the shop's own sign red, with the mis-registered black
  fill(g, '#8e2b22', P.x + IN, P.y + 6, TW, 24);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(30,26,22,0.55)'; g.font = UI.font(11, true);
  g.fillText('VIDEO HUT', cx + 1, P.y + 23);                 // the off-plate ghost
  g.fillStyle = '#f2e6c8';
  g.fillText('VIDEO HUT', cx, P.y + 22);
  g.fillStyle = '#3a3126'; g.font = UI.font(7, true);
  g.fillText('NEW THIS WEEK', cx, P.y + 42);
  fill(g, '#8e2b22', P.x + IN + 6, P.y + 46, TW - 12, 1);
  // TITLE, THEN ITS RATING UNDER IT. The copy is written "NAME  (18)" for a
  // wide sheet; on a strip the bracket is split off and set small underneath
  // rather than wrapped, because "(18)" alone on a line reads as a mistake.
  g.textAlign = 'left';
  let y = P.y + 54;
  for (const line of l.lines.slice(0, 3)) {
    const m = line.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    g.fillStyle = '#2b2620'; g.font = UI.font(7, true);
    for (const seg of wrapTo(g, (m ? m[1] : line).trim(), TW)) { g.fillText(seg, P.x + IN, y); y += 10; }
    g.fillStyle = '#6b6455'; g.font = UI.font(6);
    g.fillText(m ? `RATED ${m[2]}` : '', P.x + IN, y);
    y += 10;
  }
  flow(g, P.x + IN, P.y + 118, TW, l.lines.slice(3), 6, '#4a4030');
  // the late-fee box, ruled, because that is the part they want read
  const by = P.y + P.h - 46;
  fill(g, '#d8bf72', P.x + IN, by, TW, 40);
  fill(g, '#8e2b22', P.x + IN, by, TW, 2);
  fill(g, '#8e2b22', P.x + IN, by + 38, TW, 2);
  g.textAlign = 'center';
  g.fillStyle = '#8e2b22'; g.font = UI.font(8, true);
  g.fillText('LATE FEES ARE', cx, by + 15);
  g.font = UI.font(9, true);
  g.fillText('$1.50 A DAY', cx, by + 27);
  g.fillStyle = '#3a3126'; g.font = UI.font(6);
  g.fillText('BE KIND. REWIND.', cx, by + 36);
  g.textAlign = 'left';
};

/**
 * ── THE DINER'S TAKEAWAY MENU ──────────────────────────────────────────────
 * 104 x 178, 1:1.71 — a long slip, folded three times to get into a pocket,
 * which is what a diner hands you with the check. Green ink on white, a rule
 * under the name, and dish-leader-price down the strip the way a menu is set.
 * THE LEADER IS MEASURED, not counted: at 104 units a long dish leaves room for
 * two dots and a short one for a dozen, and a fixed count either collides with
 * the price or leaves a gap.
 */
ART['menu-diner'] = (g, l) => {
  const P = paper('menu-diner'), IN = 8, TW = P.w - IN * 2;
  const cx = P.x + P.w / 2, right = P.x + P.w - IN;
  stock(g, P.x, P.y, P.w, P.h, '#f0ece0', '#faf7ee', '#cfc9b8');
  creases(g, P.x, P.y, P.w, P.h, 3);                 // folded small, into a pocket
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#2e5136'; g.font = UI.font(11, true);
  g.fillText('THE DINER', cx, P.y + 22);
  g.fillStyle = '#6b6455'; g.font = UI.font(6);
  g.fillText('OPEN 6 AM — 11 PM', cx, P.y + 33);
  fill(g, '#2e5136', P.x + IN, P.y + 38, TW, 1);
  let y = P.y + 52;
  for (const line of l.lines) {
    const [dish, price] = line.split('|');
    if (price === undefined) {                       // a heading, not a dish
      g.textAlign = 'left'; g.fillStyle = '#2e5136'; g.font = UI.font(7, true);
      g.fillText(dish, P.x + IN, y);
    } else {
      g.textAlign = 'left'; g.fillStyle = '#3a352c'; g.font = UI.font(6);
      g.fillText(dish, P.x + IN, y);
      const dw = g.measureText(dish).width, pw = g.measureText(price).width;
      g.textAlign = 'right'; g.fillText(price, right, y);
      // the leader, measured into whatever gap is actually left
      const gap = TW - dw - pw - 8;
      if (gap > 4) {
        g.textAlign = 'left'; g.fillStyle = 'rgba(58,53,44,0.35)';
        g.fillText('.'.repeat(Math.floor(gap / g.measureText('.').width)), P.x + IN + dw + 4, y);
      }
    }
    y += 12;
  }
  g.textAlign = 'left';
};

/**
 * ── A LETTER FOR WHOEVER LIVED HERE BEFORE HIM ─────────────────────────────
 * 190 x 84, 2.26:1 — a #10 window envelope, and THE WIDEST THING IN THE BOX by
 * a wide margin. That single number does the whole job the biro and the
 * franking mark were being asked to do: nothing else in the mail is a letterbox
 * shape, so this reads as an envelope before a mark is on it. The only piece
 * that is an envelope rather than its contents — the address shows through a
 * grey panel, the name is not his, and a hand has written on it.
 */
ART['envelope-prev'] = (g, l) => {
  const P = paper('envelope-prev');
  stock(g, P.x, P.y, P.w, P.h, '#e9e6da', '#f6f4ea', '#c6c1b2');
  // the flap seam across the back, which is what makes it read as an envelope
  fill(g, 'rgba(120,112,90,0.16)', P.x, P.y + 30, P.w, 1);
  // the window, and the address showing through it
  const wx = P.x + 12, wy = P.y + 36, ww = 100, wh = 38;
  fill(g, '#cfcabb', wx - 2, wy - 2, ww + 4, wh + 4);
  fill(g, '#dedac9', wx, wy, ww, wh);
  flow(g, wx + 5, wy + 12, ww - 10, l.lines, 7, '#3a352c');
  // the franking mark, top right, where a stamp would be
  const fx = P.x + P.w - 52, fy = P.y + 6;
  g.strokeStyle = 'rgba(90,80,70,0.55)'; g.lineWidth = 1;
  g.strokeRect(fx + 0.5, fy + 0.5, 42, 20);
  g.fillStyle = 'rgba(90,80,70,0.75)'; g.font = UI.font(7, true);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('POSTAGE', fx + 21, fy + 9);
  g.fillText('PAID', fx + 21, fy + 17);
  for (let i = 0; i < 5; i++) fill(g, 'rgba(90,80,70,0.35)', fx - 22, fy + 3 + i * 4, 18, 2);
  // and somebody's biro, at an angle, because a hand wrote it. BELOW the
  // window, not across it — at 84 units tall there is one clear band left and
  // this is it.
  g.save();
  g.translate(P.x + 62, P.y + P.h - 4);
  g.rotate(-0.07);
  g.fillStyle = 'rgba(40,52,96,0.8)'; g.font = UI.font(7, true);
  g.textAlign = 'left';
  g.fillText('NOT AT THIS ADDRESS', 0, 0);
  g.restore();
  g.textAlign = 'left';
};


/** tractor-feed holes down both edges — the tell of fanfold computer paper */
function sprockets(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  fill(g, 'rgba(120,112,90,0.18)', x + 5, y, 1, h);
  fill(g, 'rgba(120,112,90,0.18)', x + w - 6, y, 1, h);
  for (let cy = y + 6; cy < y + h - 4; cy += 8) {
    fill(g, '#2a2620', x + 2, cy, 3, 3);
    fill(g, '#2a2620', x + w - 5, cy, 3, 3);
  }
}
/** a perforation: the line you tear along */
function perf(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  for (let i = 0; i < w; i += 4) fill(g, 'rgba(90,84,70,0.5)', x + i, y, 2, 1);
}

/**
 * ── VIDEO 2000: A DOT-MATRIX STATEMENT ─────────────────────────────────────
 * 192 x 152, 1.26:1 — LANDSCAPE, because a 14 7/8" tractor sheet is wider than
 * it is deep and that is the one proportion nothing else in the box has. The
 * sprocket strips are still on it and the green bar stripes run the full width.
 * A rental chain does not write you a letter, it prints an account.
 */
ART['dotmatrix-video2000'] = (g, l) => {
  const P = paper('dotmatrix-video2000'), IN = 14, TW = P.w - IN * 2;
  stock(g, P.x, P.y, P.w, P.h, '#eceadd', '#f7f6ec', '#cfccbc');
  for (let y = P.y + 30; y < P.y + P.h - 10; y += 16) {
    fill(g, 'rgba(120,160,120,0.20)', P.x + 10, y, P.w - 20, 8);
  }
  sprockets(g, P.x, P.y, P.w, P.h);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#3a352c'; g.font = UI.font(8, true);
  g.fillText('VIDEO 2000', P.x + IN, P.y + 14);
  g.font = UI.font(7);
  g.fillText('MEMBER SERVICES', P.x + IN, P.y + 23);
  fill(g, '#8d8672', P.x + 12, P.y + 27, P.w - 24, 1);
  flow(g, P.x + IN, P.y + 44, TW, l.lines, 8, '#3a352c');
  // the machine's own footer, right where a printer puts it
  g.fillStyle = '#6b6455'; g.font = UI.font(7);
  g.fillText('* * * THIS IS NOT A BILL * * *', P.x + IN, P.y + P.h - 14);
};

/**
 * ── CITY LIGHT & POWER: A FORM WITH A TEAR-OFF STUB ────────────────────────
 * 116 x 178, 1:1.53 — narrow and long, which is what a statement printed to be
 * torn in two has to be: boxed fields at the top, the amount in a rule of its
 * own, and the bottom quarter a payment stub below a perforation. The
 * perforation gives the piece two distinct halves at a glance and the aspect
 * gives it a distinct outline before that.
 */
ART['bill-utility'] = (g, l) => {
  const P = paper('bill-utility'), IN = 8, TW = P.w - IN * 2;
  const TEAR = P.y + P.h - 46, BLUE = '#2e4b6b';
  stock(g, P.x, P.y, P.w, P.h, '#eae7d6', '#f6f4e6', '#c9c4b1');
  fill(g, BLUE, P.x, P.y, P.w, 18);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#e8e4d4'; g.font = UI.font(7, true);
  g.fillText('CITY LIGHT & POWER', P.x + IN, P.y + 13);
  // the boxed fields — account, then the figure they want you to see
  l.lines.slice(0, 2).forEach((ln, i) => {
    const by = P.y + 26 + i * 20;
    g.strokeStyle = 'rgba(46,75,107,0.55)'; g.lineWidth = 1;
    g.strokeRect(P.x + IN + 0.5, by + 0.5, TW - 1, 16);
    g.fillStyle = i === 1 ? BLUE : '#3a352c';
    g.font = UI.font(i === 1 ? 8 : 6, i === 1);
    g.fillText(ln, P.x + IN + 5, by + 11);
  });
  flow(g, P.x + IN, P.y + 78, TW, l.lines.slice(2), 6, '#4a443a');
  // the stub
  perf(g, P.x + 6, TEAR, P.w - 12);
  g.fillStyle = '#6b6455'; g.font = UI.font(6);
  g.fillText('DETACH AND RETURN', P.x + IN, TEAR + 12);
  fill(g, 'rgba(46,75,107,0.10)', P.x + 6, TEAR + 16, P.w - 12, P.h - (TEAR - P.y) - 22);
  g.fillStyle = BLUE; g.font = UI.font(7, true);
  g.fillText('227 W 19TH  APT 301', P.x + IN, TEAR + 29);
  g.fillStyle = '#3a352c'; g.font = UI.font(6);
  g.fillText('PAY AT ANY BRANCH', P.x + IN, TEAR + 40);
};

/**
 * ── PALERMO PIZZA: A GLOSSY TAKEAWAY FLYER WITH A COUPON ───────────────────
 * 188 x 136, 1.38:1 — a half-sheet, LANDSCAPE, because a pizza flyer is printed
 * two-up on a letter sheet and guillotined across the middle. Red, white and
 * green, the price as the loudest thing on it, and the coupon ruled off along a
 * dashed cut line across the foot — which is the shape of every pizza flyer
 * that has ever come through a door.
 */
ART['flyer-pizza'] = (g, l) => {
  const P = paper('flyer-pizza'), IN = 8, TW = P.w - IN * 2;
  const cx = P.x + P.w / 2, RED = '#a8322a', GREEN = '#3f6b3a';
  stock(g, P.x, P.y, P.w, P.h, '#f2efe2', '#fbf9ef', '#d2cebd');
  fill(g, GREEN, P.x, P.y, P.w, 5);
  fill(g, RED, P.x, P.y + 5, P.w, 22);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#f5efdc'; g.font = UI.font(12, true);
  g.fillText('PALERMO', cx, P.y + 22);
  g.fillStyle = GREEN; g.font = UI.font(7, true);
  g.fillText('2 BLOCKS DOWN · WE DELIVER', cx, P.y + 40);
  flow(g, P.x + IN, P.y + 56, TW, l.lines.slice(0, 3), 8, '#2b2620');
  // the coupon, cut off along the dash
  const cy = P.y + 96;
  for (let i = 0; i < P.w - 16; i += 5) fill(g, 'rgba(90,84,70,0.55)', P.x + 8 + i, cy, 3, 1);
  fill(g, 'rgba(168,50,42,0.10)', P.x + 8, cy + 3, TW, P.h - 96 - 11);
  g.strokeStyle = RED; g.lineWidth = 1;
  g.strokeRect(P.x + 8.5, cy + 3.5, TW - 1, P.h - 96 - 12);
  g.textAlign = 'center'; g.fillStyle = RED; g.font = UI.font(10, true);
  g.fillText('$1 OFF ANY PIE', cx, cy + 20);
  g.fillStyle = '#6b6455'; g.font = UI.font(6);
  g.fillText(l.lines[3] ?? '', cx, cy + 29);
  g.textAlign = 'left';
};

/**
 * ── A POSTCARD ─────────────────────────────────────────────────────────────
 * 168 x 108, 1.56:1 — a 6x4, and the proportion IS the object: a postcard is
 * the one piece of mail everybody can identify from across a room. Its BACK, so
 * the rule down the middle, the message on the left in biro and, on the right,
 * a stamp with the postmark rings over its corner above three ruled address
 * lines.
 */
ART['postcard'] = (g, l) => {
  const P = paper('postcard');
  stock(g, P.x, P.y, P.w, P.h, '#e4dcc4', '#efe9d6', '#c2b898');
  const mid = P.x + Math.round(P.w * 0.56);
  fill(g, 'rgba(90,84,70,0.45)', mid, P.y + 8, 1, P.h - 16);
  // the stamp, and the postmark rings over its corner
  const sx = P.x + P.w - 34, sy = P.y + 8;
  fill(g, '#b9a878', sx, sy, 26, 20);
  fill(g, '#8a6f47', sx + 3, sy + 3, 20, 14);
  g.strokeStyle = 'rgba(60,55,45,0.45)'; g.lineWidth = 1;
  for (let k = 0; k < 3; k++) g.strokeRect(sx - 6 - k * 3, sy + 2 - k * 3, 26 + k * 6, 20 + k * 6);
  // the address, ruled
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const aw = P.x + P.w - mid - 18;
  for (let k = 0; k < 3; k++) fill(g, 'rgba(90,84,70,0.30)', mid + 8, P.y + 48 + k * 12, aw, 1);
  g.fillStyle = '#2f4f8c'; g.font = UI.font(7);
  g.fillText('APT 301', mid + 10, P.y + 46);
  g.fillText('227 W 19TH', mid + 10, P.y + 58);
  // the message, in the same biro, cramped the way a postcard always is —
  // flowed into the left half rather than sliced, since that half is 86 units
  flow(g, P.x + 8, P.y + 18, mid - P.x - 16, l.lines, 6, '#2f4f8c');
};


/**
 * ── THE SUPER'S NOTE: THE ONE SQUARE THING IN THE BOX ──────────────────────
 *
 * *"basically none of the dimensions should be square unless its like a note or
 *  a post-it"*   (2026-08-05)
 *
 * 104 x 100, 1.04:1 — AND IT IS THE ONLY ONE. Every other piece in `SHAPES` is
 * a rectangle you could name; this is a square block torn off a legal pad,
 * which is exactly the object that IS square in real life. Being the only one
 * is what makes it identifiable: it was indistinguishable when it shared a
 * silhouette with fourteen sheets of post, and it is unmistakable now that
 * nothing else has its outline.
 *
 * It is also the only piece nobody posted — pushed under the door, so no stamp,
 * no address and no straight bottom edge. Ruled paper, the red margin down the
 * left, a ragged tear across the foot, and the writing in biro CAPITALS with a
 * slight roll on it, because a hand is not a typewriter. IT SITS HIGH rather
 * than centred, because it was pinned rather than delivered.
 */
ART['note-super'] = (g, l) => {
  const P = paper('note-super'), x = P.x, y = 16;
  fill(g, '#eeead6', x, y, P.w, P.h);
  fill(g, '#f8f5e6', x, y, P.w, 2);
  // the ruled lines and the red margin a legal pad has
  for (let k = 1; k <= 7; k++) fill(g, 'rgba(90,120,150,0.22)', x + 4, y + 8 + k * 10, P.w - 8, 1);
  fill(g, 'rgba(170,70,60,0.35)', x + 13, y, 1, P.h);
  // THE TORN FOOT. Stepped, never a path fill — a diagonal here would
  // antialiase into a second tone at LETTER_SS, which is this file's own rule.
  for (let i = 0; i < P.w; i += 3) {
    const bite = 2 + ((i * 7) % 5);
    g.clearRect(x + i, y + P.h - bite, 3, bite);
  }
  g.save();
  g.translate(x + 18, y + 18);
  g.rotate(-0.02);                                   // a hand does not rule straight
  flow(g, 0, 0, P.w - 26, l.lines, 6, '#2f4f8c', true);
  g.restore();
};

/**
 * ── ADDRESSED TO 302: SOMEBODY ELSE'S SEED CATALOGUE ───────────────────────
 * 138 x 178, 1:1.29 — letter-proportioned, which is what a mail-order seed
 * catalogue is trimmed to. Not a letter at all but a COVER: a colour block with
 * a title over it, a price corner, and the neighbour's name on a mailing label
 * across the bottom. The joke is that it is not yours, so the label is the
 * loudest thing on it.
 */
ART['catalogue-302'] = (g, l) => {
  const P = paper('catalogue-302'), IN = 8, TW = P.w - IN * 2;
  const cx = P.x + P.w / 2, GREEN = '#4a6b3a';
  stock(g, P.x, P.y, P.w, P.h, '#e8e4d2', '#f4f1e2', '#c8c3b0');
  fill(g, GREEN, P.x + 6, P.y + 6, P.w - 12, 78);               // the cover photo
  // three flat rows of "seedlings", which is all a 1997 cover needs to be
  for (let k = 0; k < 5; k++) {
    fill(g, '#6f8f52', P.x + 16 + k * 24, P.y + 52, 8, 26);
    fill(g, '#c0563f', P.x + 14 + k * 24, P.y + 44, 12, 8);
  }
  fill(g, 'rgba(0,0,0,0.22)', P.x + 6, P.y + 62, P.w - 12, 22);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#f2eeda'; g.font = UI.font(11, true);
  g.fillText('SPRING SEEDS', cx, P.y + 30);
  g.font = UI.font(6);
  g.fillText('1,200 VARIETIES · FREE SHIPPING', cx, P.y + 42);
  // the price corner
  fill(g, '#e8dcb8', P.x + P.w - 40, P.y + 8, 32, 16);
  g.fillStyle = '#3a352c'; g.font = UI.font(8, true);
  g.fillText('$2.95', P.x + P.w - 24, P.y + 20);
  // THE MAILING LABEL, which is the whole point of this piece
  g.textAlign = 'left';
  fill(g, '#f6f4ea', P.x + 12, P.y + P.h - 66, P.w - 24, 34);
  fill(g, 'rgba(90,84,70,0.35)', P.x + 12, P.y + P.h - 66, P.w - 24, 1);
  g.fillStyle = '#2b2620'; g.font = UI.font(8, true);
  g.fillText('APT 302', P.x + 18, P.y + P.h - 52);
  g.fillStyle = '#4a443a'; g.font = UI.font(6);
  g.fillText('227 W 19TH — THIS BUILDING', P.x + 18, P.y + P.h - 40);
  flow(g, P.x + IN, P.y + P.h - 22, TW, l.lines.slice(0, 2), 6, '#6b6455');
};

/**
 * ── FIRST FEDERAL: A BANK USES CRISP TYPE ──────────────────────────────────
 * 126 x 178, 1:1.41 — the closest thing here to proper letter stock, and
 * deliberately the opposite of the super's square note beside it: a ruled
 * letterhead with the bank's mark, body copy flowed to the measure, and the APR
 * in the small print at the foot where a bank puts the part it does not want
 * read. White stock, navy ink, no smudge anywhere.
 */
ART['letterhead-bank'] = (g, l) => {
  const P = paper('letterhead-bank'), IN = 8, TW = P.w - IN * 2;
  const NAVY = '#28405e';
  stock(g, P.x, P.y, P.w, P.h, '#f4f2ea', '#fbfaf4', '#d4d0c4');
  creases(g, P.x, P.y, P.w, P.h, 2);
  // the mark: a flat shield, which is every savings bank's logo in 1997
  fill(g, NAVY, P.x + IN, P.y + 10, 14, 16);
  fill(g, '#f4f2ea', P.x + IN + 3, P.y + 13, 8, 7);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = NAVY; g.font = UI.font(8, true);
  g.fillText('FIRST FEDERAL', P.x + IN + 20, P.y + 19);
  g.font = UI.font(6); g.fillStyle = '#6b6455';
  g.fillText('SAVINGS · MEMBER FDIC', P.x + IN + 20, P.y + 28);
  fill(g, NAVY, P.x + IN, P.y + 34, TW, 2);
  const end = flow(g, P.x + IN, P.y + 52, TW, l.lines.slice(0, 3), 7, '#2b2620');
  flow(g, P.x + IN, end + 6, TW, l.lines.slice(3), 7, NAVY, true);
  // THE SMALL PRINT, at the foot, above a rule — where a bank puts the part it
  // would rather you did not read. Still legible, because that is the standard.
  fill(g, 'rgba(40,64,94,0.35)', P.x + IN, P.y + P.h - 34, TW, 1);
  flow(g, P.x + IN, P.y + P.h - 24, TW,
       ['Rate variable. Offer subject to approval.'], 6, '#6b6455');
};

/**
 * ── CRIMEWATCH: A PRECINCT NOTICE, WHICH IS A PRINTED FORM ─────────────────
 *
 * *"so the chain letter and the crime watch look identical they need to be
 *  distinct"*   (2026-08-05)
 *
 * HE WAS RIGHT AND THE OLD PAIR WERE THE SAME DRAWING. Both filled the whole
 * 192x178 sheet; both were grey-cream — `#dedcd2` against `#e6e3d6`, eight
 * units apart and one colour to an eye; both put a CENTRED BOLD HEADING at y 34
 * over a full-width dark rule with left-aligned all-caps 8 px body from y 60 at
 * a 13 px pitch. Identical outline, identical skeleton, identical palette.
 * Everything meant to separate them was print-quality texture — a 22 px toner
 * band at 7% alpha here, 26 blotches at 6% and a 1.5 degree skew there — and
 * NONE OF IT SURVIVES at this size.
 *
 * SO THEY ARE SPLIT ON SHAPE FIRST. This is 94 x 178, 1:1.89, a legal-size
 * sheet: the proportion a municipal notice is actually run off on so it can be
 * stapled to a board. The chain letter is 68 x 172, 1:2.53 — twenty-six units
 * narrower and visibly a different object across the room, before a mark is
 * printed on either.
 *
 * THEN ON EVERYTHING THAT READS. White stock against the chain letter's
 * yellowed; a 3 px black rule box round the whole page against no border at
 * all; a solid navy masthead with the crest reversed out of it and a second
 * navy bar at the foot against no letterhead whatsoever; the advisory CENTRED
 * in its own ruled panel against flush-left ragged type running to the edges.
 *
 * NOT THE BANK'S WHITE PAGE EITHER, which is the near-miss worth naming.
 * `letterhead-bank` is also white with a navy mark — but it is 126 wide to this
 * one's 94, carries a 14 px shield in its top-left corner and one 2 px rule,
 * and is set flush left. Two solid navy bars inside a heavy black frame have
 * nothing in common with it.
 */
ART['notice-precinct'] = (g, l) => {
  const P = paper('notice-precinct'), IN = 8, TW = P.w - IN * 2;
  const cx = P.x + P.w / 2, NAVY = '#22344e', INK = '#1e1a16';
  stock(g, P.x, P.y, P.w, P.h, '#f2f1ea', '#fbfaf4', '#d2d0c4');
  // THE FRAME. A city notice is printed inside a rule box so it survives being
  // stapled to a board, and 3 px of solid black is the loudest mark in the box.
  g.strokeStyle = INK; g.lineWidth = 3;
  g.strokeRect(P.x + 5.5, P.y + 5.5, P.w - 11, P.h - 11);
  // the masthead, reversed out — department stationery, not a photocopy
  fill(g, NAVY, P.x + IN, P.y + 8, TW, 44);
  const sx = cx - 8, sy = P.y + 12;                 // the crest, flat, in the bar
  fill(g, '#e8e6dc', sx, sy, 16, 18);
  fill(g, NAVY, sx + 3, sy + 4, 10, 7);
  fill(g, '#e8e6dc', sx + 5, sy + 13, 6, 3);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#f2f1ea'; g.font = UI.font(11, true);
  g.fillText('CRIMEWATCH', cx, P.y + 42);
  g.fillStyle = '#a9bdd6'; g.font = UI.font(6);
  g.fillText('14TH PRECINCT', cx, P.y + 50);
  // the double rule a form puts under its head
  fill(g, INK, P.x + IN, P.y + 56, TW, 2);
  fill(g, INK, P.x + IN, P.y + 60, TW, 1);
  // THE ADVISORY, CENTRED IN ITS OWN PANEL. Centred against the chain letter's
  // flush left, and FLOWED — the copy is written in 30-character lines for a
  // 192-unit sheet and this measure is 66, so it re-breaks to SEVEN lines. The
  // panel is sized for that flowed height rather than for the four lines in the
  // table: a box measured off the source copy is the carbon's overflow bug
  // again, one paper-size later.
  fill(g, 'rgba(34,52,78,0.07)', P.x + IN, P.y + 66, TW, 84);
  g.strokeStyle = NAVY; g.lineWidth = 1;
  g.strokeRect(P.x + IN + 0.5, P.y + 66.5, TW - 1, 83);
  flowMid(g, cx, P.y + 78, TW - 12, l.lines, 6, '#1e2a3c', true);
  // and the bar at the foot with the number on it, INSIDE the frame — the rule
  // box is 3 px wide and drawn on the centre line, so its inner edge is at
  // P.y + 7 and P.y + h - 7, and the bar has to stop short of that.
  fill(g, NAVY, P.x + IN, P.y + P.h - 24, TW, 15);
  g.textAlign = 'center';
  g.fillStyle = '#f2f1ea'; g.font = UI.font(6, true);
  g.fillText('REPORT IT — 555-0114', cx, P.y + P.h - 13);
  g.textAlign = 'left';
};


/**
 * ── THE MAIL-ORDER CATALOGUE: A THICK BOOK, NOT A SHEET ────────────────────
 * 154 x 172, 1:1.12 — the SQUAREST of the printed pieces without being square,
 * because a 400-page general catalogue is bound short and fat rather than long.
 * The one piece with DEPTH: a cover with a stack of page edges down its right
 * side and a spine shadow, the only thing in the box you could prop a door open
 * with. A grid of small goods on the cover, because that is exactly what a 1997
 * general catalogue put there.
 */
ART['catalogue-order'] = (g, l) => {
  const P = paper('catalogue-order'), w = P.w - 9, h = P.h;
  const x = P.x, y = P.y, cx = x + w / 2, RUST = '#9a5a3a';
  // the page edges, stacked to the right — this is the whole "it is a book"
  for (let k = 0; k < 8; k++) {
    fill(g, k % 2 ? '#d8d3c2' : '#e6e1d0', x + w + k, y + 2 + k * 0.4, 1, h - 4 - k * 0.8);
  }
  stock(g, x, y, w, h, '#e2ddc8', '#efeada', '#c4bda6');
  fill(g, 'rgba(0,0,0,0.16)', x, y, 4, h);                     // the spine
  fill(g, RUST, x + 8, y + 8, w - 16, 22);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#f2eeda'; g.font = UI.font(9, true);
  g.fillText('EVERYTHING', cx, y + 23);
  g.fillStyle = '#4a443a'; g.font = UI.font(6);
  g.fillText('SPRING · 400 PAGES · POST FREE', cx, y + 40);
  // a grid of small goods, flat blocks — a general catalogue's whole cover
  const gx = x + 12, gy = y + 48, cw = Math.floor((w - 24) / 3);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    fill(g, '#cfc8b2', gx + c * cw, gy + r * 30, cw - 6, 24);
    fill(g, ['#6b6455', '#8a7049', '#5f6b74'][(r + c) % 3], gx + c * cw + 6, gy + r * 30 + 5, cw - 18, 14);
  }
  flow(g, x + 8, y + h - 22, w - 16, l.lines.slice(0, 2), 6, '#4a443a');
};

/**
 * ── THE DENTIST: A REMINDER CARD ───────────────────────────────────────────
 * 132 x 80, 1.65:1 — SMALL, STIFF AND LANDSCAPE, because that is the shape a
 * surgery's reminder card is cut to and it is barely a third of the area of the
 * sheets around it. Pale blue stock, the practice's name across the top, and a
 * ruled APPOINTMENT panel with the date left blank, which is the joke: they
 * want him to call and fill it in, and his last visit was 1993.
 */
ART['card-dentist'] = (g, l) => {
  const P = paper('card-dentist'), IN = 8, TW = P.w - IN * 2;
  const cx = P.x + P.w / 2, TEAL = '#2f5d5a';
  stock(g, P.x, P.y, P.w, P.h, '#dfe7e6', '#eef3f2', '#bcc7c6');
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = TEAL; g.font = UI.font(8, true);
  g.fillText('R. HALVERSEN, D.D.S.', cx, P.y + 14);
  g.font = UI.font(6); g.fillStyle = '#5a6b6a';
  g.fillText('GENERAL DENTISTRY · 227 W 21ST', cx, P.y + 23);
  fill(g, TEAL, P.x + IN, P.y + 28, TW, 1);
  flow(g, P.x + IN, P.y + 38, TW, l.lines.slice(0, 3), 6, '#2b3a39');
  // the blank appointment panel — the point of the card
  const py = P.y + P.h - 20;
  g.strokeStyle = TEAL; g.lineWidth = 1;
  g.strokeRect(P.x + IN + 0.5, py + 0.5, TW - 1, 14);
  g.textAlign = 'left'; g.fillStyle = TEAL; g.font = UI.font(6, true);
  g.fillText('APPOINTMENT', P.x + IN + 4, py + 9);
  fill(g, 'rgba(47,93,90,0.45)', P.x + IN + 50, py + 10, TW - 56, 1);
};

/**
 * ── THE CHAIN LETTER: A RIBBON THAT HAS BEEN THROUGH SIX COPIERS ───────────
 *
 * *"so the chain letter and the crime watch look identical"*   (2026-08-05)
 *
 * 68 x 172, 1:2.53 — THE NARROWEST PIECE IN THE BOX, and that is the whole
 * separation from CRIMEWATCH before a mark is printed: 68 units against 94,
 * 1:2.53 against 1:1.89. Honest for the object, too — this thing has been fed
 * through six copiers by six people and what comes out the far end of that is
 * not a full sheet any more, it is a strip somebody guillotined and passed on.
 *
 * AND NO LETTERHEAD ANYWHERE, which is the other half of the split. CRIMEWATCH
 * is all structure — frame, masthead, panel, footer, everything centred. This
 * has none: yellowed stock, no border, no rule, a shouty stacked head typed
 * flush left with a row of hyphens under it because a typewriter has no
 * underline, and dense small type running ragged to both edges and all the way
 * to the foot. The copy is FLOWED, so 29-character lines re-break to the 58
 * units actually available instead of running off the paper.
 *
 * IT IS ALSO THE ONLY PIECE THAT IS CROOKED — the whole sheet is rotated, not
 * just the type on it, so the paper's own outline sits skewed against the plane
 * it hangs on. The blotches stay, but they are seasoning now rather than the
 * thing being asked to carry the difference.
 */
ART['chain-letter'] = (g, l) => {
  const P = paper('chain-letter'), IN = 5, TW = P.w - IN * 2;
  const INK = '#3a3020';
  // THE WHOLE PAGE IS TURNED, stock and all. 0.05 rad: the corners reach
  // 38.3 x 87.6 from centre against the 96 x 89 the drawing space allows, so a
  // crooked ribbon still lands entirely on the canvas and nothing is clipped.
  g.save();
  g.translate(PAPER.w / 2, PAPER.h / 2);
  g.rotate(0.05);
  g.translate(-PAPER.w / 2, -PAPER.h / 2);
  stock(g, P.x, P.y, P.w, P.h, '#e4d6a2', '#efe4bc', '#c2b276');
  // copier blotches — deterministic, so the piece does not shimmer per frame
  for (let i = 0; i < 22; i++) {
    fill(g, 'rgba(0,0,0,0.09)', P.x + 4 + ((i * 29) % (P.w - 12)),
         P.y + 6 + ((i * 53) % (P.h - 14)), 3 + (i % 3), 2);
  }
  // the head, TYPED not printed: stacked, flush left, ragged, and underscored
  // with hyphens the way a typewriter has to do it
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = INK; g.font = UI.font(8, true);
  let y = P.y + 18;
  for (const w of ['DO NOT', 'BREAK THE', 'CHAIN']) { g.fillText(w, P.x + IN, y); y += 11; }
  g.font = UI.font(6);
  g.fillText('-'.repeat(13), P.x + IN, y + 2);
  // and the body, dense, small, running to the foot of the strip
  const end = flow(g, P.x + IN, y + 16, TW, l.lines, 6, INK);
  g.fillStyle = INK; g.font = UI.font(6, true);
  g.fillText('SEND IT ON.', P.x + IN, Math.min(end + 8, P.y + P.h - 8));
  g.restore();
};

/**
 * ── THE PENNY SAVER: A CLASSIFIED SHEET, SET IN COLUMNS ────────────────────
 * 148 x 178, 1:1.20 — a free weekly is a tabloid, which is squatter than a
 * letter and wider than everything else standing beside it in this table. It
 * needs that width: it is the only piece set in COLUMNS, two of them with a
 * rule between, headings in reverse, and the ads at 6 px because a free weekly
 * sells by the line and crams. Grey-brown newsprint so it reads as pulp against
 * the bank's white.
 */
ART['classified-penny'] = (g, l) => {
  const P = paper('classified-penny'), IN = 6;
  const cx = P.x + P.w / 2;
  stock(g, P.x, P.y, P.w, P.h, '#dcd7c4', '#e8e3d2', '#bdb8a4');
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  fill(g, '#3a352c', P.x, P.y + 6, P.w, 18);
  g.fillStyle = '#dcd7c4'; g.font = UI.font(11, true);
  g.fillText('PENNY SAVER', cx, P.y + 20);
  g.fillStyle = '#4a443a'; g.font = UI.font(6);
  g.fillText('FREE · WEEKLY · TAKE ONE', cx, P.y + 32);
  g.fillText(l.lines[0] ?? '', cx, P.y + 42);
  fill(g, '#8d8672', P.x + IN, P.y + 46, P.w - IN * 2, 1);
  // two columns with a rule between them, which is the whole look
  const colW = Math.floor((P.w - IN * 2 - 8) / 2);
  const colX = [P.x + IN, P.x + IN + colW + 8];
  fill(g, 'rgba(90,84,70,0.35)', cx, P.y + 50, 1, P.h - 74);
  const heads = ['CARS', 'ROOMS TO LET'];
  for (let c = 0; c < 2; c++) {
    fill(g, '#3a352c', colX[c], P.y + 54, colW, 9);
    g.textAlign = 'left'; g.fillStyle = '#dcd7c4'; g.font = UI.font(6, true);
    g.fillText(heads[c], colX[c] + 3, P.y + 61);
    // one ad per column, flowed to the column measure, with a hairline under it
    const end = flow(g, colX[c] + 2, P.y + 74, colW - 4, [l.lines[c + 1] ?? ''], 6, '#2b2620');
    fill(g, 'rgba(90,84,70,0.30)', colX[c] + 2, end - 4, colW - 8, 1);
  }
  flow(g, P.x + IN, P.y + P.h - 12, P.w - IN * 2, [l.lines[3] ?? ''], 6, '#5a544a');
};


/**
 * ══ TEXT THAT CANNOT LEAVE ITS OWN PAPER ═══════════════════════════════════
 *
 * *"the letter is bugged"*   (2026-08-05), on the pink carbon: the balance band
 * painted ON TOP of a line of body text, "I told her no." clipped mid-word at
 * the right edge, and the signature and page counter hanging off the sheet.
 *
 * THREE FAULTS, ONE CAUSE, AND IT IS THE ONE `4eebe533` FIXED ON THE TELEVISION:
 * hand-typed y values that have to agree with each other, and a hand-typed
 * COLUMN COUNT that has to agree with a paper width. `COLS` is 35 — measured
 * against the FULL 192-unit sheet — and the carbon is 86% of that, so copy
 * written to fit a notice runs straight off a duplicate. And the band sat at
 * `y + h - 24` regardless of where the body had actually ended.
 *
 * ⚠ THESE THREE THINGS HAVE NEVER BEEN SEEN AT THEIR TRUE SIZE. Every bespoke
 * painter was rendering at a third scale until `63060209`, so the whole set is
 * effectively unreviewed at full size — which is exactly why this is a shared
 * routine rather than three more hand-placed blocks. Fixing the carbon alone
 * would leave the same trap in the other fourteen.
 *
 * `wrapTo` MEASURES rather than counting characters, so it is honest about the
 * actual face at the actual width. `flow` returns the y it finished at, so
 * whatever comes next is placed off the foot of what came before and cannot
 * land on it.
 */
function wrapTo(g: CanvasRenderingContext2D, text: string, w: number): string[] {
  if (!text) return [''];
  if (g.measureText(text).width <= w) return [text];
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && g.measureText(next).width > w) { out.push(line); line = word; }
    else line = next;
  }
  if (line) out.push(line);
  return out;
}
/** Draw `lines` inside `w`, wrapping, and return the y AFTER the last one. */
function flow(g: CanvasRenderingContext2D, x: number, y: number, w: number,
              lines: readonly string[], px: number, ink: string, bold = false): number {
  g.font = UI.font(px, bold);
  g.fillStyle = ink;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const lead = px + 4;
  let cy = y;
  for (const raw of lines) {
    if (!raw.trim()) { cy += Math.round(lead * 0.5); continue; }   // a blank is half a line
    for (const seg of wrapTo(g, raw.trim(), w)) { g.fillText(seg, x, cy); cy += lead; }
  }
  return cy;
}

/**
 * THE LIVE BALANCE BAND, read off the clock at the moment he unfolds the paper
 * rather than baked in when it was written. Factored out of `drawTyped` because
 * all three of the landlord's pieces carry it and three copies of a band that
 * quotes real state is three chances to disagree about it.
 *
 * ⚠ WHAT IT MAY NOT SAY is "PAID IN FULL", which is what the first version
 * printed the moment `owed()` came back 0 — including on the day the notice
 * arrives, before any money is due. A notice that congratulates you for paying
 * rent you have not been asked for yet is worse than no band at all. Nothing
 * outstanding and paid up are different sentences.
 */
function balanceBand(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  if (!CTX) return;
  const bal = owed(Math.floor(CTX.clock.now().totalMin / 1440));
  fill(g, '#c9c3ac', x, y, w, 16);
  g.fillStyle = '#2b2620'; g.font = UI.font(8, true);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(bal > 0 ? `OUTSTANDING NOW: $${bal.toFixed(2)}` : 'NOTHING OUTSTANDING TODAY', x + 4, y + 11);
}
/** the rubber stamp, struck off-square the way one lands on a desk */
function pastDue(g: CanvasRenderingContext2D, cx: number, cy: number): void {
  if (!CTX || owed(Math.floor(CTX.clock.now().totalMin / 1440)) <= 0) return;
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.17);
  g.strokeStyle = 'rgba(150,46,38,0.75)'; g.lineWidth = 2;
  g.strokeRect(-30, -12, 60, 24);
  g.fillStyle = 'rgba(150,46,38,0.85)'; g.font = UI.font(9, true);
  g.textAlign = 'center';
  g.fillText('PAST DUE', 0, 3);
  g.restore();
  g.textAlign = 'left';
}

/**
 * ══ THE MANAGING AGENT'S NOTICE ═══════════════════════════════════════════
 *
 * *"this looks identical to that other note, same dimensions, font,
 *  everything."*   (2026-08-05)
 *
 * HE IS RIGHT AND IT WAS THE ONE PIECE THAT COULD NOT AFFORD TO BE. Sixteen
 * junk pieces got their own drawing while the three that do real work were held
 * back — so the most consequential piece of paper in the game ended up looking
 * exactly like a chain letter.
 *
 * A MANAGING AGENT'S OWN STATIONERY, and every difference is a printer's:
 * a heavy black masthead with his name REVERSED OUT of it rather than typed
 * into the body, a rule under it, a ruled RE: block with the flat and the
 * building, then the demand — and THE AMOUNT SET APART in a boxed panel at 13
 * px so the page reads as a BILL at a glance rather than as a letter that
 * happens to mention money. Duplicate-book stock: the faint blue-grey wash and
 * the perforated top edge of a page torn out of a receipt book.
 *
 * ⚠ EVERY FIGURE STILL COMES FROM THE CONSTANTS. `mailFor` builds the lines
 * from `RENT.amount`, `RENT.dueDayOfSeason`, `RENT.flat` and `RENT.building`
 * and this only draws them. Nothing is typed here — the notice said "the 1ST"
 * hard-typed once already today and that is exactly the bug this must not
 * reintroduce.
 */
ART['notice-agent'] = (g, l) => {
  const W = PAPER.w, H = PAPER.h, IN = 10, TW = W - IN * 2;
  stock(g, 0, 0, W, H, '#e4e2d6', '#f0eee4', '#c4c1b2');
  fill(g, 'rgba(90,110,130,0.07)', 0, 0, W, H);          // duplicate-book wash
  perf(g, 4, 4, W - 8);                                  // torn from the book
  fill(g, '#2a2620', 0, 10, W, 26);                      // the masthead
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#e8e4d4'; g.font = UI.font(10, true);
  g.fillText(RENT.landlord, W / 2, 25);
  g.font = UI.font(6);
  g.fillText('MANAGING AGENT', W / 2, 33);
  // the RE: block, ruled the way a form is
  g.textAlign = 'left';
  g.fillStyle = '#3a352c'; g.font = UI.font(7, true);
  g.fillText(wrapTo(g, l.lines[0] ?? '', TW)[0], IN, 48);
  fill(g, '#8d8672', IN, 52, TW, 1);
  // THE AMOUNT SET APART, so the page reads as a bill rather than as a letter
  // that mentions money. The figure and the season both come off the lines the
  // builder assembled from RENT.amount and dateOf — nothing is typed here.
  const body = l.lines.slice(1).filter((t) => t.trim());
  const money = body.find((t) => t.includes('$')) ?? '';
  const when = body.find((t) => t.startsWith('OF ')) ?? '';
  fill(g, '#d8d4c4', IN, 60, TW, 30);
  g.strokeStyle = '#2a2620'; g.lineWidth = 1;
  g.strokeRect(IN + 0.5, 60.5, TW - 1, 29);
  g.fillStyle = '#2a2620'; g.font = UI.font(13, true);
  g.textAlign = 'center';
  g.fillText(money.match(/\$[\d,.]+/)?.[0] ?? '', W / 2, 78);
  g.font = UI.font(6);
  g.fillText(wrapTo(g, when, TW - 8)[0], W / 2, 87);
  // ⚠ THE REST IS FLOWED AND THE BAND FOLLOWS IT. Same fix as the carbon: the
  // body wraps to the paper and the band is placed off its foot, not off a
  // typed row that could land on a line.
  const end = flow(g, IN, 104, TW, body.filter((t) => t !== money && t !== when), 8, '#332d25');
  balanceBand(g, IN, Math.min(end + 4, H - 22), TW);
  pastDue(g, W - 48, Math.min(end + 26, H - 40));
};

/**
 * ══ THE RECEIPT: A DOCKET, AND THE SMALLEST PAPER IN THE GAME ═════════════
 *
 * Proof of payment is not a letter and should not be shaped like one. A stub
 * torn off a duplicate book: narrow, short, a perforation down its left edge
 * where it left the spine, a printed RECEIVED heading, the figure on a ruled
 * line, and the agent's initials scratched across the bottom in biro. It
 * occupies about a fifth of the space a notice does, which is most of what
 * says "this is a different object" before a word is read.
 */
ART['docket-receipt'] = (g, l) => {
  const w = Math.round(PAPER.w * 0.62), h = Math.round(PAPER.h * 0.42);
  const x = Math.round((PAPER.w - w) / 2), y = Math.round((PAPER.h - h) / 2);
  const IN = 10, TW = w - IN * 2;
  stock(g, x, y, w, h, '#f0ecd8', '#f8f5e6', '#d0cbb4');
  for (let i = 0; i < h; i += 4) fill(g, 'rgba(90,84,70,0.45)', x, y + i, 1, 2);  // the spine
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#2a2620'; g.font = UI.font(8, true);
  g.fillText('RECEIVED', x + w / 2, y + 15);
  fill(g, '#2a2620', x + IN, y + 19, TW, 1);
  g.fillStyle = '#5a544a'; g.font = UI.font(6);
  g.fillText(`${RENT.building} — APT ${RENT.flat}`, x + w / 2, y + 28);
  // the figure, on its own ruled line, which is what a docket is for
  const money = l.lines.find((t) => t.includes('$')) ?? '';
  g.fillStyle = '#2a2620'; g.font = UI.font(11, true);
  g.fillText(money.match(/\$[\d,.]+/)?.[0] ?? '', x + w / 2, y + 46);
  fill(g, 'rgba(90,84,70,0.55)', x + IN + 4, y + 50, TW - 8, 1);
  g.font = UI.font(6); g.fillStyle = '#5a544a';
  g.fillText('WITH THANKS', x + w / 2, y + 60);
  // his initials, in biro, INSIDE the sheet — measured off the paper's own
  // corner rather than placed at a fixed inset, so a narrow docket keeps them.
  g.save();
  g.translate(x + w - 30, y + h - 14);
  g.rotate(-0.14);
  g.fillStyle = 'rgba(47,79,140,0.8)'; g.font = UI.font(10, true);
  g.textAlign = 'center';
  g.fillText('V.O.', 0, 0);
  g.restore();
  g.textAlign = 'left';
};

// ⚠ `ART['carbon-prepaid']` WAS HERE and is deleted with the letter it drew —
// the flimsy pink duplicate from his mother, with the 1 px impression ghost
// under every line. *"remove the mom paying my rent stuff forget about that."*
// Nothing sets `art: 'carbon-prepaid'` any more, so this was an unreachable
// painter; git history has it if the conceit ever comes back.

function drawTyped(g: CanvasRenderingContext2D, letter: Letter): void {
  const l = letter;
  // ⚠ NO SUPERSAMPLE HERE. `drawLetter` applies it for every painter now — see
  // the note there. It used to live in this function, which is precisely why
  // the other sixteen drew a third of the size.
  const w = SHEET.w, h = SHEET.h;

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

// ── AND THE PAPER IS IN THE ROOM, NOT OVER YOUR FACE ──────────────────────
//
// *"can we apply the same sort of thing we applied to the atm and apply it to
// the mail?"* (2026-08-02). What he asked for at the ATM was *"i want when i
// hit e here to adjust my position and perspective and lock it to be looking at
// the atm and for the screen on the literal atm be the overlay"* — so the
// transferable part is NOT "paint it on a machine". It is: LOCK ME IN PLACE AND
// PUT THE INTERFACE IN THE WORLD INSTEAD OF OVER MY FACE.
//
// A letter is the one tenant of this framework that is not a screen — you HOLD
// it, you do not stand at it — and that changes only WHERE the surface is, not
// what it is. So the sheet is a plane hanging at reading distance in front of
// the eye, turned to face the hall, and the framework does the rest: it hangs
// this same canvas on it, eases the eye onto it, freezes the feet and keeps
// ESC and `[E]`. `chrome:'none'` and the frameless work below were already
// half of this — the paper filled its own canvas edge to edge — and this is
// the other half. This file's own heading has said *"the letter, held open in
// front of you"* since it was written; nothing had made it literal.
//
// IT DEGRADES RATHER THAN FAILS. `mesh()` returning null — a world with no
// focus controller, which is what the prototype harnesses are — gives back
// exactly today's screen-space panel.
function buildPanel(): void {
  if (PANEL) return;
  // FRAMELESS. `drawLetter` already paints a complete sheet of paper — fold
  // creases, sender line and all — filling the canvas edge to edge. The old
  // `chrome: 'cloth'` wrapped that paper in the framework's own cloth
  // background, a second surface behind a surface. Item 5i (the same fix as
  // item 0c, just not named by it): *"i never want there to be menus popping
  // up unless they are embedded to look as if they are in the actual
  // game."* No title stamped either way — the sender printed at the top of
  // the paper already said what this is, which is exactly why `title` was
  // never set here.
  PANEL = makePanel({
    id: 'ct-letter', w: PANEL_W, h: PANEL_H, chrome: 'none',
    // ⚠ SILENT, for the reason the mirror and now the calendar are. He has
    // asked twice for the framework's grey caption off a thing he is holding
    // — *"make sure the overlay for click a part of yourself and e option are
    // gone"*, then *"get rid of this in cal"* — and mail in his hands is the
    // same class of object as a mirror and a page on his wall. Same mechanism,
    // `PanelSpec.silent`, no second one.
    //
    // THE PAGE COUNT DID NOT GO WITH IT. The caption carried "2 of 3", which is
    // real information and the only thing saying there is more than one piece.
    // It moved ONTO THE PAPER, bottom right, where a page number lives — see
    // the foot of `drawTyped` and each piece's own painter. That is the answer
    // the caption was standing in for: not a smaller caption, a diegetic one.
    silent: true,
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
    surface: {
      mesh: () => sheet,
      // 0.42 m off the paper is where a person holds something they are
      // reading. The framework's 0.55 default is a stand-off for a MACHINE you
      // step up to; this is arm's length, and it is the whole difference
      // between holding a letter and standing at a kiosk.
      standoff: 0.42,
      // and lean in: 55° against the world's 88° resting look is the eye
      // narrowing onto the page, which is what reading looks like.
      fov: 55,
      // CLICKING THE PAGE TURNS IT, right half forward and left half back —
      // the same two directions the wheel and the arrows already give, so this
      // adds a gesture and no state. Only when there IS more than one, so the
      // cursor never offers a press that would do nothing.
      //
      // `hot`/`click` arrive in THIS CANVAS's pixels (`ct/hud.ts:733`), not in
      // uv, not in client space and NOT in the sheet's drawing units — so the
      // thing to halve is `PANEL_W`, the supersampled width the framework
      // allocated. Halving `SHEET.w` here would put the divide a third of the
      // way across the page and every click past it would turn forward.
      // ══ CLICK TAKES IT, AND THE NEXT ONE COMES UP ═══════════════════════
      //
      // *"the mail opens on the first piece. click: it goes into the bag, the
      //  next piece appears."*
      //
      // The whole sheet is hot, not the outer fifths — turning the page was a
      // second wheel and the wheel already turns it. One gesture, one verb.
      hot: () => true,
      click: () => { takeCurrent(); },
    },
    // THE PAPER IS ONLY THERE WHILE YOU ARE READING IT. Guarded on
    // `screenFocusReady()` rather than shown unconditionally: that is the exact
    // predicate `ct/hud.ts:1071` decides diegetic-or-not by, so in a world with
    // no focus controller the panel falls back to the screen-space cabinet and
    // this does NOT leave a blank sheet hanging in the lobby behind it.
    onOpen: () => { if (sheet && screenFocusReady()) sheet.visible = true; },
    // `onClose` runs on EVERY close — Escape, `[E]`, and the automatic close
    // when another panel opens — so there is no path that leaves it up.
    onClose: () => { if (sheet) sheet.visible = false; },
  });
}

/**
 * ══ THE MAIL GOES IN YOUR BAG ═══════════════════════════════════════════════
 *
 * *"reading the mail should take all the mail and put it in your bag."*
 *   (2026-08-05)
 *
 * MAIL STOPS BEING A THING YOU LOOK AT IN PLACE AND BECOMES THINGS YOU OWN. A
 * piece you have read is a piece you are carrying, so it can be examined in the
 * bag, dropped on the floor and picked up again like anything else.
 *
 * ONE ITEM PER PIECE, NOT PER KIND, and the id is what makes that work:
 * `MAIL-<day>-<n>`, unique, so the store gives each piece its own slot. Two
 * VIDEO HUT flyers from different weeks are two things and stack into one
 * square only if they are literally the same id, which they never are. The
 * store is `ct/inventory.ts`'s purse and nothing else — no second list of what
 * he is carrying, which is the whole of `2628381a`.
 *
 * `defineItem` IS CALLED AT THE MOMENT HE TAKES IT, which is what the item
 * table was built to allow (*"any module may — you do not need this file to own
 * yours"*). The piece's own `Letter` is closed over, so its sprite draws ITS
 * artwork and READ opens ITS page. Nothing is looked up by parsing the id.
 *
 * ⚠ THE BAG SPRITE IS THE PIECE, not a generic envelope. `cd9a7100` gave every
 * sender its own drawing and this reuses them: the icon paints the piece's real
 * art into the 24-unit box the item table draws in, so a flyer is a goldenrod
 * flyer in his bag and the previous tenant's letter is a window envelope.
 *
 * AND `READ` OPENS THE REAL PAGE — the same `showLetters` the mailbox uses, at
 * the same LETTER_SS 3x legibility, held in front of him wherever he is
 * standing. So THE FOCUSED MAIL VIEW SURVIVES AND IS NOT REDUNDANT: it was
 * never the taking, it is the READING, and now it has two doors into it. The
 * `Hold` machinery survives with it and gains a third position.
 *
 * ⚠ READ DOES NOT CONSUME. `ItemDef.use.act` returning a string puts that id
 * back in the slot it vacated, so returning its own id is "use me and keep me".
 * A letter you read once and lost would be a bug on the rent notice.
 */
/** the id a piece of mail carries in the bag — one per (day, sender), for ever */
const mailId = (l: Letter) => `MAIL-${l.day}-${l.from.replace(/[^A-Z0-9]+/gi, '-').toUpperCase()}`;
/** how a piece of mail is drawn in the bag — its own art, shrunk into the
 *  24-unit box every item icon is drawn in */
function mailIcon(l: Letter): (g: CanvasRenderingContext2D) => void {
  return (g) => {
    g.save();
    // the piece is composed at PAPER.w x PAPER.h; fit its LONG side to 22 of
    // the icon's 24 so a tall slip and a wide flyer both sit in the square
    const k = 22 / Math.max(PAPER.w, PAPER.h);
    g.translate((24 - PAPER.w * k) / 2, (24 - PAPER.h * k) / 2);
    g.scale(k, k);
    (ART[l.art ?? ''] ?? drawTyped)(g, l);
    g.restore();
  };
}
/**
 * ══ A DROPPED PIECE OF MAIL IS A SHEET OF PAPER ═════════════════════════════
 *
 * *"box of cereal work, this is correct but the notes/letters need to be flat.
 *  its paper"*   (2026-08-06)
 *
 * ⚠ MAIL NEVER GOT A MODEL. `ca77c50b` gave ten items real objects at real size
 * and that is right for the carton he says is correct — but a piece of mail is
 * declared HERE, at the moment he takes it, so it fell to `dropLoose`'s
 * fallback: a 16 cm square box, 50 mm deep, with the art printed on the top.
 * That is the white slab in his shot. Paper is 0.1 mm thick and 50 mm is a
 * ream.
 *
 * SO EVERY PIECE IS A SHEET, AND THE SHEET IS ITS OWN SHAPE. `8fd7977c` gave
 * the fifteen junk kinds real paper rectangles, from a 2.26:1 window envelope
 * to a 1:2.53 chain letter, and a dropped piece has no business being square
 * when the thing in his bag is not. The rectangle is MEASURED off the painted
 * canvas rather than read out of `SHAPES`, because a painter may sit its paper
 * anywhere in the drawing space — the super's note is pinned high at y=16, the
 * chain letter is rotated bodily off-square — and the alpha the sheet's own
 * `alphaTest` already cuts away is exactly the answer to "where is the paper".
 *
 * THE ART IS ON THE FACE AND THE EDGE IS PLAIN, which is the mistake already
 * paid for twice today: a parcel with its label on six sides, and dropped items
 * repeating their icon all round. The four edges and the underside take the
 * piece's OWN stock colour, read back off the canvas that was just painted and
 * dimmed a tenth — an edge of paper is the same paper, not a dark rim.
 *
 * ⚠ AND IT IS LIFTED. A 1.2 mm sheet lying on the boards is the coplanar case
 * that z-fights; `dropLoose` puts a model's base at `gy + 2 mm` and this adds
 * 1 mm of its own, so the underside sits 3 mm clear and the face 4.2. The
 * origin is still the BASE, so it lands flush on any storey.
 */
/** how thick a piece is, in metres. A single sheet is 1.2 mm — thinner than
 *  the eye reads as paper and thicker than the depth buffer minds. Only the
 *  pieces that are genuinely BOUND get more, because a catalogue is not a
 *  sheet: `catalogue-order` draws its own eight page edges and says 400 pages
 *  on the cover. */
const MAIL_T: Record<string, number> = {
  'catalogue-order': 0.020,      // 400 pages, and the cover already shows them
  'catalogue-302':   0.008,      // a seed catalogue, thin but stitched
  'classified-penny': 0.004,     // a free weekly — folded newsprint, not a sheet
};
const SHEET_T = 0.0012;
/** ONE MILLIMETRE OF ITS OWN, on top of `dropLoose`'s two. */
const SHEET_LIFT = 0.001;
/** sheet units to metres: the drawing space's 178 units of height ARE US
 *  letter, 279 mm, so every piece comes out the size its shape says it is —
 *  a 148x178 tabloid at 232 x 279, the chain letter's ribbon at 107 x 270. */
const PAPER_M = 0.279 / SHEET.h;
/** the same supersample the page is read at: this is looked at from a metre
 *  and a half, and 8 px type on a 1 px grid is the mush `LETTER_SS` exists to
 *  fix. Painted once, when something is dropped — never per frame. */
const MAIL_SS = 3;

function mailModel(l: Letter): THREE.Object3D {
  const art = l.art ?? '';
  const full = document.createElement('canvas');
  full.width = PAPER.w * MAIL_SS; full.height = PAPER.h * MAIL_SS;
  const g = full.getContext('2d');
  let cv: HTMLCanvasElement = full;
  let w = PAPER.w, h = PAPER.h;
  let edge = new THREE.Color(0xd8d4c4);
  if (g) {
    g.setTransform(MAIL_SS, 0, 0, MAIL_SS, 0, 0);
    try { (ART[art] ?? drawTyped)(g, l); } catch { /* a piece with no art still drops */ }
    g.setTransform(1, 0, 0, 1, 0, 0);
    try {
      // WHERE IS THE PAPER — the alpha bound of what was actually painted, so
      // an offset note and a rotated ribbon both crop to themselves.
      const px = g.getImageData(0, 0, full.width, full.height).data;
      let x0 = full.width, y0 = full.height, x1 = -1, y1 = -1;
      let r = 0, gg = 0, b = 0, n = 0;
      for (let y = 0; y < full.height; y++) {
        for (let x = 0; x < full.width; x++) {
          const i = (y * full.width + x) * 4;
          if (px[i + 3] <= 128) continue;
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
          r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++;
        }
      }
      if (n > 0) {
        // the edge of a sheet is the sheet, one tenth down — not a dark rim
        const dim = 0.9;
        edge = new THREE.Color(r / n / 255 * dim, gg / n / 255 * dim, b / n / 255 * dim);
      }
      if (x1 >= x0 && y1 >= y0) {
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        const cut = document.createElement('canvas');
        cut.width = cw; cut.height = ch;
        cut.getContext('2d')?.drawImage(full, x0, y0, cw, ch, 0, 0, cw, ch);
        cv = cut;
        w = cw / MAIL_SS; h = ch / MAIL_SS;
      }
    } catch { /* a tainted canvas is not a reason to refuse a drop */ }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  const face = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
  const side = new THREE.MeshBasicMaterial({ color: edge });
  const t = MAIL_T[art] ?? SHEET_T;
  // +Y is material index 2 — the ONE face that carries the drawing.
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * PAPER_M, t, h * PAPER_M),
    [side, side, face, side, side, side]);
  m.position.y = SHEET_LIFT + t / 2;
  const grp = new THREE.Group();
  grp.add(m);
  return grp;
}

/** put one piece in his bag, as its own item */
function pocketMail(ctx: CtxBuild, l: Letter, open: (l: Letter) => void): boolean {
  // ⚠ DERIVED FROM THE PIECE, NEVER MINTED. This was `MAIL-${l.day}-${mailSeq++}`
  // — a fresh unique id on every take — so the SAME letter could enter the bag
  // any number of times under different ids and `stack: 1` could not stop it.
  // That is half of the infinite mail source. Keyed on the day and the sender,
  // which is what identifies a piece (`mailFor` is pure and never yields one
  // sender twice on a day), so a second take of the same letter is the same id
  // and `roomFor` refuses it at a stack of one.
  const id = mailId(l);
  defineItem({
    id,
    // the sender IS the name — it is what a person calls a piece of post, and
    // it is already written on every one of them
    name: l.from.split(' — ')[0].toLowerCase(),
    stack: 1,
    blurb: '',
    icon: mailIcon(l),
    // ⚠ A BUILDER, NOT A MESH — every drop gets its own sheet, so one taken
    // back out of the scene cannot take another's texture with it.
    model: () => mailModel(l),
    use: { verb: 'read', act: () => { open(l); return id; } },
  });
  // ⚠ REPORTS WHETHER IT ACTUALLY WENT IN. It used to swallow the answer, which
  // was harmless while the bag was infinite and is a lost letter at twelve
  // slots. The caller refuses on false and leaves the piece in the box.
  if (!bagPut(ctx.purse, id)) return false;
  ctx.refreshWallet();
  return true;
}

/**
 * Open the pile, HELD WHERE `at` SAYS.
 *
 * The aim happens before `open()` and not after: `ct/hud.ts` reads the mesh and
 * enters focus inside that call, so a sheet moved afterwards would pose the
 * player against the last letter's position — which is this whole bug with an
 * extra frame in it.
 */
function showLetters(pile: Letter[], at: Hold, live = false): void {
  if (!pile.length) return;
  reading = pile;
  readingLive = live;
  page = 0;
  if (sheet) {
    sheet.position.set(at.x, at.y, at.z);
    // `rotation.set` first, THEN roll: `rotateZ` is about the object's local z,
    // which after the yaw IS the page's normal, so it rolls the page in its own
    // plane and cannot move where `poseFor` puts the eye. Re-set from scratch
    // each time rather than accumulated, or the roll compounds every open.
    sheet.rotation.set(0, at.yaw, 0);
    sheet.rotateZ(SHEET_ROLL);
  }
  buildPanel();
  PANEL?.open();
}

/**
 * ══ TAKE THE PIECE HE IS LOOKING AT ═══════════════════════════════════════
 *
 * One click, one letter into the bag, and the piece behind it comes up. When
 * the last one goes the view ends on its own — there is nothing left to read.
 *
 * ⚠ A REFUSAL NEVER EATS A LETTER. The bag is twelve slots (`3a1f21c8`), so it
 * CAN fill mid-stack. `roomFor` is asked BEFORE the piece leaves anything, the
 * refusal is worded by `fullWhy` — "your bag is full — 12 of 12" — and the
 * piece stays exactly where it was, on screen and in the box. He can drop
 * something and come back to it.
 *
 * ⚠ AND IT IS THE ONLY PLACE `collectedDay` MOVES. It advances when the pile
 * empties, which is the one moment the box is genuinely empty. Leave halfway
 * and the untaken pieces are still waiting, because `POCKETED` records the ones
 * that went and `waiting()` subtracts them.
 */
function takeCurrent(): void {
  const l = reading[page];
  if (!l || !CTX) return;
  // ══ THE OTHER HALF OF THE DUPLICATION, AND THE ONE HE SAW ═══════════════
  //
  // *"mail doesnt leave the mail box so iu quickly fill my bag just clicking
  //  through mail again and again"*   (2026-08-05)
  //
  // ⚠ THE PILE DID LEAVE. `waiting()` filters `POCKETED` and always did, and
  // the box empties correctly. WHAT HE WAS CLICKING THROUGH THE SECOND TIME WAS
  // THE ARCHIVE. With nothing waiting, the box falls through to
  // `showLetters([...HELD].reverse())` — a re-read of everything he has ever
  // taken — and this function took no interest in which of the two it was
  // looking at. So every re-read minted the whole archive into his bag again,
  // and with the id minted per take (above) nothing downstream could refuse it.
  //
  // TWO GUARDS, because one of them is a fact and the other is an assertion.
  // `readingLive` is the fact: an archive is a thing you look at, not a thing
  // you take. `POCKETED` is the assertion, and it is what makes a duplicate
  // structurally impossible rather than merely unreachable — a piece he already
  // has can never be taken again by any path, present or future.
  if (!readingLive) return;
  if (POCKETED.has(keyOf(l))) return;
  // ASKED BEFORE ANYTHING MOVES, so the refusal is readable and the piece is
  // untouched — this file's own rule for `give()`, applied to the mail.
  if (pocketsFull(CTX.purse)) { hudNote(fullWhy(CTX.purse)); return; }
  if (!pocketMail(CTX, l, (one) => showLetters([one], holdInFront(CTX!)))) {
    hudNote(fullWhy(CTX.purse));
    return;
  }
  POCKETED.add(keyOf(l));
  HELD.push(l);
  while (HELD.length > KEEP) HELD.shift();
  reading = reading.filter((x) => x !== l);
  if (!reading.length) {
    // the box is genuinely empty now, so the day may be marked collected
    const { totalMin } = CTX.clock.now();
    const hour = (totalMin % 1440) / 60;
    collectedDay = Math.floor(totalMin / 1440) - (hour >= POST_HOUR ? 0 : 1);
    PANEL?.close();
    return;
  }
  if (page >= reading.length) page = reading.length - 1;
  PANEL?.repaint();
}

// ── the world ─────────────────────────────────────────────────────────────

export function register(ctx: CtxBuild): void {
  CTX = ctx;
  const { scene } = ctx;
  const bank = findBank(scene);
  const faceX = bankFace(bank.x);
  const me = cell(bank.x, bank.y, bank.z, BANK.me.c, BANK.me.r);

  // ── WHERE EACH OF THE THREE LETTERS IS HELD ─────────────────────────────
  // See `Hold`. All three are derived, none is typed twice, and each one lands
  // the reader on the floor the [E] that opened it is gated to.
  //
  // AT THE BOXES: unchanged, and the only one that was ever right — a little
  // above the door it came out of, so the open box and the post still riding in
  // it stay visible under the page. `yaw = -π/2` sends the normal to −x, into
  // the hall, so the eye is out in the lobby looking back at the bank.
  const HOLD_BOX: Hold = { x: faceX - 0.34, y: me.y + 0.09, z: me.z, yaw: -Math.PI / 2 };

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

  // ── THE SHEET YOU HOLD UP ───────────────────────────────────────────────
  //
  // The surface the letter is painted onto — see the block above `buildPanel`
  // for why the mail is diegetic at all. Everything here is DERIVED from the
  // bank this file already measured, so C moving the boxes moves the paper too.
  //
  // THE ASPECT IS DERIVED, NOT TYPED. `drawLetter` paints a SHEET.w x SHEET.h
  // page, and a plane of any other ratio stretches the landlord's typewriter.
  // Deriving it from `SHEET` rather than `PANEL_W`/`PANEL_H` is deliberate and
  // safe — a supersample multiplies both, so the two ratios are identical, and
  // SHEET is the size the page is actually COMPOSED at.
  // (BUILDER-BRIEF §7b: a texture's density comes from the face it lands on —
  // 0.28 m of paper carrying 576 canvas px is 2057 px/m. It was 686 before
  // `LETTER_SS`, and the letter being hard to read at 686 is the whole reason
  // that constant exists: this is a thing held at arm's length filling most of
  // the frame, so the density is meant to be this high.)
  const SHEET_W = 0.28;
  sheet = add(new THREE.Mesh(
    new THREE.PlaneGeometry(SHEET_W, SHEET_W * SHEET.h / SHEET.w),
    // MeshBasicMaterial, and ONE of them rather than an array: `ct/hud.ts`
    // reads `mesh.material` as a single material to hang the canvas on, and a
    // material ARRAY throws there (queue item 150). Unlit is also what a page
    // wants — the framework forces `color` white on open so the evening wash
    // cannot dim what you are reading, and an unlit sheet honours that.
    // ⚠ TRANSPARENT + alphaTest, WHICH IS WHAT LETS THE MAIL BE DIFFERENT
    // SIZES. The canvas is no longer "the sheet"; it is the SPACE a piece of
    // mail occupies, and each piece draws its own paper inside it — a bill
    // fills it, a flyer is a squarer block, a compliments slip is a band a
    // third of the height. Whatever a piece does not paint is cut away by the
    // alpha test rather than shown as white card, so the plane's aspect never
    // changes, no geometry moves, and there is nothing new to z-fight.
    // alphaTest rather than blending: a discarded fragment never sorts, and
    // `ct/props.ts:414` is explicit that an alphaTest surface is still graded.
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaTest: 0.5 })));
  // NAMED so a probe can find it without inferring it from a geometry size —
  // an instrument that identifies its subject by guessing is the instrument
  // half this project's false defects came from.
  sheet.name = 'tenancy-letter-sheet';
  // default plane normal is +z; -pi/2 about y turns it to -x, into the hall.
  // Same rotation as the number plates above, and for the same reason: it
  // sends u along +z, which is the viewer's right from out here, so the type
  // reads left to right without the texture being flipped (GOTCHAS §35).
  sheet.rotation.y = -Math.PI / 2;
  // A HAND DOES NOT HOLD PAPER SQUARE TO THE WALL. Two degrees of roll is the
  // difference between a sheet somebody is holding and a poster somebody hung,
  // and the first frame of this read as the latter.
  //
  // `rotateZ` is about the object's LOCAL z, which after the turn above IS the
  // face's normal — so this rolls the page in its own plane and CANNOT move
  // where `poseFor` puts the eye (it reads that same normal). Setting
  // `rotation.z` instead would compose through the Euler order and tilt the
  // face itself, which is a different and worse thing.
  sheet.rotateZ(SHEET_ROLL);
  // Held a little ABOVE the door it came out of, so the open box and the post
  // still riding in it stay visible under the page rather than being covered
  // by it. x is arm's length off the face; `poseFor` then puts the eye
  // `standoff` further back again along the same normal.
  sheet.position.set(HOLD_BOX.x, HOLD_BOX.y, HOLD_BOX.z);
  sheet.visible = false;

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
    // ══ AN EMPTY BOX IS EMPTY ═══════════════════════════════════════════
    //
    // *"once i take the mail the mail shouldnt be in the mailbox anymore btw"*
    //   (2026-08-05)
    //
    // `24323f68` proved the PILE empties correctly and that what he was seeing
    // the second time was the ARCHIVE — the fall-through that showed everything
    // he had ever taken whenever nothing was waiting. That fix made the archive
    // read-only, which stopped the duplication and did not touch the complaint:
    // from his side, opening his box and being handed letters he already owns IS
    // the mail not leaving. The distinction between "the pile" and "the archive"
    // was ours, not his.
    //
    // SO THE ARCHIVE IS OFF THE BOX ENTIRELY. Both readers are gone — the
    // fall-through that opened it and the label that advertised it — and with
    // nothing waiting the spot says the box is empty and `[E]` opens no panel at
    // all. He can walk up, read that there is nothing in it, and walk away.
    //
    // ⚠ RE-READING HAS A BETTER HOME AND THAT IS WHY THIS COSTS NOTHING. His
    // letters are ITEMS now (`27fda3d1`): they are in his bag, they carry their
    // own artwork as their sprite, and READ opens the real page at full size
    // wherever he is standing. The archive was solving a problem that stopped
    // existing the moment mail became something he carries.
    //
    // `HELD` ITSELF STAYS, and it now has exactly one reader: the `held()`
    // report surface a probe uses. Nothing the player can see consults it. It is
    // not deleted because it is the only record of what has come through the
    // box, and the next thing that wants that — a "you have already read this"
    // mark, a filing system — will want it whole.
    label: () => {
      const w = waiting(ctx.clock.now().totalMin).length;
      if (w > 0) return `open your mailbox — ${w} letter${w === 1 ? '' : 's'}`;
      return `your mailbox — ${RENT.flat} — nothing in it`;
    },
    act: () => {
      const w = waiting(ctx.clock.now().totalMin);
      // ⚠ NOTHING WAITING, NOTHING OPENS. No panel, no archive, no empty sheet
      // hanging in the lobby — the label has already told him, before he pressed
      // anything, which is this file's own rule for a refusal being honest.
      if (!w.length) return;
      // THE BOX HANDS YOU THE PILE AND CLICKING TAKES ONE — see the panel's
      // `click` and `takeCurrent`. LIVE, because this is the box's own pile.
      //
      // Nothing is collected here: `collectedDay` advances only when the pile
      // actually empties, so walking away mid-stack leaves the rest in the box.
      showLetters(w, HOLD_BOX, true);
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

  // ── HE MEANDERS ─────────────────────────────────────────────────────────
  //
  // *"landlord should meander downstairs not just always be in one
  // orientation."* (2026-08-05.) He was a statue: one coordinate, one heading,
  // for fifteen hours of every day he is owed money.
  //
  // FOUR POSTS AND A PAUSE, not pathfinding. He is WAITING, not patrolling —
  // so the whole behaviour is: pick a post that is not this one, stroll to it
  // at a slow walk, stand for a few seconds looking at something a man waiting
  // in a lobby would look at, pick again. `citizenSprite` already owns the
  // eight painted views, the walk cycle and the view hysteresis (`setFacing`,
  // `setWalking`), so this borrows all of that and adds only WHERE and WHEN —
  // exactly the split ct/crowd.ts uses on the street.
  //
  // ⚠ WHERE HE MAY NOT GO, and every bound here is somebody else's geometry:
  //   · lz ≥ 6.30 keeps him 2.01 m off 101's landing parcel at (200.25, −15.69).
  //     That parcel is the whole reason he stands where he does — C measured a
  //     1.15 m trigger swallowing it whole (`notes/C-package-vs-rent-for-N.md`)
  //     and the man moved rather than the door. A wander that drifts back up
  //     the hall re-opens that bug by hand, so the near bound is derived from
  //     it: 2.01 m clears the two 0.95 radii ADDED together, the same margin
  //     his fixed post had.
  //   · lz ≤ 7.55 stops him short of the stair foot at `STAIR_Z0` = 8.4 and of
  //     the newel at 8.33. He does not go upstairs; the ask is that he meanders
  //     DOWNSTAIRS.
  //   · lx 0.55…1.70 against hall walls at lx 0 and lx 2.4, so his 0.30 m
  //     half-width lands inside 0.25…2.00 and never touches either. The
  //     mailboxes (lx 2.145…2.335, lz 0.55…2.05) and both flat doors (lz 3.5)
  //     are outside the box entirely — he cannot reach them to walk through
  //     them, which is cheaper and more reliable than testing against them.
  // The box is 1.15 × 1.25 m. It is deliberately SMALL: the hall is 2.4 m wide
  // and the 2 m lane is sacred indoors too, so a man taking the middle of it
  // for a stroll is a worse bug than a man standing still.
  const LL_MIN_X = APT_X0 + 0.55, LL_MAX_X = APT_X0 + 1.70;
  const LL_MIN_Z = APT_Z0 + 6.30, LL_MAX_Z = APT_Z0 + 7.55;
  /** where he stands, and what he turns to look at once he gets there. The
   *  look-targets are real objects: the front door at (AX 1.2, AZI 0.09), the
   *  stair foot at (AX 0.6, AZI 8.4), the mailboxes at (AX 2.28, AZI 1.3). A
   *  man idling stares at SOMETHING; a random heading reads as a bug. */
  const LL_POSTS: { x: number; z: number; lx: number; lz: number }[] = [
    // his old post, at the foot of the stairs — looking up them
    { x: APT_X0 + 0.62, z: APT_Z0 + 6.60, lx: APT_X0 + 0.60, lz: APT_Z0 + 8.40 },
    // out into the hall a little — watching the front door for you
    { x: APT_X0 + 1.30, z: APT_Z0 + 6.85, lx: APT_X0 + 1.20, lz: APT_Z0 + 0.09 },
    // back against the west wall — reading the mailboxes down the hall
    { x: APT_X0 + 0.58, z: APT_Z0 + 7.30, lx: APT_X0 + 2.28, lz: APT_Z0 + 1.30 },
    // the east side, by the stair gate — the front door again, from the far side
    { x: APT_X0 + 1.62, z: APT_Z0 + 6.40, lx: APT_X0 + 1.20, lz: APT_Z0 + 0.09 },
  ];
  const LL_SPEED = 0.42;           // m/s. A stroll. He is not going anywhere.
  const LL_NOTICE = 2.6;           // m: inside this he stops and looks at YOU
  let llx = LL_POSTS[0].x, llz = LL_POSTS[0].z;   // where he is, live
  let llHead = LL_FACING;                          // eased heading, atan2(vx, vz)
  let llPost = 0;                                  // the post he is at or heading for
  let llWait = 3;                                  // seconds left standing still
  let llMoving = false;
  let llWasIn = false;
  /** turn the short way round, at a human rate. Lifted from ct/crowd.ts, which
   *  learned it the hard way: snapping the heading is the third source of the
   *  sprite twitching between two painted columns. */
  const llTurn = (want: number, dt: number, rate = 4.5) => {
    let d = want - llHead;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    llHead += d * Math.min(1, dt * rate);
  };

  // WHAT HE HANDS YOU IS HELD BETWEEN THE TWO OF YOU, not five metres away at
  // the boxes, which is where it used to open from. The page's normal is
  // (sin yaw, cos yaw), so aiming the yaw from HIM at YOU puts the eye on your
  // side of the paper looking back at the page and at the man behind it. It is
  // computed at [E] time from where he is actually standing now — a fixed hold
  // would open the sheet at the post he left thirty seconds ago.
  const HOLD_HALL = (): Hold => {
    const yaw = Math.atan2(ctx.player.x() - llx, ctx.player.z() - llz);
    // 0.55 m of his 0.95 m reach, so the feet land a half-step back from where
    // you pressed [E] and clear of his collider.
    return { x: llx + Math.sin(yaw) * 0.55, y: 1.42, z: llz + Math.cos(yaw) * 0.55, yaw };
  };
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
    if (here) {
      // ARRIVING: he does not fade in mid-stride at wherever he happened to
      // stop yesterday. Coming on shift puts him back on his own post, facing
      // the door, standing still — which is also what he looked like before
      // this item, so the first thing you ever see of him is unchanged.
      if (!llWasIn) {
        llPost = 0; llx = LL_POSTS[0].x; llz = LL_POSTS[0].z;
        llHead = LL_FACING; llMoving = false; llWait = 2.5;
      }
      const post = LL_POSTS[llPost];
      // ── DOES HE NOTICE YOU ─────────────────────────────────────────────
      //
      // Yes, and it is the cheapest line in the file for what it buys: inside
      // 2.6 m on the lobby floor he STOPS WHERE HE IS and turns to face you.
      // A man you owe money to who keeps pacing while you stand in front of
      // him is a machine; a man who turns his head is a man waiting for you.
      // Distance only — no sight line — because he is expecting you and this
      // is his hall.
      const near = gy < 0.5 && Math.hypot(px - llx, pz - llz) < LL_NOTICE;
      if (near) {
        llTurn(Math.atan2(px - llx, pz - llz), dt, 6);
        landlord.setWalking(false);
        // he keeps the post he was walking to, so he resumes rather than
        // re-rolling the moment you step away
        llWait = Math.max(llWait, 1.2);
      } else if (llMoving) {
        const dx = post.x - llx, dz = post.z - llz;
        const d = Math.hypot(dx, dz);
        if (d < 0.06) {
          // arrived. Stand a while and look at whatever this post looks at.
          llx = post.x; llz = post.z;
          llMoving = false;
          llWait = 2.5 + Math.random() * 5;
        } else {
          const step = Math.min(d, LL_SPEED * dt);
          llx += (dx / d) * step; llz += (dz / d) * step;
          llTurn(Math.atan2(dx, dz), dt);       // HE FACES WHERE HE IS GOING
          landlord.setWalking(true);
        }
      } else {
        landlord.setWalking(false);
        llTurn(Math.atan2(post.lx - llx, post.lz - llz), dt, 2.2);  // and looks at it
        llWait -= dt;
        if (llWait <= 0) {
          // any post but this one, so he always actually goes somewhere
          let n = Math.floor(Math.random() * (LL_POSTS.length - 1));
          if (n >= llPost) n += 1;
          llPost = n;
          llMoving = true;
        }
      }
      // BOUNDS ARE ENFORCED ON THE POSITION, not trusted to the posts. The
      // posts are all inside the box, so this clamp never fires today — it is
      // here so that editing a post by hand cannot walk him into a wall, the
      // stair or 101's parcel without the clamp catching it first.
      llx = Math.min(LL_MAX_X, Math.max(LL_MIN_X, llx));
      llz = Math.min(LL_MAX_Z, Math.max(LL_MIN_Z, llz));
      landlord.mesh.position.set(llx, 0, llz);
      landlord.setFacing(llHead);
      landlord.update(px, pz, dt);
      // THE [E] SPOT FOLLOWS THE MAN. `pickSpot` reads these fields off the
      // registered object every frame, so writing them here is the whole of it
      // — and `aimX/aimZ` are declared so aim is measured to HIM and not to a
      // floor marker he has walked away from (`Pickable.aimX` in fp.ts).
      llSpot.x = llx; llSpot.z = llz;
      llSpot.aimX = llx; llSpot.aimZ = llz;
    }
    llWasIn = here;
    // WITHHELD IF YOU ARE ALREADY STANDING IN IT — C's rule for the hermit and
    // for the landing packages, and it is not a nicety: a collider that appears
    // around the player shoves them, and being shoved by a man materialising is
    // the kind of thing that reads as the world breaking. It matters MORE now
    // that he moves: the box travels with him, so it can arrive around a player
    // standing still. Same rule, same shove, so the same guard covers both.
    const inIt = Math.abs(px - llx) < LL_HALF_X + 0.36 && Math.abs(pz - llz) < LL_HALF_Z + 0.36;
    const solid = here && !inIt && gy < 0.5;
    llBox.minX = solid ? llx - LL_HALF_X : 999;
    llBox.maxX = solid ? llx + LL_HALF_X : 999;
    llBox.minZ = solid ? llz - LL_HALF_Z : 999;
    llBox.maxZ = solid ? llz + LL_HALF_Z : 999;
  });

  /** A receipt is a letter you were handed rather than posted. Same sheet. */
  function receipt(day: number, amount: number): Letter {
    // MONTHS, not weeks. Money still moves in whole rent periods and a period is
    // now a season, so the carbon book has to say so — a receipt that says
    // "one week's rent" against a monthly lease is the feature contradicting its
    // own paperwork, which is what this file's own notice comment warns about.
    const months = Math.round(amount / RENT.amount);
    return {
      day, kind: 'receipt', art: 'docket-receipt', from: `${RENT.landlord} — RECEIVED`,
      lines: [
        `RECEIVED OF APT ${RENT.flat}`,
        '',
        `THE SUM OF $${amount.toFixed(2)},`,
        `being ${months === 1 ? "one month's" : `${months} months'`} rent.`,
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

  // HELD IN A NAMED OBJECT because it MOVES. `crosstown.ts` pushes the very
  // object you hand it onto `SPOTS` and `pickSpot` reads its fields fresh every
  // frame, so the frame hook above rewrites `x/z/aimX/aimZ` in place and the
  // prompt, the highlight and the trigger circle all travel with him. A spot
  // left at his old post would offer you a man standing a metre to your left.
  const llSpot: Spot = {
    // He is the object, so the prompt and the highlight name the same man.
    // r 0.95, not the 1.15 it was. C's second question — *"1.15 is the largest
    // radius on that landing and I do not know whether it is deliberate"* — and
    // the honest answer is that it was not: I picked it because a man is wide.
    // The door's is 0.95 and the parcel's is 0.95, so this is 0.95.
    // rewritten every frame by the hook above; these are only where he starts
    x: LL_X, z: LL_Z, aimX: LL_X, aimZ: LL_Z, r: 0.95,
    obj: landlord.mesh,
    ok: () => landlordIn(ctx.clock.now().totalMin) && ctx.player.gy() < 0.5,
    // THE FIGURE IS IN THE PROMPT, both ways round. K's rule, and it is the
    // difference between a refusal you understand and a key that does nothing:
    // *"the refusal is in the caption you are already reading."*
    label: () => {
      const day = Math.floor(ctx.clock.now().totalMin / 1440);
      const bal = owed(day);
      const cash = ctx.purse.cash;
      // A LABEL MUST BE TRUE EVEN WHEN NOBODY CAN READ IT. `ok()` is false
      // whenever nothing is owed, so this branch is unreachable in play — and
      // it read `rent is $0.00 — you are $30.50 short`, which is two false
      // statements in one line. It cost nothing to leave and it is not
      // harmless: labels are the world's public description of itself, and C's
      // packages check already took a false red off one of my prompts once
      // (notes/C-package-vs-rent-for-N.md). An instrument reading spots gets
      // this text; the gate is not visible from there.
      if (bal <= 0) return 'nothing is owed';
      if (cash >= RENT.amount) {
        const months = Math.min(Math.floor(cash / RENT.amount), bal / RENT.amount);
        return `pay the rent — $${(months * RENT.amount).toFixed(2)}`;
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
      showLetters([l], HOLD_HALL());
    },
  };
  ctx.spot(llSpot);

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
  // ── AND YOU READ IT WHERE YOU PICKED IT UP: INSIDE 301 ───────────────────
  //
  // *"i cant read it and i teleport to outside my apt?"* — both of those were
  // this line missing. See `Hold`: this page used to open at the mailbox three
  // storeys below, so the focus controller walked the player's feet out onto
  // the landing and left the eye pointed down through the floorboards.
  //
  // `yaw = -π/2` is the same normal the boxes use (−x), which here means the
  // page hangs just inside your own door with the eye on the ROOM side of it,
  // looking back at the doorway the slip came under. The feet land at
  // `x - 0.95` = AX(−1.10) on floor 3: a half-step back from where you bent
  // down, well inside the flat, clear of the bed (AZI 4.40+) and the crate
  // (AZI 2.53−), and nothing between that eye and the page whether the door is
  // open or shut. The storey is the whole point — the boxes and this slip sit
  // within a metre of each other in x and z (GOTCHAS §7).
  const HOLD_301: Hold = { x: SLIP.x - 0.10, y: SLIP.y + 1.41, z: SLIP.z, yaw: -Math.PI / 2 };
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
      showLetters([l], HOLD_301);
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
    /**
     * THE DATE, as `ct/calendar.ts` gives it — season, day of season, year.
     *
     * Published here because the tenancy is the only thing in the world that
     * acts on the date today, so this is where anyone asking "what season is it"
     * will look first. The real accessor is `seasonOf(day)` from
     * `ct/calendar.ts`; this is the window onto it, not a second copy of it.
     */
    date: (d?: number) => dateOf(d ?? Math.floor(ctx.clock.now().totalMin / 1440)),
    isRentDay: (d: number) => isRentDay(d),
    nextDueDay: (d: number) => nextDueDay(d),
    /** the notice for period `n` goes in the box on this day */
    noticeDay: (n: number) => noticeDay(n),
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
    /**
     * Where the box is, AND THE STOREY YOU HAVE TO BE ON TO USE IT.
     *
     * `stand` used to be x and z only. Verifier J confirmed this row and said
     * plainly what they could not do: *"warping to his spot left `ok()` false
     * because I did not resolve the STOREY … a published spot plus the wrong
     * floor looks exactly like a spot that does not work."*
     *
     * That is my defect and not J's. Every one of my three [E]s is gated on
     * the floor and MUST be — the mailbox and the slip under 301's door sit
     * within a metre of each other in x and z and are separated only by which
     * storey you stand on (GOTCHAS §7). A caller cannot know that from two
     * coordinates, so the third one is published: warp with `stand.gy` and the
     * spot is live. Publish your own footprint rather than making the reader
     * derive it.
     */
    box: () => {
      const w = door.getWorldPosition(new THREE.Vector3());
      return { x: w.x, y: w.y, z: w.z,
        stand: { x: STAND_X, z: me.z, gy: 0 }, snapped: bank.found };
    },
    envelopes: () => envs.filter((e) => e.visible).length,
    /** the two slips he hands over, so the overrun check can measure them too:
     *  they never go through mailFor() and were invisible to it. */
    slips: () => [receipt(0, RENT.amount), shortSlip(0)].map((l) => ({ from: l.from, lines: l.lines })),
    /** the slip under 301's door: where it is and whether it is on the floor */
    slip: () => ({ x: SLIP.x, z: SLIP.z, y: SLIP.y,
      /** stand HERE to be offered it — floor 3, and the storey is the point */
      stand: { x: SLIP.x - 0.55, z: SLIP.z, gy: 2 * ST0 },
      down: slipDown(ctx.clock.now().totalMin), visible: slip.visible }),
    /** the landlord: where he is, whether he is in the hall, and his box */
    landlord: () => ({
      // LIVE, because he meanders now. `x/z` is where he is THIS frame and it
      // is also what the [E] spot reads — an instrument quoting his old fixed
      // post would be describing a man who is not there.
      x: llx, z: llz, in: landlordIn(ctx.clock.now().totalMin),
      /** which way he is turned, atan2(vx, vz), and whether he is walking */
      facing: llHead, walking: llMoving,
      /** the box he may never leave: the stair foot, clear of 101's parcel */
      bounds: { minX: LL_MIN_X, maxX: LL_MAX_X, minZ: LL_MIN_Z, maxZ: LL_MAX_Z },
      /** stand HERE to be offered him — the LOBBY floor, which is what J could
       *  not resolve from x and z alone */
      stand: { x: llx, z: llz - 0.6, gy: 0 },
      visible: landlord.mesh.visible,
      solid: llBox.minX < 900,
      /** the clear lane past him, against the 0.72 m player. GOTCHAS §29:
       *  this is a RAW GAP on an EMPTY lobby, quoted the way the rest of the
       *  project quotes one. */
      /** the clear lane past him RIGHT NOW — worst case is his east bound */
      lane: (APT_X0 + 2.395) - (LL_MAX_X + LL_HALF_X),
    }),
    reading: () => (PANEL?.isOpen() ? { page, of: reading.length } : null),
    pay: () => payRent(ctx, Math.floor(ctx.clock.now().totalMin / 1440)),
    /**
     * A FIXTURE, not a fake: put `n` dollars in the purse so the paying path
     * can be measured at all.
     *
     * The purse starts at $14.50 and a season's rent is `RENT.amount`, so without this
     * every clause about money leaving the wallet is a verdict over an empty
     * set — green because it never happened (GOTCHAS §34). `ct/atm.ts` is the
     * one thing in the world that adds cash, and driving K's machine to fund my
     * own check would redden this suite every time K's ATM moved.
     *
     * It sets up a PRECONDITION and cannot make any assertion true: whether
     * exactly one period's rent leaves, whether the arrears clear, and whether a refusal
     * takes nothing are all still the code's answer. Same class as
     * `__ct.warp` and `__ct.clock`, which write the world for the same reason.
     */
    stage: (n: number) => { ctx.purse.cash = n; ctx.refreshWallet(); return ctx.purse.cash; },
  };
}
