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
// Its lone seven sits at index 10 with blanks either side of it (9 and 11), so
// on the spins where reels 1 and 2 have both landed sevens, the third reel
// either pays 250 or shows you the seven one row off the payline. That is the
// tease, and it is a fact about the strip rather than a script.
//
// The second, far more frequent tease is the bars. Reel 3's TRIPLE BAR at 14
// has a plain BAR immediately above it at 13, so TRIPLE–TRIPLE–BAR drops from
// 100 to the ANY BARS 5 by one position. Bars hit often enough that this is the
// near miss you actually live with; the sevens one is the near miss you
// remember.
//
// (Those four indices read 11, 10, 12, 15 and 14 when this paragraph was first
// written, and every one of them was one out — typed from the shape of the
// strip rather than counted along it. The CLAIMS were all true; the addresses
// were not. GOTCHAS §44 is about a number that stops being true, and this is
// its neighbour: a number that was never true, in prose, which no build can
// check. `scripts/L-slots-feel.mjs` asserts the neighbour relation by finding
// the symbol rather than by trusting an index, which is why the check was right
// while the comment beside it was wrong.)
export const STRIPS: readonly (readonly Sym[])[] = [
  // REEL 1 — 2 sevens, 4 bars, 3 double, 2 triple, 3 cherries, 8 blanks
  ['SEVEN', 'BLANK', 'BAR1', 'CHERRY', 'BAR2', 'BLANK', 'BAR1', 'BAR3',
    'BLANK', 'CHERRY', 'BAR1', 'BLANK', 'BAR2', 'SEVEN', 'BLANK', 'BAR1',
    'CHERRY', 'BAR3', 'BLANK', 'BAR2', 'BLANK', 'BLANK'],
  // REEL 2 — 2 sevens, 4 bars, 3 double, 2 triple, 2 cherries, 9 blanks
  ['BLANK', 'BAR1', 'CHERRY', 'BLANK', 'BAR2', 'SEVEN', 'BLANK', 'BAR1',
    'BAR3', 'BLANK', 'BAR2', 'BLANK', 'BAR1', 'CHERRY', 'BLANK', 'BAR3',
    'SEVEN', 'BLANK', 'BAR1', 'BAR2', 'BLANK', 'BLANK'],
  // REEL 3 — the short reel. ONE seven, at 10, blanks either side of it.
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

// ─────────────────────────────────────────────────────────────────────────────
// PART TWO: THE FEEL.
//
// "THE FEEL IS MOST OF THE JOB and it is where high effort actually lands.
//  Reels that stop ONE AT A TIME, left to right - the stagger is what makes the
//  third reel matter, and stopping them together kills the whole thing."
//
// Everything below advances a machine by a `dt` in seconds and returns numbers.
// It draws nothing, it imports nothing, and it has never heard of a canvas.
//
// That boundary is not tidiness — it is the whole reason the second game is
// cheap. The desk's instruction was to keep the line clean between THE GAME and
// THE MACHINERY AROUND IT, so that blackjack is "mostly rules and cards" rather
// than a second everything. The machinery is: a panel to draw in (K's), a
// wallet to pay from (K's), a seat that opens it (G's furniture, the desk's
// hook). None of the three is in this file, and none of them is needed to run,
// test or tune what is.
//
// The second reason is GOTCHAS §30 and §43, which are the same clock confusion
// from opposite ends: a `setTimeout` standing in for something the render loop
// drives is a bet on how busy the machine is, and a wall-clock stopwatch reads
// ~1.5x long below 20 fps because `main.ts` clamps dt to 0.05. A reel that
// stops on a timer is a reel that stops in the wrong place on a slow machine.
// A reel that advances by dt is correct at any frame rate and can be stepped
// deterministically by a check.

/** Where one reel is, right now, for something that has to draw it. */
export interface ReelView {
  /** continuous position in STOPS. The payline shows `symAt(reel, round(pos))`
   *  and the window either side of it, so a fractional pos is a reel caught
   *  between two symbols — which is most of a spin. */
  readonly pos: number;
  /** `stopped` is a REEL that has finished, whatever the machine is doing.
   *
   *  It said `idle` here and only became `idle` once the whole machine did,
   *  which meant the three reels appeared to stop simultaneously to anything
   *  watching from outside — including the check written to prove they do not.
   *  A reel's phase is a fact about the reel. */
  readonly phase: 'spinning' | 'braking' | 'settling' | 'stopped';
  /** the stop it is heading for, or resting on */
  readonly stop: number;
  /** true while this reel is being held back for the anticipation */
  readonly teasing: boolean;
}

export type MachineState = 'idle' | 'spinning' | 'paying';

export interface MachineView {
  readonly state: MachineState;
  readonly credits: number;
  readonly bet: number;
  readonly reels: readonly ReelView[];
  /** the line that came in, once the last reel has settled. null until then —
   *  a machine that names the win before the third reel stops has given the
   *  game away, and the third reel mattering is the entire point. */
  readonly win: Win | null;
  /** credits of that win handed over so far. Counts UP; see `tick`. */
  readonly paid: number;
  /** total staked and total returned this sitting, for the machine's own
   *  honesty — a player can check it against the printed 92.83%. */
  readonly staked: number;
  readonly returned: number;
}

export interface Machine {
  view(): MachineView;
  /** advance by `dt` REAL seconds. The only clock this game has. */
  tick(dt: number): void;
  /** stake `bet` and set the reels going. False if it cannot — no credits, or
   *  already spinning. */
  play(): boolean;
  /** cycle the stake. A no-op mid-spin, like the real button. */
  betUp(): void;
  betDown(): void;
  /** put credits on the meter. The cash side of this is not in this file. */
  insert(credits: number): void;
  /** empty the meter and hand back what was on it. Standing up calls this, so
   *  you cannot walk away from money — see CASH OUT below. */
  cashOut(): number;
  /** is it safe to close the panel? False mid-spin and mid-payout. */
  settled(): boolean;
}

// ── the numbers that are the feel ────────────────────────────────────────────
//
// Every one of these is in SECONDS or in STOPS PER SECOND, and they are grouped
// here rather than buried at their use sites because tuning the feel means
// moving them together and reading them against each other.
//
// PUBLISHED AND MUTABLE, which is a deliberate choice and not laziness.
//
// `scripts/L-slots-feel.mjs` asserts things like "the reels stop one at a time"
// and "the brake is not a snap", and GOTCHAS §27 says a check nobody has watched
// fail is decoration. To watch it fail you have to break the machine — and while
// these were module-private consts, the only way to break it from outside was to
// wrap the public surface in something that IMITATED a broken machine. That is
// the trap §27 spells out: "a mutation that does not actually break the thing
// proves nothing, and looks exactly like a check that works." The mutation would
// have been testing my wrapper.
//
// Exporting them means the mutation reaches the real code path — `FEEL.hold = 0`
// genuinely removes the anticipation, `FEEL.brakeT = 0.001` genuinely makes the
// reel snap — and the check goes red for the real reason.
//
// It earns its keep the ordinary way too: this table IS the feel, and a tuner
// (or a fast-play option, or blackjack wanting its own pacing) wants exactly
// these twelve numbers and nothing else.
export const FEEL = {
/** Free-spin speed, stops a second. 26 is about 1.2 turns a second on a 22-stop
 *  reel: fast enough to be a blur, slow enough that you can still see a seven
 *  go by, which is what makes a spinning reel worth watching at all. */
  spinSpeed: 26,

/** A reel gets up to speed rather than appearing at it. Short, because a
 *  mechanical reel is light and the motor is not gentle. */
  rampT: 0.15,

/** How long a reel spends braking into its stop.
 *
 *  THE BRAKE IS CONSTANT DECELERATION, and getting that wrong is the reason
 *  this section was rewritten. The first version eased the reel over its
 *  remaining distance with a cubic ease-out, which is the obvious thing and is
 *  wrong in a way you would never think to check: `1-(1-k)³` has its steepest
 *  slope at k = 0, so the reel LURCHED FORWARD at three times its free speed
 *  the instant the brake came on, then slowed. Measured at 90.9 stops/s against
 *  a 26 stops/s free run. It read as the reel being kicked.
 *
 *  Constant deceleration from v to 0 covers v·t/2 and its velocity is
 *  continuous with the free spin at the moment it starts, which is the whole
 *  requirement. It also fixes the distance: 26 stops/s over 0.42 s is 5.5
 *  stops, about five and a half symbols crawling past the window, every time.
 *
 *  That fixed distance is what forces the scheduling in `play` to work
 *  backwards from the stop rather than forwards from the handle. */
  brakeT: 0.42,

/** THE CLUNK. A mechanical reel does not stop dead: it overshoots its detent
 *  and is pulled back. 0.16 of a stop is about a fifth of a symbol — visible as
 *  a jolt, too small to be read as landing on the wrong symbol.
 *
 *  The brake therefore aims PAST the target by `BOUNCE` and the settle pulls it
 *  back, which is the order the real thing happens in. */
  bounce: 0.16, bounceT: 0.14,

/** THE STAGGER, and the guarantee behind it.
 *
 *  `WANT_FIRST` is when reel 1 would like to rest; `GAP_MIN` is the least time
 *  any reel waits for the one before it. They are minima, not times: because
 *  the brake covers a fixed distance and must end on a specific symbol, a reel
 *  can only stop at moments spaced one revolution apart — 22 stops at 26
 *  stops/s, so about 0.85 s. `play` picks the first slot at or after the
 *  minimum, so a real gap runs 0.55–1.40 s and the ORDER can never be wrong.
 *
 *  Scheduling each reel off the one before it, rather than off a fixed table,
 *  is what makes that a guarantee. A fixed table of stop times plus 0.85 s of
 *  unavoidable jitter can overlap; sequential scheduling cannot.
 *
 *  The user: "the stagger is what makes the third reel matter, and stopping
 *  them together kills the whole thing." */
  wantFirst: 0.70, gapMin: 0.55,

/** THE ANTICIPATION. When the first two reels have landed on something that is
 *  still live, the third is held back and crawls.
 *
 *  This is the one piece of presentation that could be dishonest and is not,
 *  and it is worth being exact about why. The stops for ALL THREE reels are
 *  drawn at the moment you press the button, before anything moves. Nothing
 *  below consults the outcome to CHOOSE it — it consults an outcome already
 *  chosen, to decide how long to take showing it to you. The tin has decided;
 *  only the pace changes.
 *
 *  The dishonest version of this is a machine that decides, once it sees you
 *  are two-thirds of the way to a jackpot, to weight the third reel against
 *  you. That requires drawing the third stop LATE, and this machine draws all
 *  three at once specifically so it cannot. `scripts/L-slots-feel.mjs` has a
 *  `rigged` mutation that does exactly that and requires the check to catch it,
 *  because the RTP script cannot: it only bites on 4 combinations in 10,648. */
  hold: 1.25, crawl: 5.5,

/** THE PAYOUT RAMP. "The payout counting up rather than appearing."
 *
 *  Rate scales with the win so a 250 does not take twenty seconds and a 2 does
 *  not vanish before you see it, and it is clamped at both ends: a two-credit
 *  cherry ticks over in about a sixth of a second, the jackpot takes about
 *  three. A real machine did this because it was counting physical coins into a
 *  tray, and the sound of a big win taking a long time to pay is most of what a
 *  big win IS.
 *
 *  IT PAYS IN WHOLE CREDITS. The ramp is a float and the meter is coins; adding
 *  the float straight onto the balance left it at 4340.9999999997 after 2,519
 *  spins and cashing out floored a credit away. A meter that ticks in whole
 *  numbers is both arithmetically exact and what the real thing does. */
  payMin: 12, payMax: 90, payOver: 1.8,
};

/**
 * One machine. Holds a credit meter, three reels, and the state of the spin in
 * flight; knows nothing about money, panels, seats or the world.
 *
 * THE CREDIT METER IS NOT MONEY, and the distinction is deliberate. A 1997
 * machine takes a note, puts credits on a meter, and gives them back when you
 * press CASH OUT — you are not watching your bank balance tick on every spin,
 * which is both period-correct and better play. Credits exist only between
 * sitting down and standing up: `insert` puts them on, `cashOut` empties it,
 * and whatever wires this up is required to call `cashOut` when the player
 * stands. That invariant is the thing that stops this becoming a second wallet
 * (asked of K in notes/L-for-K-money-and-the-panel.md).
 */
export function createMachine(opts: { rng?: Rng; bets?: readonly number[] } = {}): Machine {
  const rng = opts.rng ?? Math.random;
  const BETS = opts.bets ?? [1, 2, 3, 5];

  let credits = 0, betIx = 0, state: MachineState = 'idle';
  let t = 0;                                    // seconds since the handle went
  let staked = 0, returned = 0;
  let win: Win | null = null, owed = 0, payRate = 0, payRamp = 0, paid = 0;

  /**
   * One reel's whole spin, as a SCHEDULE rather than as a position being
   * integrated frame by frame.
   *
   * `pos` is a pure function of the time since the handle went, so any `dt`
   * gives the identical answer — one 3-second step and 180 sixtieths land on
   * the same symbol at the same moment. That is the property GOTCHAS §30 and
   * §43 are both about, and the first version of this did not have it: it
   * integrated `pos += speed * dt` under a `Math.min(dt, 0.05)` clamp, so at
   * 15 fps the reels ran at 75% speed and rested 0.83 s late. The clamp was
   * copied from `main.ts:107`, where it is right for a reason that does not
   * apply here — the world clamps so a long frame cannot teleport a body
   * through a wall, and a reel has nothing to collide with.
   */
  const reels = [0, 1, 2].map((i) => ({
    pos: i * 7.3,       // parked differently on each reel: three reading 0 is a reset
    stop: 0,
    start: 0,           // pos when the handle went
    rampT: FEEL.rampT, cruiseT: 0, crawlT: 0,
    dRamp: 0, dCruise: 0, dCrawl: 0, dBrake: 0,
    vEnter: FEEL.spinSpeed, // speed entering the brake — crawl if it was held
    stopT: 0,           // when it comes fully to rest, including the clunk
    spinning: false, teasing: false,
  }));
  type Reel = typeof reels[0];

  /** Where a reel is at time `tt`. The whole of the reel physics. */
  const posOf = (r: Reel, tt: number): number => {
    if (!r.spinning) return r.pos;
    const tRamp = r.rampT, tCruise = tRamp + r.cruiseT, tCrawl = tCruise + r.crawlT;
    const tBrake = tCrawl + FEEL.brakeT, tEnd = tBrake + FEEL.bounceT;
    if (tt <= 0) return r.start;
    // getting up to speed: v goes 0 -> FEEL.spinSpeed, so distance is v·t²/2T
    if (tt < tRamp) return r.start + FEEL.spinSpeed * tt * tt / (2 * r.rampT);
    if (tt < tCruise) return r.start + r.dRamp + FEEL.spinSpeed * (tt - tRamp);
    // the tease: the reel drops to a crawl and symbols walk past one at a time
    if (tt < tCrawl) return r.start + r.dRamp + r.dCruise + FEEL.crawl * (tt - tCruise);
    const base = r.start + r.dRamp + r.dCruise + r.dCrawl;
    if (tt < tBrake) {
      // constant deceleration from vEnter to 0 — velocity continuous with what
      // came before it, which the cubic ease-out this replaced was not
      const τ = tt - tCrawl;
      return base + r.vEnter * τ - (r.vEnter / (2 * FEEL.brakeT)) * τ * τ;
    }
    // THE CLUNK: the brake has aimed FEEL.bounce past the detent; now get pulled back
    if (tt < tEnd) {
      const k = (tt - tBrake) / FEEL.bounceT;
      return base + r.dBrake - FEEL.bounce * (1 - (1 - k) ** 2);
    }
    return base + r.dBrake - FEEL.bounce;
  };

  const view = (): MachineView => ({
    state, credits, bet: BETS[betIx], win, paid, staked, returned,
    reels: reels.map((r) => {
      const tt = t;
      const tCrawl = r.rampT + r.cruiseT + r.crawlT;
      let phase: ReelView['phase'] = 'stopped';
      if (r.spinning && tt < r.stopT) {
        phase = tt >= tCrawl + FEEL.brakeT ? 'settling' : tt >= tCrawl ? 'braking' : 'spinning';
      }
      return { pos: posOf(r, tt), stop: r.stop, teasing: r.teasing && tt < tCrawl && tt >= r.rampT + r.cruiseT, phase };
    }),
  });

  /**
   * Work BACKWARDS from where the reel has to end up.
   *
   * The brake covers a fixed distance and must finish on a named symbol, so a
   * reel can only come to rest at moments one revolution apart. This picks the
   * first such moment at or after `want`, and gives the free spin exactly the
   * distance that gets it there. Nothing is integrated and nothing drifts.
   *
   * Returns the time the reel comes fully to rest, so the next reel can be
   * scheduled off it — which is what makes the ORDER a guarantee rather than a
   * consequence of three constants that happen not to overlap.
   */
  const schedule = (r: Reel, target: number, want: number, hold: boolean): number => {
    r.start = r.pos; r.stop = target; r.spinning = true; r.teasing = hold;
    r.rampT = FEEL.rampT;
    r.dRamp = FEEL.spinSpeed * FEEL.rampT / 2;
    r.crawlT = hold ? FEEL.hold : 0;
    r.dCrawl = hold ? FEEL.crawl * FEEL.hold : 0;
    r.vEnter = hold ? FEEL.crawl : FEEL.spinSpeed;
    r.dBrake = r.vEnter * FEEL.brakeT / 2;

    // Total distance from here to the detent, overshooting it by FEEL.bounce. The
    // reel's own position is unbounded and `symAt` wraps, so this only ever has
    // to be congruent — there is no seam to think about.
    const fixed = r.dRamp + r.dCrawl + r.dBrake - FEEL.bounce;
    const need = ((target + FEEL.bounce - r.start) % STOPS + STOPS) % STOPS;
    const other = r.rampT + r.crawlT + FEEL.brakeT + FEEL.bounceT;

    // The smallest whole number of extra revolutions that both leaves the
    // cruise a non-negative length and lands at or after `want`. Solved rather
    // than searched: a loop with a bail-out is a loop that silently returns a
    // wrong schedule when the bail-out fires, and the mutation testing this
    // machine deliberately drives the constants a long way out of their normal
    // range — which is exactly when a search would have hit its cap and handed
    // back a reel with a negative cruise, spinning backwards.
    const byDistance = (fixed - need) / STOPS;
    const byTime = (fixed + (want - other) * FEEL.spinSpeed - need) / STOPS;
    const n = Math.max(0, Math.ceil(Math.max(byDistance, byTime) - 1e-9));

    r.dCruise = need + n * STOPS - fixed;
    r.cruiseT = r.dCruise / FEEL.spinSpeed;
    r.stopT = other + r.cruiseT;
    return r.stopT;
  };

  const play = (): boolean => {
    if (state !== 'idle') return false;
    const bet = BETS[betIx];
    if (credits < bet) return false;
    credits -= bet; staked += bet;
    win = null; paid = 0; payRamp = 0; owed = 0; t = 0; state = 'spinning';

    // ALL THREE STOPS, DRAWN NOW, BEFORE ANYTHING MOVES. See FEEL.hold above — this
    // is the line between an anticipation and a rigged reel.
    const s = spin(rng);
    const live = isLive(s);
    // Sequential: each reel waits at least FEEL.gapMin for the one before it, and
    // the third waits out the anticipation on top of that when it still
    // matters. The first two are never held — a pause before reel 1 is a hitch
    // in the machine, not a tease.
    let prev = schedule(reels[0], s[0], FEEL.wantFirst, false);
    prev = schedule(reels[1], s[1], prev + FEEL.gapMin, false);
    schedule(reels[2], s[2], prev + FEEL.gapMin + (live ? FEEL.hold : 0), live);
    return true;
  };

  const tick = (dt: number) => {
    if (!(dt > 0)) return;
    // NOT clamped. `posOf` is a pure function of `t`, so a five-second step and
    // three hundred sixtieths land in the same place — which is the whole point
    // of scheduling rather than integrating. A backgrounded tab that comes back
    // to a finished spin is the correct outcome, not a glitch to guard against.
    t += dt;

    if (state === 'spinning') {
      let last = 0;
      for (const r of reels) last = Math.max(last, r.stopT);
      if (t < last) return;
      for (const r of reels) { r.pos = posOf(r, r.stopT); r.spinning = false; r.teasing = false; }
      // The win is only NAMED once every reel has settled. See MachineView.win —
      // a machine that names it earlier has given the third reel away.
      win = evaluate(symAt(0, reels[0].stop), symAt(1, reels[1].stop), symAt(2, reels[2].stop));
      if (!win) { state = 'idle'; return; }
      owed = win.pays * BETS[betIx];
      payRate = Math.min(FEEL.payMax, Math.max(FEEL.payMin, owed / FEEL.payOver));
      payRamp = 0; paid = 0;
      state = 'paying';
      return;
    }

    if (state === 'paying') {
      // WHOLE CREDITS ONLY. `payRamp` is the float; `paid` and `credits` are
      // coins. Adding the float straight onto the balance is what left the meter
      // at 4340.9999999997 and lost a credit to `Math.floor` on cash out.
      payRamp = Math.min(owed, payRamp + payRate * dt);
      const whole = Math.min(owed, Math.floor(payRamp));
      credits += whole - paid; paid = whole;
      if (payRamp >= owed) {
        credits += owed - paid; paid = owed; returned += owed;
        state = 'idle';
      }
      return;
    }
  };

  return {
    view, tick, play,
    betUp: () => { if (state === 'idle') betIx = Math.min(BETS.length - 1, betIx + 1); },
    betDown: () => { if (state === 'idle') betIx = Math.max(0, betIx - 1); },
    insert: (n: number) => { if (n > 0) credits += Math.floor(n); },
    cashOut: () => {
      // Deliberately NOT gated on `settled()`. Standing up mid-spin has to give
      // the money back — refusing would be a machine that eats your credits
      // because you stood up at the wrong moment, which is a bug the user finds
      // in one sitting. The staked credit for a spin in flight is already gone,
      // exactly as it is on a real machine, and the win it was going to pay is
      // forfeited with it. Whatever is ON THE METER always comes back.
      const n = credits; credits = 0;
      state = 'idle'; win = null; paid = 0; payRamp = 0; owed = 0;
      for (const r of reels) { r.pos = posOf(r, t); r.spinning = false; r.teasing = false; }
      return n;
    },
    settled: () => state === 'idle',
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
