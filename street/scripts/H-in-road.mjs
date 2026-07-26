// H: how many walkers are in the CARRIAGEWAY outside a marked crossing?
//
// This is the number the original east-end fault was measured with (18 of
// ~20000 samples, all of them on the unflagged east-end edge). Re-run it the
// same way so before and after are comparable.
//
// Corridors are derived from the node definitions in ct/crowd-net.ts, not
// hand-placed: WEST_X/EAST_X = -+(ROAD_HALF + IN) = -+6, NORTH_Z -97 and
// SOUTH_Z -109 are the side street's kerb lines, and CROSS_HALF is 1.3.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const SECS = +(process.env.SECS ?? 45);
const ROAD_HALF = 5.0, CROSS_HALF = 1.3, PAD = 0.6;
const SIDE_Z0 = -108, SIDE_Z1 = -98;            // the side street's asphalt
const CROSSINGS = [
  { name: 'main-street mouth', a: [-6, -97], b: [6, -97] },
  { name: 'side street at the corner', a: [8.7, -97], b: [6, -109] },
];
const segDist = (px, pz, [ax, az], [bx, bz]) => {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)) : 0;
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers, null, { timeout: 60000 });
console.log(`measuring ${URL}  build ${await p.evaluate(() => document.body.innerText.match(/[0-9a-f]{9}/)?.[0] ?? '?')}`);
let samples = 0, onRoad = 0, offCrossing = 0;
const hits = new Map();
const t0 = Date.now();
while (Date.now() - t0 < SECS * 1000) {
  const ws = await p.evaluate(() => window.__ct.walkers().map((q) => [q.x, q.z]));
  for (const [x, z] of ws) {
    samples++;
    const inMain = Math.abs(x) <= ROAD_HALF - PAD && z < 12;
    const inSide = z >= SIDE_Z0 + PAD && z <= SIDE_Z1 - PAD && x > -ROAD_HALF;
    if (!inMain && !inSide) continue;
    onRoad++;
    const near = CROSSINGS.some((c) => segDist(x, z, c.a, c.b) <= CROSS_HALF + PAD);
    if (near) continue;
    offCrossing++;
    const k = `${Math.round(x / 3) * 3},${Math.round(z / 3) * 3}`;
    hits.set(k, (hits.get(k) ?? 0) + 1);
  }
  await p.waitForTimeout(120);
}
console.log(`\n  ${samples} walker samples over ${SECS} s`);
console.log(`  in the carriageway at all:            ${onRoad}`);
console.log(`  in it OUTSIDE a marked crossing:      ${offCrossing}`);
if (offCrossing) {
  console.log('\n  where (3 m bins, worst first):');
  for (const [k, n] of [...hits].sort((a, c) => c[1] - a[1]).slice(0, 10)) console.log(`     (${k})  ${n}`);
} else console.log('\n  nobody walks in the road outside a crossing.');
await b.close();
