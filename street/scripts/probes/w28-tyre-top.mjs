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
    let top = -1, cy = 0, segs = 0, rad = 0, depth = 0;
    g.traverse((o) => {
      if (!o.geometry || o.geometry.type !== 'CylinderGeometry') return;
      const q = o.geometry.parameters;
      if (Math.abs(q.radiusTop - q.radiusBottom) > 1e-9) return;   // wheels only
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (bb.max.y > top) {
        top = bb.max.y; cy = o.position.y; segs = q.radialSegments;
        rad = q.radiusTop; depth = bb.max.z - bb.min.z;
      }
    });
    g.parent.remove(g);
    return { top, cy, segs, rad, depth, tyre: g.userData.tyre };
  }, kind);
  // A CylinderGeometry with N radial segments is an N-gon, not a circle. Laid
  // on its side as a wheel it stands on a FLAT, so its top is the apothem
  // above centre — r·cos(π/N) — not r.
  const apothem = r.rad * Math.cos(Math.PI / r.segs);
  console.log(`${kind.padEnd(7)} wheel r=${r.rad} segs=${r.segs} centre y=${r.cy}`
    + `  userData.tyre=${r.tyre}`);
  console.log(`        measured top ${r.top.toFixed(4)}   z-extent ${r.depth.toFixed(4)} (= 2r)`
    + `   predicted r+r·cos(π/${r.segs}) = ${(r.cy + apothem).toFixed(4)}`
    + `   naive r+r = ${(r.cy + r.rad).toFixed(4)}`);
}
await b.close();
