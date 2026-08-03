#!/usr/bin/env node
// One question: how high is the top of a car's tyre, to the millimetre, and why
// is it not the 0.68 that `ct/cars.ts` states in four comments?
//
// w21 measured 0.66 off the mesh and flagged the disagreement without a cause
// (`notes/w21-car-roof-climb.md`, "found and NOT fixed" §2). Queue item 47's own
// text then depends on the number: "the tyre at 0.66 m, clearing the kerb by
// 28 mm". A 2 cm error in the only candidate first step in the fleet is worth
// nailing down, in a file that has been bitten by hand-typed numbers before.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w28-tyre-top.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

for (const kind of ['sedan', 'hatch', 'pickup', 'van']) {
  const r = await p.evaluate((k) => {
    const g = window.__ct.carVariant(k, {}, 400, 400, 0);
    g.updateMatrixWorld(true);
    let top = -1, cy = 0, segs = 0, rad = 0, depth = 0, theta = 0;
    g.traverse((o) => {
      if (!o.geometry || o.geometry.type !== 'CylinderGeometry') return;
      const q = o.geometry.parameters;
      if (Math.abs(q.radiusTop - q.radiusBottom) > 1e-9) return;   // wheels only
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (bb.max.y > top) {
        top = bb.max.y; cy = o.position.y; segs = q.radialSegments;
        rad = q.radiusTop; depth = bb.max.z - bb.min.z;
        theta = q.thetaStart ?? 0;
      }
    });
    g.parent.remove(g);
    return { top, cy, segs, rad, depth, theta, tyre: g.userData.tyre };
  }, kind);
  // A CylinderGeometry with N radial segments is an N-gon, not a circle, so its
  // extent in any direction is r·cos(δ) where δ is the angle from that
  // direction to the NEAREST VERTEX. Which means the answer depends on the
  // geometry's PHASE, and this file used to assume the phase was 0.
  //
  // ⚠ THAT ASSUMPTION WAS TRUE WHEN THIS WAS WRITTEN AND IS NOT ANY MORE.
  // At thetaStart 0 a wheel stands on a FLAT: top = r·cos(π/N) above the hub,
  // which is the 0.6634 this probe was written to establish, and which was also
  // 16.6 mm of air under every tyre in the world (item 252). `tyreGeo` in
  // ct/cars.ts now phases the polygon half a segment so a VERTEX is down, and
  // the top is a clean r. Both numbers are printed below so a reader can see
  // WHICH world they are looking at rather than trusting the label — the flat
  // has moved to the horizontal, so it is now the Z-EXTENT that is short of 2r.
  const half = Math.PI / r.segs;                       // half a segment
  const vertexDown = Math.abs(((r.theta / half) % 2) - 1) < 1e-6;
  const apothem = r.rad * Math.cos(half);
  console.log(`${kind.padEnd(7)} wheel r=${r.rad} segs=${r.segs} centre y=${r.cy}`
    + `  thetaStart=${r.theta.toFixed(4)} (${vertexDown ? 'VERTEX down' : 'FLAT down'})`
    + `  userData.tyre=${r.tyre}`);
  console.log(`        measured top ${r.top.toFixed(4)}   z-extent ${r.depth.toFixed(4)}`
    + `   flat-down would be r+r·cos(π/${r.segs}) = ${(r.cy + apothem).toFixed(4)}`
    + `   vertex-down is r+r = ${(r.cy + r.rad).toFixed(4)}`);
  const want = r.cy + (vertexDown ? r.rad : apothem);
  console.log(`        ${Math.abs(r.top - want) < 1e-3 ? 'ok' : 'DISAGREES'}`
    + ` — the phase on the geometry predicts ${want.toFixed(4)}`);
}
await b.close();
