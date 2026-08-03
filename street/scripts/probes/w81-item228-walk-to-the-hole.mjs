// ITEM 228, STEP 1 — IS (-30, 12) REACHABLE ON FOOT?
//
// Worker seventynine reported a suspected third hole there and was honest that
// it WARPED in: *"it could not show the spot is reachable on foot."* That is the
// whole question, because a spot a player cannot reach is a much smaller
// problem than a fourth escape.
//
// SO THIS WALKS. The only warp is to the middle of the road at (0, 0) — the
// street the player spawns onto and the sweep photographs from — and everything
// after it is held keys through the real input loop.
//
// It is a greedy walker, not a pathfinder: face the target, hold `w`, and when
// progress stalls, strafe along the obstacle for a moment and try again. That
// finds a route if an easy one exists and proves nothing if it fails, which is
// exactly the asymmetry to keep in mind reading the output — A FAILED WALK IS
// NOT PROOF OF CONTAINMENT, only a failure to find a way in this many seconds.
//
// Usage: SHOT_URL=http://localhost:4370/ node scripts/probes/w81-item228-walk-to-the-hole.mjs
import { chromium } from 'playwright';

const TARGETS = [[-30, 12], [-30, 18]];
const BUDGET_MS = 60000;        // per target, of real held input

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4370/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };
const face = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));   // forward is (sin y, -cos y)
const settle = () => p.evaluate(() => new Promise((done) => {
  let last = NaN, still = 0, n = 0;
  const t = () => {
    const y = window.__ct.camY();
    still = Math.abs(y - last) < 1e-4 ? still + 1 : 0;
    last = y;
    if (still >= 6 || ++n > 300) return done(y);
    requestAnimationFrame(t);
  };
  requestAnimationFrame(t);
}));

console.log('start: warp to (0, 0), the middle of the road — the only warp in this file');
await p.evaluate(() => window.__ct.warp(0, 0, 0, 0, 0));
await settle();
console.log(`  standing at ${JSON.stringify(await pos())}, eye ${(await camY()).toFixed(2)}`);

for (const [tx, tz] of TARGETS) {
  // back to the road for each attempt, so one failed target does not strand the
  // next one somewhere arbitrary
  await p.evaluate(() => window.__ct.warp(0, 0, 0, 0, 0));
  await settle();
  let spent = 0, best = Infinity, bestAt = null, stalls = 0;
  let last = await pos();
  console.log(`\nWALKING to (${tx}, ${tz}) — greedy, ${BUDGET_MS / 1000} s of held input`);
  while (spent < BUDGET_MS) {
    const P = await pos();
    const d = Math.hypot(P[0] - tx, P[2] - tz);
    if (d < best - 0.05) { best = d; bestAt = [P[0], P[2]]; stalls = 0; } else stalls++;
    if (d < 1.0) break;
    const yaw = face(P[0], P[2], tx, tz);
    await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0), [P[0], P[2], yaw]);
    if (stalls >= 2) {
      // walled: slide along it for a moment, alternating side, then try again
      await hold(stalls % 4 < 2 ? 'a' : 'd', 900);
      spent += 900;
    } else {
      await hold('w', 700);
      spent += 700;
    }
    const now = await pos();
    if (Math.hypot(now[0] - last[0], now[2] - last[2]) < 0.05) stalls++;
    last = now;
  }
  const P = await pos();
  const d = Math.hypot(P[0] - tx, P[2] - tz);
  console.log(`  ${d < 1.0 ? 'REACHED' : 'did not reach'} — ended at ${P[0].toFixed(2)}, ${P[2].toFixed(2)}`
    + ` (${d.toFixed(2)} m away); closest approach ${best.toFixed(2)} m at`
    + ` ${bestAt ? `${bestAt[0].toFixed(2)}, ${bestAt[1].toFixed(2)}` : '—'}`);
  console.log(`  eye height there: ${(await camY()).toFixed(2)}  (1.62 over a floor at 0)`);
}

if (errs.length) console.log('page errors:', errs.slice(0, 3).join(' | '));
console.log('\nNOTE: a failed walk is NOT proof of containment — only that this greedy walker');
console.log('found no way in the time given. A reached target IS proof of reachability.');
await browser.close();
