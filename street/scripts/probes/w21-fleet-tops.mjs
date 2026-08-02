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

// THE WORST-CASE APEX, not fp.ts:446's 0.571 — that is the continuous figure
// and the world never reaches it. fp.ts:455-456 is semi-implicit Euler (`vy`
// decremented before the position update), which loses v0·dt/2 per frame, and
// main.ts:107 clamps dt at 0.05. Measured at 0.475 by
// scripts/probes/w21-apex.mjs; 0.471 is the analytic value at that clamp and
// is the floor no frame can fall below. TOP_EPS is fp.ts:52.
const APEX = 4.0 * 4.0 / (2 * 14) - 4.0 * 0.05 / 2, EPS = 0.08, REACH = APEX + EPS;
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
  const highest = flats.length ? flats[flats.length - 1].y : 0;
  console.log(`  flat tops: ${flats.map((f) => f.y.toFixed(2)).join(', ')}`);
  // and everything else, narrow surfaces included — a tyre is only 0.24 m
  // across but it is what a person actually steps on to climb a car, so the
  // follow-up item needs its real height rather than the filtered list
  const all = [...new Map(tops.map((t) => [t.y, t])).values()].sort((a, c) => a.y - c.y)
    .filter((t) => t.y > KERB && t.y < 1.0);
  console.log(`  every top under 1.0 m: ${all.map((t) => `${t.y.toFixed(2)}(${t.w}x${t.d})`).join(' ')}`);
  // THE ONE QUESTION THAT DECIDES IT: is there anything at all you can get
  // onto from the pavement? A greedy chain over these panels lies, because
  // the 0.84 beltline is under the bonnet and the glass and nobody can stand
  // on it; what the route needs is a FIRST step, and after that the truck's
  // own column shows the rest is easy. The proven route is a walk, not this:
  // scripts/w21-roof-climb.mjs.
  const first = all.filter((t) => t.y <= KERB + REACH && t.y > KERB + 0.15);
  if (!first.length) {
    console.log(`  NO FIRST STEP: nothing between ${(KERB + 0.15).toFixed(2)} and ${(KERB + REACH).toFixed(2)}, `
      + `so the ${highest.toFixed(2)} roof cannot be started from the pavement at all`);
  } else {
    console.log(`  first step available: ${first.map((t) => `${t.y.toFixed(2)} (${t.w}x${t.d}, margin ${(KERB + REACH - t.y).toFixed(3)})`).join(', ')}`);
  }
}
await b.close();
