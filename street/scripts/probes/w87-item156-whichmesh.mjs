// ITEM 156 — WHICH MESHES MEET AT THE HARD EDGE?
//
// The ratio map (w87-item156-ratiomap.mjs) shows the lamp pool on the walk-up's
// wall as a bright RECTANGLE with straight vertical sides, not a radial pool:
// light stops dead at a vertical line. That is a per-surface boundary, so the
// question is which surfaces, and whether each carries the pool patch.
//
// Casts a ray from the real camera through a row of pixels across the edge and
// names the first mesh each one hits, with:
//   patched   material.customProgramCacheKey() === 'w45pool' — does this
//             surface run POOL_FRAG at all?
//   base.y    the mesh box's BASE, which is what `poolable` tests
//             (ct/props.ts: `const poolable = bx.min.y < POOL_Y1`)
//
// Ray/AABB by hand: three's Raycaster is not reachable from a scene instance,
// and the slab test against world boxes is what w60-mug-shot.mjs already does
// here for the same reason.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const Z = Number(process.argv[2] ?? -50);
const ROW = Number(process.argv[3] ?? 330);
const W = 1000, H = 640;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.evaluate(([ZZ]) => window.__ct.warp(-2.0, ZZ, Math.PI / 2, 0, 0.08), [Z]);
await p.evaluate(() => window.__ct.clock(23, 0));
await p.waitForTimeout(900);

const rows = await p.evaluate(([w, h, row]) => {
  const cam = window.__ct.camera(), s = window.__ct.scene();
  s.updateMatrixWorld(true); cam.updateMatrixWorld(true);
  const V = cam.position.constructor;
  const out = [];
  for (let px = 360; px <= 760; px += 10) {
    const ndcx = (px / w) * 2 - 1, ndcy = -((row / h) * 2 - 1);
    const far = new V(ndcx, ndcy, 0.5).unproject(cam);
    const dir = far.clone().sub(cam.position).normalize();
    let best = null;
    s.traverse((n) => {
      if (!n.isMesh || !n.geometry) return;
      for (let q = n; q; q = q.parent) if (q.visible === false) return;
      const g = n.geometry; if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox) return;
      const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
      let t0 = 0.05, t1 = 400;
      for (const ax of ['x', 'y', 'z']) {
        const o = cam.position[ax], d = dir[ax];
        if (Math.abs(d) < 1e-9) { if (o < bb.min[ax] || o > bb.max[ax]) return; continue; }
        let a = (bb.min[ax] - o) / d, c = (bb.max[ax] - o) / d;
        if (a > c) { const t = a; a = c; c = t; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) return;
      }
      if (!best || t0 < best.t) {
        const mm = Array.isArray(n.material) ? n.material : [n.material];
        const m = mm[0];
        best = {
          t: +t0.toFixed(2), id: n.id,
          patched: !!(m && m.customProgramCacheKey && m.customProgramCacheKey() === 'w45pool'),
          col: m && m.color ? '#' + m.color.getHexString() : '?',
          baseY: +bb.min.y.toFixed(2), topY: +bb.max.y.toFixed(2),
          spanX: +(bb.max.x - bb.min.x).toFixed(2), spanZ: +(bb.max.z - bb.min.z).toFixed(2),
          bx: [+bb.min.x.toFixed(2), +bb.max.x.toFixed(2)],
          bz: [+bb.min.z.toFixed(2), +bb.max.z.toFixed(2)],
          poolLit: !!(m && m.userData && m.userData.poolLit),
        };
      }
    });
    out.push({ px, hit: best });
  }
  return out;
}, [W, H, ROW]);

console.log(`ray row y=${ROW}, standing x -2 z ${Z} looking east, 23:00\n`);
let last = null;
for (const r of rows) {
  const h = r.hit;
  if (!h) { console.log(`  px ${r.px}  (nothing)`); continue; }
  const key = `${h.id}`;
  const mark = key !== last ? ' <== different mesh' : '';
  last = key;
  console.log(`  px ${String(r.px).padStart(3)}  mesh#${String(h.id).padStart(5)}  patched=${h.patched ? 'YES' : 'no '}  poolLit=${h.poolLit ? 'Y' : 'n'}`
    + `  base.y ${String(h.baseY).padStart(6)}  top ${String(h.topY).padStart(6)}  spanX ${String(h.spanX).padStart(6)} spanZ ${String(h.spanZ).padStart(6)}`
    + `  ${h.col}  x[${h.bx}] z[${h.bz}]${mark}`);
}
await b.close();
