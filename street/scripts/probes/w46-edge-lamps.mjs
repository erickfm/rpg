// ITEM 97 — are the leading-edge lamps actually WHERE I put them, and does
// anything stand in front of them? The blade edge and the rooftop board edge
// both got a bulb column; in the frame only part of the rooftop one lights, and
// "the mesh is missing" and "the mesh is occluded" look identical in a shot.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4180/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2000);

const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const lamps = [], blockers = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2;
    if (g.type === 'SphereGeometry' && cz < -97.2) {
      lamps.push({ x: +cx.toFixed(2), y: +cy.toFixed(2), z: +cz.toFixed(2) });
    }
    // anything solid standing between the road and those two edges
    if (bb.max.z < -99.5 || bb.min.z > -97.3) return;
    if (bb.max.x < 50 || bb.min.x > 57) return;
    if (bb.max.y < 5) return;
    blockers.push({ type: g.type, x: [+bb.min.x.toFixed(2), +bb.max.x.toFixed(2)],
      y: [+bb.min.y.toFixed(2), +bb.max.y.toFixed(2)], z: [+bb.min.z.toFixed(2), +bb.max.z.toFixed(2)] });
  });
  return { lamps, blockers };
});

const col = (lo, hi, xlo, xhi) => r.lamps.filter((l) => l.y >= lo && l.y <= hi && l.x >= xlo && l.x <= xhi)
  .sort((a, c) => a.y - c.y);
const roof = col(18, 27, 50.5, 52);
const blade = col(5, 22, 55.5, 56.5);
console.log(`rooftop-board edge lamps: ${roof.length}   y ${roof.length ? roof[0].y + '..' + roof[roof.length - 1].y : '-'}  z ${roof.length ? roof[0].z : '-'}`);
console.log(`blade edge lamps        : ${blade.length}   y ${blade.length ? blade[0].y + '..' + blade[blade.length - 1].y : '-'}  z ${blade.length ? blade[0].z : '-'}`);
console.log(`\nsolids in front of those edges (z -99.5..-97.3, x 50..57):`);
for (const o of r.blockers) console.log(`  ${o.type.padEnd(14)} x ${o.x.join('..')}  y ${o.y.join('..')}  z ${o.z.join('..')}`);
await b.close();
