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
  [symAt(reel, stop + 1), symAt(reel, stop), symAt(reel, stop - 1)];
// ABOVE is stop + 1, and that is a fact about which way the reel turns rather
// than an arbitrary choice. This read `stop - 1` first, which was the natural
// way to write it and disagreed with the glass: a reel spins with its symbols
// travelling DOWNWARD past the window, so `paintReel` places strip index i at
// `y = centre - (i - pos) · rowH`, and a HIGHER index therefore sits higher.
// Nothing about the maths depends on it — `isSevenTease` looks at both rows and
// the RTP never looks at either — but a check asking "is the seven visible above
// the line" would have been told about the row below it.

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
  /** stops per second, right now. The glass blurs on this — a reel you can read
   *  at full speed is a reel that is not moving. Differentiated from the
   *  schedule rather than tracked, so it costs nothing and cannot drift. */
  readonly speed: number;
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
  /** seconds the machine has been sitting idle with nobody pressing anything.
   *  The glass goes into ATTRACT past `FEEL.attract`. */
  readonly idleT: number;
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
  /** ATTRACT. Seconds of nobody touching it before the machine starts calling
   *  you back — the pay table walks a highlight down its own lines and the
   *  message cycles. Every machine on a real floor does this, and it is the
   *  difference between a cabinet that is waiting for you and one that is off.
   *  Six seconds: long enough not to fire between spins, short enough that a
   *  player who sits down and hesitates sees it. */
  attract: 6, attractStep: 0.7,
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
  let staked = 0, returned = 0, idleT = 0;
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
    // Parked on a DETENT, and differently on each reel. It was `i * 7.3`, so a
    // machine nobody had spun yet showed all three reels stopped half a symbol
    // off the payline — which reads as broken rather than as characterful, and
    // is the first thing a player sees. A real machine at rest sits on its
    // detents; only the WHICH varies.
    pos: i * 7,
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
    state, credits, bet: BETS[betIx], win, paid, staked, returned, idleT,
    reels: reels.map((r) => {
      const tt = t;
      const tCrawl = r.rampT + r.cruiseT + r.crawlT;
      let phase: ReelView['phase'] = 'stopped';
      if (r.spinning && tt < r.stopT) {
        phase = tt >= tCrawl + FEEL.brakeT ? 'settling' : tt >= tCrawl ? 'braking' : 'spinning';
      }
      const h = 1 / 240;
      return {
        pos: posOf(r, tt), stop: r.stop, phase,
        teasing: r.teasing && tt < tCrawl && tt >= r.rampT + r.cruiseT,
        speed: r.spinning ? (posOf(r, tt + h) - posOf(r, tt - h)) / (2 * h) : 0,
      };
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
    // `need` is the distance to where the reel RESTS, not to where the brake
    // aims. Those differ by `bounce`, and having it the wrong way round left
    // every reel sitting 0.16 of a stop past its detent for ever — a permanent
    // 5 px offset on every symbol at a 30 px row, which looks like nothing and
    // is wrong in every frame. Nothing in the maths could see it: `stop` was
    // always correct, so the pay was always correct; only the GLASS was off,
    // and only by a fifth of a symbol.
    //
    // Found by the glass check refusing to match a symbol against the same
    // painter drawing it alone. The arithmetic: travel comes out at
    // `need + n·STOPS + bounce`, the settle gives back `bounce`, so the rest
    // position is `start + need + n·STOPS` and `need` must be measured to the
    // detent itself.
    const need = ((target - r.start) % STOPS + STOPS) % STOPS;
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
    win = null; paid = 0; payRamp = 0; owed = 0; t = 0; idleT = 0; state = 'spinning';

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
    idleT = state === 'idle' ? idleT + dt : 0;

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
    betUp: () => { if (state === 'idle') { betIx = Math.min(BETS.length - 1, betIx + 1); idleT = 0; } },
    betDown: () => { if (state === 'idle') { betIx = Math.max(0, betIx - 1); idleT = 0; } },
    insert: (n: number) => { if (n > 0) { credits += Math.floor(n); idleT = 0; } },
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

// ─────────────────────────────────────────────────────────────────────────────
// PART THREE: THE GLASS.
//
// One function, `paintMachine`, which takes a 2D context and a `MachineView`
// and draws the front of the machine. It reads state; it never changes any.
//
// IT IS PAINTED AT 320 × 240 AND SCALED UP, which is the idiom `ct/hud.ts`
// already set for this world's panels: the wallet is a 180 × 140 canvas shown
// at 340 × 264 with `image-rendering: pixelated`. Everything is flat `fillRect`
// and small monospace type. Painting at the panel's real pixel size and
// scaling nothing would give smooth 2026 vector UI bolted onto a 1997 street,
// which is exactly the mismatch the shared-panel decision exists to avoid.
//
// NO `Math.random()` ANYWHERE IN HERE, and that is worth stating because the
// rest of this project's paint layer is built on it: GOTCHAS §1 opens with
// `dither()` and thirteen other sites calling it directly, which is why two runs
// of identical code differ in 20% of pixels and why screenshots cannot be
// diffed. This panel is a deterministic function of (view, t). Give it the same
// machine and the same clock and it paints the same pixels, so it CAN be
// diffed — which is the only reason `scripts/L-slots-glass.mjs` can assert
// anything about it without a browser.
//
// THE PALETTE WAS THE ROOM'S. THE USER OVERRULED THAT, AND HE IS RIGHT.
//
// It used to read: "the palette is the room's, read off `ct/int-casino.ts`
// rather than chosen to look similar — #d8a83a gold and #8a6a22 its shadow are
// the entrance portal, #d8d0c0 is the reel cream on the cabinet fronts, #4a1f24
// the carpet, #241e22 the cabinet body. A machine you walk up to and a machine
// you sit at should not be two designs."
//
// The reasoning is sound and the result was wrong, which is the interesting
// case. Dressing the machine in the ROOM's palette dressed it in the CARPET's:
// a near-black body (#241e22) under a muted gold. The user, 2026-08-02, with a
// screenshot: *"this is what the slot machine looks like to me. it is
// incredibly ugly and nothing like a classic slot machine."*
//
// The proof is in his own frame and it is not a matter of taste. The cabinets
// FLANKING the one he is sitting at — baked textures out of `int-casino.ts` —
// are red and blue bodies under bright gold marquee bars, and they are visibly
// BRIGHTER THAN THE LIVE FACE BETWEEN THEM. Sitting down at this machine made
// it duller than the scenery. `shots/w73-before/1-standing.png` and
// `2-seated.png`, side by side, are the whole argument.
//
// A slot machine is the brightest object on a casino floor. It is built to
// FIGHT the room, not to match it. So the body is red, the trim is a hotter
// gold, the reel cream is nearly white so the symbols can carry black outlines
// against it, and the marquee is lit. What stays shared with `int-casino.ts` is
// the IDIOM — flat fills, no gradients, pixel type — which is the part that
// actually kept the world coherent; the hues were never doing that work.

/**
 * The logical size everything below is drawn at. The caller scales.
 *
 * PORTRAIT, AND THE ASPECT IS NOT A STYLE CHOICE — IT IS THE CABINET'S.
 *
 * This was 320 x 256, which is landscape, and it was right for what it was: a
 * rectangle floating in the middle of the screen has no proportions to answer
 * to. Item 100 hangs this canvas on the front of the machine in the world, and
 * `ct/int-casino.ts` builds that cabinet as a 0.6 m x 1.45 m box — so the moment
 * the picture lands on the object, its aspect stops being free. A 1.25:1 face
 * stretched across a 0.41:1 front is nearly a 2x horizontal smear, and "the
 * interface reads as being on the machine" is the whole of the ask.
 *
 * 320 x 483 is 0.6 m x 0.9056 m at 533 px/m — SQUARE TEXELS, the same number
 * both ways, which is BUILDER-BRIEF §7b's rule stated for a canvas rather than
 * for a wall. The width comes from the cabinet's own bounding box at open time
 * (`screenPlane` below reads the mesh; nothing about the casino is typed here),
 * and the height is that width divided by this aspect. So the plane is cut to
 * the picture and the picture is cut to the object, and only ONE of the two is
 * a number I chose.
 *
 * The 0.9056 m lands the face across the cabinet's top two-thirds — its topper,
 * glass and deck — and leaves the shadowed body and the coin tray below it as
 * the baked texture `ct/int-casino.ts` already paints. That is the same division
 * of labour `ct/atm.ts` has with `ct/bank.ts`: the live canvas covers what it
 * draws, and the machine's own geometry keeps everything it does not.
 *
 * w41's seam guide, in one line: "Your canvas should be cut to your mesh face's
 * aspect, or it will stretch."
 */
export const FACE = { w: 320, h: 483 } as const;

const P = {
  // the cabinet: a red upright with gold trim, not a black one
  case: '#a8161c', caseHi: '#e0503e', caseLo: '#560a10',
  gold: '#ffc426', goldLo: '#9c6a0e', goldHi: '#fff4a6',
  glass: '#100a12',
  // nearly white, so a black outline round a symbol has something to bite on
  reel: '#f7f2e4', reelLo: '#c4bca8',
  red: '#ec2a1e', redLo: '#8c0e12', redHi: '#ff9c84',
  green: '#1e7c3c', greenHi: '#54d46a',
  cream: '#f4eeda', ink: '#12090c',
  // the pay table's captions, deliberately quieter than its pictures — the words
  // are there so the odds stay legible, not so they are the first thing you read
  label: '#b0a48a',
  // a bulb is a warm core with a halo and a dark socket round it. Three colours,
  // because two made a square that read as a hole punched in the panel.
  lampOn: '#fff8d2', lampGlow: '#ffcc4a', lampOff: '#7a5a20', socket: '#2a1408',
  meter: '#0c1408', meterInk: '#84f060', meterDim: '#2c5426',
  carpet: '#4a1f24',
  // the button deck is a metal plate; the buttons are objects sitting on it
  chrome: '#a8a49c', chromeHi: '#e4e0d8', chromeLo: '#4e4a44',
} as const;

/** Full turn, for the arcs. Named because `Math.PI * 2` appeared eleven times. */
const TAU = Math.PI * 2;

/** The line this machine shouts about when nobody is sitting at it — whichever
 *  one pays most, read off the table rather than named, so re-ordering the pay
 *  table cannot leave the attract advertising the second-best prize. */
const TOP_PAY = PAYTABLE.reduce((a, b) => (b.pays > a.pays ? b : a));

/** The three reel windows, and the row grid inside them. Derived once so the
 *  painter and any check agree on where the payline is. */
export const GLASS = {
  x: 22, y: 194, w: 276, h: 108,
  reelW: 84, gap: 12, rowH: 36,
} as const;
// The face's vertical plan, in one place, because it was not in one place and
// the machine's own message printed across the bottom of the reel glass. Six
// pixels of clearance is not a layout; a named band is.
//
// RE-SPACED FOR THE PORTRAIT FACE (item 100), and the 227 extra pixels are NOT
// distributed evenly. The old landscape face had to shave every band to fit;
// what it shaved is exactly what a real cabinet has most of. So the topper goes
// 26 -> 76 and can carry its name at a readable size, the pay table 48 -> 112
// and stops being 8 px type, and the meters and the deck roughly double. The
// reel glass grows the LEAST in proportion — 90 -> 108 — because a reel window
// is about a third of a metre on a real upright and making it a half-metre-tall
// letterbox would be the one change that stopped this looking like a slot
// machine.
//
// The twelve-pixel clearance the note above bought stays bought: the reel
// glass's own surround ends at 342 and the message band starts at 348.
// RE-CUT AGAIN FOR ITEM 208, and the two bands that moved both moved for the
// same reason: the things in them stopped being TYPE and started being OBJECTS.
//
// The topper loses 14 px (66 -> 52) and gives them to two BULB BANDS, 2..14 and
// 66..78. The old bulbs were 4 x 4 px squares laid straight on the cabinet at a
// 10 px pitch, which is a dotted rule, not a marquee — the user's frame reads
// them as a perforated stamp edge round the name. A bulb needs a dark ground to
// be bright against, a socket, and room for a halo; 12 px of band buys all
// three, and the name is still 34 px type in the 52 that are left.
//
// The pay table gains 4 (100 -> 104) and starts 2 px higher, because each row is
// now a PICTURE of the three symbols plus its pay, with the line's name demoted
// to an 8 px caption under it. Four rows of 25 px, two columns.
const TOPPER = { y: 14, h: 52 } as const;
const BULB_BAND = { top: 2, bottom: 66, h: 12 } as const;
const PAYT = { y: 80, h: 104 } as const;
const SAY_Y = 334, SAY_BAND = [318, 22] as const;
const METER_Y = 346, METER_H = 36, BTN_Y = 412, BTN_H = 26;
// THE BOTTOM 45 PIXELS OF THIS FACE CARRY NOTHING LIVE, AND THAT IS MEASURED.
//
// The eye is stood off along the face's normal and clamped to 1.05 m above the
// floor (`crosstown.ts`'s `poseFor`), and from there THE STOOL YOU ARE SITTING
// ON rises into the bottom of the frame — its cushion is a 0.42 m dome 0.68 m
// from your eye. Shot, cropped and measured rather than reasoned about
// (`scripts/probes/w55-slot-look.mjs`): the cushion's crest cuts the face at
// canvas y 454, and the first layout put the bill acceptor at 462-480 and the
// button deck's lower edge at 456 — the acceptor was invisible and SPIN was
// clipped.
//
// So every band that does anything ends by 438, and what is below it is the
// underside of the deck, in shadow, which is what a cabinet has there and what
// a seated player cannot see anyway.
// 438 -> 444: the buttons grew a 3 px chrome bezel and a raised cap, so the
// object that ends at 438 now casts to 441. The number that actually matters is
// unchanged and is still measured, not guessed — the stool's crest cuts the face
// at 454, and 444 is nine pixels clear of it.
const DECK_UNDER = 444;
// THE BILL ACCEPTOR, AND IT EXISTS BECAUSE OF THE MOUSE.
//
// The four deck buttons are `BET ONE`, `MAX BET`, `SPIN` and `CASH OUT`. There
// has never been an INSERT among them, because `I` on the keyboard did it and a
// keyboard player is never stuck. A player working the machine with the mouse —
// which is the entire point of this item — sits down at an empty meter, reads
// `INSERT COIN` on the say band, and has nothing on the face to press.
//
// This is w41's PIN-pad finding happening a second time in a different machine:
// *"the screen on the literal atm be the overlay that i can use my mouse to
// click through"* — CLICK THROUGH, all of it, not up to the first step that
// only the keyboard can take. A 1997 machine has a bill validator in exactly
// this place, so the affordance the mouse needs and the part the cabinet is
// missing are the same object.
const BILL_Y = 388, BILL_H = 18;
const REEL_X = [0, 1, 2].map((i) => GLASS.x + i * (GLASS.reelW + GLASS.gap));
const PAYLINE_Y = GLASS.y + GLASS.h / 2;

/**
 * THE BUTTON DECK, DECLARED ONCE — because the mouse made two authorings of it
 * possible for the first time.
 *
 * Until item 100 these four were literals inside `paintMachine`'s own body and
 * that was harmless: nothing else in the world knew where a button was, because
 * the only way to press one was a key. A click has to be hit-tested against the
 * same rectangle that was painted, and `ct/int-casino.ts`'s own `SLOT_N`/`ROWS`
 * fault (a literal table and a loop bound as two authorings of one number) is
 * cited in this file already. So the painter reads this and so does `deckAt`,
 * and a button cannot be drawn anywhere a click does not land.
 *
 * `key` is what the press dispatches, which is how a click and a keystroke stay
 * the same event — see `clickAt`.
 */
export interface DeckBtn { readonly x: number; readonly w: number; readonly label: string; readonly key: string }
export const DECK: readonly DeckBtn[] = [
  { x: 22, w: 62, label: 'BET ONE', key: 'b' },
  { x: 88, w: 62, label: 'MAX BET', key: 'm' },
  { x: 154, w: 76, label: 'SPIN', key: ' ' },
  { x: 234, w: 64, label: 'CASH OUT', key: 'c' },
];

/** What a deck button says right now. Only SPIN has anything to say about the
 *  machine's state, and it says it in the button rather than beside it. */
function deckLabel(d: DeckBtn, v: MachineView): string {
  return d.key === ' ' && v.state === 'spinning' ? 'SPINNING' : d.label;
}

/**
 * Is this button LIT — meaning pressing it does something?
 *
 * ONE ANSWER, read by the paint, by the hand cursor and by the click. w41's
 * rule for the ATM, which this inherits rather than re-derives: "a hand over a
 * dead key is a machine lying about what it will do." A lit button that does
 * nothing and a dead button that works are the same bug seen from two sides,
 * and the only way neither can happen is for there to be nothing to keep in
 * step.
 *
 * These are exactly the conditions the landscape face already painted, lifted
 * out of `paintMachine` unchanged so that `hotAt` can ask the same question.
 * BET ONE and MAX BET stay live at an empty meter because `betUp` really does
 * work there — cycling the stake with no credits is a thing the machine does,
 * and greying them out would be the paint telling a truer-sounding lie.
 */
function deckLive(d: DeckBtn, v: MachineView): boolean {
  const idle = v.state === 'idle';
  if (d.key === ' ') return idle && v.credits >= v.bet;
  if (d.key === 'c') return idle && v.credits > 0;
  return idle;
}

/** The button under this canvas pixel, or null. Canvas pixels are the
 *  coordinates the framework hands back from its raycast — see `ScreenSurface`
 *  in `ct/hud.ts` — which is to say the same ones everything above draws in. */
function deckAt(x: number, y: number): DeckBtn | null {
  if (y < BTN_Y || y > BTN_Y + BTN_H) return null;
  return DECK.find((d) => x >= d.x && x <= d.x + d.w) ?? null;
}

/** Is this canvas pixel on the bill acceptor's mouth? */
function billAt(x: number, y: number): boolean {
  return y >= BILL_Y && y <= BILL_Y + BILL_H && x >= 22 && x <= 298;
}

/** A minimal slice of the 2D context — everything this file actually calls.
 *
 *  Typed structurally rather than as `CanvasRenderingContext2D` so the glass can
 *  be driven by a RECORDING context in node and asserted on without a browser.
 *  A real context satisfies it; nothing here needs a DOM. */
export interface Paint2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign; globalAlpha: number; lineWidth: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(s: string, x: number, y: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  save(): void; restore(): void;
  translate(x: number, y: number): void; scale(x: number, y: number): void;
  beginPath(): void; arc(x: number, y: number, r: number, a: number, b: number): void; fill(): void;
  rect(x: number, y: number, w: number, h: number): void; clip(): void;
}

// ── the symbols ──────────────────────────────────────────────────────────────
//
// Drawn into a cell, centred, from flat rectangles — no gradients and no
// curves except the cherries, which need them to be cherries. Each one has to
// be legible at a glance while sliding past at 26 stops a second, so they
// differ in SILHOUETTE first and colour second: the sevens are the only tall
// thin mark, the bars are the only horizontal ones and count upward, the
// cherries are the only round thing. That ordering is the same reason
// `ct/int-casino.ts` gives roulette, craps and poker three different shapes.

// EVERY SYMBOL IS OUTLINED IN INK, AND THAT IS THE SINGLE BIGGEST CHANGE HERE.
//
// The user's frame, read back at 1:1 (the face is 320 canvas px across and lands
// on ~320 screen px from the stool, so a canvas pixel IS a screen pixel): the
// bars are "stacks of flat mustard rectangles" and the seven is a thin red mark.
// Both were drawn as a flat fill with a one-pixel drop shadow onto a cream that
// is only two steps darker than the gold. Nothing separated the symbol from the
// reel, so the eye read a coloured area rather than an object.
//
// A printed reel strip has ink round every glyph. That outline is what makes a
// bar a BAR instead of a rectangle, and it costs one extra `fillRect` per mark.
//
// THE SIZE IS CAPPED BY THE CHECK, NOT BY TASTE. `scripts/L-slots-glass.mjs`
// isolates a symbol from its neighbours by taking only the marks with
// |x - cx| < reelW/2 (42), |y - cy| < rowH/2 (18), w < reelW * 0.7 (58.8) and
// h < rowH (36) — see its own note at the filter. So every mark's TOP EDGE has
// to stay inside cy +/- 18 and nothing may be wider than 58.8. The outlines are
// 2 px horizontally and 1 px vertically for exactly that reason: 2 px all round
// would put the widest bar at 56 (fine) but the tallest stack's outline at
// cy - 17, which clears an 18 px bound by one pixel. Vertical outlines of 1 px
// keep it at cy - 15 and leave the check three pixels of room.

const bars = (g: Paint2D, cx: number, cy: number, n: number) => {
  // One, two or three stacked bars — the count IS the symbol, so the stack is
  // sized to fill the same height whatever n is. A player reads "how many" from
  // the divisions, not from the overall block.
  // GROWN WITH THE ROW, NOT SCALED AT THE CALL SITE. The portrait face took the
  // reel row from 30 px to 36, and a symbol left at its old size sits in a
  // taller cell with air above and below — it reads as a picture of a reel
  // rather than as one.
  //
  // The literals move rather than a `g.scale()` wrapping the call, and that is
  // deliberate: `scripts/L-slots-glass.mjs` fingerprints every symbol by the
  // marks it makes and then looks for that fingerprint inside each reel cell.
  // Its recorder logs a `fillRect`'s RAW ARGUMENTS, so a scale applied around
  // the call would be invisible to it — the check would go on passing while
  // measuring a size nothing draws at any more. Growing the numbers keeps the
  // check looking at what is actually painted.
  //
  // 50, not 46 x 1.2 = 55: the shadow is drawn one pixel proud on each side, so
  // the widest mark is w + 2, and that check isolates a symbol from its
  // neighbours by requiring it to be under `GLASS.reelW * 0.7` = 58.8 px. 52
  // clears that by 6.8 px; 57 would clear it by 1.8, which is a check passing
  // on a fingernail.
  const w = 52, gap = 4;
  const h = (28 - (n - 1) * gap) / n;                 // 28, 12, 6.67
  const lip = Math.max(1, Math.min(3, h * 0.22));
  for (let i = 0; i < n; i++) {
    const y = cy - 14 + i * (h + gap);
    g.fillStyle = P.ink; g.fillRect(cx - w / 2 - 2, y - 1, w + 4, h + 2);
    g.fillStyle = P.gold; g.fillRect(cx - w / 2, y, w, h);
    g.fillStyle = P.goldHi; g.fillRect(cx - w / 2, y, w, lip);
    g.fillStyle = P.goldLo; g.fillRect(cx - w / 2, y + h - lip, w, lip);
  }
  // THE WORD, ON THE ONE BAR THAT CAN HOLD IT.
  //
  // A single bar is 28 px tall and a real single-bar glyph has BAR written
  // across it — it is the only reason anybody calls the symbol a bar. The double
  // is 12 px and the triple 6.67, where 14 px type is not a caption, it is a
  // smudge; and stacking plain bars for 2x and 3x is what a real strip does
  // anyway, so the count stays the thing you read them by.
  if (n === 1) {
    g.fillStyle = P.ink; g.font = 'bold 15px monospace'; g.textAlign = 'center';
    g.fillText('BAR', cx, cy + 6);
  }
};

const seven = (g: Paint2D, cx: number, cy: number) => {
  // A blocky 7: a top bar, then the stem stepped down in whole pixels. Steps
  // rather than a rotated rect because everything else in this world is
  // axis-aligned pixels and a smooth diagonal would read as imported.
  //
  // THE SHADOW FOLLOWS THE GLYPH. It was a solid 21x21 square dropped in behind
  // it, which filled the whole counter of the 7 and made it read as a red blob
  // rather than a numeral — visible the moment the machine was looked at, and
  // invisible to a check that only asks whether the mark is distinct from the
  // other five. Some things really do need a screenshot; GOTCHAS §1 says they
  // cannot PROVE anything, not that you should not look.
  // Grown with the reel row alongside `bars` — see the note there for why the
  // numbers move rather than a scale wrapping the call.
  // FATTENED AND OUTLINED (item 208). It was 26 px wide with a 7 px stem and a
  // one-pixel shadow, which at play size is a red squiggle on cream — the user's
  // frame reads it as "a thin typographic red 7 with no outline, bevel or
  // shadow". 34 wide, a 10 px stem, ink all round it and a lit top edge.
  const top = cy - 15, W = 34, STEM = 10;
  const strokes: [number, number, number, number][] = [[cx - W / 2, top, W, 7]];
  for (let i = 0; i < 11; i++) {
    strokes.push([cx + W / 2 - STEM - i * 1.6, top + 7 + i * 2, STEM, 2]);
  }
  g.fillStyle = P.ink;                                              // the outline
  for (const [x, y, w2, h2] of strokes) g.fillRect(x - 2, y - 1, w2 + 4, h2 + 2);
  g.fillStyle = P.redLo;                                            // the shaded side
  for (const [x, y, w2, h2] of strokes) g.fillRect(x, y, w2, h2);
  g.fillStyle = P.red;                                              // the face, inset
  for (const [x, y, w2, h2] of strokes) g.fillRect(x, y, w2 - 1.5, h2);
  g.fillStyle = P.redHi; g.fillRect(cx - W / 2, top, W - 1.5, 2);   // lit top edge
  g.fillStyle = P.goldHi; g.fillRect(cx - W / 2, top + 7, W, 1);    // the bevel under the bar
};

const cherry = (g: Paint2D, cx: number, cy: number) => {
  // THE ONE SYMBOL EVERYBODY CAN NAME, AND IT READ AS TWO DOTS.
  //
  // The desk's brief said no cherry was visible in the user's frame and inferred
  // there wasn't one. There is — `4-settled.png` in the before shots has it on
  // reel 1 — so that observation is wrong and the real defect is different: two
  // 7 px berries with no outline in an 84 x 36 cell are a pair of red pips. The
  // berries go to 8.5 with an ink ring, the stems get ink, the leaf gets a
  // midrib, and there is a white specular so they read as round and wet.
  g.fillStyle = P.ink;                                              // stems, outlined
  g.fillRect(cx - 2, cy - 16, 4, 10);
  g.fillRect(cx - 11, cy - 9, 11, 4);
  g.fillRect(cx + 1, cy - 10, 12, 4);
  g.fillStyle = P.green;
  g.fillRect(cx - 1, cy - 15, 2, 8);
  g.fillRect(cx - 10, cy - 8, 9, 2);
  g.fillRect(cx + 2, cy - 9, 10, 2);
  g.fillStyle = P.ink; g.fillRect(cx, cy - 17, 13, 6);              // the leaf, outlined
  g.fillStyle = P.greenHi; g.fillRect(cx + 1, cy - 16, 11, 4);
  g.fillStyle = P.green; g.fillRect(cx + 2, cy - 15, 9, 1);         // its midrib
  for (const [dx, dy] of [[-10, 5], [9, 7]] as const) {
    g.fillStyle = P.ink;
    g.beginPath(); g.arc(cx + dx, cy + dy, 9.5, 0, TAU); g.fill();
    g.fillStyle = P.redLo;
    g.beginPath(); g.arc(cx + dx, cy + dy, 8, 0, TAU); g.fill();
    g.fillStyle = P.red;
    g.beginPath(); g.arc(cx + dx - 1, cy + dy - 1, 7, 0, TAU); g.fill();
    g.fillStyle = P.redHi;
    g.beginPath(); g.arc(cx + dx - 3, cy + dy - 3, 2.4, 0, TAU); g.fill();
    g.fillStyle = P.cream;
    g.beginPath(); g.arc(cx + dx - 3.5, cy + dy - 3.5, 1.1, 0, TAU); g.fill();
  }
};

/** One symbol, centred in its cell. BLANK really is nothing — the cream of the
 *  reel showing through, which is what a blank stop on a real strip is. */
export function paintSym(g: Paint2D, s: Sym, cx: number, cy: number): void {
  if (s === 'SEVEN') seven(g, cx, cy);
  else if (s === 'BAR1') bars(g, cx, cy, 1);
  else if (s === 'BAR2') bars(g, cx, cy, 2);
  else if (s === 'BAR3') bars(g, cx, cy, 3);
  else if (s === 'CHERRY') cherry(g, cx, cy);
}

// ── one reel behind its window ───────────────────────────────────────────────

const paintReel = (g: Paint2D, i: number, r: ReelView, flash: boolean) => {
  const x = REEL_X[i], y = GLASS.y, w = GLASS.reelW, h = GLASS.h;
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();

  g.fillStyle = P.reel; g.fillRect(x, y, w, h);

  // Strip index i sits at `centre − (i − pos)·rowH`, so a HIGHER index is
  // HIGHER on the glass and the symbols travel DOWNWARD as `pos` grows — which
  // is the way a reel drum actually turns. `windowAt` agrees with this; it did
  // not at first, and the two disagreeing is how a check ends up describing the
  // wrong row.
  const base = Math.floor(r.pos);
  for (let k = -2; k <= 2; k++) {
    const idx = base + k;
    const cy = PAYLINE_Y - (idx - r.pos) * GLASS.rowH;
    if (cy < y - GLASS.rowH || cy > y + h + GLASS.rowH) continue;
    paintSym(g, symAt(i, idx), x + w / 2, cy);
  }

  // THE BLUR. Above about eight stops a second the eye should not be able to
  // read the strip — a reel you can read at full speed is a reel that is not
  // moving. Horizontal streaks in the reel's own cream, plus a wash that grows
  // with speed, and both fall away as the brake bites so the last symbols come
  // back into focus. That resolve is most of what the brake FEELS like.
  const sp = Math.abs(r.speed);
  if (sp > 6) {
    const a = Math.min(0.62, (sp - 6) / 34);
    g.globalAlpha = a;
    g.fillStyle = P.reel; g.fillRect(x, y, w, h);
    g.globalAlpha = Math.min(0.5, a * 0.9);
    g.fillStyle = P.reelLo;
    for (let sy = y + 2; sy < y + h; sy += 5) g.fillRect(x, sy, w, 1);
    g.globalAlpha = 1;
  }

  // THE DRUM, AND THE GLASS OVER IT.
  //
  // The desk's brief said the windows have "no curvature, no top/bottom
  // shading, nothing suggesting a drum behind glass". THE SHADING WAS ALREADY
  // HERE — nine rows of ink at up to 0.5 alpha, top and bottom. The observation
  // is wrong; the complaint behind it is not. Nine rows of a 108 px window is
  // 8% of its height at half strength, which at play size is a smudge you have
  // to be told about. So this is not "add shading", it is "make the shading that
  // exists actually read", which is a different edit and a smaller one.
  //
  // 16 rows, to 0.78, squared so it falls off like a cylinder rather than like a
  // ramp. Then the part that was genuinely missing: a SHEEN. A drum behind glass
  // has a bright horizontal band where the room reflects in it, and two dark
  // edges where the glass turns away. Every mark here spans the full window
  // width, which is also what keeps it invisible to the symbol check — that
  // filter drops anything wider than 58.8 px, and 84 > 58.8.
  g.fillStyle = P.ink;
  for (let d = 0; d < 16; d++) {
    const k = 1 - d / 16;
    g.globalAlpha = 0.78 * k * k;
    g.fillRect(x, y + d, w, 1);
    g.fillRect(x, y + h - 1 - d, w, 1);
  }
  g.fillStyle = P.cream;                                     // the reflected room
  g.globalAlpha = 0.20; g.fillRect(x, y + h * 0.20, w, 3);
  g.globalAlpha = 0.11; g.fillRect(x, y + h * 0.20 + 3, w, 5);
  g.globalAlpha = 0.07; g.fillRect(x, y + h * 0.62, w, 4);
  // and the glass turning away at each side — h is 108, so the symbol check
  // drops these on `h < rowH` before it ever looks at the width
  g.fillStyle = P.ink;
  g.globalAlpha = 0.30; g.fillRect(x, y, 3, h); g.fillRect(x + w - 3, y, 3, h);
  g.globalAlpha = 0.16; g.fillRect(x + 3, y, 2, h); g.fillRect(x + w - 5, y, 2, h);
  g.globalAlpha = 1;
  g.restore();

  // the window's own frame, gold, lit when this reel is part of a win.
  // EXACTLY ONE strokeRect PER WINDOW AT reelW+2 x h+2 — `L-slots-glass.mjs`
  // counts them to find the three windows, so the chrome surround below is cut
  // at +6 rather than being a second frame at the same size.
  g.strokeStyle = flash ? P.goldHi : P.goldLo;
  g.lineWidth = 2;
  g.strokeRect(x - 1, y - 1, w + 2, h + 2);
  g.strokeStyle = flash ? P.lampOn : P.chrome;
  g.lineWidth = 1;
  g.strokeRect(x - 3.5, y - 3.5, w + 7, h + 7);
};

// ── the marquee bulbs ────────────────────────────────────────────────────────
//
// THE OLD ONES WERE NOT BULBS AND THE USER'S FRAME SAYS SO: 30 squares, 4 x 4
// px, at a 10 px pitch, laid straight onto the cabinet in two straight lines.
// The desk read them off his screenshot as "a perforated stamp edge", which is
// exactly what a row of same-sized dots at an even pitch on a flat ground is.
//
// Three things were missing and all three are cheap:
//
//   · A SOCKET. A bulb is mounted in something dark. Without it the lit state
//     is a pale square on a pale-ish panel and the chase has no contrast to
//     move through — which is why nobody could see that it was already running.
//   · A HALO. Light spills. One extra arc at 0.45 alpha is the whole effect.
//   · A RING, not two lines. The bulbs now go round all four sides of the name,
//     ordered along the ring, so `i % 3` makes the chase TRAVEL round it
//     instead of flashing two rows in place.
//
// The ring is built once as an ordered list, because the order IS the animation
// and recovering it any other way is GOTCHAS 76's second lesson ("never recover
// ordered classes by material reference — recover order physically").
const BULB_R = 3.4;
const bulbRing = (): readonly (readonly [number, number])[] => {
  const pts: [number, number][] = [];
  // 18 + 3 + 18 + 3 = 42, which BOTH chase moduli divide (3 idle, 2 on a win) —
  // otherwise the wrap-around leaves a permanent seam in the travelling light.
  const x0 = 14, x1 = 306, N = 18;
  const yTop = BULB_BAND.top + BULB_BAND.h / 2;          // 8
  const yBot = BULB_BAND.bottom + BULB_BAND.h / 2;       // 72
  const ys = [26, 40, 54];                               // beside the name
  for (let i = 0; i < N; i++) pts.push([x0 + (i * (x1 - x0)) / (N - 1), yTop]);
  for (const y of ys) pts.push([x1, y]);
  for (let i = N - 1; i >= 0; i--) pts.push([x0 + (i * (x1 - x0)) / (N - 1), yBot]);
  for (let i = ys.length - 1; i >= 0; i--) pts.push([x0, ys[i]]);
  return pts;
};
const BULBS = bulbRing();

const bulb = (g: Paint2D, x: number, y: number, on: boolean) => {
  g.fillStyle = P.socket;
  g.beginPath(); g.arc(x, y, BULB_R + 1.6, 0, TAU); g.fill();
  if (on) {
    g.globalAlpha = 0.45; g.fillStyle = P.lampGlow;
    g.beginPath(); g.arc(x, y, BULB_R + 2.6, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }
  g.fillStyle = on ? P.lampGlow : P.lampOff;
  g.beginPath(); g.arc(x, y, BULB_R, 0, TAU); g.fill();
  if (on) {
    g.fillStyle = P.lampOn;
    g.beginPath(); g.arc(x - 0.6, y - 0.6, BULB_R - 1.3, 0, TAU); g.fill();
  }
};

/**
 * A symbol drawn small, for the pay table.
 *
 * Draws through `paintSym` under a uniform scale rather than re-authoring the
 * glyphs at a second size, which is BUILDER-BRIEF §8 applied to a picture: two
 * hand-drawn cherries would drift apart the first time either was touched, and
 * the pay table's whole job is to show you the thing that is on the reel.
 *
 * The scale is uniform because `L-slots-glass.mjs`'s recorder models only
 * uniform scale and throws on anything else — a real deterrent, deliberately
 * kept.
 */
const miniSym = (g: Paint2D, s: Sym, cx: number, cy: number, k: number) => {
  g.save(); g.translate(cx, cy); g.scale(k, k); paintSym(g, s, 0, 0); g.restore();
};

/**
 * WHAT EACH PAY LINE LOOKS LIKE. Presentation only — `PAYTABLE` is the maths and
 * is not touched, this is the picture beside it.
 *
 * Derived from the line's own text rather than typed as a second table: the
 * names already say what they are ("3 DOUBLE BARS"), so reading them is one
 * authoring of the mapping instead of two that can disagree (§8 again). A line
 * this cannot read draws nothing rather than drawing something wrong.
 */
const payArt = (line: string): readonly (Sym | null)[] => {
  const n = line.startsWith('1 ') ? 1 : line.startsWith('2 ') ? 2 : 3;
  const of = (s: Sym): (Sym | null)[] => [0, 1, 2].map((i) => (i < n ? s : null));
  if (line.includes('SEVEN')) return of('SEVEN');
  if (line.includes('CHERR')) return of('CHERRY');
  if (line.includes('TRIPLE')) return of('BAR3');
  if (line.includes('DOUBLE')) return of('BAR2');
  if (line.startsWith('ANY')) return ['BAR1', 'BAR2', 'BAR3'];   // any mix pays
  if (line.includes('BAR')) return of('BAR1');
  return [null, null, null];
};

// ── the whole face ───────────────────────────────────────────────────────────

/**
 * Draw the machine, letterboxed into whatever the panel gives us.
 *
 * `t` is a clock in seconds, used ONLY for the bulb chase and the win flash.
 * Everything else is a function of the view, so a still frame of a stopped
 * machine is identical every time it is painted.
 */
export function paintMachine(
  g: Paint2D, w: number, h: number, v: MachineView, t = 0,
  /** what is in the player's POCKETS, in the wallet's own units. Optional, and
   *  the machine still knows nothing about dollars — it is handed the one fact
   *  it cannot work out for itself: whether "INSERT COIN" is advice or a taunt.
   *  Undefined means "not told", and the face falls back to INSERT COIN. */
  cash?: number,
): void {
  const s = Math.max(0.1, Math.min(w / FACE.w, h / FACE.h));
  g.save();
  g.fillStyle = P.carpet; g.fillRect(0, 0, w, h);
  g.translate((w - FACE.w * s) / 2, (h - FACE.h * s) / 2);
  g.scale(s, s);

  // the cabinet
  g.fillStyle = P.case; g.fillRect(0, 0, FACE.w, FACE.h);
  g.fillStyle = P.caseHi; g.fillRect(0, 0, FACE.w, 2);
  g.fillStyle = P.caseLo; g.fillRect(0, FACE.h - 3, FACE.w, 3);

  // gold pinstripes down the sides, so the red body reads as a trimmed cabinet
  // rather than as a red rectangle with things printed on it
  g.fillStyle = P.goldLo; g.fillRect(4, 0, 3, FACE.h); g.fillRect(313, 0, 3, FACE.h);
  g.fillStyle = P.gold; g.fillRect(4, 0, 1, FACE.h); g.fillRect(313, 0, 1, FACE.h);

  // ── the topper ──
  //
  // The bulb bands are DARK, and that is the point of them. A lit bulb on the
  // red body was a pale mark on a bright ground; on near-black it is a light.
  const win = !!v.win;
  g.fillStyle = P.glass;
  g.fillRect(8, BULB_BAND.top, 304, BULB_BAND.h);
  g.fillRect(8, BULB_BAND.bottom, 304, BULB_BAND.h);
  g.fillRect(8, TOPPER.y, 12, TOPPER.h); g.fillRect(300, TOPPER.y, 12, TOPPER.h);
  // the name panel: deep red under gold, not black under muted gold
  g.fillStyle = P.caseLo; g.fillRect(20, TOPPER.y, 280, TOPPER.h);
  g.fillStyle = P.gold;
  g.fillRect(20, TOPPER.y, 280, 2); g.fillRect(20, TOPPER.y + TOPPER.h - 2, 280, 2);
  g.fillStyle = P.goldLo;
  g.fillRect(20, TOPPER.y + 2, 280, 1); g.fillRect(20, TOPPER.y + TOPPER.h - 3, 280, 1);
  // SEVENS, with an ink shadow and a lit top-left edge — the pixel-art way of
  // getting a bevel without a gradient, and the same idiom `ct/vice.ts` uses
  const nameY = TOPPER.y + 37;
  g.font = 'bold 34px monospace'; g.textAlign = 'center';
  g.fillStyle = P.ink; g.fillText('SEVENS', FACE.w / 2 + 2, nameY + 2);
  g.fillStyle = P.goldHi; g.fillText('SEVENS', FACE.w / 2 - 1, nameY - 1);
  g.fillStyle = win ? P.lampOn : P.gold; g.fillText('SEVENS', FACE.w / 2, nameY);
  // the ring chases, and it travels round the ring because `BULBS` is ordered
  // along it. Faster in attract, faster still on a win — a machine that has just
  // paid should be shouting about it.
  //
  // ON A WIN IT CHASES HARDER, IT DOES NOT BLINK. The first version of this had
  // the whole ring flash on and off with the payline at 8 Hz, and
  // `L-slots-glass.mjs` caught it in one line: it compares the face at t = 0 and
  // t = 0.34 and demands they differ, and floor(0 * 8) and floor(0.34 * 8) are
  // both even — so a paying machine painted two identical frames a third of a
  // second apart. The check was right and the design was worse anyway: a ring
  // that blinks in unison is one lamp, and the point of 42 of them is that
  // something travels. On a win the chase goes to every OTHER bulb at 16 steps a
  // second, which lights half the ring instead of a third and moves it faster.
  const rate = win ? 16 : v.state === 'idle' && v.idleT > FEEL.attract ? 11 : 6;
  const mod = win ? 2 : 3;                     // 42 bulbs, so both divide evenly
  const phase = Math.floor(t * rate) % mod;
  for (let i = 0; i < BULBS.length; i++) bulb(g, BULBS[i][0], BULBS[i][1], i % mod === phase);

  // ── the pay table, printed on the glass above the reels ──
  //
  // On the machine itself, where it belongs. A player should be able to see what
  // a triple bar is worth without leaving the game, and it is the only thing on
  // the face that makes the odds legible at all.
  g.fillStyle = P.glass; g.fillRect(10, PAYT.y, 300, PAYT.h);
  // ONE frame, not two. The inner rule looked better empty and cost 7 px of the
  // band's 104 — which is a third of a row, and the bottom row's caption was
  // landing on it. Four rows of 25 need 100 and the band has exactly 100 inside
  // a single 2 px frame.
  g.strokeStyle = P.gold; g.lineWidth = 2;
  g.strokeRect(11, PAYT.y + 1, 298, PAYT.h - 2);
  // ATTRACT: with nobody touching it, the machine walks a highlight down its own
  // pay lines. It is the cheapest possible animation and it is exactly what a
  // real floor looks like from the door — a room of cabinets all quietly
  // advertising themselves at slightly different phases.
  const attract = v.state === 'idle' && !v.win && v.idleT > FEEL.attract;
  const walk = attract ? Math.floor((v.idleT - FEEL.attract) / FEEL.attractStep) % PAYTABLE.length : -1;
  // 13 px on the portrait face where it was 8 on the landscape one. The pay
  // table is the only thing that makes the odds legible and it was type you had
  // to lean into; the 64 px this band gained goes here rather than into air.
  //
  // 13 and not 14, and the ceiling is arithmetic rather than taste: the longest
  // line is `3 TRIPLE BARS` at 13 characters, monospace runs about 0.6 em, and
  // the pays column is right-aligned 132 px from the line's own left edge. At
  // 14 px the label runs to 109 and a three-digit pay starts at 107 — they
  // touch. At 13 the label ends at 101 and there are eight clear pixels.
  // IT IS PICTURES NOW, NOT A WORD TABLE — item 208, and the user's frame is the
  // reason: eight lines of small text in two columns "reads as a spreadsheet",
  // and it was the LARGEST element on the machine. On a real cabinet the pay
  // table is glass ART: what the symbols look like, and what they pay.
  //
  // The line's name survives as an 8 px caption under its picture, and that is
  // not a hedge — a 1997 cabinet captions its glass, and `L-slots-glass.mjs`
  // asserts that every `PAYTABLE` line is printed at YOUR bet's value, which is
  // a requirement about whether the odds are legible and is still exactly right.
  // What changed is which of the two the eye lands on first. Loosening that
  // check to let the words go would have been BUILDER-BRIEF §7's forbidden move.
  // THE ROW'S 25 PIXELS ARE SPENT TO THE PIXEL, AND THE FIRST CUT GOT IT WRONG.
  //
  // At 0.5 scale a symbol is 17 px tall, so a picture centred at py + 9 reached
  // py + 17.5 and the caption's 8 px glyphs started at py + 16 — the words ran
  // into the artwork above them and the whole band read as a tangle. Looked at,
  // not reasoned about: `shots/w73-face/maxbet.png` from the first pass.
  //
  // 0.45 scale is 15.3 px tall about py + 8, ending py + 15.7; a 7 px caption on
  // a py + 23 baseline starts at py + 17.5. 1.8 px of clear air, which is what
  // the band has to give.
  const ROW_H = 25, COL_W = 148, MINI = 0.45, PITCH = 26;
  PAYTABLE.forEach((p, i) => {
    const col = i < 4 ? 0 : 1, row = i % 4;
    const px = 18 + col * COL_W, py = PAYT.y + 2 + row * ROW_H;
    const winning = v.win?.line === p.line || i === walk;
    if (winning) {                                   // the walking attract highlight
      g.globalAlpha = 0.18; g.fillStyle = P.lampOn;
      g.fillRect(px - 4, py - 1, COL_W - 4, ROW_H - 1); g.globalAlpha = 1;
    }
    payArt(p.line).forEach((s, k) => {
      if (s) miniSym(g, s, px + 12 + k * PITCH, py + 8, MINI);
    });
    g.textAlign = 'right';
    g.fillStyle = winning ? P.lampOn : P.gold;
    g.font = 'bold 14px monospace';
    g.fillText(String(p.pays * v.bet), px + 134, py + 13);
    g.textAlign = 'left';
    g.fillStyle = winning ? P.lampOn : P.label;
    g.font = '7px monospace';
    g.fillText(p.line, px, py + 23);
  });

  // ── the reels ──
  g.fillStyle = P.glass; g.fillRect(GLASS.x - 6, GLASS.y - 6, GLASS.w + 12, GLASS.h + 12);
  // the win flash pulses rather than sitting on, so a win reads as an event
  const flash = !!v.win && Math.floor(t * 8) % 2 === 0;
  for (let i = 0; i < 3; i++) paintReel(g, i, v.reels[i], flash);

  // THE PAYLINE. One line across the middle, with a pointer either side, and it
  // is the thing that tells you which of the three rows you are being paid for.
  // Drawn OVER the reels, because on the real machine it is painted on the glass.
  // The 1 px core at exactly `GLASS.w` is how `L-slots-glass.mjs` finds the
  // payline (it looks for `w === GLASS.w && h <= 1`), so the glow is drawn at
  // GLASS.w + 4 and 3 px tall — it cannot be mistaken for the line, and the
  // check goes on measuring the thing it was written for.
  if (flash) {
    g.globalAlpha = 0.5; g.fillStyle = P.lampOn;
    g.fillRect(GLASS.x - 2, PAYLINE_Y - 2, GLASS.w + 4, 4);
    g.globalAlpha = 0.22;
    g.fillRect(GLASS.x - 2, PAYLINE_Y - 5, GLASS.w + 4, 10);
    g.globalAlpha = 1;
  }
  g.fillStyle = flash ? P.lampOn : P.red;
  g.fillRect(GLASS.x, PAYLINE_Y - 0.5, GLASS.w, 1);
  // Fatter pointers than the two hairline pips that were here, and they POINT AT
  // THE LINE: the tip (k = 0, one pixel tall) is the end nearest the glass and
  // the triangle widens away from it. The old pair widened towards the glass, so
  // they read as two arrows fleeing the reels.
  for (const [px, dir] of [[GLASS.x - 4, -1], [GLASS.x + GLASS.w + 4, 1]] as const) {
    for (let k = 0; k < 7; k++) {
      g.fillRect(px + dir * k - (dir < 0 ? 1.6 : 0), PAYLINE_Y - k, 1.6, k * 2 + 1);
    }
  }

  // ── the meters ──
  //
  // Three of them, which is what a machine of this period has: what you have,
  // what you are betting, what the last spin paid. The WIN meter counting up is
  // the payout ramp made visible, and it is the reason the ramp exists.
  const meter = (mx: number, mw: number, label: string, value: string, lit: boolean) => {
    g.fillStyle = P.meter; g.fillRect(mx, METER_Y, mw, METER_H);
    g.strokeStyle = P.caseLo; g.lineWidth = 1;
    g.strokeRect(mx + 0.5, METER_Y + 0.5, mw - 1, METER_H - 1);
    // THE 4 px INSET IS LOAD-BEARING AND IS NOT MINE TO ROUND OFF.
    // `scripts/L-slots-glass.mjs` finds each meter's reading by its right-
    // aligned x (`mx + mw - 4`) rather than by hunting for a number that
    // happens to match, so it cannot be fooled by the pay table. Moving it to 5
    // while re-cutting this face for the portrait cabinet took all nine meter
    // readings to `null` — the check was right and the change was arbitrary.
    // Only the type size and its baselines move here.
    g.fillStyle = P.meterDim; g.font = '10px monospace'; g.textAlign = 'left';
    g.fillText(label, mx + 4, METER_Y + 13);
    g.fillStyle = lit ? P.lampOn : P.meterInk;
    g.font = 'bold 19px monospace'; g.textAlign = 'right';
    g.fillText(value, mx + mw - 4, METER_Y + 30);
  };
  meter(22, 108, 'CREDITS', String(v.credits), false);
  meter(138, 44, 'BET', String(v.bet), false);
  meter(190, 108, 'WIN PAID', String(v.paid), v.state === 'paying');

  // ── the button deck ──
  //
  // Positions and labels come from `DECK`, the one declaration the hit-test
  // reads too — a button drawn where a click does not land is the fault this
  // file already cites `ct/int-casino.ts`'s SLOT_N for.
  // A PRESSABLE BUTTON IS A CAP SITTING IN A BEZEL. The four here were a flat
  // fill with a 2 px light on top, which the user's frame reads as "web buttons,
  // not chunky physical casino buttons" — and that is exactly what a single
  // top-edge highlight makes: a rectangle with a line on it.
  //
  // Four marks buy the object: a recessed metal bezel it sits IN, ink round the
  // cap so it has an edge, light on the top and left, shadow on the bottom and
  // right. The lit/dead distinction is unchanged and still comes from
  // `deckLive`, the one answer the hand cursor and the click also read.
  g.fillStyle = P.chromeLo; g.fillRect(14, BTN_Y - 6, 292, BTN_H + 12);
  g.fillStyle = P.chrome; g.fillRect(14, BTN_Y - 6, 292, 1);
  g.fillStyle = P.caseLo; g.fillRect(14, BTN_Y + BTN_H + 5, 292, 1);
  const btn = (bx: number, bw: number, label: string, live: boolean, hot: boolean) => {
    const face = !live ? '#5e5a54' : hot ? P.red : P.gold;
    const hi = !live ? '#7a766e' : hot ? P.redHi : P.goldHi;
    const lo = !live ? '#3a3630' : hot ? P.redLo : P.goldLo;
    g.fillStyle = P.chromeHi; g.fillRect(bx - 3, BTN_Y - 3, bw + 6, BTN_H + 6);
    g.fillStyle = P.chromeLo; g.fillRect(bx - 3, BTN_Y - 3, bw + 6, 2);
    g.fillStyle = P.ink; g.fillRect(bx - 1, BTN_Y - 1, bw + 2, BTN_H + 2);
    g.fillStyle = face; g.fillRect(bx, BTN_Y, bw, BTN_H);
    g.fillStyle = hi; g.fillRect(bx, BTN_Y, bw, 3); g.fillRect(bx, BTN_Y, 3, BTN_H);
    g.fillStyle = lo;
    g.fillRect(bx, BTN_Y + BTN_H - 3, bw, 3); g.fillRect(bx + bw - 3, BTN_Y, 3, BTN_H);
    g.font = 'bold 12px monospace'; g.textAlign = 'center';
    g.fillStyle = live ? P.ink : '#8e8a82';
    g.fillText(label, bx + bw / 2 + 1, BTN_Y + 18);
    g.fillStyle = live ? (hot ? P.goldHi : P.cream) : '#a6a29a';
    g.fillText(label, bx + bw / 2, BTN_Y + 17);
  };
  const idle = v.state === 'idle';
  for (const d of DECK) {
    // SPIN is red because it is the one you press; the classic cabinet gives its
    // primary action its own colour and everything else the house gold.
    btn(d.x, d.w, deckLabel(d, v), deckLive(d, v), d.key === ' ');
  }

  // ── the bill acceptor ──
  //
  // See BILL_Y: the mouse needs a way to put money in, and a 1997 cabinet has a
  // bill validator exactly here. Drawn as a slot mouth with a lit throat when it
  // will take a note and a dead one when your pockets cannot fill it, so the
  // hand cursor and the paint agree about whether pressing it does anything.
  // Dressed as a validator rather than as a stripe (item 208): a steel faceplate
  // with a routed black mouth in it, a lit throat when it will take a note, and
  // two guide arrows pointing into the slot. It was a flat bar with a darker bar
  // inside it, which on the seated shot read as a rule between the meters and
  // the buttons rather than as a thing you can put money in.
  const canFeed = idle && cash !== undefined && cash >= CREDIT;
  g.fillStyle = P.chromeLo; g.fillRect(22, BILL_Y, 276, BILL_H);
  g.fillStyle = P.chrome; g.fillRect(22, BILL_Y, 276, 2);
  g.fillStyle = P.caseLo; g.fillRect(22, BILL_Y + BILL_H - 2, 276, 2);
  g.fillStyle = P.ink; g.fillRect(118, BILL_Y + 3, 84, BILL_H - 6);      // the mouth
  g.fillStyle = canFeed ? P.lampOn : P.lampOff;                          // its throat
  g.fillRect(120, BILL_Y + 5, 80, 2);
  g.fillStyle = canFeed ? P.gold : '#7e7a72';
  for (const [ax, dir] of [[110, -1], [210, 1]] as const) {              // guide arrows
    // tip (k = 0) nearest the mouth, widening away from it — an arrow pointing
    // IN. Drawn the other way up first, which is the same mistake the payline
    // pointers had, so it is worth stating: k is distance from the slot.
    for (let k = 0; k < 4; k++) g.fillRect(ax + dir * k, BILL_Y + 8 - k, 2, 2 + k * 2);
  }
  g.fillStyle = canFeed ? P.goldHi : '#7e7a72';
  g.font = 'bold 10px monospace'; g.textAlign = 'center';
  g.fillText('INSERT', 66, BILL_Y + 13);
  g.fillText(`$${BILL}`, 254, BILL_Y + 13);

  // ── the underside of the deck ──
  // See DECK_UNDER: the stool you are sitting on covers this band, so nothing
  // that has to be read or pressed is allowed in it. What a cabinet actually has
  // below its deck is an overhang in shadow, and that is what this is.
  g.fillStyle = P.caseLo; g.fillRect(0, DECK_UNDER, FACE.w, FACE.h - DECK_UNDER);
  g.fillStyle = P.case; g.fillRect(0, DECK_UNDER, FACE.w, 2);

  // ── what the machine is saying ──
  // ITS OWN LIT STRIP, not text floating over whatever is behind it. Centred on
  // the face means centred under the middle reel, so an unbacked line reads as
  // belonging to that reel rather than to the machine.
  g.fillStyle = P.glass; g.fillRect(22, SAY_BAND[0], 276, SAY_BAND[1]);
  g.fillStyle = P.caseLo; g.fillRect(22, SAY_BAND[0], 276, 1);
  g.textAlign = 'center'; g.font = '13px monospace';
  g.fillStyle = v.win || attract ? P.lampOn : P.meterDim;
  const say = v.win
    ? `${v.win.line}   PAYS ${v.win.pays * v.bet}`
    : v.state === 'spinning' ? ''
      // TELLING A BROKE PLAYER TO INSERT A COIN IS NOT SAYING SO, IT IS A TAUNT.
      //
      // The queue's item 3 is "if the player is broke, say so on the machine
      // rather than failing silently", and the machine did say INSERT COIN with
      // an empty meter — but pressing I with an empty WALLET does nothing at
      // all, and the face went on advising the one action that could not work.
      // A player reads that as a broken button, which is the same failure the
      // requirement was written against, one level further out.
      : v.credits < v.bet
        ? (cash !== undefined && cash < CREDIT ? 'NO CASH IN YOUR POCKETS' : 'INSERT COIN')
        : attract
          // The three things a machine shouts at an empty stool.
          //
          // THE MIDDLE ONE WAS A LIE AT ANY BET ABOVE ONE. It was the literal
          // string 'SEVENS PAY 250', so a player staking 5 — whose pay table two
          // bands up correctly reads 1250 — was told 250 by the same face. That
          // is precisely the fault `L-slots-glass.mjs` devotes a section to
          // ("misinformed by the machine while being paid correctly by it"); the
          // check only ever looked at the pay table, so the say band said it
          // freely. Found by looking at `shots/w73-face/attract.png` at bet 5.
          //
          // Derived now, and from the table rather than from its index: the top
          // line is whichever pays most, which stays true if the pay table is
          // ever re-ordered. No maths changed — `PAYTABLE` is untouched.
          ? ['PLAY 1 TO 5 CREDITS',
            `${TOP_PAY.line} PAY ${TOP_PAY.pays * v.bet}`,
            'GOOD LUCK'][walk % 3]
          : 'PLACE YOUR BET';
  if (say) g.fillText(say, FACE.w / 2, SAY_Y);

  g.restore();
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

// ─────────────────────────────────────────────────────────────────────────────
// PART FOUR: THE MACHINERY AROUND IT.
//
// Everything above is the GAME and knows nothing about this world. This part is
// the join: a panel to draw in, a wallet to pay from, a seat that opens it. It
// is deliberately the smallest section in the file, and every line of it is
// something blackjack will do identically.
//
// NOT ONE LINE OF IT IS MINE TO HAVE BUILT:
//
//   · the cabinet, the freeze, ESC and the typeface are K's `makePanel`
//     (`ct/hud.ts`, `notes/K-panel-framework.md`) — three full-screen
//     interfaces were in flight at once and three authors' bezels would have
//     been visible in one screenshot;
//   · the money is `ctx.purse`, the one wallet, with `ct/int-bodega.ts` as the
//     only precedent for spending from it;
//   · the seat is G's, registered in `ct/int-casino.ts`;
//   · and the module reaches the world through `ct/world.ts`'s glob, so there
//     is no line in `crosstown.ts` to add and none to forget.

import * as THREE from 'three';
import type { CtxBuild, Spot } from './ctx';
import { BUILD, ORDER as HOOK } from './ctx';
import type { Panel } from './hud';

/** After the interiors, because the seat this attaches to is built with them. */
export const ORDER = BUILD.INTERIOR + 5;

/**
 * WHAT A CREDIT IS WORTH, and it is authored exactly once.
 *
 * A quarter machine, because that is what a 1997 neighbourhood casino floor
 * IS, and because it makes the numbers read right at both ends: a $20 note buys
 * 80 credits and a real sitting, and the 250x jackpot pays $62.50 — a good
 * night on this street rather than a life change. At a dollar a credit the same
 * jackpot is $250 and the room becomes somewhere else.
 *
 * Proposed to K in `notes/L-for-K-money-and-the-panel.md` §2 because the wallet
 * and the ATM are K's and a rate invented in two files is a rate that will
 * disagree. K has not ruled yet; this is the proposal, in one constant, and if
 * the answer is a different number it is a one-line change here and nowhere
 * else.
 */
export const CREDIT = 0.25;

/** What one press of INSERT feeds in. A note, not a coin — nobody plays a slot
 *  machine a quarter at a time, and a machine that takes twenty presses to load
 *  is a machine nobody sits at twice. */
export const BILL = 5;

/**
 * The label G's stools publish for themselves, in `ct/int-casino.ts`:
 *
 *     label: 'sit at the slot', ok: () => room.inside(),
 *
 * MATCHING ON IT IS A BRIDGE, AND IT IS MEANT TO BE DELETED. The user's
 * requirement is that the seat IS the trigger — "when i sit down i enter the
 * slots interface" — and `ctx.seat()` has no way to tell its owner it was
 * taken. I have asked the desk for `onSit`/`onStand`, two optional fields and
 * two lines in the existing registration, in `notes/L-for-DESK-seat-opens-a-game.md`.
 *
 * Until that lands, this reads which seat the player is on and matches G's own
 * published string. It is indirect, and I took it over the alternative on
 * purpose: the alternative is deriving the stool positions from `AVENUE`,
 * `SLOT_PITCH`, `SLOT_N` and `BANK_Z`, which is five of G's constants copied
 * into my file — and the comments in his own file record that layout moving
 * five separate times. A copied number detaches silently; a copied label breaks
 * loudly, because the prompt the player reads is the same string.
 *
 * When `onSit` lands this constant and `watchSeat` below both go, replaced by
 * one field on G's existing `ctx.seat({ … })` call.
 */
const SLOT_SEAT_LABEL = 'sit at the slot';

interface SeatPose { x: number; z: number; yaw: number }
interface SeatRow { pose: SeatPose; label: string }
interface CtWindow {
  __ct?: {
    seated: () => SeatPose | null;
    seats: () => SeatRow[];
    yaw: () => number;
  };
}

/** The slot stool the player is sitting on, or null.
 *
 *  Returns the POSE OBJECT rather than a boolean, and by IDENTITY rather than by
 *  position: `crosstown.ts` hands out the pose itself, so this cannot be
 *  confused by two stools at the same coordinates the way a distance test would,
 *  and the caller can tell one stool from the next one along. */
function seatedSlot(): SeatPose | null {
  const ct = (globalThis as unknown as CtWindow).__ct;
  if (!ct) return null;
  const pose = ct.seated();
  if (!pose) return null;
  const seat = ct.seats().find((s) => s.pose === pose);
  return seat?.label === SLOT_SEAT_LABEL ? pose : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SCREEN THIS FACE IS PAINTED ON — item 100.
//
// *"slots similarly need to be embedded into the game like i mentioned with the
// atm. fixed perspective. embedded interactable overlay to make it look
// realistic and immersion forward."*
//
// THE MECHANISM IS `PanelSpec.surface` AND NONE OF IT IS RE-IMPLEMENTED HERE.
// Hanging the canvas on a mesh, easing the eye onto it, locking the look,
// freezing the feet, raycasting the pointer back into canvas pixels, the Win98
// hand, ESC always closing, putting the object's own face back — all of that is
// `ct/hud.ts` and `crosstown.ts`, built for the ATM by w41 and called here. The
// only thing this section does is answer the one question the framework asks the
// caller: WHICH MESH.
//
// AND THAT QUESTION IS WHERE THE ATM'S ANSWER STOPS TRANSFERRING.
//
// `ct/bank.ts` builds the ATM's raked screen as its own plane with its own
// single material and tags it `userData.atmPart = 'screen'`, so `ct/atm.ts`
// finds it in four lines and hands it over. There is no equivalent here, and it
// is not an oversight — MEASURED (`scripts/probes/w55-slot-mesh.mjs`): the
// machine you sit at is ONE `BoxGeometry(0.6, 1.45, 0.6)` wearing an ARRAY OF
// SIX materials, its front being index 4 of that array. It has no screen mesh
// because until now it had no screen.
//
// Two things follow, and the second is the one that decides the design:
//
//  1. `ct/hud.ts:899` reads `mesh.material` as a single `MeshBasicMaterial` and
//     immediately calls `.color.getHex()` on it. Handed a six-material box that
//     is `undefined.getHex()` — a throw inside `open()`, before the panel is
//     live. The framework is not wrong to assume this; a surface is a face, and
//     a six-sided box is six faces.
//  2. Even if it could, painting this canvas onto material index 4 would repaint
//     the WHOLE front — including the shadowed body and the coin tray, which
//     `paintMachine` does not draw and should not have to.
//
// So this file supplies a screen: a thin plane, parented to the cabinet, lying
// 6 mm proud of the face the player is looking at, cut to the canvas's aspect
// and hung from the cabinet's top edge. The cabinet keeps its body and its tray;
// the plane is the part that comes alive. That is the same division the ATM has
// with its niche and its keypad.
//
// EVERY NUMBER IN IT IS READ OFF THE WORLD (BUILDER-BRIEF §8). The cabinet is
// found by casting a ray forward from the stool the player is on; its width and
// its top come from its own geometry's bounding box; which face to hang on comes
// from the normal of the face the ray hit. `ct/int-casino.ts` is not imported,
// not touched, and none of `AVENUE`, `SLOT_PITCH`, `SLOT_N`, `BANK_Z` or
// `STOOL_TOP` appears here — which is exactly what the note on SLOT_SEAT_LABEL
// above says the alternative would have cost, on a layout its own comments
// record moving five separate times.
//
// AND IT BUILDS NOTHING UNTIL THE FIRST TIME A PLAYER SITS DOWN. GOTCHAS 75:
// `scenedump.mjs` seeds `Math.random` globally and three draws four random
// values per Object3D, so a mesh created at build time would shift that stream
// and repaint every dithered texture after it — `npm run fp` would report a
// catastrophe that was not there. A scenedump never opens a panel, so it never
// sees this: measured, `objects` is 8415 either way and no `ct-slots-screen`
// exists in a freshly loaded world.
//
// (The stream DOES shift in this commit all the same, for an unrelated reason
// that took isolating to find. See the block on the `three` import below — it is
// the import, not the plane, and the plane's laziness is still worth having.)

// THREE IS IMPORTED STATICALLY, AND THE COST OF THAT IS MEASURED AND REPORTED.
//
// The panel comes in by a dynamic import (see the note below `SLOT_SEAT_LABEL`)
// because `ct/hud.ts` reaches `virtual:build-stamp`, which does not exist
// outside the bundler, and because it is in the glob's cycle. NEITHER APPLIES TO
// THREE: it is not in `ct/world.ts`'s glob, `crosstown.ts` already imports it
// statically, and node loads it perfectly well — checked, not assumed, by
// running `L-slots-rtp`, `-feel` and `-glass` against this file with the static
// import in place.
//
// Static also removes a real hazard the dynamic version had: a window, a few
// milliseconds wide after the world builds, in which `three` had not resolved
// yet and a player sitting down would silently get the screen-space fallback.
//
// WHAT IT COSTS, MEASURED (`npm run fp`, against mainline's `ct/slots.ts`):
// 1018 of 1458 textures and 2069 structure entries hash differently, with the
// object count, the dimensions and every tint IDENTICAL. That is GOTCHAS 75's
// signature, not a change to the world — `scenedump.mjs` seeds `Math.random`
// globally so a dump is reproducible, three draws four random values per
// Object3D for its uuid, and slots.ts taking an edge on three at all reorders
// the bundle's module graph enough to shift that stream. Everything built after
// the shift re-dithers.
//
// PROVED BY ISOLATION rather than argued: with this one import removed and every
// other line of item 100 in place — the whole portrait re-cut, the screen plane,
// the hit test — `fpdiff` reports textures IDENTICAL, structure IDENTICAL, tints
// IDENTICAL and 7 pigeons drifted, which is the noise floor. So the face and the
// surface move nothing, and the dither reseed is the import's alone.
//
// It is also invisible in the game. `dither()` calls `Math.random` unseeded at
// build time in the real world (GOTCHAS §1), so the noise on those textures is
// already different on every page load; only a SEEDED dump has a pattern to
// change. What it costs is `fp`'s readability across this one commit, which is
// why it is written down here instead of being left for the next person to
// rediscover as a catastrophe.

/** the one plane, re-parked on whichever cabinet the player is at */
let plane: THREE.Mesh | null = null;
const RAY = new THREE.Raycaster();

/**
 * The cabinet in front of the player, and the face of it they are looking at.
 *
 * ASKED OF THE WORLD RATHER THAN LOOKED UP. A ray from where the player is,
 * along the way they are facing, hits the thing they are facing — which is the
 * definition of the machine they sat down at, and it stays the definition if the
 * floor is re-laid. `ct/atm.ts` finds its screen by a `userData` tag for the
 * same reason: neither file knows a coordinate.
 *
 * The 2 m limit is the cabinet's own reach from a stool 0.67 m away with room to
 * spare, and it is what stops a stool at the end of a bank finding the wall
 * across the aisle.
 */
function cabinetAhead(scene: THREE.Scene, from: { x: number; z: number; yaw: number }, gy: number):
{ mesh: THREE.Mesh; normal: THREE.Vector3 } | null {
  // rig convention, fp.ts:477 — fwd = (sin yaw, 0, -cos yaw). Read off the same
  // line `crosstown.ts`'s own focus controller cites, not re-derived.
  RAY.set(
    new THREE.Vector3(from.x, gy + 1.0, from.z),
    new THREE.Vector3(Math.sin(from.yaw), 0, -Math.cos(from.yaw)),
  );
  RAY.far = 2.0;
  for (const hit of RAY.intersectObjects(scene.children, true)) {
    const o = hit.object as THREE.Mesh;
    if (o === plane) continue;                       // never find last time's screen
    // The people on the stools either side are sprites and are not machines; a
    // ray that finds one would hang the interface on somebody's back.
    if (o.userData?.citizen) continue;
    if (!o.isMesh || !hit.face) continue;
    // Straight-on faces only. A ray that grazes a valance overhead or clips the
    // corner of the next cabinet along returns a face the player is not square
    // to, and the pose derived from it would put the eye somewhere sideways.
    if (Math.abs(hit.face.normal.y) > 0.3) continue;
    return { mesh: o, normal: hit.face.normal.clone() };
  }
  return null;
}

/**
 * The plane the panel paints on, resolved fresh on every open.
 *
 * Returns `null` when there is no cabinet to find — a prototype harness, a
 * probe that opened the machine from the street — and the framework then falls
 * back to the screen-space panel it would have had anyway. That degrade is
 * `ScreenSurface.mesh`'s stated contract and it is why this was safe to adopt.
 */
function screenPlane(scene: THREE.Scene, gy: number): THREE.Object3D | null {
  // THE STOOL'S OWN POSE, which is where the player is standing — `rig.sit` put
  // them there and `crosstown.ts`'s focus controller cannot move them off it
  // (`FirstPerson.sit` is a no-op while already seated, fp.ts:230). So the seat
  // is both the way in and the vantage point, and there is no second source for
  // either. Not seated means not at a machine, and the framework's screen-space
  // fallback is the honest answer.
  const seat = seatedSlot();
  if (!seat) return null;
  const found = cabinetAhead(scene, seat, gy);
  if (!found) return null;

  const geo = found.mesh.geometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return null;
  const n = found.normal;
  // Which horizontal axis the face looks along, and therefore which one it is
  // WIDE along. The cabinets are axis-aligned boxes, so this is exact.
  const alongX = Math.abs(n.x) > Math.abs(n.z);
  const half = alongX ? (n.x > 0 ? bb.max.x : -bb.min.x) : (n.z > 0 ? bb.max.z : -bb.min.z);
  const width = alongX ? bb.max.z - bb.min.z : bb.max.x - bb.min.x;
  // THE ASPECT COMES FROM THE CANVAS AND THE WIDTH COMES FROM THE OBJECT, so
  // the texels are square whatever size cabinet this is asked about. See FACE.
  const height = width * (FACE.h / FACE.w);

  if (!plane) {
    plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      // White and opaque: the framework multiplies its canvas by this colour and
      // sets it to white on open anyway, and an untouched canvas on a material
      // with no `transparent` flag renders as flat black (w41's third bug).
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    plane.name = 'ct-slots-screen';
  }
  plane.geometry.dispose();
  plane.geometry = new THREE.PlaneGeometry(width, height);
  // PARENTED TO THE CABINET, so it inherits the machine's own place in the room
  // and travels with it, and so everything above can be worked out in the
  // cabinet's local space where the box is axis-aligned and centred.
  if (plane.parent !== found.mesh) found.mesh.add(plane);
  plane.position.set(
    alongX ? Math.sign(n.x) * (half + 0.006) : 0,
    // hung from the TOP edge of the cabinet, which is where a machine's marquee
    // is; the body and the coin tray keep the rest of the face
    bb.max.y - height / 2,
    alongX ? 0 : Math.sign(n.z) * (half + 0.006),
  );
  // A PlaneGeometry looks down +z. Turning it to look down `n` puts u running
  // left-to-right and v bottom-to-top from the player's eye, which is what
  // `ct/hud.ts`'s `surfaceHit` unflips into canvas pixels.
  plane.rotation.set(0, Math.atan2(n.x, n.z), 0);
  plane.visible = true;
  return plane;
}

/**
 * `ct/hud.ts` is reached by a DYNAMIC import, and for two reasons that happen to
 * point the same way.
 *
 * The first is GOTCHAS §28. `ct/world.ts` collects modules from an eager glob,
 * and a module in a runtime import cycle with that graph can resolve to an
 * undefined namespace in the Rollup bundle while working perfectly in the dev
 * server — which is how GOLDEN ACES shipped missing, and how a whole week of
 * "all eight doors arrive" claims turned out to describe dev only. A dynamic
 * import is not part of the static graph, so it cannot take part in that cycle.
 * `ct/int-casino.ts` avoids the same trap by deriving its door stand-off rather
 * than importing a value from `./doors`.
 *
 * The second is that it keeps THE GAME importable by node. `ct/hud.ts` reaches
 * `virtual:build-stamp`, a Vite virtual module that does not exist outside the
 * bundler, so a static import of it would make this whole file unloadable
 * outside a browser — and the maths, the reel physics and the glass are all
 * checked by node scripts that import this module directly. A statically-linked
 * panel would have cost three checks to save one line.
 */
export function register(ctx: CtxBuild): void {
  const machine = createMachine();
  let panel: Panel | null = null;
  let clock = 0, lastT = -1;
  /**
   * The stool the player has ALREADY walked away from without leaving it.
   *
   * ESC closes every panel in this world and must keep doing so — a player who
   * cannot get out of a machine is stuck. But sitting down is what opens this
   * one, and the player is still sitting down afterwards, so the frame hook
   * below reopened it on the very next frame and ESC did nothing at all. It
   * closed, paid out, and sprang back up; measured, not reasoned about — the
   * in-world check caught it as "ESC closes the machine: FAIL" while every
   * money verdict beside it passed, because the close really had happened.
   *
   * So a dismissal is remembered against the stool it was made at. Stand up, or
   * move to a different machine, and it offers itself again. Same stool, same
   * sitting: it stays shut and you get the ordinary "stand up" prompt back.
   *
   * AND AS OF C's SEAT-EXIT FIX THIS IS UNREACHABLE — kept anyway, deliberately.
   *
   * `e090a74fa` and `f110b7f5a` made standing up a state exit that fires at the
   * lowest level, and a side effect is that leaving the panel leaves the STOOL
   * too. Measured both ways rather than assumed: pressing ESC, and calling
   * `__hud.closePanels()` directly, each end with `seated=false, panel=null`.
   * There is no longer any path that closes this cabinet while the player is
   * still on the stool, so `dismissed` is always null and the guard never fires.
   *
   * It stays because its unreachability lives in OTHER PEOPLE'S files — K's
   * panel close and C's seat exit — and quietly depending on another module's
   * current behaviour for your own correctness is the thing this project keeps
   * being bitten by. Four lines that cost nothing are a better trade than
   * re-deriving this the day one of those two changes.
   *
   * What PINS it is not this code: `scripts/L-slots-inworld.mjs` asserts that
   * ESC leaves both the machine and the seat. If that stops being true the
   * verdict goes red, which is the honest place for the claim to live.
   */
  let dismissed: object | null = null;

  /** Credits in, dollars out, and the wallet is the only account. */
  const cashOut = () => {
    const n = machine.cashOut();
    if (n <= 0) return;
    ctx.purse.cash += n * CREDIT;
    ctx.refreshWallet();
  };
  const insert = () => {
    if (!machine.settled()) return;
    const spend = Math.min(BILL, ctx.purse.cash);
    const credits = Math.floor(spend / CREDIT);
    if (credits <= 0) return;
    ctx.purse.cash -= credits * CREDIT;      // charged for what was CREDITED,
    ctx.refreshWallet();                     // never for the rounding
    machine.insert(credits);
  };

  // ── the mouse ─────────────────────────────────────────────────────────────
  //
  // The framework raycasts the pointer onto the screen plane and hands the hit
  // back in THIS canvas's own pixels — the same coordinates `paintMachine` draws
  // in — so the machine hit-tests the layout it drew and the framework is never
  // told where a button is. That seam is w41's and this is the whole of using
  // it: two functions, no registration, no rectangles handed over.

  /** is there something PRESSABLE here? Drives the hand cursor, so it must be
   *  true only where a click does something — w41's rule, and the reason
   *  `deckLive` is one answer read by the paint and by this. */
  const hotAt = (x: number, y: number): boolean => {
    const d = deckAt(x, y);
    if (d) return deckLive(d, machine.view());
    if (billAt(x, y)) return machine.settled() && ctx.purse.cash >= CREDIT;
    return false;
  };

  /**
   * THE ONE DISPATCH, and it is one on purpose.
   *
   * `DECK[i].key` is a keystroke, and a click sends that keystroke through here
   * exactly as the keyboard does. A click on SPIN and a press of SPACE are the
   * same event as far as this machine is concerned, and the one thing worse than
   * two input paths is two that disagree about what SPIN does. `ct/atm.ts` routes
   * its soft keys and its PIN pad the same way for the same reason.
   */
  const onKey = (k: string): void => {
    if (k === ' ' || k === 'enter') machine.play();
    else if (k === 'b') machine.betUp();
    else if (k === 'v') machine.betDown();
    else if (k === 'm') { for (let i = 0; i < 8; i++) machine.betUp(); }
    else if (k === 'i') insert();
    else if (k === 'c') cashOut();
    panel?.repaint();
  };

  const clickAt = (x: number, y: number): void => {
    if (!hotAt(x, y)) return;                  // a dead button stays dead
    const d = deckAt(x, y);
    if (d) { onKey(d.key); return; }
    if (billAt(x, y)) onKey('i');
  };

  // three, on the same dynamic import as the panel and for the second of the two
  // reasons given below: a static `import * as THREE from 'three'` would make
  // this module pull the whole renderer into node, where `L-slots-rtp`,
  // `-feel` and `-glass` import it directly to check the maths, the reels and
  // the glass without a browser. The type-only import at the top of PART FOUR
  // is erased and costs nothing.

  void import('./hud').then(({ makePanel }) => {
  panel = makePanel({
    // FRAMELESS. `paintMachine` already draws a complete cabinet — case,
    // topper marquee with its own chasing bulbs, pay table, reels, meters and
    // button deck — filling the whole FACE.w×FACE.h canvas. The framework's
    // moulded 'machine' bezel used to wrap a SECOND cabinet around that
    // picture of a first one, plus a title stamp on top of it — which is
    // exactly the *"i never want there to be menus popping up unless they are
    // embedded"* law item 0c names. The marquee headline is real signage
    // (`ct/vice.ts` paints it on the facade); it was never missing from the
    // world, only doubled onto this screen's own frame.
    //
    // That headline READ `LOOSEST SLOTS` when this was written, and the note
    // here defended it as authentic period copy — which it is: a "loose"
    // machine is one set to pay out more often, and 1997 marquees advertised
    // exactly that. Superseded 2026-08-04, because the user did not parse it:
    // *"what does loosest slots mean, please change this sign"*. It is
    // `WINNERS DAILY` now. The authenticity is kept on the record because it is
    // why the phrase was chosen, not because it survived the reading.
    id: 'ct-slots',
    // scale 1, not 2. It only decides the size of the SCREEN-SPACE fallback,
    // and the portrait face is 483 canvas pixels tall — at 2 that fallback
    // would be 966 css px and taller than the window it appears in.
    w: FACE.w, h: FACE.h, scale: 1,
    chrome: 'none',
    // ON THE MACHINE, not over the camera. *"slots similarly need to be embedded
    // into the game like i mentioned with the atm. fixed perspective."* Naming
    // the mesh the canvas belongs on is the whole of the change; `paintMachine`
    // above draws what it drew before, re-cut to the face it is now on.
    //
    // 1.15 m and 58°, against the framework's default 0.55/60 and the ATM's
    // 0.75/58. The face is 0.906 m tall and 58° covers 1.24 m of world at
    // 1.15 m, so the machine reads at about 71% of frame height and the
    // cabinets either side, the lit valance overhead and the cabinet's own body
    // under the deck are all in the same frame. That surround is the difference
    // between a screen and a machine in a room, and it is the fault w41 recorded
    // backing the ATM off 0.20 m to fix.
    //
    // 1.35 WAS TRIED AND IS WORSE, WHICH IS NOT WHAT I EXPECTED. Further back
    // frames more room, but `crosstown.ts`'s focus controller stands the eye off
    // along the face's normal and clamps it to a minimum of 1.05 m above the
    // floor — and this face's centre sits at 0.997 m, so the eye takes the
    // clamp. From 1.05 m looking level, backing off 0.20 m brings the STOOL YOU
    // ARE SITTING ON up into the shot: at 1.35 its cushion and both neighbours'
    // rise over the button deck and the bill acceptor and cover them. The reason
    // I backed off in the first place — that the framework's caption printed
    // over the bill acceptor — turned out to be wrong when the frame was
    // measured rather than eyeballed: at 1.15 the face's bottom edge is at 595
    // of 700 px and the caption band starts at 615. They never touched.
    surface: {
      mesh: () => screenPlane(ctx.scene, ctx.player.gy()),
      standoff: 1.15,
      fov: 58,
      hot: hotAt,
      click: clickAt,
    },
    // The mouse is a way in now, so the caption says so — but the keys are named
    // and in full, because *"the current keyboard shortcuts should keep
    // working"* and a player who learned this machine on the keyboard must not
    // be told it stopped listening.
    hint: () => (machine.settled()
      ? (ctx.purse.cash < CREDIT
        ? 'click a button · SPACE spin · B/M bet · C cash out'
        : 'click a button · SPACE spin · B/M bet · I insert · C cash out')
      : '…'),
    draw: (g, w, h) => paintMachine(g, w, h, machine.view(), clock, ctx.purse.cash),
    key: (k) => onKey(k),
    // THE MONEY COMES BACK, ALWAYS. ESC closes every panel in this world without
    // the caller writing a line, which is right and is also the one way a player
    // could have walked away from a full meter. Cashing out on close makes
    // "what you win is in your wallet when you stand up" true by construction
    // rather than by remembering to press a button.
    // THE SCREEN GOES DARK WHEN YOU LEAVE IT. The framework puts the mesh's own
    // material back — for the ATM that restores the cabinet's baked texture, but
    // this plane HAS no other face: it exists only to carry the live canvas, and
    // restored to `savedMap = null` it is a blank white rectangle stuck to the
    // front of the machine. Hiding it is the plane's half of the same promise
    // `ct/hud.ts` keeps for a mesh that was already there.
    //
    // Belt and braces on top of the framework's own restore, deliberately: the
    // one thing worse than a machine you cannot leave is one you left and that
    // is still wearing your session.
    onClose: () => {
      if (plane) plane.visible = false;
      dismissed = seatedSlot();
      cashOut();
    },
  });
  });

  /**
   * The tick, and the reason it is not `f.dt`.
   *
   * `Frame.dt` is clamped to 0.05 by `src/main.ts:107` so one long frame cannot
   * teleport a body through a wall — correct for the world and wrong here, where
   * it would mean the reels visibly slow down whenever the 3D scene is
   * struggling (GOTCHAS §43: below 20 fps sim time runs at 0.659x wall). A
   * machine you sit at is an interface, not physics. `Frame.t` is documented as
   * "wall time, for anything that animates on its own clock", so this takes its
   * own delta from that and gets one clock shared with the world rather than a
   * second `requestAnimationFrame` loop running beside it.
   *
   * K's framework never repaints on its own — "a panel that repaints on a timer
   * is a panel that flickers" — so a moving machine has to ask, and only while
   * it is actually up.
   */
  // ═════════════════════════════════════════════════════════════════════════
  // THE CABINET IS AN `[E]` TARGET NOW — item 205
  // ═════════════════════════════════════════════════════════════════════════
  //
  // The row asks for the poll below to be DELETED in favour of this spot. **Only
  // the spot is added.** The poll is not a workaround here, it is the feature:
  //
  //   *"add a slots interface and game where WHEN I SIT DOWN I ENTER THE SLOTS
  //    INTERFACE and i can play slots."*  — FEATURE-REQUESTS.md:281
  //
  // and it works today — measured before anything was touched
  // (`scripts/probes/w74-does-the-poll-fire.mjs`): sitting on a stool opens
  // `ct-slots` with `__slots.screen()` live, i.e. on the cabinet's own face.
  // BUILDER-BRIEF §6a: where the row and his words disagree, his words win.
  //
  // WHAT THE SPOT IS FOR is the state `dismissed` above already describes at
  // length: dismissed, and still on the stool. That state is unreachable today
  // only because `crosstown.ts:1440` stands you up on every diegetic close —
  // the exact "unreachability that lives in OTHER PEOPLE'S files" the comment on
  // `dismissed` refuses to depend on. That removal is **queued as item 206**,
  // *"closing a panel from a chair ejects you from the chair"*, reported by w69.
  // This is the way back in when it goes, and it is the world's own dispatch
  // rather than a fourth private notion of what the player is doing.
  //
  // ONE SPOT, RE-AIMED. There are 87 stools; registering one spot each would put
  // 87 extra `ok()` calls inside `pickSpot`'s per-frame loop, each running a
  // 219-entry `find`. Only one machine can ever be the one you are sitting at,
  // so one registration is re-aimed at the cabinet in front of whichever stool
  // you took, and `ok()` compares two references.
  //
  // THE NUMBERS COME OFF THE CABINET, via the same `cabinetAhead` ray the panel
  // uses to find its screen — not from `AVENUE`/`SLOT_PITCH`/`BANK_Z`, which are
  // G's and have moved five times (see SLOT_SEAT_LABEL). The radius is the
  // measured stool-to-cabinet distance, so the circle reaches exactly the stool
  // it was found from whatever the casino does to its layout.
  let useSpot: (Spot & { obj?: THREE.Object3D }) | null = null;
  let armedAt: SeatPose | null = null;
  /** `cabinetAhead` is a raycast against the whole scene; this stops it running
   *  every frame in the one case that would otherwise do so — sitting on a stool
   *  whose cabinet cannot be found. */
  let nextLook = -1;

  const FACE_AT = new THREE.Vector3();
  const aimSpot = (stool: SeatPose, t: number): void => {
    if (armedAt === stool || t < nextLook) return;
    nextLook = t + 0.5;
    const found = cabinetAhead(ctx.scene, stool, ctx.player.gy());
    if (!found) return;
    // THE FACE, NOT THE CENTRE — and this is not a preference, it is what
    // `canSee` requires. `crosstown.ts:2119` raycasts eye -> spot and stops
    // `dist - 0.35` short so the thing itself is not counted as its own
    // occluder. A cabinet is 0.6 m deep, so a spot at its CENTRE puts 0.30 m of
    // solid machine inside that margin: measured, the ray ran 0.382 m at a front
    // face 0.364 m away and the machine blocked the line to itself. Every leg
    // downstream passed — `ok()` true, off-axis 0.000, inside the seated reach —
    // and the prompt still never appeared, which is exactly the silent shape
    // `crosstown.ts:2076` records for the apartment door.
    //
    // The offset is the same `half` `screenPlane` below derives for the panel's
    // own plane, off the same bounding box and the same face normal, so the spot
    // and the picture cannot end up on different sides of the machine.
    const geo = found.mesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    if (!bb) return;
    const n = found.normal;
    const alongX = Math.abs(n.x) > Math.abs(n.z);
    const half = alongX ? (n.x > 0 ? bb.max.x : -bb.min.x) : (n.z > 0 ? bb.max.z : -bb.min.z);
    FACE_AT.set(
      alongX ? Math.sign(n.x) * half : 0,
      0,
      alongX ? 0 : Math.sign(n.z) * half,
    );
    found.mesh.updateWorldMatrix(true, false);
    FACE_AT.applyMatrix4(found.mesh.matrixWorld);
    const x = FACE_AT.x, z = FACE_AT.z;
    const r = Math.hypot(x - stool.x, z - stool.z);
    if (!useSpot) {
      useSpot = {
        x, z, r, obj: found.mesh,
        // O(1): ask the rig which pose it is on and compare references. `armedAt`
        // is only ever set to a stool that already carried SLOT_SEAT_LABEL, so
        // this and `seatedSlot()` have the same answer without the search.
        ok: () => armedAt !== null
          && (globalThis as unknown as CtWindow).__ct?.seated() === armedAt,
        label: () => 'play the slot machine',
        act: () => panel?.open(),
      };
      ctx.spot(useSpot);
    } else {
      useSpot.x = x; useSpot.z = z; useSpot.r = r; useSpot.obj = found.mesh;
    }
    armedAt = stool;
  };

  // Registered SYNCHRONOUSLY even though the panel it drives arrives a tick
  // later: `crosstown.ts` sorts HOOKS by declared ORDER once, at build time, so
  // a hook pushed after that sort runs last regardless of what it asked for.
  // It no-ops until the panel exists.
  ctx.onFrame((f) => {
    if (!panel) return;
    // THE SEAT IS THE TRIGGER. Sitting down opens it; standing up is impossible
    // while it is open, because the panel has the keyboard.
    const stool = seatedSlot();
    if (stool === null) { dismissed = null; armedAt = null; nextLook = -1; } // off the stool: offer it again
    else aimSpot(stool, f.t);
    if (!panel!.isOpen()) {
      lastT = -1;
      if (stool !== null && stool !== dismissed) { lastT = f.t; clock = 0; panel!.open(); }
      return;
    }
    // Left the seat some other way — a room transition stands you up directly
    // (`crosstown.ts:653`), which is the same path that would miss an `onStand`
    // hook. Closing here cashes out through `onClose`.
    if (stool === null) { panel!.close(); return; }
    const dt = lastT < 0 ? 0 : Math.max(0, f.t - lastT);
    lastT = f.t;
    clock += dt;
    machine.tick(dt);
    panel!.repaint();
  }, HOOK.LATE);

  // The station, for `scripts/` and for anyone who wants to look at the machine
  // without walking to the casino. Named for what it is; `__hud.panel()` will
  // report `ct-slots` while it is up.
  (globalThis as unknown as Record<string, unknown>).__slots = {
    open: () => panel?.open(),
    close: () => panel?.close(),
    /**
     * TEST AFFORDANCE — the DISMISSED-BUT-STILL-ON-THE-STOOL state, which
     * `useSpot` exists for and which nothing in the UI can reach today. The
     * comment on `dismissed` above sets out why: `crosstown.ts:1440` stands you
     * up on every diegetic close, so the frame hook clears the latch a frame
     * later. `ct/library-pc.ts` carries the same affordance for the same reason.
     *
     * A capability nobody can exercise is a capability nobody can prove
     * (GOTCHAS 79). Write `dismissed` AFTER the close — `onClose` overwrites it
     * with `seatedSlot()`, null by then — and re-seat in the SAME turn, or the
     * next frame clears it: `__slots.dismissHere(); __ct.sit(pose)`.
     */
    dismissHere: () => { const s = seatedSlot(); panel?.close(); dismissed = s; },
    view: () => machine.view(),
    insert: (n: number) => machine.insert(n),
    play: () => machine.play(),
    rtp: () => exactRTP(),
    /** The ONE wallet, read through the same `ctx.purse` the bodega spends
     *  from. Published here rather than asking for a new station affordance in
     *  a file I do not own — and reading it through this module is the honest
     *  way round anyway, since the claim being checked is that MY machine moves
     *  THAT money. */
    cash: () => ctx.purse.cash,
    credit: () => CREDIT,
    /**
     * WHERE THE PRESSABLE THINGS ARE, in canvas pixels — the machine's own
     * declaration, published so a harness can click the layout that was
     * actually drawn instead of carrying a second copy of it.
     *
     * BUILDER-BRIEF §8, and it is not a theoretical worry here: this face was
     * re-laid twice while item 100 was being built (once for the portrait
     * cabinet, once to lift every control clear of the stool cushion), and a
     * probe holding hand-typed button centres would have gone on clicking dead
     * cabinet and reporting the mouse broken. It also survives the one place
     * `import('/src/proto/ct/slots.ts')` cannot reach, which is the BUILT
     * bundle — the only place GOTCHAS §28's class of fault is visible at all.
     */
    face: () => ({
      w: FACE.w, h: FACE.h,
      deck: DECK.map((d) => ({ ...d, y: BTN_Y, h: BTN_H })),
      bill: { x: 22, y: BILL_Y, w: 276, h: BILL_H },
      glass: { ...GLASS },
    }),
    /** the plane the face is painted on while focused, or null */
    screen: () => (plane && plane.visible ? plane : null),
  };
}
