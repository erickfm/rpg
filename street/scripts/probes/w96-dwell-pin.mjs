// THE REPRO ITEM 207 ASKS FOR: A TAXI THAT DWELLS ON THE CROSSING.
//
// The user, twice: *"people still get stuck. they should back up and allow the
// car to pass."*
//
// WHY ORDINARY TRAFFIC PROVES NOTHING. Worker sixtynine measured 100 s of it and
// found max jam 0.03 s (notes/w69-car-pins-citizen.md). I measured the other
// half: scripts/probes/w96-deadlock.mjs drove a taxi at a walker who was
// mid-crossing, five trials, and **the taxi got past on 5 of 5** — it brakes
// (ct/traffic.ts:343 `blockedAt`), the walker finishes crossing, it goes. A
// MOVING car is not the bug and no amount of watching one will show it.
//
// WHAT IS. A vehicle that is stopped for its OWN reasons — dwelling at the kerb,
// held at the corner — while a walker is trying to cross. Then the walker's way
// is blocked by something that will not move, and ct/crowd.ts:624 gives it seven
// candidates that all read `t + step`: it can stand, or after JAM_GIVE_UP = 2.0 s
// reroute from where it stands. **It cannot give ground.** That is the user's
// screenshot and this makes it happen on demand.
//
// WHERE. A vehicle body on the main straight sits at x = 1.50 with a 2.30 m wide
// box (x 0.35..2.65) — scripts/probes/w96-where-can-a-car-reach.mjs. Citizens
// walk at |x| 6.05-6.39 (ct/crowd.ts:275) and the walk is |x| 5.0-7.0, so **a
// vehicle can never touch a walker who is on the walk.** The one ground they
// share is the roadway, which pedestrians only enter on a crossing
// (ct/crowd-net.ts:58-61). Main crossing: z = -90.2, DERIVED from
// JUNCTION_CROSSINGS.main (ct/tex-ground.ts:1338), not retyped.
//
// HOW IT IS HELD. `__ct.drive('NE','taxi', s)` re-puts the taxi at route
// position s; calling it every sample pins it there. Nothing is monkey-patched
// and no box is planted — `__ct.citAvoid()` returns a MAPPED COPY (GOTCHAS 74),
// so a planted box would land in an array nobody reads.
//
// THE MEASUREMENT IS PER BLOCKED EPISODE, not per walker: contiguous frames with
// the walker in the roadway AND within TOUCH of the taxi's box. For each one:
//   · how long it stood still
//   · how much ground it gave back toward THE KERB IT CAME FROM
//
// ⚠ THAT LAST METRIC IS THE ONE I GOT WRONG FIRST. Counting "moved away from
// x = 0" called a walker completing a normal crossing a retreat — it read 3.93 m
// of ground given on a trial where nobody gave any. Retreat is only meaningful
// against the side the walker STEPPED OFF, so the entry kerb is latched when the
// episode opens and the sign is taken from that.
//
//   SHOT_URL=http://localhost:4520/ SECONDS=180 node scripts/probes/w96-dwell-pin.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const SECONDS = Number(process.env.SECONDS ?? 180);
const EVERY = 100;
const ROAD_HALF = 5.0;          // ct/rng.ts:3
const CROSS_Z = -90.2;          // JUNCTION_CROSSINGS.main.z, ct/tex-ground.ts:1338
const TOUCH = 0.9;              // m from the box to count as "blocked by it"
const STAND_MAX = 1.2;          // s standing still while blocked = a pin

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

// ── park the taxi ON the crossing ──────────────────────────────────────────
const sBest = await p.evaluate(async (cz) => {
  let best = null;
  for (let s = 80; s < 115; s += 1) {
    window.__ct.drive('NE', 'taxi', s);
    await new Promise((r) => requestAnimationFrame(r));
    const t = window.__ct.traffic()[0];
    if (!t) continue;
    const d = Math.hypot(t.z - cz, t.x - 1.5);
    if (!best || d < best.d) best = { s, d, x: +t.x.toFixed(2), z: +t.z.toFixed(2) };
  }
  return best;
}, CROSS_Z);
if (!sBest) { console.log('REFUSING TO REPORT: the taxi never posed'); await b.close(); process.exit(3); }
console.log(`taxi dwelling at route s=${sBest.s} -> (${sBest.x}, ${sBest.z}), `
  + `${sBest.d.toFixed(2)} m from the crossing centre (1.50, ${CROSS_Z})\n`);

const first = await p.evaluate(() => window.__ct.walkers());
if (!first.length) { console.log('REFUSING TO REPORT: no walkers'); await b.close(); process.exit(3); }
const N = first.length;

const live = Array.from({ length: N }, () => null);   // open episode per walker
const prev = first.map((w) => ({ x: w.x, z: w.z }));
const eps = [];
let samples = 0, roadFrames = 0;

const gap = (car, w) => Math.hypot(Math.max(car.minX - w.x, 0, w.x - car.maxX),
  Math.max(car.minZ - w.z, 0, w.z - car.maxZ));

const t0 = Date.now();
while (Date.now() - t0 < SECONDS * 1000) {
  const s = await p.evaluate((sv) => {
    window.__ct.drive('NE', 'taxi', sv);           // hold it: the taxi DWELLS
    return { w: window.__ct.walkers(),
      cars: window.__ct.citAvoid().filter((b) => b.actor && b.minX < 900) };
  }, sBest.s);
  samples++;
  const car = s.cars[0];
  for (let i = 0; i < Math.min(N, s.w.length); i++) {
    const w = s.w[i];
    const inRoad = Math.abs(w.x) < ROAD_HALF && Math.abs(w.z - CROSS_Z) < 6;
    if (inRoad) roadFrames++;
    const blocked = inRoad && car && gap(car, w) < TOUCH;
    let e = live[i];
    if (blocked && !e) {
      // LATCH THE KERB THIS WALKER STEPPED OFF. Retreat has no meaning without
      // it — see the header.
      e = live[i] = { walker: i, side: Math.sign(prev[i].x) || Math.sign(w.x) || 1,
        stand: 0, maxStand: 0, back: 0, fwd: 0, jam: 0, frames: 0,
        x0: +w.x.toFixed(2), z0: +w.z.toFixed(2) };
    }
    if (e) {
      if (blocked) {
        e.frames++;
        e.jam = Math.max(e.jam, w.jam);
        const dx = w.x - prev[i].x, dz = w.z - prev[i].z;
        const step = Math.hypot(dx, dz);
        if (step < 0.004) { e.stand += EVERY / 1000; e.maxStand = Math.max(e.maxStand, e.stand); }
        else {
          e.stand = 0;
          // toward the entry kerb = retreat; away from it = progress
          if (dx * e.side > 0) e.back += Math.abs(dx); else e.fwd += Math.abs(dx);
        }
      } else { eps.push(e); live[i] = null; }
    }
    prev[i] = { x: w.x, z: w.z };
  }
  await p.waitForTimeout(EVERY);
}
for (const e of live) if (e) eps.push(e);

console.log(`${samples} samples over ${SECONDS}s; ${roadFrames} walker-frames in the roadway.`);
if (!eps.length) {
  console.log('REFUSING TO REPORT: nobody was ever blocked by the parked taxi — no episode to judge.');
  console.log('(Crossings are infrequent; raise SECONDS.)');
  await b.close(); process.exit(3);
}
console.log(`\n${eps.length} blocked episode(s) — walker within ${TOUCH} m of the dwelling taxi:\n`);
console.log('walker  frames  peakJam  longest-stand  ground-given  pushed-on   from');
for (const e of eps) {
  console.log(`  ${String(e.walker).padStart(2)}     ${String(e.frames).padStart(3)}     ${e.jam.toFixed(2)}s`.padEnd(34)
    + `${e.maxStand.toFixed(1)}s`.padEnd(16) + `${e.back.toFixed(2)}m`.padEnd(14)
    + `${e.fwd.toFixed(2)}m`.padEnd(12) + `${e.x0},${e.z0}`);
}
const worstStand = Math.max(...eps.map((e) => e.maxStand));
const totalBack = eps.reduce((a, e) => a + e.back, 0);
const pinned = eps.filter((e) => e.maxStand > STAND_MAX).length;
console.log(`\nlongest stand while blocked: ${worstStand.toFixed(1)}s  (a pin is > ${STAND_MAX}s)`);
console.log(`total ground given back toward the kerb: ${totalBack.toFixed(2)} m`);
console.log(`episodes that PINNED: ${pinned} of ${eps.length}`);
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
const bad = pinned > 0;
console.log(bad ? '\nFAIL — a walker stood against the car and never gave ground'
  : '\nPASS — every blocked walker gave ground instead of standing');
await b.close();
process.exit(bad ? 1 : 0);
