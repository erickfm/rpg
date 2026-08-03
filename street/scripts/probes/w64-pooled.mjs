// w64: how many materials in the world actually carry the per-fragment pool?
// Item 156. `attachPool` stamps customProgramCacheKey = 'w45pool'; anything
// without it is lit only by the CPU ambient grade, so a lamp pool stops dead
// at its edge. Reports the whole world, then the meshes near a given point.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const CX = +(process.env.CX ?? 0), CZ = +(process.env.CZ ?? 0), RAD = +(process.env.RAD ?? 14);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1064, height: 796 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(1200);
const out = await p.evaluate(({ CX, CZ, RAD }) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const seen = new Map(); let meshes = 0;
  const near = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    meshes++;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox ? g.boundingBox.clone().applyMatrix4(o.matrixWorld) : null;
    const mm = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mm) { if (!m) continue; if (!seen.has(m)) seen.set(m, !!(m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool')); }
    if (!bb) return;
    const dx = Math.max(bb.min.x - CX, 0, CX - bb.max.x), dz = Math.max(bb.min.z - CZ, 0, CZ - bb.max.z);
    if (Math.hypot(dx, dz) > RAD) return;
    near.push({ d: +Math.hypot(dx, dz).toFixed(2),
      x0: +bb.min.x.toFixed(2), x1: +bb.max.x.toFixed(2), z0: +bb.min.z.toFixed(2), z1: +bb.max.z.toFixed(2),
      y0: +bb.min.y.toFixed(2), y1: +bb.max.y.toFixed(2),
      pooled: mm.map(m => !!(m && m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool')),
      col: mm.map(m => (m && m.color ? '#' + m.color.getHexString() : null)),
      blend: mm.map(m => m ? m.blending : null) });
  });
  let pooled = 0; for (const v of seen.values()) if (v) pooled++;
  const call = (k) => { try { const v = s.userData[k]; return typeof v === 'function' ? v() : v; } catch (e) { return String(e); } };
  return { meshes, materials: seen.size, pooled, lampHeadCount: call('lampHeadCount'),
    uploaded: call('lampHeadsUploaded'), near };
}, { CX, CZ, RAD });
console.log(`meshes ${out.meshes} · materials ${out.materials} · POOLED ${out.pooled} (${(100 * out.pooled / out.materials).toFixed(1)}%)`);
console.log(`lampHeadCount ${JSON.stringify(out.lampHeadCount)} uploaded ${JSON.stringify(out.uploaded)}`);
console.log(`near (${CX},${CZ}) r${RAD}: ${out.near.length} meshes`);
out.near.sort((a, b2) => a.d - b2.d);
for (const n of out.near.slice(0, 80)) console.log(`  d${n.d} x[${n.x0},${n.x1}] z[${n.z0},${n.z1}] y[${n.y0},${n.y1}] pooled=${n.pooled} ${n.col}`);
await b.close();
