// w64: stand in the street at night and describe the exterior — pooled vs
// unpooled materials among what is actually VISIBLE, plus the tall facades and
// the lamp heads. Item 156.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const X = +(process.env.X ?? -2), Z = +(process.env.Z ?? 0), H = +(process.env.H ?? 22);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(([X, Z, H]) => { window.__ct.warp(X, Z, 0, 0); window.__ct.clock(H, 30); }, [X, Z, H]);
await p.waitForTimeout(1500);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const isPool = (m) => { try { return m.customProgramCacheKey() === 'w45pool'; } catch { return false; } };
  const mats = new Set(); const tall = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mm) if (m) mats.add(m);
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.min.x > 150) return;
    if (bb.max.y - bb.min.y < 5) return;
    tall.push({ h: +(bb.max.y - bb.min.y).toFixed(2), x: [+bb.min.x.toFixed(2), +bb.max.x.toFixed(2)],
      z: [+bb.min.z.toFixed(2), +bb.max.z.toFixed(2)], y: [+bb.min.y.toFixed(2), +bb.max.y.toFixed(2)],
      pooled: mm.map(m => isPool(m)), col: mm.map(m => (m && m.color ? '#' + m.color.getHexString() : null)) });
  });
  let pooled = 0; for (const m of mats) if (isPool(m)) pooled++;
  return { pos: window.__ct.pos ? window.__ct.pos() : null, mats: mats.size, pooled, tall };
});
console.log(`pos ${JSON.stringify(out.pos)}  visible materials ${out.mats}  pooled ${out.pooled}`);
console.log(`tall exterior meshes: ${out.tall.length}`);
out.tall.sort((a, c) => a.x[0] - c.x[0]);
for (const t of out.tall) console.log(`  h${t.h} x[${t.x}] z[${t.z}] y[${t.y}] pooled=${t.pooled} ${t.col}`);
await b.close();
