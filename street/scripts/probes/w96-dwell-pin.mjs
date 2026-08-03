// THE REPRO ITEM 207 ASKS FOR, AND THE ACCEPTANCE TEST FOR ITS FIX.
//
// The user, twice: *"people still get stuck. they should back up and allow the
// car to pass."* Two phases, because that sentence has two halves:
//
//   PHASE 1  a taxi DWELLS on the crossing. The walker must not stand frozen
//            against it; it must give ground.
//   PHASE 2  the taxi drives off. The walker must then actually cross.
//
// A fix that only passes phase 1 has taught the crowd to run away from cars; one
// that only passes phase 2 has changed nothing. Both, or it is not the behaviour
// he asked for.
//
// WHY ORDINARY TRAFFIC PROVES NOTHING. Worker sixtynine measured 100 s of it and
// found max jam 0.03 s (notes/w69-car-pins-citizen.md). I measured the other
// half: scripts/probes/w96-deadlock.mjs drove a taxi at a walker who was
// mid-crossing, five trials, and the taxi got past on 5 of 5. A MOVING car is
// not the bug — it brakes (ct/traffic.ts:343), the walker finishes, it goes.
//
// WHAT IS. A vehicle stopped for its OWN reasons while somebody is crossing.
// Then ct/crowd.ts's seven placement candidates — all `t + step`, only the
// lateral offset varying — leave the walker able to stand or to reroute FROM
// WHERE IT STANDS, and nothing else.
//
// WHERE. A vehicle body on the main straight sits at x = 1.50 with a 2.30 m box
// (scripts/probes/w96-where-can-a-car-reach.mjs). Citizens walk at |x| 6.05-6.39
// and the walk is |x| 5.0-7.0, so a car can never touch a walker ON the walk.
// The only shared ground is the roadway, entered only on a crossing. Main
// crossing z = -90.2, DERIVED from JUNCTION_CROSSINGS.main (ct/tex-ground.ts:1338).
//
// HOW THE DWELL IS HELD. `__ct.drive('NE','taxi', s)` re-puts the taxi at route
// position s; calling it every sample pins it there. Phase 2 simply stops
// calling it, so the taxi accelerates away under its own logic — the car really
// does pass, rather than being teleported out of the way. No box is planted:
// `__ct.citAvoid()` returns a MAPPED COPY (GOTCHAS 74).
//
//   SHOT_URL=http://localhost:4520/ TRIALS=5 node scripts/probes/w96-dwell-pin.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const TRIALS = Number(process.env.TRIALS ?? 5);
const BUDGET = Number(process.env.BUDGET ?? 420);
const EVERY = 100;
const ROAD_HALF = 5.0;          // ct/rng.ts:3
const CROSS_Z = -90.2;          // JUNCTION_CROSSINGS.main.z
const NEAR_CROSS = 8.0;         // m of the crossing to count as "at" it
const STAND_MAX = 2.5;          // s standing still while walled = a pin
const CROSS_BY = 14;            // s allowed to complete the crossing in phase 2

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const S_PARK = await p.evaluate(async (cz) => {
  let best = null;
  for (let s = 80; s < 115; s += 1) {
    window.__ct.drive('NE', 'taxi', s);
    await new Promise((r) => requestAnimationFrame(r));
    const t = window.__ct.traffic()[0];
    if (!t) continue;
    const d = Math.hypot(t.z - cz, t.x - 1.5);
    if (!best || d < best.d) best = { s, d };
  }
  return best?.s ?? null;
}, CROSS_Z);
if (S_PARK === null) { console.log('REFUSING TO REPORT: the taxi never posed'); await b.close(); process.exit(3); }
console.log(`taxi dwells at route s=${S_PARK} (on the crossing, z=${CROSS_Z})\n`);

const hold = () => p.evaluate((s) => {
  window.__ct.drive('NE', 'taxi', s);
  return { w: window.__ct.walkers(), tr: window.__ct.traffic() };
}, S_PARK);
const look = () => p.evaluate(() => ({ w: window.__ct.walkers(), tr: window.__ct.traffic() }));

// "at the crossing and trying to use it": near it, and on or past the kerb line
const atCrossing = (w) => Math.abs(w.z - CROSS_Z) < NEAR_CROSS && Math.abs(w.x) < 7.2;
const inRoad = (w) => Math.abs(w.x) < ROAD_HALF && Math.abs(w.z - CROSS_Z) < NEAR_CROSS;

const trials = [];
const t0 = Date.now();
for (let n = 0; n < TRIALS && (Date.now() - t0) / 1000 < BUDGET; n++) {
  // ── PHASE 1: hold the taxi, wait for somebody to be stopped by it ────────
  let who = -1, gave = 0, maxStand = 0, stand = 0, prev = null, side = 0;
  const p1 = Date.now();
  while ((Date.now() - t0) / 1000 < BUDGET && (Date.now() - p1) / 1000 < 90) {
    const s = await hold();
    for (let i = 0; i < s.w.length; i++) {
      const w = s.w[i];
      if (!atCrossing(w)) continue;
      if (who < 0 && w.gave > 0) { who = i; side = Math.sign(w.x) || 1; }
      if (i === who) {
        gave = Math.max(gave, w.gave);
        if (prev) {
          const step = Math.hypot(w.x - prev.x, w.z - prev.z);
          if (step < 0.004) { stand += EVERY / 1000; maxStand = Math.max(maxStand, stand); }
          else stand = 0;
        }
        prev = { x: w.x, z: w.z };
      }
    }
    if (who >= 0 && gave > 0 && (Date.now() - p1) / 1000 > 6) break;
    await p.waitForTimeout(EVERY);
  }
  if (who < 0) { console.log(`trial ${n + 1}: nobody reached the crossing in 90 s — skipped`); continue; }

  // ── PHASE 2: let go. The taxi drives off; the walker must cross. ─────────
  const startX = (await look()).w[who].x;
  let crossed = false, tCross = 0;
  const p2 = Date.now();
  while ((Date.now() - p2) / 1000 < CROSS_BY) {
    await p.waitForTimeout(EVERY);
    const s = await look();                       // NOT holding: the taxi drives
    const w = s.w[who];
    if (!w) break;
    // crossed = reached the far kerb, i.e. the other side of the road
    if (Math.sign(w.x) === -Math.sign(startX) && Math.abs(w.x) > ROAD_HALF) {
      crossed = true; tCross = (Date.now() - p2) / 1000; break;
    }
    if (!inRoad(w) && Math.sign(w.x) === Math.sign(startX) && (Date.now() - p2) / 1000 > 8) break;
  }
  trials.push({ who, gave, maxStand, crossed, tCross, side });
  console.log(`trial ${n + 1}: walker ${who} at the crossing — gave ${gave.toFixed(2)}m, `
    + `longest stand ${maxStand.toFixed(1)}s, `
    + (crossed ? `crossed ${tCross.toFixed(1)}s after the taxi left` : 'did NOT cross'));
  await p.waitForTimeout(1200);
}

if (!trials.length) { console.log('\nREFUSING TO REPORT: no trial produced a walker at the crossing'); await b.close(); process.exit(3); }
const gaves = trials.map((t) => t.gave);
const stands = trials.map((t) => t.maxStand);
const crossings = trials.filter((t) => t.crossed).length;
console.log(`\n${trials.length} trials`);
console.log(`ground given to the dwelling taxi: ${Math.min(...gaves).toFixed(2)}-${Math.max(...gaves).toFixed(2)} m`);
console.log(`longest stand while walled:        ${Math.min(...stands).toFixed(1)}-${Math.max(...stands).toFixed(1)} s (a pin is > ${STAND_MAX}s)`);
console.log(`crossed once the taxi drove off:   ${crossings}/${trials.length}`);
const bad = Math.max(...stands) > STAND_MAX || Math.min(...gaves) <= 0 || crossings < trials.length;
console.log(bad ? '\nFAIL' : '\nPASS — the walker backs up, and goes once the car has passed');
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
await b.close();
process.exit(bad ? 1 : 0);
