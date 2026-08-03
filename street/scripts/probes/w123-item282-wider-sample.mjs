// Item 282 — THE WIDER SAMPLE the row asks for, north of the bench.
//
// Item 276 reported 144 stationary episodes and 0 pinned across 810 s, and its
// author volunteered the honest limit: **only 6.9% of crowd samples were north
// of the bench**, so the zero proved "when they went through, they went
// through", not "they cannot pin".
//
// This is a MEASUREMENT, not a check, and it is not committed as one —
// BUILDER-BRIEF §10a: anything that needs a window of wall-clock time to mean
// something is a coin toss as a standing assertion. The number belongs in the
// handoff. The standing answer is the geometry, which
// `w123-item282-stop-geometry.mjs` gets deterministically off the colliders.
//
// Usage: SHOT_URL=http://localhost:4194/ node scripts/probes/w123-item282-wider-sample.mjs [seconds]
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const SECONDS = Number(process.argv[2] ?? 300);
if (!Number.isFinite(SECONDS) || SECONDS <= 0) {
  console.error(`INCONCLUSIVE — "${process.argv[2]}" is not a number of seconds.`);
  process.exit(2);
}
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers, null, { timeout: 30000 });

// STAND AT THE STOP. Not for the picture — the crowd is only simulated where
// the player is, and sampling the block from the far end measures a block
// nobody is walking. This is also the honest way to bias toward the stretch the
// row wants sampled: there is no hook that steers a walker.
await p.evaluate(() => window.__ct.warp(6.0, -34.0, 0, 0, 0));

const BENCH_Z = -35.0;                       // measured off the collider, see the geometry probe
const NEAR = (w) => w.x > 4 && w.x < 9 && w.z > -42 && w.z < -28;   // the stop's stretch
const NORTH = (w) => NEAR(w) && w.z > BENCH_Z;                      // north of the bench

let ticks = 0, samples = 0, near = 0, north = 0;
let stationaryNear = 0, stationaryNorth = 0;
let maxJamNear = 0, maxJamNorth = 0;
let pinnedNear = 0, pinnedNorth = 0;
const JAM_PIN = 2.0;                         // the threshold item 276 reported against
const worst = [];
const t0 = Date.now();
while ((Date.now() - t0) / 1000 < SECONDS) {
  const ws = await p.evaluate(() => window.__ct.walkers());
  ticks++;
  for (const w of ws) {
    samples++;
    if (!NEAR(w)) continue;
    near++;
    const isNorth = NORTH(w);
    if (isNorth) north++;
    if (w.jam > maxJamNear) maxJamNear = w.jam;
    if (isNorth && w.jam > maxJamNorth) maxJamNorth = w.jam;
    if (w.doing !== 'walking') { stationaryNear++; if (isNorth) stationaryNorth++; }
    if (w.jam >= JAM_PIN) {
      pinnedNear++; if (isNorth) pinnedNorth++;
      if (worst.length < 8) worst.push({ x: +w.x.toFixed(2), z: +w.z.toFixed(2), jam: w.jam, doing: w.doing });
    }
  }
  await p.waitForTimeout(200);
}
const pct = (a, c) => c ? `${(100 * a / c).toFixed(1)}%` : 'n/a';
console.log(`\n${SECONDS}s, ${ticks} ticks, ${samples} person-samples`);
console.log(`  in the stop's stretch (z -42..-28, east walk): ${near}  (${pct(near, samples)} of all samples)`);
console.log(`  NORTH of the bench (z > ${BENCH_Z})           : ${north}  (${pct(north, near)} of the stretch,`
  + ` ${pct(north, samples)} of all)`);
console.log(`  stationary in the stretch: ${stationaryNear}   north of the bench: ${stationaryNorth}`);
console.log(`  highest jam in the stretch: ${maxJamNear.toFixed(2)}   north of the bench: ${maxJamNorth.toFixed(2)}`
  + `   (pin threshold ${JAM_PIN})`);
console.log(`  PINNED samples (jam >= ${JAM_PIN}): ${pinnedNear} in the stretch, ${pinnedNorth} north of the bench`);
for (const w of worst) console.log(`     (${w.x}, ${w.z}) jam ${w.jam} doing ${w.doing}`);
console.log(`\npage errors: ${errs.length}`);
await b.close();
