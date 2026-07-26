// VERIFYING L's slots — I did not build it, so I may.
//
// L's row enumerates its own maths exhaustively: RTP 92.834% by exact
// enumeration of all 10,648 stop combinations, cross-checked against a
// 100,000-spin simulation that agrees to 0.391%, plus reel rest times measured
// over 539 live spins. Re-running any of that teaches nobody anything.
//
// So this tests the two things an OUTSIDER can settle that L's own harness
// cannot, because both need somebody else's code:
//
//   1. THE ASK ITSELF — *"when i sit down i enter the slots"*. Not "an [E]
//      offers it": that it opens BECAUSE YOU SAT, on one press and no second
//      key. That is the user's sentence and it is the whole feature.
//   2. NO SECOND WALLET — read the money through N's TENANCY module, which is
//      a different builder's code reading the same purse. M's loan row was
//      verified this way off A's ATM and it is the right shape: a second
//      wallet agrees with itself and disagrees with everybody else.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-verify-L-slots.mjs
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);

let bad = 0, n = 0;
const ok = (c, m) => { n++; console.log(`${c ? 'OK  ' : 'NO  '} ${m}`); if (!c) bad++; };

// ── population first (GOTCHAS 34) ─────────────────────────────────────────
const stools = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /sit at the slot/i.test(s.label ?? '')).length);
console.log(`stools registered: ${stools}`);
if (!stools) { console.error('ABORT: no slot stools — nothing below measures L\'s work'); await b.close(); process.exit(3); }
ok(stools >= 24, `there is a FLOOR of them, not one machine — ${stools} stools`);

const seat = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /sit at the slot/i.test(s.label ?? ''))[0]);

/** the money, read through N's tenancy prompt — a DIFFERENT builder's module
 *  reading the same purse. Returns the shortfall in dollars, or null. */
const moneyViaTenancy = () => p.evaluate(() => {
  const s = window.__ct.spots().find((s) => /you are \$[\d.]+ short/i.test(s.label ?? ''));
  if (!s) return null;
  const m = /you are \$([\d.]+) short/i.exec(s.label);
  return m ? Number(m[1]) : null;
});

// ── 1. SITTING opens it, on one press ─────────────────────────────────────
console.log('\n── the ask: sit down and you are in the slots ──');
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [seat.x, seat.z]);
await afterFrames(p, 6);
const where = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
ok(Math.hypot(where[0] - seat.x, where[2] - seat.z) < 0.6,
  `standing at the stool (${where[0]}, ${where[2]}) before pressing anything (GOTCHAS 20)`);
ok((await p.evaluate(() => window.__ct.seated?.() ?? null)) === null,
  'not seated yet — so what follows is caused by the press and not by the warp');

await p.keyboard.press('e');
const sat = await p.evaluate(() => new Promise((res) => {
  const t0 = performance.now();
  const tick = () => {
    if (window.__ct.seated?.()) return res(true);
    if (performance.now() - t0 > 6000) return res(false);
    requestAnimationFrame(tick);
  };
  tick();
}));
await afterFrames(p, 25);
ok(sat === true, 'ONE press of E and you are seated — no second key to open the game');
await p.screenshot({ path: 'shots/O-verify-L-slots-seated.png' });
console.log(`   seated at: ${JSON.stringify(await p.evaluate(() => window.__ct.seated()))}`);

// ── 2. NO SECOND WALLET, read through N's module ──────────────────────────
//
// N's prompt only states a shortfall once rent is DUE, so the clock has to be
// moved before this half can measure anything at all. My first run reported it
// as NOT MEASURED for exactly that reason — which was honest and was also just
// a check that had not set its subject up.
console.log('\n── the money, read through N\'s tenancy prompt ──');
await p.evaluate(() => window.__ct.advanceClock(3 * 1440, 0));
await afterFrames(p, 10);
const before = await moneyViaTenancy();
if (before === null) {
  console.log('   NOT MEASURED — no tenancy prompt exposes a shortfall right now, so I');
  console.log('   cannot read the purse through another builder\'s module. Saying so');
  console.log('   rather than scoring it.');
} else {
  console.log(`   N says you are $${before.toFixed(2)} short of the rent`);
  await p.keyboard.press('i');              // feed a $5 note into the machine
  await afterFrames(p, 25);
  const after = await moneyViaTenancy();
  console.log(`   after feeding a note, N says $${after?.toFixed(2)} short`);
  ok(after !== null && Math.abs((after - before) - 5) < 0.01,
    `feeding $5 into the slots moves N's OWN reading by exactly $5 ` +
    `($${before.toFixed(2)} -> $${after?.toFixed(2)}) — one wallet, not two`);
}

console.log(`\n${n} checks, ${bad} disagreed`);
await b.close();
process.exit(bad ? 1 : 0);
