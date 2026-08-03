// THE ACCEPTANCE TEST FOR ITEM 207 — "back up and allow the car to pass".
//
// This is the mutual deadlock, and it is the thing the user is actually looking
// at. Two correct behaviours compose into a frozen street:
//
//   · ct/traffic.ts:343 `blockedAt` — a vehicle brakes for anyone within
//     CLEAR_R = 2.0 m of a route point ahead of it. Correct: cars should not
//     drive through people.
//   · ct/crowd.ts:624 — the seven placement candidates all advance by `t + step`.
//     A walker whose way is blocked can stand, or (after JAM_GIVE_UP = 2.0 s)
//     reroute. **It cannot give ground.**
//
// So a walker on the crossing and a car approaching it reach a state where the
// car waits for the walker and the walker cannot leave. The car's own `held`
// timer (published by `__ct.traffic()`) counts the seconds it has been yielding,
// so the deadlock is directly measurable rather than inferred.
//
// A trial: wait for a walker to step into the roadway at the main crossing
// (z = -90.2, JUNCTION_CROSSINGS.main), then put a taxi 12 m upstream of it
// (s = 86; s increases as z decreases — scripts/probes/w96-route-map.mjs) and
// let it drive itself. Watch until the taxi is CLEAR of the crossing or the
// trial times out.
//
// PASS = the taxi gets past the crossing, on every trial, and no walker is left
// standing in the roadway longer than STAND_MAX.
//
//   SHOT_URL=http://localhost:4520/ TRIALS=5 node scripts/probes/w96-deadlock.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const TRIALS = Number(process.env.TRIALS ?? 5);
const BUDGET = Number(process.env.BUDGET ?? 300);   // s, whole run
const TRIAL_MAX = 25;      // s to watch one trial
const STAND_MAX = 4.0;     // s a walker may stand in the roadway before it is a pin
const CROSS_Z = -90.2;     // JUNCTION_CROSSINGS.main.z (ct/tex-ground.ts:1338)
const ROAD_HALF = 5.0;     // ct/rng.ts:3
const S_START = 86;        // ~12 m upstream of the crossing (s=98)
const S_CLEAR = 103;       // past it

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const onCrossing = (w) => Math.abs(w.x) < ROAD_HALF && Math.abs(w.z - CROSS_Z) < 3.0;
const read = () => p.evaluate(() => ({
  w: window.__ct.walkers(),
  tr: window.__ct.traffic(),
  cars: window.__ct.citAvoid().filter((b) => b.actor && b.minX < 900),
}));

const results = [];
const t0 = Date.now();
for (let trial = 0; trial < TRIALS && (Date.now() - t0) / 1000 < BUDGET; trial++) {
  // ── wait for somebody to step off the kerb ────────────────────────────────
  let who = -1;
  while ((Date.now() - t0) / 1000 < BUDGET) {
    const s = await read();
    const i = s.w.findIndex(onCrossing);
    if (i >= 0) { who = i; break; }
    await p.waitForTimeout(120);
  }
  if (who < 0) break;
  await p.evaluate((sv) => window.__ct.drive('NE', 'taxi', sv), S_START);

  let maxHeld = 0, maxJam = 0, maxStand = 0, stand = 0, backDist = 0, minGap = Infinity;
  let passed = false, sEnd = S_START;
  let prev = null;
  const tt = Date.now();
  while ((Date.now() - tt) / 1000 < TRIAL_MAX) {
    await p.waitForTimeout(100);
    const s = await read();
    const v = s.tr[0];
    if (v) { maxHeld = Math.max(maxHeld, v.held); sEnd = v.s; if (v.s > S_CLEAR) { passed = true; break; } }
    else break;                                   // taxi despawned
    const w = s.w[who];
    if (!w) break;
    if (onCrossing(w)) {
      maxJam = Math.max(maxJam, w.jam);
      const car = s.cars[0];
      if (car) {
        minGap = Math.min(minGap, Math.hypot(Math.max(car.minX - w.x, 0, w.x - car.maxX),
          Math.max(car.minZ - w.z, 0, w.z - car.maxZ)));
      }
      if (prev) {
        const step = Math.hypot(w.x - prev.x, w.z - prev.z);
        if (step < 0.004) { stand += 0.1; maxStand = Math.max(maxStand, stand); } else stand = 0;
        // giving ground = moving back toward the kerb it came from
        if (step > 0.004 && Math.abs(w.x) > Math.abs(prev.x)) backDist += step;
      }
      prev = { x: w.x, z: w.z };
    } else { stand = 0; prev = null; }
  }
  results.push({ who, passed, maxHeld, maxJam, maxStand, backDist, minGap, sEnd });
  console.log(`trial ${trial + 1}: walker ${who} on the crossing — `
    + `taxi ${passed ? 'PASSED' : `STALLED at s=${sEnd.toFixed(1)}`}, `
    + `held ${maxHeld.toFixed(1)}s, walker jam ${maxJam.toFixed(2)}s, `
    + `stood ${maxStand.toFixed(1)}s, gave ground ${backDist.toFixed(2)}m`
    + (minGap < Infinity ? `, closest ${minGap.toFixed(2)}m` : ''));
  await p.waitForTimeout(1500);
}

if (!results.length) { console.log('REFUSING TO REPORT: no walker used the crossing in the budget'); await b.close(); process.exit(3); }
const passes = results.filter((r) => r.passed).length;
const stands = results.map((r) => r.maxStand);
const backs = results.map((r) => r.backDist);
console.log(`\n${results.length} trials: taxi got past on ${passes}/${results.length}`);
console.log(`walker stood in the roadway: ${Math.min(...stands).toFixed(1)}-${Math.max(...stands).toFixed(1)}s (limit ${STAND_MAX}s)`);
console.log(`ground given up: ${Math.min(...backs).toFixed(2)}-${Math.max(...backs).toFixed(2)}m`);
const bad = passes < results.length || Math.max(...stands) > STAND_MAX;
console.log(bad ? '\nFAIL — the street deadlocks' : '\nPASS — the walker gives way and the car goes');
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
await b.close();
process.exit(bad ? 1 : 0);
