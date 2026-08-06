// ── THE WORLD'S CALENDAR ───────────────────────────────────────────────────
//
// *"per year i want there to be 4 months kinda like stardew where each month is
//  a season, spring, summer, fall, winter"*   (2026-08-04)
//
// and, in the same breath:
//
// *"lets make rent due monthly on the first. when you start the game it's the
//  first but ur mom already paid for your first month when she kicked you out"*
//
// A MONTH AND A SEASON ARE THE SAME OBJECT HERE. There are four of them in a
// year, they are named rather than numbered, and every dated thing in this world
// reads them from this file.
//
// ── WHY THIS IS ITS OWN MODULE, AND WHY IT IMPORTS NOTHING ─────────────────
//
// Before today the date lived in TWO places and neither knew about the other:
// `ct/tenancy.ts` ran the lease off a day count (`firstDay: 2, everyDays: 7`)
// and `ct/apartment.ts`'s wall calendar derived real Gregorian months off a
// `Date.UTC(1997, 8, 1)` epoch of its own, plus a hand-copied `LEASE` block with
// a comment admitting the copy:
//
//   *"BUILDER-BRIEF §8 says import rather than retype, and I cannot: `ct/
//    tenancy.ts:4` imports `APT_X0/APT_Z0/ST0` FROM THIS FILE, so importing it
//    back closes an import cycle — and GOTCHAS §28 is that a module in a cycle
//    can be silently dropped from the BUILT BUNDLE ONLY. Dev would look perfect
//    and the calendar (or the mailbox) would not exist in the artifact. … The
//    follow-up for the desk is to hoist `RENT` into a leaf module that neither
//    file imports."*
//
// THIS IS THAT LEAF MODULE. It imports nothing at all — not three, not `ctx`,
// not `paint` — so anything may import it and no cycle can form. That is the
// whole reason it exists and it is the one property to preserve: **do not add
// an import to this file.**
//
// ── THE ACCESSOR EVERYTHING ELSE SHOULD USE ────────────────────────────────
//
// `dateOf(day)` where `day = Math.floor(ctx.clock.now().totalMin / 1440)`, or
// the shorthand `seasonOf(day)`. Weather, sky colour, what grows in the park and
// what citizens wear are all "what season is it" questions, and when any of them
// is built it asks HERE rather than counting days again. Nothing in this file
// knows about any of those and it does not have to.

/**
 * HOW LONG A SEASON IS — the one number in this world you tune by feel.
 *
 * 28, which is Stardew's own and is the number the reference he named makes a
 * player expect. It buys two structural things beyond faithfulness:
 *
 *   - 28 is FOUR WHOLE WEEKS, so a season page draws as a clean 4 x 7 block
 *     with no leading blanks and no ragged tail. Gregorian months could not do
 *     that and the old calendar carried `lead`/`weeks` arithmetic to cope
 *   - day 0 is a Monday (`noDelivery` has said so since it was written), so with
 *     a multiple of 7 **the 1st of every season is a Monday, for ever**, and the
 *     rent notice always lands on the same weekday
 *
 * ⚠ THE REAL-TIME COST, because it is large and nobody should discover it by
 * waiting. A game day is 1440 game-minutes at one real second each = 24 real
 * minutes. So:
 *
 *     a season   28 days  = 11.2 real hours
 *     a year    112 days  = 44.8 real hours
 *
 * and rent, being due once a season, is therefore a **once-per-11.2-hours** event
 * if you only ever walk. Sleeping is the release valve — `ctx.clock.advance()`
 * moves eight game hours in about a second and a half — so a player who sleeps
 * crosses a season in minutes rather than in an evening.
 *
 * KEEP IT A MULTIPLE OF 7. 14 (5.6 h a season, 22.4 h a year) is the number to
 * try if a season should turn twice in one sitting; it keeps the Monday 1st, the
 * Friday notice and a clean 2 x 7 page. 7 itself works and makes the seasons
 * gallop. A non-multiple still computes correctly — the weekday is taken off the
 * absolute day and not off the season — it only puts blank cells at the head of
 * the calendar page.
 */
export const DAYS_PER_SEASON = 28;

/** The four of them, in the user's own order, and the year is exactly these. */
export const SEASONS = ['SPRING', 'SUMMER', 'FALL', 'WINTER'] as const;
export type Season = (typeof SEASONS)[number];

/**
 * ── WHAT COLOUR A SEASON IS ───────────────────────────────────────────────
 *
 * *"theme the color of the calendar to the season. green spring, yellow summer,
 *  red fall, blue winter"*   (2026-08-05)
 *
 * HERE, BESIDE THE NAMES, because this module is what a season IS. The wall
 * calendar is the first reader; if the sky, the foliage or a shop window ever
 * wants to know what colour SUMMER is, it reads one place and cannot invent a
 * fifth opinion — the same argument that put the lease in here beside the date.
 *
 * ⚠ A PRINTER'S SECOND COLOUR ON CHEAP STOCK, NOT FOUR PRIMARIES. CROSSTOWN is
 * overcast brick, worn tan and cold grey, and a pure green would be the loudest
 * thing in the flat — that exact mistake got a whole screen thrown out today
 * (*"WAY TOOO UGKLY"*). So: a muted leaf, an ochre rather than a yellow, and
 * the brick red the calendar's banner has ALWAYS been, which is why FALL cost
 * nothing to name — the page was already autumn-coloured and nobody had said so.
 *
 * MEASURED, NOT EYEballed. Every one of these carries the banner's cream type
 * (#e8dcb8) at 3.5:1 or better, which is the large-text bar, and stands off the
 * cream paper (#e8e0cc) at 3.3:1 or better as a block:
 *
 *              banner type   vs paper
 *   SPRING        3.53         3.67
 *   SUMMER        3.97         4.12
 *   FALL          5.57         5.79
 *   WINTER        4.68         4.87
 *
 * SUMMER IS THE ONE THAT NEEDED WORK, exactly as expected — yellow ink on cream
 * paper is the trap in this request. A true mustard came back at 2.44:1, below
 * anything readable, so it is walked down to a dark ochre. It still reads as
 * the yellow season beside the other three, which is what a season colour has
 * to do; it just is not a highlighter.
 */
export const SEASON_INK: Record<Season, string> = {
  SPRING: '#5f7a43',        // muted leaf
  SUMMER: '#87641f',        // dark ochre — see the note above
  FALL: '#8c3a2e',          // the brick the banner already was
  WINTER: '#4a6272',        // cold slate
};

/** 112 days. Derived — never type the product. */
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

/**
 * THE GAME OPENS ON SPRING 1, 1997 — day 0, and both halves of that are chosen.
 *
 * THE SEASON. Spring, because it is the first name he said, because it is where
 * Stardew starts, and because a calendar whose very first page is page one of
 * the year is a calendar a player can read without being told the scheme. The
 * rain this world already has reads as spring rain in a city perfectly well. If
 * the grey street wants to match its weather instead, FALL is a one-word change
 * to `SEASON0` and nothing else moves.
 *
 * ── THE YEAR IS YEAR 1 NOW, NOT 1997 ──────────────────────────────────────
 *
 * *"i think you can also get rid of the year. maybe just year 1"*  (2026-08-05)
 *
 * HE OFFERED BOTH — no year at all, or YEAR 1 — AND THE PAGE KEEPS ONE, for a
 * reason that arrived in the same message as the year did: the wall calendar
 * now SCROLLS between seasons. Every fifth page you turn back to is SPRING
 * again, and with nothing but the season name on the banner two different
 * SPRINGs are the same picture. A year is the only thing on the page that says
 * which one you are looking at. Drop it and the scroll loses its landmark.
 *
 * 1997 IS UNTOUCHED AS THE SETTING. The world is CROSSTOWN '97 and stays so —
 * this number was only ever printed in one place, the banner of the calendar in
 * 301 (`ct/apartment.ts`, the `stampNum` line), and nothing else in the world
 * derived an era from it. Checked all of it: `dateStr` has no callers at all,
 * `ct/tenancy.ts` reads `dateOf(...).season` and never `.year`, so no rent
 * notice, receipt or carbon has ever carried a year to disagree with. The
 * library's `b.year` is a BOOK's publication date and is not this. The signage,
 * the television and the watch's CROSSTOWN QUARTZ face read nothing from here.
 *
 * Seasons still roll it over, so after WINTER, YEAR 1 comes SPRING, YEAR 2.
 */
export const YEAR0 = 1;
/** which of `SEASONS` day 0 falls in */
export const SEASON0 = 0;

/** floor division that behaves for negative days — a probe may snap the clock
 *  backwards, and `%` on a negative in JS is not the modulus you want. */
const fdiv = (a: number, b: number) => Math.floor(a / b);
const fmod = (a: number, b: number) => ((a % b) + b) % b;

/** What a game day IS. Everything dated in this world is one of these fields. */
export interface GameDate {
  /** the game day it was derived from */
  day: number;
  /** SPRING | SUMMER | FALL | WINTER */
  season: Season;
  /** 0…3, its index in `SEASONS` */
  seasonIndex: number;
  /** 1…DAYS_PER_SEASON. **1 is the rent day.** */
  dayOfSeason: number;
  /** 1997, 1998, … */
  year: number;
  /** 0 = Monday … 6 = Sunday. Day 0 is a Monday. */
  weekday: number;
  /**
   * How many season-boundaries have been crossed since day 0 — i.e. which
   * MONTH this is, counting from 0. This is the rent period index and it is
   * what `duePeriodsBy` counts.
   */
  monthIndex: number;
}

/** The date, from a game day. Pure, total, and correct for negative days. */
export function dateOf(day: number): GameDate {
  const m = fdiv(day, DAYS_PER_SEASON);              // months since day 0
  const s = fmod(SEASON0 + m, SEASONS.length);
  return {
    day,
    season: SEASONS[s],
    seasonIndex: s,
    dayOfSeason: day - m * DAYS_PER_SEASON + 1,
    year: YEAR0 + fdiv(SEASON0 + m, SEASONS.length),
    weekday: fmod(day, 7),
    monthIndex: m,
  };
}

/** The shorthand the rest of the world will want: what season is it. */
export function seasonOf(day: number): Season { return dateOf(day).season; }

/**
 * A date as a person says it — "SPRING 14, 1997".
 *
 * Here so that a letter, a sign or a HUD line never assembles one by hand and
 * ends up with a second format in the same small world.
 */
export function dateStr(day: number): string {
  const d = dateOf(day);
  return `${d.season} ${d.dayOfSeason}, YEAR ${d.year}`;
}

/** Sunday. No post. Day 0 is a Monday, so `weekday === 6` is Sunday for ever. */
export function noDelivery(day: number): boolean { return fmod(day, 7) === 6; }

// ── THE LEASE ──────────────────────────────────────────────────────────────
//
// It lives in the calendar because rent is a DATE — "the 5th of the month" — and
// splitting the terms from the date is what produced two disagreeing copies in
// the first place. `ct/tenancy.ts` runs the tenancy off these; the wall calendar
// in 301 rings the days off these. There is one copy and it is this one.

export const RENT = {
  /**
   * ── $500 A SEASON ────────────────────────────────────────────────────────
   *
   * *"rent is 500/mo"*   (2026-08-05)
   *
   * A "month" here is a SEASON — 28 days — because that is the cycle he built,
   * so this is $500 per 28 days, four times a year.
   *
   * IT REPLACES $45, AND THE OLD ARGUMENT FOR $45 IS WHAT MAKES THIS WORTH
   * FLAGGING RATHER THAN JUST SETTING. That number was chosen against the
   * economy that exists: *"you start with $14.50 and a box of cereal costs
   * $2.50. A realistic $325 a month would be a debt you could never clear,
   * which is a failure state rather than a feature."* $500 is above the figure
   * that reasoning already rejected.
   *
   * ⚠ IT IS NOT PAYABLE TODAY, MEASURED RATHER THAN GUESSED. Everything a
   * player can currently turn into cash:
   *
   *     starting cash                            $14.50
   *     the bank account (`atm.ts`)              $312.40
   *     the fence's whole table, best first      CHEQUES $8, TRAINERS $5,
   *                                              TOASTER $4, VHS $2,
   *                                              SOCKS $0.50, CATALOGUE $0.25
   *     slots and blackjack, per unit            $0.25
   *
   * Liquid on a fresh start is $326.90. Parcels arrive at 10% per door per day
   * across 8 doors, so ~0.8 a day, and a season of stealing every one of them
   * yields on the order of $70 at those fence prices. That is ~$400 against a
   * $500 bill, and the tables move a quarter at a time.
   *
   * SO THE FIGURE IS HIS AND IT IS SET; the numbers that would have to move for
   * it to be reachable are the fence table, the account, or an income source
   * that does not exist yet — and none of those is mine to change unasked. The
   * consequence of not paying is not a failure state: arrears accrue, the
   * notice and the PAST DUE stamp appear, and the landlord stands in the lobby.
   * Nothing evicts him, so a high rent reads as pressure rather than a wall.
   */
  amount: 500,
  /**
   * ── WHICH DAY OF THE SEASON THE RENT FALLS ON ────────────────────────────
   *
   * *"make rent due on the 5th instead of the 1st ty"*   (2026-08-05)
   *
   * THE ONE NUMBER. `dueDay`, `isRentDay`, `duePeriodsBy`, `nextDueDay` and
   * `noticeDay` are all expressed through it, so this line is the whole change
   * and nothing downstream holds a second opinion — the wall calendar's ring,
   * its event line, the notice, the receipt and the landlord all follow.
   *
   * IT IS A FRIDAY, EVERY TIME. `DAYS_PER_SEASON` is 28, a whole number of
   * weeks, and day 0 is a Monday — so the 1st was a Monday for ever and the 5th
   * is a Friday for ever. Nothing depended on rent day being a Monday: the only
   * weekday rule in this module is `noDelivery` (Sunday, no post), and Friday is
   * a delivery day. Rent due on a Friday is the more period-correct of the two
   * anyway — you paid the agent at the end of the working week.
   *
   * AND THE FIRST OF THE SEASON IS STILL A MONDAY. That property was about the
   * calendar page's shape, not about rent, and it is untouched: the grid still
   * starts flush with no lead-in blanks.
   */
  dueDayOfSeason: 5,
  /**
   * The notice lands this many days before the rent day.
   *
   * 3, up from 2. Against a seven-day cycle 2 days was 28% of the period; against
   * a 28-day one it is 7%, and a reminder that arrives at the very last moment
   * of a season is a reminder for a game with a much faster clock than this.
   *
   * ⚠ WHERE IT LANDS CHANGED WITH THE DUE DAY, AND FOR THE BETTER. It used to
   * fall 3 days before the 1st, i.e. on the PREVIOUS season's 26th — a warning
   * about SUMMER's rent arriving in SPRING, which reads as a stray. Off the 5th
   * it lands on the **2nd of the same season**, a Tuesday, so the notice and the
   * bill are on the same page of the calendar. That is what a real agent posts
   * and it is what the wall calendar can now show.
   */
  noticeLead: 3,
  /**
   * MONTHS ALREADY PAID WHEN THE GAME OPENS — the whole of his second sentence,
   * as one number.
   *
   * *"when you start the game it's the first but ur mom already paid for your
   *  first month when she kicked you out"*
   *
   * Day 0 is SPRING 1 and the first rent day is SPRING 5 — day 4 — so a month
   * falls due four days into the world rather than the instant it loads. She
   * covered it. `ct/tenancy.ts` seeds `paidPeriods` from this, so on a fresh
   * start `owed()` is 0 and STAYS 0 through the whole of spring: no arrears, no
   * PAST DUE stamp, no slip under the door and **no landlord in the lobby** (he
   * only stands there when he is owed).
   *
   * The first payment you make with your own money is **SUMMER 5, day 32**.
   * `duePeriodsBy` is 0 on day 0 now, where it used to be 1 — the game no longer
   * opens ON a rent day — and 1 from day 4, which is the month she paid.
   *
   * Her receipt is in the mailbox on day 0. See `prepaidReceipt` in tenancy.
   */
  prepaidMonths: 1,
  /** the flat, the landlord, and the man's name on the bottom of the notice */
  flat: '301',
  landlord: 'V. OKONKWO',
  building: 'No. 227',
} as const;

/** Is the rent due on `day`? `RENT.dueDayOfSeason` of a season, and nothing else. */
export function isRentDay(day: number): boolean {
  return day >= 0 && dateOf(day).dayOfSeason === RENT.dueDayOfSeason;
}

/** The game day of the `n`th rent day, counting from 0. Day 4, 32, 60, 88 … */
export function dueDay(n: number): number {
  return n * DAYS_PER_SEASON + RENT.dueDayOfSeason - 1;
}

/**
 * How many rent days have arrived by `day` — `dueDay(n) <= day` for n < this.
 *
 * ⚠ IT IS 0 ON DAY 0 NOW, where it used to be 1. The game opened ON a rent day
 * when rent was the 1st; on the 5th it opens four days short of one, so nothing
 * is due until day 4. `RENT.prepaidMonths` still covers that first one, so the
 * fresh-start balance is 0 either way — but the reason is different and the
 * arithmetic below had to stop assuming it.
 *
 * COUNTED FROM THE DUE DAY, not from the season boundary: `dueDay(n) = n*28 + 4`,
 * so the count is how many of those are at or below `day`.
 */
export function duePeriodsBy(day: number): number {
  const first = dueDay(0);
  if (day < first) return 0;
  return Math.floor((day - first) / DAYS_PER_SEASON) + 1;
}

/** The next rent day on or after `day`. */
export function nextDueDay(day: number): number {
  const first = dueDay(0);
  if (day <= first) return first;
  return Math.ceil((day - first) / DAYS_PER_SEASON) * DAYS_PER_SEASON + first;
}

/**
 * When the notice for the `n`th rent day goes in the box.
 *
 * `noticeLead` days before it, WALKED BACK OFF A SUNDAY, because there is no
 * post on one and a notice posted on a day with no delivery is a notice that is
 * never sent. With `DAYS_PER_SEASON` a multiple of 7 the shift never fires — the
 * notice day is a fixed weekday for ever — and it is here so that retuning the
 * season to a length that is not a multiple of 7 cannot silently delete a
 * quarter's warning.
 */
export function noticeDay(n: number): number {
  let d = dueDay(n) - RENT.noticeLead;
  while (noDelivery(d)) d--;
  return d;
}

/**
 * ONE SEASON'S PAGE, for whoever is drawing the calendar on 301's wall.
 *
 * `offset` is how many seasons forward or back of the one containing `day` —
 * the wall calendar's page-turn. Everything the grid needs comes back from here
 * so that the drawing code owns no date arithmetic of its own: that split is
 * exactly how the wall ended up disagreeing with the letters.
 */
export function seasonPage(day: number, offset = 0): {
  season: Season; year: number;
  /** the game day of this page's day 1 */
  day0: number;
  /** how many cells the page has */
  nDays: number;
  /** blank cells before day 1. 0 whenever the season is a multiple of 7. */
  lead: number;
  /** how many rows the grid needs */
  weeks: number;
} {
  const m = fdiv(day, DAYS_PER_SEASON) + offset;
  const day0 = m * DAYS_PER_SEASON;
  const lead = fmod(day0, 7);
  return {
    season: SEASONS[fmod(SEASON0 + m, SEASONS.length)],
    year: YEAR0 + fdiv(SEASON0 + m, SEASONS.length),
    day0,
    nDays: DAYS_PER_SEASON,
    lead,
    weeks: Math.ceil((lead + DAYS_PER_SEASON) / 7),
  };
}
