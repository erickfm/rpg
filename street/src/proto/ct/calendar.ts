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
 * and rent, being due on the 1st, is therefore a **once-per-11.2-hours** event
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
 * THE YEAR. 1997, kept, because the world is called CROSSTOWN '97 and the wall
 * calendar has stamped that year since it was drawn. Seasons roll the year over:
 * after WINTER 1997 comes SPRING 1998.
 */
export const YEAR0 = 1997;
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
  return `${d.season} ${d.dayOfSeason}, ${d.year}`;
}

/** Sunday. No post. Day 0 is a Monday, so `weekday === 6` is Sunday for ever. */
export function noDelivery(day: number): boolean { return fmod(day, 7) === 6; }

// ── THE LEASE ──────────────────────────────────────────────────────────────
//
// It lives in the calendar because rent is a DATE — "the 1st of the month" — and
// splitting the terms from the date is what produced two disagreeing copies in
// the first place. `ct/tenancy.ts` runs the tenancy off these; the wall calendar
// in 301 rings the days off these. There is one copy and it is this one.

export const RENT = {
  /**
   * $45, unchanged in figure and changed entirely in meaning: it used to buy a
   * WEEK and it now buys a MONTH, which is a season. Left at 45 deliberately —
   * the old comment's reasoning still holds and is now much safer:
   *
   *   *"it is set against the economy that exists rather than against realism:
   *    you start with $14.50 and a box of cereal costs $2.50. A realistic $325
   *    a month would be a debt you could never clear, which is a failure state
   *    rather than a feature."*
   *
   * You now have a whole season to find $45 instead of a week, so the lease got
   * dramatically kinder without a single number moving. It is also the figure
   * already stamped on the wall calendar in 301, which the user has looked at.
   */
  amount: 45,
  /**
   * The notice lands this many days before the 1st.
   *
   * 3, up from 2. Against a seven-day cycle 2 days was 28% of the period; against
   * a 28-day one it is 7%, and a reminder that arrives at the very last moment
   * of a season is a reminder for a game with a much faster clock than this. At
   * 3 the notice lands on the **Friday** before the season turns — every time,
   * because 28 is a whole number of weeks — which is exactly when a real agent
   * posts one.
   */
  noticeLead: 3,
  /**
   * MONTHS ALREADY PAID WHEN THE GAME OPENS — the whole of his second sentence,
   * as one number.
   *
   * *"when you start the game it's the first but ur mom already paid for your
   *  first month when she kicked you out"*
   *
   * Day 0 IS the 1st, so a month's rent falls due the instant the world loads.
   * She covered it. `ct/tenancy.ts` seeds `paidPeriods` from this, so on a fresh
   * start `owed()` is 0 — which means no arrears, no PAST DUE stamp, no slip
   * under the door and **no landlord in the lobby** (he only stands there when
   * he is owed). The first payment you make with your own money is the 1st of
   * the next season.
   *
   * Her receipt is in the mailbox on day 0. See `prepaidReceipt` in tenancy.
   */
  prepaidMonths: 1,
  /** the flat, the landlord, and the man's name on the bottom of the notice */
  flat: '301',
  landlord: 'V. OKONKWO',
  building: 'No. 227',
} as const;

/** Is the rent due on `day`? The 1st of a season, and nothing else. */
export function isRentDay(day: number): boolean {
  return day >= 0 && dateOf(day).dayOfSeason === 1;
}

/** The game day of the `n`th rent day, counting from 0. Day 0, 28, 56, 84 … */
export function dueDay(n: number): number { return n * DAYS_PER_SEASON; }

/**
 * How many rent days have arrived by `day` — `dueDay(n) <= day` for n < this.
 *
 * NOTE THAT THIS IS 1 ON DAY 0, not 0: the game opens ON a rent day and that
 * month is genuinely due. It is also genuinely paid — see `RENT.prepaidMonths`.
 */
export function duePeriodsBy(day: number): number {
  if (day < 0) return 0;
  return dateOf(day).monthIndex + 1;
}

/** The next rent day on or after `day`. */
export function nextDueDay(day: number): number {
  if (day <= 0) return 0;
  return Math.ceil(day / DAYS_PER_SEASON) * DAYS_PER_SEASON;
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
