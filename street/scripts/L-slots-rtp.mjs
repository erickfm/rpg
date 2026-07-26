#!/usr/bin/env node
// THE CLAIM: the SEVENS slot machine returns 92.83% of what is staked in it,
// and its hit rate, tease rate and session shape are what ct/slots.ts says.
//
// Named for the claim rather than for the subject (GOTCHAS §24). There is no
// `slots.mjs` and there should not be — "slots" is a subject and more than one
// agent will end up investigating it. This file asserts one number.
//
// It imports ct/slots.ts DIRECTLY, so it measures the real module the game
// imports rather than a copy of the tables transcribed into a script. That
// transcription is exactly the two-authorings fault this project keeps hitting
// (GOTCHAS §44, and the ROWS/SLOT_N literal in ct/int-casino.ts): a pay table
// typed twice is a pay table that will disagree with itself, and the disagreeing
// copy is always the one being tested.
//
// Node 24 strips TypeScript types natively, so a `.ts` import from a `.mjs`
// script just works and needs no build step. The first version of this script
// spun up a vite server in middleware mode to do the same job, and it died
// under load with EMFILE — vite watches its own config file, fourteen agents
// were running, and the machine ran out of file descriptors. It passed cleanly
// on an idle machine and failed on a busy one, which is GOTCHAS §30's shape in
// a place §30 does not look: not a timing bet, a RESOURCE bet. Importing the
// module opens one file.
//
//   node scripts/L-slots-rtp.mjs            enumerate, simulate, assert
//   node scripts/L-slots-rtp.mjs table      the pay table and the strips
//   node scripts/L-slots-rtp.mjs sessions   what a sitting looks like
//   node scripts/L-slots-rtp.mjs all
//
// Exit codes follow the house convention (GOTCHAS §32):
//   0  measured, and it is fine
//   1  measured, and it is WRONG
//   2  usage, or a --selftest that was not caught
//   3  aborted — nothing was measured
//
// It needs no browser and no server, which is the point of the maths living in
// a module that imports nothing: the one part of this feature that cannot be
// checked by looking at it is also the one part that needs no world to check.

import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
// Lets node resolve this project's extensionless relative imports. See the file.
register('./lib/L-ts-imports.mjs', import.meta.url);

const MODES = ['rtp', 'table', 'sessions', 'all', '--selftest'];
const mode = process.argv[2] ?? 'rtp';
if (!MODES.includes(mode)) {
  // GOTCHAS §34 shape one: a mode word that matches no branch runs nothing and
  // exits 0, which is indistinguishable on a board from a real pass. Reject it
  // before doing any work.
  console.error(`usage: node scripts/L-slots-rtp.mjs [${MODES.join('|')}]`);
  process.exit(2);
}

// ── THE SELFTEST ─────────────────────────────────────────────────────────────
//
// GOTCHAS §27: a check you have never watched fail is a check you will argue
// with. Every mutation below breaks the MACHINE — the strips and the pay table
// the check actually reads — and the check has to go red for each one, or it is
// decoration.
//
// They are chosen to be the mistakes somebody would really make while tuning
// this thing, not arbitrary damage: raising a prize, levelling the reels, and
// making the machine generous. The third is the one that matters most, because
// a slot machine that pays too much is the failure nobody reports.
const MUTATIONS = {
  // The obvious one: a jackpot somebody nudged up "to make it feel better".
  jackpot: (S) => { S.PAYTABLE[0].pays = 900; },
  // The subtle one, and the reason the short-reel assertion exists at all:
  // level the sevens across the three reels and the honest near miss quietly
  // stops happening. Nothing about the RTP band would notice on its own.
  'level-reels': (S) => { S.STRIPS[2][0] = 'SEVEN'; },
  // A machine that has stopped paying small change. The RTP falls out of band
  // AND the hit rate collapses — two different assertions, one mutation, which
  // is how you tell they are measuring different things.
  'kill-cherries': (S) => {
    for (const st of S.STRIPS) for (let i = 0; i < st.length; i++) if (st[i] === 'CHERRY') st[i] = 'BLANK';
  },
  // The game and the enumeration drifting apart: `spin` stops using the whole
  // strip and nails reel 3 to one stop. The enumeration is unaffected — it never
  // calls spin — so ONLY the simulation-agrees assertion can catch this, which
  // is the entire reason a simulation is run alongside an exact answer.
  //
  // This is the mutation that made the simulation move OUT of ct/slots.ts. While
  // `simulate()` lived in the module it closed over the module's own `spin` and
  // this mutation could not reach it: applied, machine broken, check green.
  'short-spin': (S) => {
    const real = S.spin;
    S.spin = (rng = Math.random) => { const s = real(rng); return [s[0], s[1], 0]; };
  },
};

// ── the instruments, driving the module from outside ─────────────────────────
//
// Deliberately here rather than in ct/slots.ts. See the note at the foot of that
// file: a measurement that lives inside the thing it measures cannot be aimed at
// a broken version of it.

/** N spins through the module's own `spin` and `evaluate`. Not a better number
 *  than the enumeration — an independent path to the same one. */
const simulate = (S, spins, rng) => {
  let returned = 0, hits = 0, best = 0, teases = 0;
  for (let n = 0; n < spins; n++) {
    const s = S.spin(rng);
    if (S.isSevenTease(s)) teases++;
    const w = S.evaluate(S.symAt(0, s[0]), S.symAt(1, s[1]), S.symAt(2, s[2]));
    if (!w) continue;
    hits++; returned += w.pays;
    if (w.pays > best) best = w.pays;
  }
  return { spins, staked: spins, returned, rtp: returned / spins,
    hits, hitFrequency: hits / spins, best, teases };
};

/** A sitting: `bankroll` credits in, 1 a spin, until it is gone or `maxSpins`.
 *  "Sit and play a while, win sometimes, drift down slowly" is a claim about the
 *  SHAPE of a session, and an RTP alone cannot tell you that — a 92.8% machine
 *  paying one enormous prize and nothing else has the same RTP and feels like
 *  losing every spin, which it would be. */
const session = (S, bankroll, maxSpins, rng) => {
  let credits = bankroll, peak = bankroll, n = 0;
  for (; n < maxSpins && credits >= 1; n++) {
    credits -= 1;
    const s = S.spin(rng);
    const w = S.evaluate(S.symAt(0, s[0]), S.symAt(1, s[1]), S.symAt(2, s[2]));
    if (w) credits += w.pays;
    if (credits > peak) peak = credits;
  }
  return { spins: n, ended: credits, peak, busted: credits < 1 };
};

if (mode === '--selftest') {
  let slept = 0;
  for (const name of Object.keys(MUTATIONS)) {
    let code = 0, out = '';
    try {
      out = execFileSync(process.execPath, [SELF, 'all'], {
        env: { ...process.env, L_SLOTS_MUTATE: name }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    const failed = (out.match(/^FAIL/gm) ?? []).length;
    // Exit 3 is NOT a catch (GOTCHAS §32) — a check that never ran cannot have
    // noticed anything, and counting it as CAUGHT is the exact false green that
    // entry warns canfail.mjs about.
    const caught = code === 1 && failed > 0;
    if (!caught) slept++;
    console.log(`${caught ? 'CAUGHT ' : 'SLEPT  '} ${name.padEnd(14)} exit=${code} fails=${failed}`);
  }
  console.log(slept === 0
    ? `\n  selftest: ${Object.keys(MUTATIONS).length} / ${Object.keys(MUTATIONS).length} CAUGHT.`
      + ' The check can fail.\n'
    : `\n  selftest: ${slept} mutation(s) SLEPT — the check passed a broken machine.\n`);
  process.exit(slept === 0 ? 0 : 2);
}

// ── the band this machine has to sit in ──────────────────────────────────────
//
// The user's words: "Around 90 to 95 percent, so he can sit and play a while,
// win sometimes, and drift down slowly." That is the assertion, and it is a
// BAND rather than a point because a point would make every future strip tweak
// a red. Anything outside it is a real failure and should be.
const RTP_MIN = 0.90, RTP_MAX = 0.95;
// A machine can hit the RTP band and still feel dead. 92.8% delivered as one
// prize in three thousand spins is arithmetically identical and unplayable, so
// the hit rate is asserted too, with a floor measured from these strips rather
// than remembered (GOTCHAS §34: "measure the floor, do not remember it").
const HIT_MIN = 0.12, HIT_MAX = 0.30;
// The simulation exists to catch the game and the enumeration disagreeing. Over
// 100,000 spins on a machine whose largest prize is 250x, the sampling error on
// the mean is around 1.2 percentage points (sd/sqrt(n) with sd ≈ 3.8 credits),
// so 2 points is about 1.6 sigma of honest noise — tight enough to catch a real
// divergence and loose enough not to go red on a Tuesday.
const SIM_SPINS = 100_000, SIM_TOL = 0.02;

const pct = (x) => `${(x * 100).toFixed(3)}%`;
const oneIn = (x) => (Number.isFinite(x) ? `1 in ${x.toFixed(0)}` : 'never');

/** A seeded LCG so a simulation run is reproducible and a red can be re-read.
 *  Deliberately NOT ct/rng.ts — GOTCHAS §2, that stream's draw order is
 *  load-bearing for the whole world's foliage. This one is local to the proof. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

let S;
try {
  // A module namespace is frozen, so the mutations below cannot write to it.
  // Copied into a plain object — the arrays and pay rows inside are the SAME
  // objects, so a mutation still breaks the real tables the enumeration reads.
  S = { ...await import('../src/proto/ct/slots.ts') };
} catch (e) {
  console.error(`ABORTED: could not load ct/slots.ts — ${e.message}`);
  process.exit(3);
}

// Applied here and nowhere else: the mutation breaks the machine the check is
// about to read, leaving the check's own code untouched. That is the difference
// between proving the check can fail and proving the harness can print FAIL.
if (process.env.L_SLOTS_MUTATE) {
  const m = MUTATIONS[process.env.L_SLOTS_MUTATE];
  if (!m) { console.error(`ABORTED: no mutation "${process.env.L_SLOTS_MUTATE}"`); process.exit(3); }
  m(S);
  console.log(`  [MUTATED: ${process.env.L_SLOTS_MUTATE}] — this run is expected to FAIL\n`);
}

// GOTCHAS §34 shape two: every verdict below is free on an empty machine. Assert
// the population before asserting anything about it.
if (!S.STRIPS?.length || S.STRIPS.length !== 3 || !S.PAYTABLE?.length) {
  console.error('ABORTED: ct/slots.ts published no strips or no pay table —'
    + ' every check below would pass for free.');
  process.exit(3);
}
for (let r = 0; r < 3; r++) {
  if (S.STRIPS[r].length !== S.STOPS) {
    console.error(`ABORTED: reel ${r + 1} has ${S.STRIPS[r].length} stops, not ${S.STOPS}.`
      + ' The enumeration below assumes every reel is the same length.');
    process.exit(3);
  }
}

const R = S.exactRTP();
let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

console.log(`\nSEVENS — three-reel mechanical, ${S.STOPS} stops a reel,`
  + ` ${R.combos.toLocaleString()} combinations, one payline\n`);

if (mode === 'table' || mode === 'all') {
  console.log('  THE STRIPS   (position 0 at the top; the payline shows the middle row)\n');
  const glyph = { SEVEN: ' 7 ', BAR3: '3B ', BAR2: '2B ', BAR1: '1B ', CHERRY: ' C ', BLANK: ' . ' };
  for (let r = 0; r < 3; r++) {
    console.log(`    reel ${r + 1}  ${S.STRIPS[r].map((s) => glyph[s]).join('')}`);
  }
  console.log('');
  const counts = {};
  for (const sym of S.SYMS) counts[sym] = S.STRIPS.map((st) => st.filter((x) => x === sym).length);
  console.log('    symbol        r1  r2  r3');
  for (const sym of S.SYMS) {
    console.log(`    ${(S.SYM_NAME[sym] || 'blank').padEnd(12)}  `
      + counts[sym].map((n) => String(n).padStart(2)).join('  '));
  }
  console.log('');
}

if (mode === 'rtp' || mode === 'table' || mode === 'all') {
  console.log('  THE PAY TABLE, and what each line actually contributes\n');
  console.log('    line               pays    combos      odds        of RTP');
  for (const row of R.rows) {
    console.log(`    ${row.line.padEnd(16)}  ${String(row.pays).padStart(5)}`
      + `  ${String(row.combos).padStart(8)}`
      + `  ${oneIn(row.odds).padStart(12)}`
      + `  ${pct(row.credits / R.combos).padStart(10)}`);
  }
  console.log(`    ${''.padEnd(16)}  ${''.padStart(5)}  ${String(R.hits).padStart(8)}`
    + `  ${oneIn(R.combos / R.hits).padStart(12)}  ${pct(R.rtp).padStart(10)}\n`);

  console.log('  ENUMERATED — every one of the'
    + ` ${R.combos.toLocaleString()} stop combinations, no sampling\n`);
  console.log(`    return to player   ${pct(R.rtp)}`
    + `   (${R.credits.toLocaleString()} credits back per ${R.combos.toLocaleString()} staked)`);
  console.log(`    hit frequency      ${pct(R.hitFrequency)}   ${oneIn(R.combos / R.hits)} spins pays something`);
  console.log(`    average win        ${R.averageWin.toFixed(2)}x the credit that bought it`);
  console.log(`    two-seven tease    ${oneIn(R.combos / R.teases)}   `
    + `${R.teases} combinations land SEVEN SEVEN not-SEVEN\n`);

  // The simulation. Not a better number — an independent path to the same one.
  const sim = simulate(S, SIM_SPINS, lcg(0x5E7E1));
  console.log(`  SIMULATED — ${SIM_SPINS.toLocaleString()} spins through spin() and evaluate(),`
    + ' seeded so this line is reproducible\n');
  console.log(`    return to player   ${pct(sim.rtp)}   (${sim.returned.toLocaleString()} back`
    + ` on ${sim.staked.toLocaleString()} staked)`);
  console.log(`    hit frequency      ${pct(sim.hitFrequency)}`);
  console.log(`    biggest single win ${sim.best}x`);
  console.log(`    teases seen        ${sim.teases}\n`);

  check(R.rtp >= RTP_MIN && R.rtp <= RTP_MAX,
    `RTP ${pct(R.rtp)} is inside the ${pct(RTP_MIN)}–${pct(RTP_MAX)} the user asked for`);
  check(R.hitFrequency >= HIT_MIN && R.hitFrequency <= HIT_MAX,
    `hit frequency ${pct(R.hitFrequency)} is inside ${pct(HIT_MIN)}–${pct(HIT_MAX)}`
    + ' — a machine can hit the RTP band and still be dead');
  check(Math.abs(sim.rtp - R.rtp) < SIM_TOL,
    `the simulation agrees with the enumeration to within ${pct(SIM_TOL)}`
    + ` (${pct(Math.abs(sim.rtp - R.rtp))} apart) — the game plays the machine that was costed`);
  check(R.teases > 0 && R.teases >= 10 * R.rows[0].combos,
    `the strip produces near misses without being told to: ${R.teases} two-seven teases`
    + ` against ${R.rows[0].combos} jackpots, ${(R.teases / R.rows[0].combos).toFixed(0)}x as many`);

  // The short reel, asserted rather than described. This is the whole honest
  // near-miss mechanism and it is one number: if somebody levels the sevens
  // across the three reels the teases stop and nothing else goes red.
  const sevens = S.STRIPS.map((st) => st.filter((x) => x === 'SEVEN').length);
  check(sevens[2] < sevens[0] && sevens[2] < sevens[1],
    `reel 3 is the short reel — ${sevens.join(', ')} sevens across the three reels,`
    + ' which is where the tease comes from');

  // And that the tease is VISIBLE, not merely arithmetic: the lone seven on the
  // short reel must have a blank next to it, or it never slides past the line.
  const r3 = S.STRIPS[2], n3 = r3.length;
  const sevenIdx = r3.indexOf('SEVEN');
  const adjacentBlank = sevenIdx >= 0
    && (r3[(sevenIdx + n3 - 1) % n3] !== 'SEVEN' && r3[(sevenIdx + 1) % n3] !== 'SEVEN');
  check(adjacentBlank,
    'the short reel\'s seven has non-seven neighbours, so it is seen sliding past the payline');
}

if (mode === 'sessions' || mode === 'all') {
  // The shape of a sitting. An RTP says nothing about whether you get to play.
  const BANK = 100, CAP = 500, RUNS = 2000;
  let busted = 0, spinsTotal = 0, ahead = 0, peakSum = 0;
  const rng = lcg(0xC45170);
  for (let i = 0; i < RUNS; i++) {
    const s = session(S, BANK, CAP, rng);
    spinsTotal += s.spins; peakSum += s.peak;
    if (s.busted) busted++;
    if (s.ended > BANK) ahead++;
  }
  console.log(`  A SITTING — ${RUNS.toLocaleString()} runs, ${BANK} credits in,`
    + ` 1 a spin, walk away at ${CAP} spins\n`);
  console.log(`    median spins survived   ~${(spinsTotal / RUNS).toFixed(0)} of ${CAP}`);
  console.log(`    ran out before ${CAP}      ${pct(busted / RUNS)}`);
  console.log(`    still up when they stop ${pct(ahead / RUNS)}`);
  console.log(`    average high-water mark ${(peakSum / RUNS).toFixed(0)} credits\n`);

  check(spinsTotal / RUNS > 0.6 * CAP,
    `${BANK} credits lasts most of a ${CAP}-spin sitting`
    + ` (${(spinsTotal / RUNS).toFixed(0)} on average) — "sit and play a while"`);
  check(ahead / RUNS > 0.10,
    `${pct(ahead / RUNS)} of sittings end up on the day — "win sometimes"`);
  check(busted / RUNS < 0.60,
    `${pct(busted / RUNS)} of sittings run dry inside ${CAP} spins — a drift, not a cliff`);
}

console.log(bad === 0
  ? `\n  ${mode}: all checks pass. RTP ${pct(R.rtp)}, enumerated.\n`
  : `\n  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
