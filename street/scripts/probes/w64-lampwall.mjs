// w64: where are the lamps, and what big facades stand near them?
// Item 156 — "whats going on here with the light reflecting against the
// invisible wall?". Answers two questions in one pass, both from the running
// world rather than from the source: (1) every lamp head the pool uploads
// from, (2) every tall exterior mesh, with whether EACH of its materials
// carries the per-fragment pool patch (customProgramCacheKey === 'w45pool').
// The desk's hypothesis is a registration gap between two materials of one
// wall, so the per-material `pooled` flag is the thing that settles it.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1064, height: 796 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const ud = s.userData;
  const lamps = ud.lampList ? ud.lampList() : (ud.lamps ? ud.lamps() : null);
  const walls = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.min.x > 300) return;
    const h = bb.max.y - bb.min.y;
    if (h < 6) return;
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    walls.push({ h: +h.toFixed(2), x0: +bb.min.x.toFixed(2), x1: +bb.max.x.toFixed(2),
      z0: +bb.min.z.toFixed(2), z1: +bb.max.z.toFixed(2), y0: +bb.min.y.toFixed(2), y1: +bb.max.y.toFixed(2),
      nMat: mm.length,
      pooled: mm.map(m => !!(m && m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool')),
      col: mm.map(m => (m && m.color ? '#' + m.color.getHexString() : null)) });
  });
  return { udKeys: Object.keys(ud), lamps, nWalls: walls.length, walls };
});
console.log('scene.userData keys:', out.udKeys.join(' '));
console.log('lamps:', JSON.stringify(out.lamps));
console.log('tall meshes:', out.nWalls);
for (const w of out.walls) console.log(`  ${w.h}m  x[${w.x0},${w.x1}] z[${w.z0},${w.z1}] y[${w.y0},${w.y1}] mats=${w.nMat} pooled=${w.pooled} ${w.col}`);
await b.close();
