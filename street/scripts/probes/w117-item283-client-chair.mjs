// ITEM 283 — DOES THE BANK'S CLIENT CHAIR OFFER THE LOAN WHILE YOU ARE SITTING?
//
// The user asked for this chair by name: *"the load application process should
// also be like atm and whatnot. you sit and its the loan process as an
// integrated overlay."* Item 188 built the seated `[E]` that makes it possible.
// Worker onehundredseven found it dead there anyway.
//
// THE DEFECT, and it is a relationship rather than a value. `crosstown.ts`
// latches `landing` when an act moves the player more than LATCH_ARM (1.0 m),
// and discharges it only when the player has WALKED LATCH_CLEAR (1.2 m) away.
// `fp.ts`'s seated branch returns before movement is integrated, so a seated
// player's x/z never changes — a latch armed by sitting down can never
// discharge, and `canSee` is false for every spot in the world until you stand.
// `ctx.seat`'s `approach` is what arms it: the client chair is taken from its
// right (`ct/int-bank.ts:1421`) so the player does not stand on the loan
// officer, and `hypot(1.10, 0.25) = 1.13 m` clears LATCH_ARM by 13 cm.
//
// WHY ITEM 188's OWN SWEEP CANNOT SEE THIS, which is the part worth keeping.
// `scripts/probes/w69-seated-offers.mjs` seats the player with `__ct.sit()` — a
// direct call on the rig, deliberately, because reachability is another check's
// question. `landing` is armed in the `[E]` DISPATCH, which that path never
// enters. So item 188's contract was measured on a route no player takes, and
// w69 still reads green with this bug fully present. THIS probe sits the only
// way a player can: standing on the approach, pressing E.
//
// TURNING THE HEAD. A seated player keeps their head — `fp.ts` applies mouse
// deltas BEFORE its seated branch — so the sweep re-aims with
// `__ct.warp(seat.x, seat.z, yaw)`, which sets yaw and leaves `this.seat`
// alone. Warping to the seat's OWN coordinates moves the player 0 m, so it
// cannot discharge a latch by accident; the broken world stays broken under it,
// which is what makes `--expect-broken` honest.
//
// SELF-TEST BOTH SIGNS. `--expect-broken` inverts the verdict, so this same
// file proves the check fails on the unfixed world:
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w117-item283-client-chair.mjs
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w117-item283-client-chair.mjs --expect-broken
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4190/');
const EXPECT_BROKEN = process.argv.includes('--expect-broken');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

// BUILDER-BRIEF §5: a HELD key. `press()` can begin and end inside one frame and
// the [E] dispatch is an edge read once per RENDERED frame.
const tap = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(120);
  await p.keyboard.up(k); await p.waitForTimeout(260);
};
const promptNow = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});
const state = () => p.evaluate(() => {
  const q = window.__ct.pos();
  return {
    seated: !!window.__ct.seated(), landing: window.__ct.landing(),
    x: q[0], z: q[2], panel: window.__hud?.panel?.() ?? null,
  };
});

const fails = [];
const note = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`); if (!ok) fails.push(msg); };

// POPULATION FLOOR, GOTCHAS 71 — "no seat is trapped" is free over an empty set.
const seats = await p.evaluate(() => (window.__ct.seats() || []).map((s, i) => ({
  i, label: s.label, x: s.pose.x, z: s.pose.z, yaw: s.pose.yaw,
  ax: s.at.x, az: s.at.z,
  hop: Math.hypot(s.pose.x - s.at.x, s.pose.z - s.at.z),
})));
console.log(`\n${seats.length} seats registered`);
if (seats.length < 200) {
  console.log(`REFUSING TO REPORT: only ${seats.length} seats visible`);
  await b.close(); process.exit(3);
}

// The at-risk population, DERIVED from the world's own geometry rather than
// from a list typed here: every seat whose approach is further from its pose
// than the arm threshold. Those are the ones that can arm the latch by sitting.
const ARM = 1.0;                       // crosstown.ts's LATCH_ARM
const atRisk = seats.filter((s) => s.hop > ARM);
console.log(`${atRisk.length} of them move you more than ${ARM} m when you sit — the at-risk set:`);
for (const s of atRisk) console.log(`   "${s.label}"  hop ${s.hop.toFixed(2)} m  @ ${s.x.toFixed(2)},${s.z.toFixed(2)}`);
note(atRisk.length > 0, `the at-risk set is non-empty (${atRisk.length}) — otherwise this check measures nothing`);

// ── every at-risk seat, sat the way a player sits: stand on the approach and
//    press E. The facing is derived from approach->pose, never typed.
console.log('\nsitting on each at-risk seat through the [E] DISPATCH (not __ct.sit):');
await p.evaluate(() => window.__ct.clock(10, 0));    // the loan desk takes applications nine to four
for (const s of atRisk) {
  await p.evaluate(() => { window.__ct.stand(); });
  const yaw = Math.atan2(s.x - s.ax, -(s.z - s.az));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [s.ax, s.az, yaw]);
  await waitPainted(p, { frames: 6 });
  const offered = await promptNow();
  if (!/\[E\]/.test(offered ?? '')) {
    note(false, `"${s.label}": nothing offered from its own approach — got ${JSON.stringify(offered)}`);
    continue;
  }
  await tap('e');
  await waitPainted(p, { frames: 6 });
  const sat = await state();
  note(sat.seated, `"${s.label}": [E] on the approach seated the player`);
  note(sat.landing === null,
    `"${s.label}": the arrival latch is CLEAR while seated — landing=${JSON.stringify(sat.landing)}`);
  console.log(`          seated prompt: ${JSON.stringify(await promptNow())}`);
  await p.evaluate(() => window.__ct.stand());
}

// ── THE USER'S CHAIR, IN FULL: sit in it, and look for the loan ─────────────
const chair = seats.find((s) => /client chair/i.test(s.label));
note(!!chair, 'the bank publishes a client chair');
if (chair) {
  console.log(`\nthe bank's client chair @ ${chair.x.toFixed(2)},${chair.z.toFixed(2)} (hop ${chair.hop.toFixed(2)} m)`);
  await p.evaluate(() => window.__ct.stand());
  const yaw0 = Math.atan2(chair.x - chair.ax, -(chair.z - chair.az));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [chair.ax, chair.az, yaw0]);
  await waitPainted(p, { frames: 6 });
  await tap('e');
  await waitPainted(p, { frames: 6 });
  note((await state()).seated, 'you are sitting in it');

  // Sweep the head the way a player would, and record every distinct offer,
  // rather than asserting that one hand-picked yaw is the right one.
  const found = new Map();
  for (let d = -100; d <= 100; d += 4) {
    await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y), [chair.x, chair.z, chair.yaw + (d * Math.PI) / 180]);
    await waitPainted(p, { frames: 2 });
    const t = await promptNow();
    const m = /\[E\]\s*([^·]+?)\s*(?:·|$)/.exec(t ?? '');
    if (m && !/stand up/i.test(m[1])) {
      const e = found.get(m[1]) ?? { lo: d, hi: d, n: 0 };
      e.lo = Math.min(e.lo, d); e.hi = Math.max(e.hi, d); e.n++;
      found.set(m[1], e);
    }
  }
  console.log('  offers reachable by turning your head in the chair (0° = the way the seat faces):');
  for (const [label, e] of found) {
    console.log(`     ${String(e.lo).padStart(4)}° … ${String(e.hi).padStart(4)}°  (${e.n} samples)  "${label}"`);
  }
  if (!found.size) console.log('     (none)');
  note(found.size > 0, 'something other than standing up is on offer from the client chair');
  const loan = [...found.keys()].find((l) => /loan|application/i.test(l));
  note(!!loan, `the LOAN is among them — "${loan ?? 'nothing matched /loan|application/'}"`);

  // and it must actually open, while seated, and let you back out.
  if (loan) {
    const e = found.get(loan);
    const deg = Math.round((e.lo + e.hi) / 2);      // the middle of the band, not its edge
    await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y), [chair.x, chair.z, chair.yaw + (deg * Math.PI) / 180]);
    await waitPainted(p, { frames: 3 });
    await tap('e');
    await waitPainted(p, { frames: 6 });
    const open = await state();
    note(!!open.panel, `pressing [E] while seated opened a panel — ${JSON.stringify(open.panel)}`);
    note(open.seated, 'and it did NOT eject you from the chair');
    // BUILDER-BRIEF §11: a panel you cannot close is the worst bug this ships.
    await tap('Escape');
    await waitPainted(p, { frames: 6 });
    const shut = await state();
    note(!shut.panel, `[ESC] closed it — panel=${JSON.stringify(shut.panel)}`);
    const after = await promptNow();
    note(!shut.seated || /\[E\]/.test(after ?? ''),
      `and you are not stranded — seated=${shut.seated} prompt=${JSON.stringify(after)}`);
  }

  // STANDING UP MUST STILL WORK, and must not leave a latch behind either.
  await p.evaluate(() => window.__ct.stand());
  await waitPainted(p, { frames: 6 });
  const up = await state();
  note(!up.seated, 'and you can get back up');
  note(up.landing === null, `standing up leaves no latch behind — landing=${JSON.stringify(up.landing)}`);
}

// ── AND THE LATCH MUST STILL ARM ON A REAL TRANSITION ───────────────────────
//
// REFUSING THE EASY GREEN. Deleting the latch outright passes every assertion
// above and re-opens the yo-yo it exists to stop — *"im literally stuck here"*,
// GOTCHAS' own history for `landing`. So the fix has to be shown to be narrow:
// a DOOR, which moves you hundreds of metres, must still latch.
console.log('\nthe latch still arms on a real transition (a door):');
// READ THE SPOT LIST FROM THE STREET, NOT FROM INSIDE THE BANK. `spots()`
// evaluates every `ok()` at call time, and a street door's `ok` is false while
// the player is standing in a room — so the first cut of this leg read "0 open
// street doors" and failed on its own vantage rather than on the world. Warp
// out to the spawn's storey first. (GOTCHAS 50, in miniature.)
await p.evaluate(() => window.__ct.stand());
await p.evaluate(() => window.__ct.warp(0, 0, 0, 0, 0));
await waitPainted(p, { frames: 6 });
const doors = await p.evaluate(() => (window.__ct.spots() || [])
  .filter((s) => /^into /.test(s.label ?? '') && s.ok)
  .map((s) => ({ x: s.x, z: s.z, r: s.r, label: s.label })));
console.log(`  ${doors.length} open street doors`);
note(doors.length > 0, 'there is at least one door to test the latch with');
let armed = 0;
for (const d of doors.slice(0, 5)) {
  await p.evaluate(() => window.__ct.stand());
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [d.x, d.z]);
  await waitPainted(p, { frames: 6 });
  if (!/\[E\]/.test((await promptNow()) ?? '')) continue;
  const from = await state();
  await tap('e');
  await waitPainted(p, { frames: 8 });
  const to = await state();
  const moved = Math.hypot(to.x - from.x, to.z - from.z);
  if (moved <= ARM) continue;           // not a transition; nothing to assert
  armed++;
  note(to.landing !== null,
    `"${d.label}" moved you ${moved.toFixed(1)} m and DID latch — landing=${JSON.stringify(to.landing)}`);
}
note(armed > 0, `at least one door actually transitioned (${armed}) — otherwise this leg measured nothing`);

if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 5).join('\n')}`);
console.log(`\n${fails.length} failing assertion(s)`);
for (const f of fails) console.log(`   ${f}`);
await b.close();

if (EXPECT_BROKEN) {
  if (fails.length === 0) { console.log('\nSELF-TEST FAILED: expected a broken world, everything passed'); process.exit(1); }
  console.log('\nSELF-TEST OK — the check FAILS on the broken world, as it must');
  process.exit(0);
}
if (fails.length) { console.log('\nFAIL — item 283 is not satisfied'); process.exit(1); }
console.log('\nok — the client chair offers the loan while you are sitting in it');
