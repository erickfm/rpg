// Item 292 — THE TRAILER'S WHEELS, MEASURED OFF THE LIVE SCENE GRAPH.
//
// Four numbers the row's DONE WHEN names, and the one it does not:
//   · does each wheel carry a HUBCAP (three materials, not one)?
//   · is the geometry `tyreGeo` — i.e. is `thetaStart` non-zero?
//   · GROUND GAP. `tyreGeo` at the wrong segment count reintroduces a float,
//     and this pair is the one the whole phase argument was derived from
//     (`ct/cars.ts`: "the only pair that measured gap 0.0000"). Must stay 0.
//   · DECK OVERHANG, which item 253 left at -0.007 m and this must not move.
//
// Everything is derived from the meshes themselves — the deck is the only
// 1.5 m-long plank-topped box on the rig, the wheels are its cylinder children
// — so nothing here is a second copy of a number `crosstown.ts` owns.
//
//   SHOT_URL=http://localhost:4750/ node scripts/probes/w119-292-trailer-wheels.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4750/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(600);

const out = await p.evaluate(() => {
  let trailer = null;
  // The trailer is the group whose children include a CylinderGeometry of
  // radius 0.22 — no other vehicle in the world has one that size.
  window.__ct.scene().traverse((o) => {
    if (trailer || !o.isGroup) return;
    const wheels = o.children.filter((c) => c.geometry
      && c.geometry.type === 'CylinderGeometry'
      && Math.abs(c.geometry.parameters.radiusTop - 0.22) < 1e-6);
    if (wheels.length === 2) trailer = o;
  });
  if (!trailer) return { found: false };

  const V = window.__ct.scene().position.constructor;
  const worldBox = (m) => {
    m.updateWorldMatrix(true, false);
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    let lo = null, hi = null;
    for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
      const v = new V(cx, cy, cz).applyMatrix4(m.matrixWorld);
      if (!lo) { lo = v.clone(); hi = v.clone(); } else { lo.min(v); hi.max(v); }
    }
    return { lo, hi };
  };
  // The TRUE lowest point of a phased polygon is a vertex, not the bounding
  // box of the untransformed geometry — read the position attribute so the
  // phase is actually measured and not assumed.
  const lowestVertex = (m) => {
    m.updateWorldMatrix(true, false);
    const pos = m.geometry.getAttribute('position');
    let min = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const v = new V(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld);
      if (v.y < min) min = v.y;
    }
    return min;
  };

  const wheels = trailer.children.filter((c) => c.geometry
    && c.geometry.type === 'CylinderGeometry'
    && Math.abs(c.geometry.parameters.radiusTop - 0.22) < 1e-6);
  const deck = trailer.children.find((c) => c.geometry
    && c.geometry.type === 'BoxGeometry'
    && Math.abs(c.geometry.parameters.depth - 1.5) < 1e-6);

  const d = worldBox(deck);
  const res = { found: true, deck: { minX: d.lo.x, maxX: d.hi.x }, wheels: [] };
  for (const w of wheels) {
    const wb = worldBox(w);
    const g = w.geometry.parameters;
    res.wheels.push({
      mats: Array.isArray(w.material) ? w.material.length : 1,
      capped: Array.isArray(w.material) && w.material.length === 3
        && !!w.material[1].map && !!w.material[2].map,
      noLightTread: Array.isArray(w.material) && !!(w.material[0].userData || {}).noLight,
      segs: g.radialSegments, thetaStart: +g.thetaStart.toFixed(6),
      minX: wb.lo.x, maxX: wb.hi.x,
      lowestY: +lowestVertex(w).toFixed(5),
      groundY: window.__ct.groundAt(w.getWorldPosition(new V()).x, w.getWorldPosition(new V()).z),
    });
  }
  return res;
});

if (!out.found) { console.error('trailer not found'); await b.close(); process.exit(3); }

console.log(`deck span X  ${out.deck.minX.toFixed(4)} … ${out.deck.maxX.toFixed(4)}`);
let wLo = Infinity, wHi = -Infinity;
for (const w of out.wheels) {
  wLo = Math.min(wLo, w.minX); wHi = Math.max(wHi, w.maxX);
  console.log(`wheel  ${w.segs}-gon  thetaStart ${w.thetaStart}  materials ${w.mats}`
    + `  HUBCAP ${w.capped ? 'yes' : 'NO'}  noLight tread ${w.noLightTread ? 'yes' : 'no'}`);
  console.log(`       lowest vertex y ${w.lowestY}  ground ${(+w.groundY).toFixed(5)}`
    + `  GAP ${(w.lowestY - w.groundY).toFixed(5)} m`);
}
console.log(`wheel span X ${wLo.toFixed(4)} … ${wHi.toFixed(4)}`);
const overhang = Math.max(out.deck.minX - wLo, wHi - out.deck.maxX);
console.log(`DECK OVERHANG (+ = tyre proud of the deck): ${overhang.toFixed(4)} m`);
await b.close();
