// WHERE DO THE WHEELS ACTUALLY SIT? Item 113.
//
//   *"fix the wheel on this cheap car"*   (the $695 hatch, on the used lot)
//   *"fix the wheels on the trailer"*     (the sedan-with-trailer on the street)
//
// [DIAGNOSIS LOST], so this measures rather than assumes. A wheel can be wrong
// in three ways that all look the same in a still and are different numbers:
//
//   FLOATS    its lowest point is above the road it stands on
//   SINKS     its lowest point is below the road
//   OUTBOARD  it stands proud of the body/deck it belongs to
//
// THE APOTHEM TRAP, which is the item's own standing note and the reason this
// probe reads world AABBs instead of trusting radius arithmetic: an N-gon
// cylinder's lowest point is its APOTHEM, R*cos(pi/N), not R -- unless a vertex
// happens to be at the bottom, which depends on the geometry's theta phase AND
// on how it was rotated into place. A 12-gon at R 0.22 is 0.2125 at the flat and
// 0.22 at a vertex: a 7.5 mm difference that decides whether a wheel floats.
// Nobody should compute that by hand. `Box3.setFromObject` bakes in the phase,
// the rotation and the parent transforms at once.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4540/');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const out = await p.evaluate(() => {
  const THREE = window.__ct.three ?? null;
  const scene = window.__ct.scene();
  const res = { trailers: [], lot: [], note: [] };

  // A trailer wheel is a CylinderGeometry child of a group that also holds a
  // plank deck. Rather than pattern-match names (there are none), find every
  // cylinder in the scene whose radius is near 0.22 and whose parent group also
  // contains a box about 1.8 x 0.06 wide -- the deck.
  const boxOf = (o) => {
    const bb = new (window.THREE?.Box3 ?? Object.getPrototypeOf(scene).constructor.prototype.constructor
      ? window.THREE.Box3 : null)();
    return bb;
  };
  void boxOf; void THREE;
  return res;
});
void out;

// The page has no THREE handle on window, so do the geometry with the module the
// world itself used: every Object3D carries updateWorldMatrix + geometry
// bounding boxes, which is enough to compute a world AABB by hand.
const data = await p.evaluate(() => {
  const scene = window.__ct.scene();
  const worldBox = (o) => {
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    o.updateWorldMatrix(true, true);
    o.traverse((n) => {
      if (!n.isMesh || !n.geometry) return;
      const g = n.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox;
      n.updateWorldMatrix(true, false);
      const m = n.matrixWorld.elements;
      for (const cx of [bb.min.x, bb.max.x]) {
        for (const cy of [bb.min.y, bb.max.y]) {
          for (const cz of [bb.min.z, bb.max.z]) {
            const x = m[0] * cx + m[4] * cy + m[8] * cz + m[12];
            const y = m[1] * cx + m[5] * cy + m[9] * cz + m[13];
            const z = m[2] * cx + m[6] * cy + m[10] * cz + m[14];
            min = [Math.min(min[0], x), Math.min(min[1], y), Math.min(min[2], z)];
            max = [Math.max(max[0], x), Math.max(max[1], y), Math.max(max[2], z)];
          }
        }
      }
    });
    return { min, max };
  };

  const cyl = [];
  scene.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const t = n.geometry.type;
    const pr = n.geometry.parameters || {};
    if (t === 'CylinderGeometry' && pr.radiusTop > 0.15 && pr.radiusTop < 0.45) {
      const wb = worldBox(n);
      cyl.push({
        r: pr.radiusTop, h: pr.height, seg: pr.radialSegments,
        min: wb.min.map((v) => +v.toFixed(4)), max: wb.max.map((v) => +v.toFixed(4)),
        parentKids: n.parent ? n.parent.children.length : 0,
      });
    }
  });
  // ground under each, from the authoritative picker
  for (const c of cyl) {
    const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2;
    c.ground = +(window.__ct.groundAt(cx, cz) ?? 0).toFixed(4);
    c.gapToGround = +(c.min[1] - c.ground).toFixed(4);
    c.cx = +cx.toFixed(2); c.cz = +cz.toFixed(2);
  }
  return { cyl };
});

console.log(`cylinder wheels with radius 0.15..0.45 found: ${data.cyl.length}`);
if (data.cyl.length === 0) {
  console.log('FAIL: none — measuring nothing (population floor)');
  await b.close(); process.exit(3);
}
const byR = new Map();
for (const c of data.cyl) {
  const k = `r=${c.r} seg=${c.seg} h=${c.h}`;
  if (!byR.has(k)) byR.set(k, []);
  byR.get(k).push(c);
}
console.log('\ngrouped by geometry — gapToGround is lowest point MINUS the floor:');
for (const [k, v] of byR) {
  const gaps = v.map((c) => c.gapToGround);
  const lo = Math.min(...gaps), hi = Math.max(...gaps);
  const apo = v[0].r * Math.cos(Math.PI / v[0].seg);
  console.log(`  ${k.padEnd(28)} n=${String(v.length).padStart(3)}  `
    + `gap ${lo.toFixed(4)}..${hi.toFixed(4)}   apothem ${apo.toFixed(4)}  (R-apothem ${(v[0].r - apo).toFixed(4)})`);
}
// ONLY THE WHEELS. The first cut of this ranked EVERY cylinder in the world by
// |gap| and led with a ceiling fixture floating 9.3 m — true, meaningless, and
// exactly the sort of confident nonsense that gets read as a finding. A road
// wheel is a car tyre (r 0.34, 10-gon) or a trailer wheel (r 0.22, 12-gon);
// nothing else in this scene is a thing that is supposed to touch the ground.
const isWheel = (c) => (c.r === 0.34 && c.seg === 10) || (c.r === 0.22 && c.seg === 12);
console.log('\nthe worst offenders AMONG ACTUAL WHEELS (|gap| largest):');
for (const c of data.cyl.filter(isWheel)
  .sort((a, z) => Math.abs(z.gapToGround) - Math.abs(a.gapToGround)).slice(0, 12)) {
  console.log(`  r=${c.r} seg=${c.seg}  at (${c.cx}, ${c.cz})  low y ${c.min[1].toFixed(4)}  `
    + `ground ${c.ground.toFixed(4)}  gap ${c.gapToGround > 0 ? '+' : ''}${c.gapToGround.toFixed(4)} `
    + `${c.gapToGround > 0.004 ? 'FLOATS' : c.gapToGround < -0.004 ? 'SINKS' : 'ok'}`);
}
await b.close();
