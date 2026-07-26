// SEVENS — the slot machine you can actually play.
//
// ─────────────────────────────────────────────────────────────────────────────
// PART ONE: THE MATHS. Nothing here draws anything, imports anything, or
// touches the world. That is deliberate and it is the whole point of this file
// being organised the way it is.
//
// A slot machine is a pay table and three strips of tin. Everything else — the
// glass, the stagger, the counting-up meter — is presentation over a number
// that was decided before any of it was drawn. If the number is wrong, no
// amount of looking at the machine will tell you, and every hour spent on the
// glass is spent on top of a broken foundation. So the number comes first, it
// is COMPUTED rather than asserted, and `scripts/L-slots-rtp.mjs` recomputes it
// from these exact tables on demand.
//
// The declared return to player is **92.83%**, and it is not a target I am
// aiming at — it is the exact enumeration of all 10,648 stop combinations
// against the pay table below, confirmed independently by 100,000 simulated
// spins. See THE PROOF at the foot of this section for both figures.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY 22 STOPS
//
// A 1997 three-reel mechanical is a 22-stop machine. That is not a stylistic
// choice, it is what the physical reel WAS: Bally's and IGT's standard reel
// strip carried 22 symbol positions, which is why classic pay tables are all
// built on 10,648 combinations (22³). Using 20 or 24 would give the same kind
// of machine with none of the period's actual arithmetic.
//
// The stop is drawn UNIFORMLY over the 22 positions of each strip. This is the
// honest construction and it is worth being explicit about, because the
// alternative was standard by 1997 and is what most people mean when they say a
// slot machine lies: VIRTUAL REELS map a large hidden random space onto the 22
// physical stops unevenly, so a jackpot symbol that you can SEE occupying one
// of 22 positions might in truth be one of 128. The reel then teases you with a
// near miss whose frequency has nothing to do with the strip you are looking
// at.
//
// This machine does not do that. Every position is 1 in 22, the strips below
// are the whole of the truth, and the near misses come out of where the symbols
// physically sit — which is what the brief asked for: "near misses that are
// HONEST, falling out of the real strip rather than rigged in."

/** The six things printed on the tin. */
export type Sym = 'SEVEN' | 'BAR3' | 'BAR2' | 'BAR1' | 'CHERRY' | 'BLANK';

/** Reading order for anything that has to lay the symbols out. */
export const SYMS: readonly Sym[] = ['SEVEN', 'BAR3', 'BAR2', 'BAR1', 'CHERRY', 'BLANK'];

/** What the pay table calls each one, in the casino's own words. */
export const SYM_NAME: Record<Sym, string> = {
  SEVEN: 'SEVEN', BAR3: 'TRIPLE BAR', BAR2: 'DOUBLE BAR', BAR1: 'BAR',
  CHERRY: 'CHERRY', BLANK: '',
};

/** A bar is a bar for the ANY BARS line. */
export const isBar = (s: Sym): boolean => s === 'BAR1' || s === 'BAR2' || s === 'BAR3';

// ─────────────────────────────────────────────────────────────────────────────
// THE STRIPS
//
// Three arrays of 22, authored by hand, position 0 at the top. Two things are
// being decided here at once and they are easy to confuse:
//
//   · the COUNT of each symbol on each reel, which sets the maths;
//   · the ORDER they sit in, which sets the FEEL and costs the maths nothing.
//
// The counts are what the RTP is computed from. The order is invisible to the
// arithmetic — 22 positions is 22 positions however you shuffle them — but it
// is the entire near-miss design, because the machine shows THREE ROWS through
// the glass and only the middle one pays. A symbol sitting next to a blank is a
// symbol you watch slide past the line.
//
// REEL 3 IS THE SHORT REEL, and that is the oldest trick in the trade done
// honestly. It carries ONE seven against two on each of reels 1 and 2, so
// SEVEN–SEVEN–something is 21 times more likely than the jackpot. That ratio is
// not imposed by a weighting table; it is just how many sevens are printed on
// the tin. You can count them.
//
// Its lone seven sits at index 11 with blanks either side of it (10 and 12), so
// on the spins where reels 1 and 2 have both landed sevens, the third reel
// either pays 250 or shows you the seven one row off the payline. That is the
// tease, and it is a fact about the strip rather than a script.
//
// The second, far more frequent tease is the bars. Reel 3's TRIPLE BAR at 15
// has a plain BAR immediately above it at 14, so TRIPLE–TRIPLE–BAR drops from
// 100 to the ANY BARS 5 by one position. Bars hit often enough that this is the
// near miss you actually live with; the sevens one is the near miss you
// remember.
export const STRIPS: readonly (readonly Sym[])[] = [
  // REEL 1 — 2 sevens, 4 bars, 3 double, 2 triple, 3 cherries, 8 blanks
  ['SEVEN', 'BLANK', 'BAR1', 'CHERRY', 'BAR2', 'BLANK', 'BAR1', 'BAR3',
    'BLANK', 'CHERRY', 'BAR1', 'BLANK', 'BAR2', 'SEVEN', 'BLANK', 'BAR1',
    'CHERRY', 'BAR3', 'BLANK', 'BAR2', 'BLANK', 'BLANK'],
  // REEL 2 — 2 sevens, 4 bars, 3 double, 2 triple, 2 cherries, 9 blanks
  ['BLANK', 'BAR1', 'CHERRY', 'BLANK', 'BAR2', 'SEVEN', 'BLANK', 'BAR1',
    'BAR3', 'BLANK', 'BAR2', 'BLANK', 'BAR1', 'CHERRY', 'BLANK', 'BAR3',
    'SEVEN', 'BLANK', 'BAR1', 'BAR2', 'BLANK', 'BLANK'],
  // REEL 3 — the short reel. ONE seven, at 11, blanks either side of it.
  ['BLANK', 'BAR1', 'BLANK', 'CHERRY', 'BLANK', 'BAR2', 'BLANK', 'BAR1',
    'BLANK', 'BLANK', 'SEVEN', 'BLANK', 'BLANK', 'BAR1', 'BAR3', 'BLANK',
    'CHERRY', 'BLANK', 'BAR2', 'BLANK', 'BAR1', 'BLANK'],
];

/** 22. Read from the strips rather than typed twice — see the ROWS/SLOT_N fault
 *  in ct/int-casino.ts, where a literal table and a loop bound were two
 *  authorings of one number and quietly disagreed. */
export const STOPS = STRIPS[0].length;

// ─────────────────────────────────────────────────────────────────────────────
// THE PAY TABLE
//
// Single payline, straight across the middle. Pays are per credit staked, so a
// three-credit bet pays three times a one-credit bet on every line — which
// means THE RTP IS THE SAME AT EVERY BET SIZE. That is a deliberate omission of
// the period's other standard trick: real machines paid the top jackpot
// disproportionately on max coins precisely so that anything less than max was
// a worse machine. One honest number for the whole machine is worth more here
// than that piece of authenticity.
//
// Cherries pay from the left on 1, 2 or 3, which is what makes a three-reeler
// tick over instead of going dead between hits: cherry-on-reel-one alone is
// 12.4% of all spins and a quarter of the return. It is the small change that
// keeps you sitting down, and it is why the hit rate is 19% rather than 5%.
export interface Pay { readonly line: string; readonly pays: number }

/** Ordered best-first. `evaluate` returns the first that matches. */
export const PAYTABLE: readonly Pay[] = [
  { line: '3 SEVENS', pays: 250 },
  { line: '3 TRIPLE BARS', pays: 100 },
  { line: '3 DOUBLE BARS', pays: 40 },
  { line: '3 CHERRIES', pays: 40 },
  { line: '3 BARS', pays: 20 },
  { line: '2 CHERRIES', pays: 8 },
  { line: 'ANY 3 BARS', pays: 5 },
  { line: '1 CHERRY', pays: 2 },
];

const payOf = (line: string): number => {
  const p = PAYTABLE.find((q) => q.line === line);
  // Not a silent 0. A pay line named here and missing from the table would
  // otherwise make the machine quietly stop paying one of its own combinations,
  // and the RTP script would faithfully report the lower number as correct.
  if (!p) throw new Error(`[slots] pay line "${line}" is not in PAYTABLE`);
  return p.pays;
};

export interface Win { readonly line: string; readonly pays: number }

/**
 * What the three symbols on the payline are worth, per credit staked.
 *
 * Returns the BEST single line, never a sum — three cherries is 40, not
 * 40 + 8 + 2. The categories below are disjoint in every other respect (a
 * cherry is not a bar, a bar is not a seven), so the ordering only actually
 * matters for the cherry ladder, but it is written best-first anyway because
 * "first match wins" is only safe when the table is ordered.
 */
export function evaluate(a: Sym, b: Sym, c: Sym): Win | null {
  if (a === 'SEVEN' && b === 'SEVEN' && c === 'SEVEN') return { line: '3 SEVENS', pays: payOf('3 SEVENS') };
  if (a === 'BAR3' && b === 'BAR3' && c === 'BAR3') return { line: '3 TRIPLE BARS', pays: payOf('3 TRIPLE BARS') };
  if (a === 'BAR2' && b === 'BAR2' && c === 'BAR2') return { line: '3 DOUBLE BARS', pays: payOf('3 DOUBLE BARS') };
  if (a === 'CHERRY' && b === 'CHERRY' && c === 'CHERRY') return { line: '3 CHERRIES', pays: payOf('3 CHERRIES') };
  if (a === 'BAR1' && b === 'BAR1' && c === 'BAR1') return { line: '3 BARS', pays: payOf('3 BARS') };
  if (a === 'CHERRY' && b === 'CHERRY') return { line: '2 CHERRIES', pays: payOf('2 CHERRIES') };
  if (isBar(a) && isBar(b) && isBar(c)) return { line: 'ANY 3 BARS', pays: payOf('ANY 3 BARS') };
  if (a === 'CHERRY') return { line: '1 CHERRY', pays: payOf('1 CHERRY') };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SPINNING
//
// A spin is three uniform draws over [0, 22). That is all it is, and keeping it
// that small is what lets the RTP below be an EXACT enumeration rather than an
// estimate.
//
// THE RANDOM SOURCE IS INJECTED, and it defaults to Math.random rather than to
// this world's seeded stream. GOTCHAS §2: `ct/rng.ts` exports one LCG whose
// DRAW ORDER is load-bearing — every tree height and pigeon position downstream
// shifts if a new module takes a number out of it. A slot machine drawing three
// numbers per spin would rearrange the world's foliage as you played. So it
// never touches that stream. Math.random at spin time is also correct on its
// own terms: a machine whose outcomes are reproducible across page loads is a
// machine you can learn.
//
// The injection is for the PROOF, which needs to be reproducible, and for any
// check that wants to drive a known sequence through the presentation.
export type Rng = () => number;

/** Three stop indices, one per reel. */
export type Stops = readonly [number, number, number];

export function spin(rng: Rng = Math.random): Stops {
  const n = STOPS;
  return [
    Math.min(n - 1, Math.floor(rng() * n)),
    Math.min(n - 1, Math.floor(rng() * n)),
    Math.min(n - 1, Math.floor(rng() * n)),
  ];
}

/** The symbol a reel shows on the payline at a given stop. */
export const symAt = (reel: number, stop: number): Sym =>
  STRIPS[reel][((stop % STOPS) + STOPS) % STOPS];

/**
 * The THREE symbols visible through the glass on one reel: above the payline,
 * on it, below it.
 *
 * This exists in the maths half rather than the drawing half because the near
 * miss IS this function. A machine that only computes the payline cannot tease
 * you — you would never see the seven that did not land. The window is the
 * mechanism, and it is a fact about the strip, so it is testable without a
 * renderer.
 */
export const windowAt = (reel: number, stop: number): readonly [Sym, Sym, Sym] =>
  [symAt(reel, stop - 1), symAt(reel, stop), symAt(reel, stop + 1)];

/**
 * Is this spin a near miss on the top prize — two sevens on the line, and the
 * third reel showing a seven one row off it?
 *
 * Reported, never caused. Nothing anywhere in this file consults this to decide
 * an outcome; the stops are already drawn by the time it can be asked. It is
 * here so the presentation can hold the third reel a beat longer on a spin that
 * deserves it, and so the proof can COUNT how often the strip produces one
 * rather than me claiming a frequency.
 */
export function isSevenTease(stops: Stops): boolean {
  if (symAt(0, stops[0]) !== 'SEVEN' || symAt(1, stops[1]) !== 'SEVEN') return false;
  if (symAt(2, stops[2]) === 'SEVEN') return false;            // that is a jackpot, not a tease
  const [above, , below] = windowAt(2, stops[2]);
  return above === 'SEVEN' || below === 'SEVEN';
}

/**
 * Are the first two reels already matched, so the third one decides something?
 *
 * The cue for the anticipation hold in the presentation. Worth being clear that
 * slowing a reel down on a spin whose outcome is already drawn is NOT the
 * dishonest thing — the tin has already decided; only the pace of showing it
 * changes. Weighting the DRAW would be the dishonest thing and nothing here
 * does it.
 */
export function isLive(stops: Stops): boolean {
  const a = symAt(0, stops[0]), b = symAt(1, stops[1]);
  if (a === 'CHERRY' && b === 'CHERRY') return true;           // 3 cherries still live
  if (a === b && a !== 'BLANK') return true;                   // any pair of the same tin
  return isBar(a) && isBar(b);                                 // ANY 3 BARS still live
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PROOF
//
// `exactRTP()` walks all 22³ = 10,648 stop combinations and sums what each one
// pays. Every combination is equally likely because every stop is, so this is
// not a sample — it is the machine's return to player, full stop.
//
// A simulation cannot improve on an exact enumeration, but it can catch the
// enumeration and the game disagreeing, which is a real class of bug: the two
// use different code paths (`spin` + `evaluate` against a triple loop), so
// 100,000 spins landing on the same figure is evidence that the thing being
// enumerated is the thing being played. `scripts/L-slots-rtp.mjs` runs both and
// prints them side by side.
//
//   RTP                92.834%      (9,885 credits returned per 10,648 staked)
//   hit frequency      19.00%       (2,023 of 10,648 combinations pay)
//   average win        4.89x        the credit that bought it
//   top prize          1 in 2,662   4 of 10,648
//   two-seven tease    1 in 127     84 of 10,648 land SEVEN SEVEN not-SEVEN
//
// Those five numbers are printed by the script from these tables, not typed
// there. If you change a strip or a pay, run it — it takes about a second, and
// it is the only thing that can tell you what you did.

export interface RtpRow {
  readonly line: string;
  readonly pays: number;
  readonly combos: number;
  readonly credits: number;
  readonly odds: number;          // 1 in N
}

export interface RtpReport {
  readonly combos: number;        // 10,648
  readonly credits: number;       // returned per `combos` staked
  readonly rtp: number;           // credits / combos
  readonly hits: number;
  readonly hitFrequency: number;
  readonly averageWin: number;    // per paying spin, per credit staked
  readonly teases: number;        // SEVEN SEVEN not-SEVEN on the line
  readonly rows: readonly RtpRow[];
}

/** The machine's return to player, enumerated. No sampling anywhere in it. */
export function exactRTP(): RtpReport {
  const byLine = new Map<string, { combos: number; credits: number; pays: number }>();
  let credits = 0, hits = 0, teases = 0;
  const combos = STOPS ** 3;

  for (let i = 0; i < STOPS; i++) {
    for (let j = 0; j < STOPS; j++) {
      for (let k = 0; k < STOPS; k++) {
        const a = symAt(0, i), b = symAt(1, j), c = symAt(2, k);
        if (a === 'SEVEN' && b === 'SEVEN' && c !== 'SEVEN') teases++;
        const w = evaluate(a, b, c);
        if (!w) continue;
        hits++; credits += w.pays;
        const row = byLine.get(w.line) ?? { combos: 0, credits: 0, pays: w.pays };
        row.combos++; row.credits += w.pays;
        byLine.set(w.line, row);
      }
    }
  }

  const rows: RtpRow[] = PAYTABLE.map((p) => {
    const r = byLine.get(p.line) ?? { combos: 0, credits: 0, pays: p.pays };
    return {
      line: p.line, pays: p.pays, combos: r.combos, credits: r.credits,
      odds: r.combos ? combos / r.combos : Infinity,
    };
  });

  return {
    combos, credits, rtp: credits / combos,
    hits, hitFrequency: hits / combos,
    averageWin: hits ? credits / hits : 0,
    teases, rows,
  };
}

// THE MEASURING INSTRUMENTS ARE NOT IN THIS FILE, and that is a decision worth
// recording because the first draft had them here.
//
// `simulate()` and `session()` — play N spins, report the return; play a
// bankroll down, report how long it lasted — lived in this module and were
// called by the proof script. It made the script shorter and it made the
// selftest a lie: a mutation that replaced the exported `spin` could not reach
// `simulate`, because `simulate` closed over the module's own binding. The
// mutation applied, the machine was broken, and the check went green. Exactly
// GOTCHAS §27's first warning — "a mutation that does not actually break the
// thing proves nothing, and looks exactly like a check that works."
//
// They are in `scripts/L-slots-rtp.mjs` now, driving this module's public
// surface from outside. Same numbers, and the mutation lands.
//
// The line it draws is also the right one for its own sake: `exactRTP` is a
// property OF the machine and the pay-table screen will want it. A bankroll
// simulation is a CLAIM ABOUT the machine, and claims belong with the checks.
