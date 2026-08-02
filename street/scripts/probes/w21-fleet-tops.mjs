// WHAT WOULD IT TAKE TO CLIMB THE OTHER THREE KINDS? Item 29 made the pickup
// climbable because a pickup already owns a staircase (bed 0.50 -> rail 0.97
// -> roof 1.50). A sedan, hatch and van do not, and the desk should be told
// what they are missing in METRES rather than in adjectives.
//
// Every number here is MEASURED off the real mesh — `__ct.carVariant()` stands
// one car of each kind in the world and this reads the world-space bounding
// box of every child — rather than copied out of ct/cars.ts's comments, which
// is how `bedcavity.mjs` spent a week measuring a truck that no longer existed.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w21-fleet-tops.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// fp.ts: vy = 4.0 against 14 m/s^2 of gravity, and standTop's TOP_EPS = 0.08
const APEX = 4.0 * 4.0 / (2 * 14), EPS = 0.08, REACH = APEX + EPS;
const KERB = await p.evaluate(() => window.__ct.groundAt(-6.0, -20.0));
console.log(`one hop gains ${REACH.toFixed(3)} m (apex ${APEX.toFixed(3)} + TOP_EPS ${EPS}); pavement is ${KERB.toFixed(2)}`);

for (const kind of ['sedan', 'hatch', 'pickup', 'van']) {
  const tops = await p.evaluate((k) => {
    const g = window.__ct.carVariant(k, {}, 400, 400, 0);
    const out = [];
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      if (!o.geometry) return;
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
      out.push({ y: +bb.max.y.toFixed(3), w: +w.toFixed(2), d: +d.toFixed(2) });
    });
    g.parent.remove(g);
    return out;
  }, kind);
  // a "surface" only counts if you could actually stand on it: at least a
  // player's own footprint (2 * fp.ts RADIUS = 0.72 m) across one axis
  const flats = [...new Map(tops.filter((t) => t.w >= 0.5 && t.d >= 0.5)
    .map((t) => [t.y, t])).values()].sort((a, c) => a.y - c.y);
  console.log(`\n${kind}:`);
  let at = KERB, step = 0;
  const line = [];
  for (const f of flats) {
    if (f.y <= at + 1e-6) continue;
    if (f.y <= at + REACH) { line.push(`${f.y.toFixed(2)} (${f.w}x${f.d})`); at = f.y; step++; }
  }
  const highest = flats.length ? flats[flats.length - 1].y : 0;
  console.log(`  flat tops: ${flats.map((f) => f.y.toFixed(2)).join(', ')}`);
  // and everything else, narrow surfaces included — a tyre is only 0.24 m
  // across but it is what a person actually steps on to climb a car, so the
  // follow-up item needs its real height rather than the filtered list
  const all = [...new Map(tops.map((t) => [t.y, t])).values()].sort((a, c) => a.y - c.y)
    .filter((t) => t.y > KERB && t.y < 1.0);
  console.log(`  every top under 1.0 m: ${all.map((t) => `${t.y.toFixed(2)}(${t.w}x${t.d})`).join(' ')}`);
  console.log(`  climbable from the pavement in ${step} hop(s): ${line.join(' -> ') || 'nothing'}`);
  if (at < highest) {
    console.log(`  STUCK at ${at.toFixed(2)}; the highest surface is ${highest.toFixed(2)}, `
      + `so it needs a step at ${(at + 0.01).toFixed(2)}..${(at + REACH).toFixed(2)} that it does not have`);
  }
}
await b.close();
