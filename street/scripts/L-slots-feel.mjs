#!/usr/bin/env node
// THE CLAIM: the reels stop ONE AT A TIME, LEFT TO RIGHT, with a real brake and
// a real clunk; the third reel is held back when it still matters; the payout
// counts up rather than appearing; and none of that depends on the frame rate.
//
// The user, on what high effort means here:
//
//   "THE FEEL IS MOST OF THE JOB and it is where high effort actually lands.
//    Reels that stop ONE AT A TIME, left to right - the stagger is what makes
//    the third reel matter, and stopping them together kills the whole thing.
//    Near misses that are HONEST, falling out of the real strip rather than
//    rigged in."
//
// Every one of those is a testable claim about ct/slots.ts and none of them
// needs a browser, because the game logic is dt-driven and draws nothing. That
// is the point of the boundary: the feel is the part you would normally only be
// able to check by looking, and here it is arithmetic.
//
// Named for its claim, not its subject (GOTCHAS §24). Its sibling
// `L-slots-rtp.mjs` asserts the maths; this one asserts the machine.
//
//   node scripts/L-slots-feel.mjs             the stagger, the brake, the ramp
//   node scripts/L-slots-feel.mjs honest      the money conserves, nothing is rigged
//   node scripts/L-slots-feel.mjs all
//   node scripts/L-slots-feel.mjs --selftest  break the machine nine ways, watch it go red
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 nothing measured.

import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
// Lets node resolve this project's extensionless relative imports. See the file.
register('./lib/L-ts-imports.mjs', import.meta.url);
const MODES = ['feel', 'honest', 'all', '--selftest'];
const mode = process.argv[2] ?? 'feel';
if (!MODES.includes(mode)) {
  console.error(`usage: node scripts/L-slots-feel.mjs [${MODES.join('|')}]`);
  process.exit(2);
}

// ── mutations ────────────────────────────────────────────────────────────────
//
// GOTCHAS §27. Each one breaks the MACHINE, not the check, and each is a
// mistake somebody could really make while tuning the feel. The first is the
// user's own words for the failure mode — "stopping them together kills the
// whole thing" — so it is the mutation this file exists for.
// Most of these move numbers in the real `FEEL` table, so the mutation reaches
// the real code path rather than a wrapper imitating a broken machine — see the
// note above `FEEL` in ct/slots.ts for why that table is exported at all.
const MUTATIONS = {
  // THE STAGGER COLLAPSES. Reels can rest only at moments one revolution apart,
  // so making a revolution almost instant collapses every reel onto its
  // earliest allowed time — and dropping the gap to zero makes that time the
  // same for all three. This is the user's own failure mode: "stopping them
  // together kills the whole thing."
  together: (S) => { S.FEEL.spinSpeed = 2000; S.FEEL.gapMin = 0; },
  // THE BRAKE GOES. The reel free-runs at full speed until a millisecond before
  // its detent and then snaps onto it.
  'no-brake': (S) => { S.FEEL.brakeT = 0.001; },
  // THE CLUNK GOES. It rests dead on the detent with no overshoot.
  'no-clunk': (S) => { S.FEEL.bounce = 0; },
  // THE ANTICIPATION GOES. A live spin paces exactly like a dead one.
  'no-hold': (S) => { S.FEEL.hold = 0; },
  // THE PAYOUT APPEARS instead of counting up.
  'instant-pay': (S) => { S.FEEL.payMin = 1e7; S.FEEL.payMax = 1e7; },
  // LEFT TO RIGHT BECOMES RIGHT TO LEFT. Not a constant — it is what a
  // rendering mistake looks like, so it is applied where a rendering mistake
  // would land: on what the player is shown.
  backwards: (S) => {
    const real = S.createMachine;
    S.createMachine = (o) => {
      const m = real(o), view = m.view;
      return { ...m, view: () => { const v = view(); return { ...v, reels: [...v.reels].reverse() }; } };
    };
  },
  // THE CLOCK BET COMES BACK. This is the bug that was actually in this file —
  // `tick` clamped dt to 0.05 the way main.ts:107 clamps the world's, so at
  // 15 fps the machine ran at 75% speed. It is a mutation now so it cannot
  // return unnoticed (GOTCHAS §30, §43).
  'clamped-dt': (S) => {
    const real = S.createMachine;
    S.createMachine = (o) => {
      const m = real(o), tick = m.tick;
      return { ...m, tick: (dt) => tick(Math.min(dt, 0.05)) };
    };
  },
  // THE ONE THAT MATTERS MOST: the machine looks at what reels 1 and 2 did and
  // steers the spin away from the jackpot. That is the dishonest machine the
  // anticipation is carefully NOT, and it is INVISIBLE to the RTP script —
  // it only bites on 4 combinations in 10,648, well inside sampling noise.
  // Only a check that plays a scripted jackpot can see it.
  //
  // It steers the THIRD DRAW on the strength of the first two, which is the
  // precise mechanism, and it is applied to the random source rather than to
  // the outcome — a rig that re-rolls a finished spin is not what a rigged
  // machine does and, as written first, was not even that: it called `play()` a
  // second time, hit the "already spinning" guard, and changed nothing. It
  // certified as CAUGHT-proof while doing nothing at all. A mutation that does
  // not break the thing looks exactly like a check that works (GOTCHAS §27), and
  // this one was the mutation, not the check.
  rigged: (S) => {
    const real = S.createMachine;
    S.createMachine = (o = {}) => {
      const base = o.rng ?? Math.random;
      let n = 0, s0 = 0, s1 = 0;
      const steer = () => {
        const v = base();
        const stop = Math.min(S.STOPS - 1, Math.floor(v * S.STOPS));
        const i = n++ % 3;
        if (i === 0) { s0 = stop; return v; }
        if (i === 1) { s1 = stop; return v; }
        if (S.symAt(0, s0) === 'SEVEN' && S.symAt(1, s1) === 'SEVEN' && S.symAt(2, stop) === 'SEVEN') {
          return (((stop + 1) % S.STOPS) + 0.5) / S.STOPS;      // anything but the jackpot
        }
        return v;
      };
      return real({ ...o, rng: steer });
    };
  },
  // CREDITS LEAK on the way out of the machine.
  'leaky-cashout': (S) => {
    const real = S.createMachine;
    S.createMachine = (o) => {
      const m = real(o), cashOut = m.cashOut;
      return { ...m, cashOut: () => Math.max(0, cashOut() - 1) };
    };
  },
};

let S;
try {
  S = { ...await import('../src/proto/ct/slots.ts') };
} catch (e) {
  console.error(`ABORTED: could not load ct/slots.ts — ${e.message}`);
  process.exit(3);
}

if (process.env.L_SLOTS_MUTATE) {
  const m = MUTATIONS[process.env.L_SLOTS_MUTATE];
  if (!m) { console.error(`ABORTED: no mutation "${process.env.L_SLOTS_MUTATE}"`); process.exit(3); }
  m(S);
  console.log(`  [MUTATED: ${process.env.L_SLOTS_MUTATE}] — this run is expected to FAIL\n`);
}

if (mode === '--selftest') {
  let slept = 0;
  const names = Object.keys(MUTATIONS);
  for (const name of names) {
    let code = 0, out = '';
    try {
      out = execFileSync(process.execPath, [SELF, 'all'], {
        env: { ...process.env, L_SLOTS_MUTATE: name }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout ?? ''}${e.stderr ?? ''}`; }
    const failed = (out.match(/^FAIL/gm) ?? []).length;
    const caught = code === 1 && failed > 0;      // exit 3 is NOT a catch, GOTCHAS §32
    if (!caught) slept++;
    console.log(`${caught ? 'CAUGHT ' : 'SLEPT  '} ${name.padEnd(14)} exit=${code} fails=${failed}`);
  }
  console.log(slept === 0
    ? `\n  selftest: ${names.length} / ${names.length} CAUGHT. The check can fail.\n`
    : `\n  selftest: ${slept} mutation(s) SLEPT — the check passed a broken machine.\n`);
  process.exit(slept === 0 ? 0 : 2);
}

if (!S.createMachine) {
  console.error('ABORTED: ct/slots.ts publishes no createMachine — every verdict below is free.');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

/** Deterministic rng that yields a scripted sequence of STOPS, then repeats. */
const scripted = (stops) => {
  let i = 0;
  return () => { const s = stops[i++ % stops.length]; return (s + 0.5) / S.STOPS; };
};
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/** Find the index of a symbol on a reel — by SEARCHING, never by a typed index.
 *  The prose in ct/slots.ts named four strip positions and every one was off by
 *  one; the claims were true and the addresses were not. A check that looks the
 *  symbol up cannot inherit that mistake. */
const idxOf = (reel, sym) => S.STRIPS[reel].indexOf(sym);

/**
 * Play one spin to completion at a fixed frame rate and record everything that
 * happened, frame by frame.
 *
 * Stepping by dt rather than sleeping is the whole reason this check is
 * trustworthy under load (GOTCHAS §30): there is no wall clock anywhere in it,
 * so a busy machine cannot change a single number it reports.
 */
const runSpin = (m, fps = 60, maxT = 30) => {
  const dt = 1 / fps;
  const frames = [];
  let t = 0;
  const settled = [null, null, null];
  let namedAt = null, payStart = null, payEnd = null;
  const before = m.view();
  m.play();
  let prev = m.view();
  while (t < maxT) {
    m.tick(dt); t += dt;
    const v = m.view();
    frames.push({ t, pos: v.reels.map((r) => r.pos), phase: v.reels.map((r) => r.phase),
      teasing: v.reels.map((r) => r.teasing), state: v.state, paid: v.paid, credits: v.credits });
    for (let i = 0; i < 3; i++) {
      if (settled[i] === null && prev.reels[i].phase !== 'stopped' && v.reels[i].phase === 'stopped') settled[i] = t;
    }
    if (namedAt === null && v.win) namedAt = t;
    if (payStart === null && v.state === 'paying') payStart = t;
    if (payStart !== null && payEnd === null && v.state !== 'paying') payEnd = t;
    if (v.state === 'idle' && settled.every((s) => s !== null)) break;
    prev = v;
  }
  const v = m.view();
  return { frames, settled, namedAt, payStart, payEnd, before, after: v,
    stops: v.reels.map((r) => r.stop), win: v.win, t };
};

console.log('\nSEVENS — the machine, not the maths. Stepped by dt; no wall clock anywhere.\n');

if (mode === 'feel' || mode === 'all') {
  // ── the stagger ────────────────────────────────────────────────────────────
  //
  // Driven on a dead spin (three blanks) so nothing about the anticipation is
  // in the measurement — the stagger has to be there on EVERY spin, and a
  // check that only ever looks at exciting ones would miss it going.
  const dead = [idxOf(0, 'BLANK'), idxOf(1, 'BLANK'), idxOf(2, 'BLANK')];
  const m = S.createMachine({ rng: scripted(dead) });
  m.insert(100);
  const r = runSpin(m);

  console.log('  ONE AT A TIME, LEFT TO RIGHT   (a dead spin — no anticipation in this)\n');
  for (let i = 0; i < 3; i++) {
    console.log(`    reel ${i + 1} came to rest at ${r.settled[i].toFixed(2)} s`
      + `   stop ${String(r.stops[i]).padStart(2)}  ${S.SYM_NAME[S.symAt(i, r.stops[i])] || 'blank'}`);
  }
  const gaps = [r.settled[1] - r.settled[0], r.settled[2] - r.settled[1]];
  console.log(`    gaps between them  ${gaps.map((g) => `${g.toFixed(2)} s`).join('   ')}\n`);

  check(r.settled[0] < r.settled[1] && r.settled[1] < r.settled[2],
    'the reels stop LEFT TO RIGHT — reel 1, then 2, then 3, strictly in order');
  check(gaps.every((g) => g > 0.4),
    `each reel waits ${gaps.map((g) => g.toFixed(2)).join(' and ')} s for the one before it`
    + ' — "stopping them together kills the whole thing"');

  // ── the brake and the clunk ────────────────────────────────────────────────
  //
  // A reel that teleports onto its stop has a stagger and no feel. Measure the
  // SPEED over the spin: it has to be high in the middle and near zero at rest,
  // with the last stretch visibly slower than the free run.
  const speedsOf = (i) => {
    const out = [];
    for (let k = 1; k < r.frames.length; k++) {
      const dt = r.frames[k].t - r.frames[k - 1].t;
      out.push({ t: r.frames[k].t, v: (r.frames[k].pos[i] - r.frames[k - 1].pos[i]) / dt });
    }
    return out;
  };
  const sp0 = speedsOf(0);
  const free = Math.max(...sp0.map((s) => s.v));
  // MEASURED INSIDE THE BRAKING PHASE, not "in the last tenth of a second".
  //
  // The first version took the slowest speed in the 0.1 s before the reel came
  // to rest and got -1.9 stops/s, which is a fine number and the wrong one: that
  // window is the CLUNK, where the reel is being pulled BACK onto its detent, so
  // the speed is negative and the assertion `slowest < free * 0.35` passed
  // trivially — it would have passed on a reel with no brake at all, because the
  // clunk is what it was reading. It was going to let the `no-brake` mutation
  // through. GOTCHAS §34's shape: a verdict satisfied by something other than
  // the thing it names.
  const braking = sp0.filter((s, k) => r.frames[k + 1].phase[0] === 'braking');
  const tail = braking.slice(Math.floor(braking.length * 0.75));
  const slowest = tail.length ? Math.max(...tail.map((s) => s.v)) : free;
  const travel = r.frames.at(-1).pos[0] - 0;
  console.log('  THE BRAKE, AND THE CLUNK\n');
  console.log(`    free speed              ${free.toFixed(1)} stops/s`);
  console.log(`    frames spent braking    ${braking.length}`);
  console.log(`    speed in its last qtr   ${slowest.toFixed(1)} stops/s`);
  console.log(`    reel 1 travelled        ${travel.toFixed(1)} stops before resting\n`);

  check(free > 15, `the reel really spins — ${free.toFixed(1)} stops/s at full speed`);
  check(braking.length >= 10,
    `there IS a braking phase to measure — ${braking.length} frames of it`
    + ' (every verdict below is free at zero)');
  check(slowest < free * 0.35,
    `it BRAKES into its stop — down to ${slowest.toFixed(1)} stops/s by the end of the brake,`
    + ` ${(slowest / free * 100).toFixed(0)}% of free speed, not a snap`);
  check(travel > 8, `it travels ${travel.toFixed(1)} stops, so the spin is watched rather than blinked`);

  // The clunk: position must overshoot its final rest and come back. Measured
  // as "the maximum position reached exceeds where it ended up".
  const restPos = r.frames.at(-1).pos[0];
  const peak = Math.max(...r.frames.map((f) => f.pos[0]));
  console.log(`    overshoot at the detent ${(peak - restPos).toFixed(3)} stops,`
    + ' then pulled back — a mechanical reel does not stop dead\n');
  check(peak > restPos + 0.02 && peak < restPos + 0.5,
    `the reel overshoots its detent by ${(peak - restPos).toFixed(3)} of a stop and settles back`);

  // ── the anticipation ───────────────────────────────────────────────────────
  //
  // Two spins, identical in every way except what reels 1 and 2 landed on. The
  // live one must take LONGER on the third reel, and the third reel must
  // visibly crawl rather than simply starting later.
  const sevenLive = [idxOf(0, 'SEVEN'), idxOf(1, 'SEVEN'), idxOf(2, 'BLANK')];
  const mLive = S.createMachine({ rng: scripted(sevenLive) });
  mLive.insert(100);
  const live = runSpin(mLive);
  const held = live.frames.filter((f) => f.teasing[2]).length;

  console.log('  THE ANTICIPATION   (same machine, same everything but what reels 1 and 2 did)\n');
  console.log(`    dead spin, reel 3 rests at   ${r.settled[2].toFixed(2)} s`);
  console.log(`    SEVEN SEVEN ? , reel 3 at    ${live.settled[2].toFixed(2)} s`
    + `   (+${(live.settled[2] - r.settled[2]).toFixed(2)} s)`);
  console.log(`    frames spent crawling        ${held}\n`);

  // The same three targets, played twice, with the anticipation the ONLY
  // difference — reel 3 held or not. Comparing a seven spin against a blank
  // spin would have compared two different sets of stops: a reel's rest time
  // depends on how far it has to travel, so those two runs differ for a second
  // reason and the measurement would not be of the hold at all.
  const noHoldRef = (() => {
    const keep = S.FEEL.hold; S.FEEL.hold = 0;
    const mm = S.createMachine({ rng: scripted(sevenLive) }); mm.insert(100);
    const out = runSpin(mm); S.FEEL.hold = keep; return out;
  })();
  console.log(`    the same SEVEN SEVEN ? spin with the hold off  ${noHoldRef.settled[2].toFixed(2)} s\n`);

  check(live.settled[2] > noHoldRef.settled[2] + 0.6,
    `reel 3 is held ${(live.settled[2] - noHoldRef.settled[2]).toFixed(2)} s longer when it still matters`
    + ' — measured against the SAME spin with the hold off, not against a different one');
  check(held > 20, `and it CRAWLS while it is held (${held} frames), so the tease is watched`);
  check(live.settled[0] === noHoldRef.settled[0] && live.settled[1] === noHoldRef.settled[1],
    'reels 1 and 2 rest at the identical moment either way — a pause before reel 1'
    + ' is a hitch in the machine, not a tease');
  check(live.frames.every((f) => !f.teasing[0] && !f.teasing[1]),
    'and neither of them ever crawls');

  // EVERY live spin, not one scripted one.
  //
  // This exists because a twenty-spin playtest in the world reported the hold
  // never firing, on three spins that were live — and the machine was right and
  // the playtest was wrong. It sampled `teasing` at the instant reel 2 came to
  // rest, and the crawl starts a MEDIAN 0.38 s after that (up to 0.81 s, because
  // reel 3 can only rest at moments one revolution apart and may take an extra
  // turn). One sample at a boundary measured nothing, which is GOTCHAS §48's
  // stride problem in time rather than in space.
  //
  // A single scripted spin could never have caught that either. So: play three
  // thousand real spins, and require the crawl on every live one and on no dead
  // one.
  {
    const mm = S.createMachine({ rng: lcg(99) });
    mm.insert(1_000_000);
    let liveN = 0, heldN = 0, falseN = 0;
    for (let n = 0; n < 3000; n++) {
      mm.play();
      const wasLive = S.isLive(mm.view().reels.map((r) => r.stop));
      let saw = false;
      while (mm.view().state === 'spinning') { mm.tick(1 / 120); if (mm.view().reels[2].teasing) saw = true; }
      while (mm.view().state !== 'idle') mm.tick(1 / 120);
      if (wasLive) { liveN++; if (saw) heldN++; } else if (saw) falseN++;
    }
    console.log(`    across 3,000 spins: ${liveN} live, reel 3 crawled on ${heldN};`
      + ` ${falseN} dead spins teased\n`);
    check(liveN > 300, `${liveN} live spins in 3,000 — the population this rests on`);
    check(heldN === liveN, `reel 3 is held on EVERY live spin (${heldN}/${liveN}), not most`);
    check(falseN === 0, `and never on a dead one (${falseN}) — the tease is not decoration`);
  }

  // ── the payout counts up ───────────────────────────────────────────────────
  const jack = [idxOf(0, 'SEVEN'), idxOf(1, 'SEVEN'), idxOf(2, 'SEVEN')];
  const mJack = S.createMachine({ rng: scripted(jack) });
  mJack.insert(100);
  const jr = runSpin(mJack);
  const payFrames = jr.frames.filter((f) => f.state === 'paying').length;
  const payDur = (jr.payEnd ?? 0) - (jr.payStart ?? 0);
  const cherry = [idxOf(0, 'CHERRY'), idxOf(1, 'BLANK'), idxOf(2, 'BLANK')];
  const mCh = S.createMachine({ rng: scripted(cherry) });
  mCh.insert(100);
  const cr = runSpin(mCh);
  const chFrames = cr.frames.filter((f) => f.state === 'paying').length;

  console.log('  THE PAYOUT COUNTS UP\n');
  console.log(`    3 SEVENS, 250 credits   ${payDur.toFixed(2)} s over ${payFrames} frames`);
  console.log(`    1 CHERRY, 2 credits     ${((cr.payEnd ?? 0) - (cr.payStart ?? 0)).toFixed(2)} s`
    + ` over ${chFrames} frames\n`);

  check(payFrames > 30 && payDur > 0.5,
    `the jackpot takes ${payDur.toFixed(2)} s to pay — it counts, it does not appear`);
  check(payDur < 6, `and it does not outstay itself (${payDur.toFixed(2)} s)`);
  check(chFrames >= 1 && chFrames < payFrames,
    'a two-credit cherry pays faster than a 250 — the ramp scales with the win');
  check(jr.namedAt !== null && jr.namedAt >= jr.settled[2] - 1 / 60,
    'the win is not NAMED until the third reel has settled — the third reel has to matter');

  // ── frame rate independence ────────────────────────────────────────────────
  //
  // GOTCHAS §30 and §43 are the two halves of this project's clock problem, and
  // a machine driven by dt is immune to both by construction. Immune by
  // construction is a claim, so it gets measured: the same scripted spin at
  // 60 fps and at 15 fps must land on the same stops at close to the same time.
  const at = (fps) => {
    const mm = S.createMachine({ rng: scripted(dead) });
    mm.insert(100);
    return runSpin(mm, fps);
  };
  const fast = at(60), slow = at(15);
  console.log('  THE SAME MACHINE AT ANY FRAME RATE\n');
  console.log(`    60 fps   reel 3 rests at ${fast.settled[2].toFixed(2)} s   stops ${fast.stops.join(',')}`);
  console.log(`    15 fps   reel 3 rests at ${slow.settled[2].toFixed(2)} s   stops ${slow.stops.join(',')}\n`);
  check(fast.stops.join() === slow.stops.join(),
    'a slow machine lands on the same symbols — the outcome is not a frame-rate bet');
  check(Math.abs(fast.settled[2] - slow.settled[2]) < 0.25,
    `and at the same moment, within ${Math.abs(fast.settled[2] - slow.settled[2]).toFixed(2)} s`
    + ' — dt-driven, not setTimeout-driven');
}

if (mode === 'honest' || mode === 'all') {
  console.log('  THE MONEY CONSERVES, AND NOTHING IS RIGGED\n');

  // ── no credit is created or destroyed ──────────────────────────────────────
  //
  // The single invariant that stops this becoming a second wallet: over any
  // sitting, what you walk away with equals what you put in, less what you
  // staked, plus what you were paid. Played long enough to hit every branch.
  const m = S.createMachine({ rng: lcg(0xA5107) });
  const IN = 200_000;
  m.insert(IN);
  let spins = 0;
  // Stepped at a quarter of a second rather than a sixtieth, which is not a
  // shortcut — it is the frame-rate independence proved two blocks up, being
  // used. A schedule-driven reel gives the same answer at any dt, so 40,000
  // spins cost 15 ticks each instead of 200.
  //
  // The spin count is not arbitrary either. At 2,519 spins this test read
  // 73.84% against an enumerated 92.83% and I nearly went looking for the bug:
  // the standard error on a machine whose top prize is 250x is about 7.6 points
  // over that many spins, and a sitting that happens to miss both 1-in-2,662
  // lines is 13 points light on its own. 40,000 brings it to 2.2 points, so a
  // 5-point tolerance is a real assertion rather than a coin toss. GOTCHAS §29's
  // lesson in a different currency: say what the number describes, and compare
  // it against the right thing.
  for (let n = 0; n < 2_000_000 && spins < 40_000; n++) {
    if (m.view().state === 'idle' && m.play()) spins++;
    m.tick(0.25);
  }
  while (!m.settled()) m.tick(0.25);
  const v = m.view();
  const out = m.cashOut();
  console.log(`    ${spins.toLocaleString()} spins   in ${IN}   staked ${v.staked}`
    + `   returned ${v.returned}   cashed out ${out}`);
  console.log(`    in - staked + returned = ${IN - v.staked + v.returned}\n`);
  check(out === IN - v.staked + v.returned,
    'every credit is accounted for — nothing is created and nothing leaks');
  check(m.cashOut() === 0 && m.view().credits === 0,
    'cashing out twice pays nothing the second time — the meter really empties');

  const rtp = v.returned / v.staked;
  console.log(`    return over those ${spins.toLocaleString()} spins   ${(rtp * 100).toFixed(2)}%`
    + `   (the tin says ${(S.exactRTP().rtp * 100).toFixed(3)}%)\n`);
  check(Math.abs(rtp - S.exactRTP().rtp) < 0.05,
    `the machine as PLAYED returns ${(rtp * 100).toFixed(2)}%, matching the enumerated`
    + ` ${(S.exactRTP().rtp * 100).toFixed(2)}% — the game is the machine that was costed`);

  // ── you can always walk away with what is on the meter ─────────────────────
  const m2 = S.createMachine({ rng: lcg(7) });
  m2.insert(50);
  m2.play();
  m2.tick(1 / 60);                       // stand up mid-spin, reels still turning
  const back = m2.cashOut();
  console.log(`    stood up mid-spin with 50 in, 1 staked   ->  ${back} back\n`);
  check(back === 49,
    'standing up mid-spin returns the meter — you cannot be trapped in a spin,'
    + ' and the credit already staked is gone exactly as on a real machine');

  // ── the jackpot is not steered away from ───────────────────────────────────
  //
  // The dishonest machine draws reel 3 LATE, sees two sevens, and picks
  // something else. It would be invisible to the RTP script — it only bites on
  // 4 combinations in 10,648 — so it is measured here, by playing a scripted
  // jackpot and requiring the machine to actually pay it.
  const jack = [idxOf(0, 'SEVEN'), idxOf(1, 'SEVEN'), idxOf(2, 'SEVEN')];
  const mj = S.createMachine({ rng: scripted(jack) });
  mj.insert(10);
  const jr = runSpin(mj);
  check(jr.win?.line === '3 SEVENS' && jr.win.pays === 250,
    'a spin whose three stops ARE three sevens pays 3 SEVENS — the third reel is'
    + ' drawn with the other two, not after them');

  // And the honest tease, asserted by finding the symbol rather than trusting a
  // typed index — the four indices in the prose were all one out.
  const r3 = S.STRIPS[2], n3 = r3.length, si = r3.indexOf('SEVEN');
  const nbr = [r3[(si + n3 - 1) % n3], r3[(si + 1) % n3]];
  const b3 = r3.indexOf('BAR3');
  console.log(`    reel 3's lone SEVEN sits at ${si}, between ${nbr.join(' and ')}`);
  console.log(`    its TRIPLE BAR at ${b3}, under a ${r3[(b3 + n3 - 1) % n3]}\n`);
  check(nbr.every((s) => s !== 'SEVEN'),
    `the tease is a fact about the strip: the short reel's seven has non-seven`
    + ' neighbours, so you watch it slide past the line');
  check(S.isBar(r3[(b3 + n3 - 1) % n3]) && r3[(b3 + n3 - 1) % n3] !== 'BAR3',
    'and the frequent tease is real too — a lesser bar sits directly above the'
    + ' triple bar, so TRIPLE TRIPLE BAR drops from 100 to 5 by one position');
}

console.log(bad === 0
  ? `\n  ${mode}: all checks pass.\n`
  : `\n  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
