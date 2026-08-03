// DOES A MOVING CAR ACTUALLY PIN A CITIZEN? — item 173, the user's SECOND report
//
// *"people still get stuck. they should back up and allow the car to pass."*
//
// The item offers two leads and this settles the first one before anything is
// changed. It is an OBSERVATION of the shipped world, not a mutation: no box is
// planted, because `__ct.citAvoid()` returns a MAPPED COPY (`crosstown.ts:1765`)
// and pushing onto it would land in an array nobody reads — GOTCHAS 74's shape,
// which has already disarmed one check's selftest in this repo.
//
// So it watches the real traffic instead. Every 200 ms it records each walker's
// position and its `jam` timer (seconds spent getting nowhere, published by
// `crowd.walkers()`), together with every ACTOR box — the vehicles, which
// `crosstown.ts:615` tags through `actorBoxes` so a probe can tell a taxi from a
// tree.
//
// It reports, per walker:
//   · the longest run of frames with jam still climbing
//   · whether a vehicle box was within PIN_NEAR of them while it climbed
//   · whether they ever moved BACKWARDS along their own heading (the behaviour
//     the user asked for, and which nothing in ct/crowd.ts can currently do —
//     every candidate offset in the placement loop is at `t + step`)
//
//   SHOT_URL=http://localhost:4250/ SECONDS=90 node scripts/probes/w69-car-pins-citizen.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4250/');
const SECONDS = Number(process.env.SECONDS ?? 90);
const EVERY = 200;                 // ms between samples
const PIN_NEAR = 2.2;              // m from a vehicle box to count as "beside it"

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(1000);

const sample = () => p.evaluate(() => ({
  t: performance.now(),
  w: window.__ct.walkers(),
  cars: window.__ct.citAvoid().filter((b) => b.actor && b.minX < 900),
}));

const first = await sample();
if (!first.w.length) { console.log('REFUSING TO REPORT: no walkers'); await b.close(); process.exit(3); }
console.log(`${first.w.length} walkers, sampling every ${EVERY} ms for ${SECONDS} s\n`);

const N = first.w.length;
const prev = first.w.map((w) => ({ x: w.x, z: w.z }));
const st = Array.from({ length: N }, () => ({
  maxJam: 0, jamNearCar: 0, framesNearCar: 0, backSteps: 0, at: null, moved: 0,
}));
let carSeen = 0, samples = 0;

const dist = (w, c) => Math.hypot(
  Math.max(c.minX - w.x, 0, w.x - c.maxX), Math.max(c.minZ - w.z, 0, w.z - c.maxZ));

const t0 = Date.now();
while (Date.now() - t0 < SECONDS * 1000) {
  await p.waitForTimeout(EVERY);
  const s = await sample();
  samples++;
  if (s.cars.length) carSeen++;
  for (let i = 0; i < Math.min(N, s.w.length); i++) {
    const w = s.w[i], k = st[i];
    const near = s.cars.length ? Math.min(...s.cars.map((c) => dist(w, c))) : Infinity;
    if (w.jam > k.maxJam) k.maxJam = w.jam;
    if (near < PIN_NEAR) {
      k.framesNearCar++;
      if (w.jam > k.jamNearCar) { k.jamNearCar = w.jam; k.at = { x: +w.x.toFixed(2), z: +w.z.toFixed(2), d: +near.toFixed(2) }; }
    }
    const dx = w.x - prev[i].x, dz = w.z - prev[i].z;
    k.moved += Math.hypot(dx, dz);
    prev[i] = { x: w.x, z: w.z };
  }
}

console.log(`${samples} samples, a vehicle was on the block in ${carSeen} of them `
  + `(${(100 * carSeen / samples).toFixed(0)}%)\n`);
console.log('walker  maxJam   maxJam-beside-a-car   frames beside a car   metres walked');
let worst = 0;
for (let i = 0; i < N; i++) {
  const k = st[i];
  worst = Math.max(worst, k.jamNearCar);
  console.log(`  ${String(i).padStart(2)}   ${k.maxJam.toFixed(2)}s`.padEnd(20)
    + `${k.jamNearCar.toFixed(2)}s`.padEnd(22)
    + `${k.framesNearCar}`.padEnd(22) + `${k.moved.toFixed(1)} m`
    + (k.at ? `      pinned at ${k.at.x},${k.at.z} (${k.at.d} m from the car)` : ''));
}
console.log(`\nworst jam recorded while beside a vehicle: ${worst.toFixed(2)} s`);
console.log(`ct/crowd.ts's JAM_GIVE_UP is 2.0 s — above that the walker reroutes`);
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
await b.close();
