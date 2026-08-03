// Exploratory: what meshes stand in the jail's sally port?
// Locates the jail from the world's own site registry rather than a typed
// coordinate, then dumps every mesh in the door's neighbourhood.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
// The world culls by region — at spawn the jail is not in the scene at all, so
// a dump taken from the spawn point reports "no door" and means nothing.
// Stand at the user's own approach first. (GOTCHAS 48's family: an instrument
// aimed at the wrong place reports a clean bill of health it did not earn.)
await p.evaluate(() => window.__ct.warp(58.5, -103));
await p.waitForTimeout(1200);
console.log('stood at', JSON.stringify(await p.evaluate(() => window.__ct.pos())));

const out = await p.evaluate(() => {
  const ct = window.__ct;
  const site = ct.site ? ct.site('jail') : null;
  const s = ct.scene(); s.updateMatrixWorld(true);
  const boxes = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    boxes.push({
      x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y, z0: bb.min.z, z1: bb.max.z,
      w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y, d: bb.max.z - bb.min.z,
      type: o.geometry.type,
      maps: mats.map((m) => (m && m.map && m.map.image ? `${m.map.image.width}x${m.map.image.height}` : 'none')).join(','),
      colr: mats.map((m) => (m && m.color ? '#' + m.color.getHexString() : '-')).join(','),
      tr: mats.some((m) => m && m.transparent),
    });
  });
  return { site, boxes, keys: Object.keys(ct) };
});
await b.close();

console.log('__ct keys:', out.keys.join(' '));
console.log('site(jail):', JSON.stringify(out.site));

// thin upright slabs anywhere in the world, ~3 m tall — the leaf shape
const slabs = out.boxes.filter((o) => o.w < 0.2 && o.h > 2.5 && o.h < 3.5 && o.d > 0.8 && o.d < 2.0);
console.log(`\nthin upright slabs (w<0.2, 2.5<h<3.5, 0.8<d<2.0): ${slabs.length}`);
for (const o of slabs.slice(0, 30)) {
  console.log(`  x ${o.x0.toFixed(2)}…${o.x1.toFixed(2)}  y ${o.y0.toFixed(2)}…${o.y1.toFixed(2)}  z ${o.z0.toFixed(2)}…${o.z1.toFixed(2)}  maps=${o.maps} col=${o.colr} tr=${o.tr}`);
}
console.log(`\ntotal meshes: ${out.boxes.length}`);
