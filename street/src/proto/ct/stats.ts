// ══ STATS — THE FIVE NUMBERS UNDER EVERYTHING ═══════════════════════════════
//
// *"lets also make the character have intelligence, strength, charisma,
//  dexterity, constitution and you can spec them on start. make a spider chart
//  actually. that would rule. also health is derived from str and con, speed
//  is derived from dex, int allows you to get better jobs, but you always have
//  a small chance of getting the job or passing the application of whatever
//  and that small chance is slightly more likely from having high charisma."*
//   (2026-08-08)
//
// The character sheet, as data. This module owns the five numbers and the
// arithmetic over them; it owns NO screen, NO job board and NO gym — those
// call in. The creation form (`ct/create.ts`) specs them, the gym trains STR,
// DEX and CON, the community college trains INT, the punch clock trains CHA
// (`ct/jobs.ts`), and every one of them goes through the verbs below so the
// floor and the change signal cannot be forgotten by a caller — the same
// argument `ct/health.ts` makes for `hp`.
//
// ⚠ A PURE LEAF. IT IMPORTS NOTHING, AND IT NEVER MAY. `ct/health.ts` derives
// its maximum from here, `ct/hud.ts` imports health, and half the world
// imports the HUD — so an import added here is one step from the cycle
// GOTCHAS §28 warns about, where a module is silently dropped from the built
// bundle and dev looks perfect. The save slice therefore lives in
// `ct/save.ts`'s `builtins`, exactly like the purse's, the body's and
// health's, reached through `captureStats`/`restoreStats` below.
//
// NEW GAME needs no line anywhere: the stats live only in the `ct-save` blob,
// which `ct/newgame.ts` wipes whole, and the reload puts the record back at
// its declared defaults. That is the rule `ct/newgame.ts`'s own table states.

// ── the five, in the order he said them ────────────────────────────────────
export type StatName = 'int' | 'str' | 'cha' | 'dex' | 'con';

export const STAT_NAMES: readonly StatName[] = ['int', 'str', 'cha', 'dex', 'con'];

/** how a stat is printed on paper — the form, a report card, a gym chart */
export const STAT_LABEL: Record<StatName, string> = {
  int: 'INT', str: 'STR', cha: 'CHA', dex: 'DEX', con: 'CON',
};

// ── THE POINT-BUY ──────────────────────────────────────────────────────────
//
// Each stat runs from a floor of 1. THE DESK CAPS AT 10; THE WORLD DOES NOT:
// *"i was thinking cap 10 for creation, un cap during gameplay"* (2026-08-15,
// refining *"i dont want an upper ceiling on the points"* from the same day).
// So the CREATION form cannot place a stat past 10 — that cap lives in
// `specStep`, the form's only writer — while `setStat` and training have no
// ceiling at all, for ever. A fresh character holds 5 in everything — dead
// average, which is what the derivations below are tuned around (average
// health lands at exactly 100, average speed at exactly 1.0). The creation
// pool is 30 points against the 25 a flat spec costs, so there are FIVE free
// points to place, and dumping a stat to 1 buys four more elsewhere. Classic
// point-buy, no cost curve: point in, point out, because a curve is a rulebook
// and this is a one-screen form.
export const STAT_MIN = 1;
export const SPEC_POOL = 30;
/** the CREATION ceiling — `specStep`'s alone. Nothing after the first
 *  morning reads it; training past 10 is the whole point of the un-cap. */
const SPEC_MAX = 10;

const DEFAULT = 5;

const stats: Record<StatName, number> = {
  int: DEFAULT, str: DEFAULT, cha: DEFAULT, dex: DEFAULT, con: DEFAULT,
};

/** who recomputes when a number moves — health re-derives its max, the
 *  creation form redraws its chart, the save flushes. */
const WATCH: (() => void)[] = [];

export function onStatsChange(fn: () => void): void { WATCH.push(fn); }

function notify(): void { for (const f of WATCH) f(); }

export function stat(s: StatName): number { return stats[s]; }

function clampStat(v: number): number {
  return Math.max(STAT_MIN, Math.round(v));
}

/** The one writer. Everything — the spec, the gym, the restore — lands here,
 *  so the clamp and the signal are unforgettable. */
export function setStat(s: StatName, v: number): void {
  if (typeof v !== 'number' || !Number.isFinite(v)) return;
  const next = clampStat(v);
  if (next === stats[s]) return;
  stats[s] = next;
  notify();
}

// ── training — what the gym, the college and the punch clock call ──────────
//
// Floored at 1 by `setStat`, capped by nothing; persistence is the save
// slice's job and needs nothing from the caller. The pool is a CREATION rule
// only — a year of bench presses is not spending points, so training ignores it.
export function raiseStat(s: StatName, n = 1): void { setStat(s, stats[s] + n); }
export function lowerStat(s: StatName, n = 1): void { setStat(s, stats[s] - n); }

/**
 * THE TRAINING ROLL — one curve for every place a day's effort might move a
 * number (the gym's machines, a shift behind a counter). Below 10 it is the
 * gym's original line, (10 − s) / 5 — 5→6 certain, 9→10 one day in five.
 * Past 10 the old line hit zero, which was the ceiling wearing a different
 * hat; now a long tail takes over, 1 / (s − 3) — 10→11 one day in seven,
 * 15→16 one in twelve — diminishing for ever, never zero. No session is a
 * priori wasted, and no stat has a top.
 */
export function trainOdds(s: number): number {
  const v = clampStat(s);
  return Math.min(1, Math.max((10 - v) / 5, 1 / (v - 3)));
}

// ── the spec, at creation ──────────────────────────────────────────────────

/** points still unspent against the pool. Negative is possible LATER — a
 *  trained character's stats sum past 30 — and means only that creation-style
 *  raising is out of budget, which by then it always is. */
export function pointsLeft(): number {
  let sum = 0;
  for (const s of STAT_NAMES) sum += stats[s];
  return SPEC_POOL - sum;
}

/** Step a stat on the creation form: up only while the pool has a point in
 *  it AND the stat is under the desk's cap of 10 (`SPEC_MAX` — training may
 *  pass it later, the form may not), down only to 1 (a person has SOME of
 *  everything). Lowering refunds. */
export function specStep(s: StatName, d: number): void {
  if (d > 0 && (pointsLeft() <= 0 || stats[s] >= SPEC_MAX)) return;
  setStat(s, stats[s] + (d > 0 ? 1 : -1));
}

// ══ THE DERIVATIONS ═════════════════════════════════════════════════════════
//
// Pure functions of the numbers, so a tooltip, a probe or a what-if can ask
// about a spec nobody holds. The convenience forms below them read the live
// record — those are what the HUD-facing modules call.

/**
 * HEALTH, FROM STR AND CON — *"health is derived from str and con"*.
 *
 *     max = 60 + 4 × (STR + CON)
 *
 * Tuned so the average body (5/5) is exactly the 100 the HUD bar was born
 * reading — the bar does not lie about a character made before stats existed.
 * The floor (1/1) is 68, still most of a bar; the biggest CREATION body
 * (10/10, the desk's cap) is 140, and past creation there is no ceiling —
 * every trained point of STR or CON is four more health, for ever.
 * (`ct/carhit.ts` sized its flat 70 against that 140 — see its header
 * before touching either number.)
 */
export function maxHealthFor(str: number, con: number): number {
  return 60 + 4 * (clampStat(str) + clampStat(con));
}

/**
 * SPEED, FROM DEX — *"speed is derived from dex"*.
 *
 *     mul = 1 + 0.025 × (DEX − 5),  held to 0.9 … 1.15
 *
 * A MULTIPLIER on walk speed, deliberately modest: 0.9 at DEX 1, 1.0 at the
 * average, 1.125 at DEX 10. Movement and collision are never small — the
 * whole world's doorways, kerbs and the sacred 2 m lane were tuned at 1.0,
 * and a build that doubles it breaks the feel of all of them.
 *
 * ⚠ THE 1.15 HOLD IS A MOVEMENT RULE, NOT A STAT CEILING, and it survived the
 * ceiling's removal on purpose: `fp.ts`'s fall arithmetic and every doorway
 * were tuned against "the fastest legal body", and points past DEX 11 buying
 * more speed would move that bound from a trunk file this change may not
 * enter. DEX past 11 walks no faster. Erick's call to raise, not a builder's.
 */
export function speedMulFor(dex: number): number {
  return Math.max(0.9, Math.min(1.15, 1 + 0.025 * (clampStat(dex) - 5)));
}

/**
 * JOBS, FROM INT AND CHA — his rule, verbatim: *"int allows you to get better
 * jobs, but you always have a small chance of getting the job or passing the
 * application of whatever and that small chance is slightly more likely from
 * having high charisma."*
 *
 * NO JOB SYSTEM LIVES HERE. A job-giver declares how much INT the position
 * wants (`reqInt` — the bodega wants 5, the college wants 10) and rolls once
 * against what this returns:
 *
 *   qualified   (INT ≥ reqInt):  0.70 + 0.04 × (INT − reqInt) + 0.025 × CHA,
 *                                capped at 0.95 — nothing is ever certain
 *   unqualified (INT < reqInt):  0.04 + 0.02 × CHA, capped at 0.60 — charm
 *                                opens most doors, but never INT's doors
 *
 * ⚠ THE CHA COEFFICIENTS WERE RAISED 2.5× AND 3.3× — *"charisma should
 * matter more"* (2026-08-15), overriding the original "slightly more likely".
 * The unqualified line is still the chance you always have — 6% at CHA 1 —
 * but a talker is a real applicant now: 24% at CHA 10, and with no stat
 * ceiling a CHA 28 silver tongue talks into three doors of five. INT still
 * gates the qualified line; CHA can only ever knock.
 */
export function jobChance(reqInt: number, s: { int: number; cha: number } = stats): number {
  const req = clampStat(reqInt);
  const int = clampStat(s.int), cha = clampStat(s.cha);
  if (int >= req) return Math.min(0.95, 0.70 + 0.04 * (int - req) + 0.025 * cha);
  return Math.min(0.60, 0.04 + 0.02 * cha);
}

// ── the live conveniences ──────────────────────────────────────────────────

/** what the health module asks: the max this body supports, right now */
export function maxHealthNow(): number { return maxHealthFor(stats.str, stats.con); }

/** what locomotion asks, once per frame: cheap on purpose — two compares and
 *  a multiply, no allocation. */
export function speedMul(): number { return speedMulFor(stats.dex); }

// ── the save's two doors ───────────────────────────────────────────────────
//
// `ct/save.ts` registers the slice (see the leaf note in the header) and
// these are all it touches. Restore is BY NAME and clamped through `setStat`,
// so a corrupt blob cannot land a 900-STR character; a missing field keeps
// its default, which is the registry's own rule for missing slices.

export function captureStats(): Record<string, number> {
  return { ...stats };
}

export function restoreStats(v: Record<string, unknown>): void {
  if (!v || typeof v !== 'object') return;
  for (const s of STAT_NAMES) {
    const n = v[s];
    if (typeof n === 'number' && Number.isFinite(n)) setStat(s, n);
  }
}

// Test affordance, same shape and reason as `__health`: the record is a
// module local with one setter, and a console has no other door.
if (typeof window !== 'undefined') {
  (window as unknown as { __stats: unknown }).__stats = {
    get: () => ({ ...stats }), set: setStat, raise: raiseStat, lower: lowerStat,
    pointsLeft, jobChance, maxHealth: maxHealthNow, speedMul, trainOdds,
  };
}
