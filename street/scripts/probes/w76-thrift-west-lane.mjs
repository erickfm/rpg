// One-shot (item 220): how wide IS the west walk on the THRIFT frontage, and how
// much of the narrowing is the lamp collider rather than the lamp?
//
// Property sweep, not a route: for each z it walks x across the walk in 2 cm
// steps and reports every standable run, so it finds the gap wherever it is
// instead of only where I thought to look (BUILDER-BRIEF: "a route-based check
// only finds the holes its author imagined").
//
// STANDABLE = the player's own collision predicate, asked of the world:
// __ct.colliders() with the rig radius, which is what the movement code tests.
//   SHOT_URL=http://localhost:4320/ node scripts/probes/w76-thrift-west-lane.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? (() => { throw new Error('SHOT_URL required — GOTCHAS 50'); })();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(800);

const RADIUS = 0.36;                       // the rig radius the walking suites use
const rows = await p.evaluate((R) => {
  const cols = window.__ct.colliders();
  const blocked = (x, z) => cols.some((c) =>
    x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
  const out = [];
  for (let z = -70; z <= -60.0001; z += 0.25) {
    const runs = [];
    let start = null;
    for (let x = -9.0; x <= -2.0 + 1e-9; x += 0.02) {
      const ok = !blocked(x, z) && window.__ct.groundAt(x, z) !== null;
      if (ok && start === null) start = x;
      if (!ok && start !== null) { runs.push([start, x - 0.02]); start = null; }
    }
    if (start !== null) runs.push([start, -2.0]);
    const widest = runs.reduce((m, r) => Math.max(m, r[1] - r[0]), 0);
    out.push({ z: +z.toFixed(2), widest: +widest.toFixed(2),
      runs: runs.map((r) => `${r[0].toFixed(2)}…${r[1].toFixed(2)} (${(r[1] - r[0]).toFixed(2)})`) });
  }
  return out;
}, RADIUS);

console.log('z        widest clear run   all runs');
for (const r of rows) {
  const flag = r.widest < 2.0 ? '  <-- under 2 m' : '';
  console.log(`${String(r.z).padStart(7)}  ${String(r.widest).padStart(5)} m         ${r.runs.join('  ')}${flag}`);
}
const narrow = rows.filter((r) => r.widest < 2.0);
const clear = rows.filter((r) => r.widest >= 2.0);
console.log(`\n${narrow.length} of ${rows.length} sampled z rows are under 2.00 m; ${clear.length} are clear.`);
if (rows.length === 0) { console.error('MEASURED NOTHING'); process.exit(2); }
const worst = rows.reduce((m, r) => (r.widest < m.widest ? r : m), rows[0]);
console.log(`worst: z=${worst.z} at ${worst.widest} m`);
const best = rows.reduce((m, r) => (r.widest > m.widest ? r : m), rows[0]);
console.log(`best:  z=${best.z} at ${best.widest} m  (this is what the walk is when nothing is on it)`);
await b.close();
