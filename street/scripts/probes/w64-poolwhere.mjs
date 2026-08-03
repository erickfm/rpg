// w64: WHERE are the pooled materials? Splits the count by visibility and by
// world region, because a first pass found 0 pooled among visible meshes while
// 'w45pool' plainly exists in the world.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const isPool = (m) => { try { return m.customProgramCacheKey() === 'w45pool'; } catch { return false; } };
  const vis = new Set(), invis = new Set(); const sample = [];
  s.traverse(o => {
    if (!o.isMesh) return;
    let v = true; for (let q = o; q; q = q.parent) if (q.visible === false) { v = false; break; }
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mm) { if (!m) continue; (v ? vis : invis).add(m); }
    if (mm.some(m => m && isPool(m))) {
      const g = o.geometry; if (g && !g.boundingBox) g.computeBoundingBox();
      const bb = g && g.boundingBox ? g.boundingBox.clone().applyMatrix4(o.matrixWorld) : null;
      if (sample.length < 25) sample.push({ vis: v, type: o.type,
        bb: bb ? [+bb.min.x.toFixed(1), +bb.max.x.toFixed(1), +bb.min.y.toFixed(1), +bb.max.y.toFixed(1), +bb.min.z.toFixed(1), +bb.max.z.toFixed(1)] : null });
    }
  });
  const cnt = (set) => { let n = 0; for (const m of set) if (isPool(m)) n++; return n; };
  return { visMats: vis.size, visPooled: cnt(vis), invisMats: invis.size, invisPooled: cnt(invis), sample };
}), null, 1));
await b.close();
