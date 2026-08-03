// ITEM 238 — WHY DOES THE RAYCAST CLAIM 7289 CELLS THE BOXES DO NOT?
//
// `w91-floor-predicate-reconcile.mjs` found the disagreement is NOT one-signed,
// against eightyfive's stated expectation ("a bounding box can only ever
// over-cover", `w85-item230-aabb-vs-raycast.mjs:6-8`). That claim is true of a
// box versus THE MESH INSIDE IT and false of these two predicates, and the
// difference has to be shown rather than argued.
//
// So: for a sample of the ray-only cells, name the mesh whose triangle floors
// them and print the bounding box the AABB pass would have computed for it —
// then say which of the AABB filter's two size tests threw it away.
//
//   SHOT_URL=http://localhost:4470/ node scripts/probes/w91-why-ray-only.mjs
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';
import { FLOOR_LO, FLOOR_HI } from './../lib/floors.mjs';

const SITE = aim('http://localhost:4470/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(SITE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, SITE);
await page.evaluate(() => window.__ct.clock(13, 0));

const out = await page.evaluate(([LO, HI]) => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);

  // every mesh, with the AABB pass's own verdict on it recorded rather than
  // applied — so a mesh can be asked "why were you excluded?"
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb) return;
    const e = o.matrixWorld.elements;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let i = 0; i < 8; i++) {
      const vx = i & 1 ? bb.max.x : bb.min.x, vy = i & 2 ? bb.max.y : bb.min.y, vz = i & 4 ? bb.max.z : bb.min.z;
      const X = e[0] * vx + e[4] * vy + e[8] * vz + e[12];
      const Y = e[1] * vx + e[5] * vy + e[9] * vz + e[13];
      const Z = e[2] * vx + e[6] * vy + e[10] * vz + e[14];
      mnx = Math.min(mnx, X); mxx = Math.max(mxx, X);
      mny = Math.min(mny, Y); mxy = Math.max(mxy, Y);
      mnz = Math.min(mnz, Z); mxz = Math.max(mxz, Z);
    }
    const thick = mxy - mny > 0.6;
    const small = mxx - mnx < 1 || mxz - mnz < 1;
    meshes.push({
      o, nm: o.name || '(unnamed)', ty: o.geometry.type,
      minX: mnx, maxX: mxx, minZ: mnz, maxZ: mxz, y: mxy,
      dy: mxy - mny, dx: mxx - mnx, dz: mxz - mnz,
      thick, small, kept: !thick && !small,
    });
  });

  // which mesh's triangle floors a given (x, z) at the storey the picker names?
  const flooredBy = (x, z) => {
    const gy = window.__ct.groundAt(x, z);
    const hits = [];
    for (const m of meshes) {
      const pos = m.o.geometry.getAttribute && m.o.geometry.getAttribute('position');
      if (!pos) continue;
      if (x < m.minX - 0.01 || x > m.maxX + 0.01 || z < m.minZ - 0.01 || z > m.maxZ + 0.01) continue;
      const idx = m.o.geometry.getIndex();
      const n = idx ? idx.count : pos.count;
      const e = m.o.matrixWorld.elements;
      const xf = (k) => {
        const vx = pos.getX(k), vy = pos.getY(k), vz = pos.getZ(k);
        return [e[0] * vx + e[4] * vy + e[8] * vz + e[12],
          e[1] * vx + e[5] * vy + e[9] * vz + e[13],
          e[2] * vx + e[6] * vy + e[10] * vz + e[14]];
      };
      for (let t = 0; t + 2 < n; t += 3) {
        const A = xf(idx ? idx.getX(t) : t), C = xf(idx ? idx.getX(t + 1) : t + 1), D = xf(idx ? idx.getX(t + 2) : t + 2);
        const det = (C[0] - A[0]) * (D[2] - A[2]) - (D[0] - A[0]) * (C[2] - A[2]);
        if (!(Math.abs(det) > 1e-9)) continue;
        const w0 = ((C[0] - x) * (D[2] - z) - (D[0] - x) * (C[2] - z)) / det;
        const w1 = ((D[0] - x) * (A[2] - z) - (A[0] - x) * (D[2] - z)) / det;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const y = w0 * A[1] + w1 * C[1] + w2 * D[1];
        if (y >= gy - LO && y <= gy + HI) {
          hits.push({ nm: m.nm, ty: m.ty, y: +y.toFixed(2), kept: m.kept, thick: m.thick, small: m.small,
            dx: +m.dx.toFixed(2), dy: +m.dy.toFixed(2), dz: +m.dz.toFixed(2) });
          break;
        }
      }
    }
    return { gy: +gy.toFixed(2), hits };
  };

  const SAMPLE = [
    [-39, -98], [-39, -95], [-39, -90], [-38.5, -97], [-20, 17], [-15, 17],
    [1210, 0], [1210, 5], [700, 0], [900, 6],
  ];
  const probed = SAMPLE.map(([x, z]) => ({ x, z, ...flooredBy(x, z) }));

  const kept = meshes.filter((m) => m.kept).length;
  const thickOnly = meshes.filter((m) => m.thick && !m.small).length;
  const smallOnly = meshes.filter((m) => !m.thick && m.small).length;
  const bothOut = meshes.filter((m) => m.thick && m.small).length;
  return { total: meshes.length, kept, thickOnly, smallOnly, bothOut, probed };
}, [FLOOR_LO, FLOOR_HI]);

console.log(`\n${out.total} meshes in the scene`);
console.log(`  the AABB pass KEEPS      ${out.kept}   (thin in Y and >= 1 m across)`);
console.log(`  thrown out as TOO THICK  ${out.thickOnly}   (dy > 0.6)`);
console.log(`  thrown out as TOO SMALL  ${out.smallOnly}   (dx < 1 or dz < 1)`);
console.log(`  thrown out by both       ${out.bothOut}`);
console.log(`\nSo the raycast reads ${out.total - out.kept} meshes the AABB predicate never looks at.`);

console.log('\n── what floors the cells only the RAYCAST claims ──');
for (const p of out.probed) {
  const top = p.hits.slice(0, 3).map((h) => `${h.ty}${h.nm !== '(unnamed)' ? `/${h.nm}` : ''} y${h.y} `
    + `${h.dx}x${h.dy}x${h.dz} ${h.kept ? 'KEPT-by-AABB' : (h.thick ? 'dropped:THICK' : '') + (h.small ? 'dropped:SMALL' : '')}`);
  console.log(`(${p.x}, ${p.z}) gy ${p.gy} — ${p.hits.length} mesh(es) floor it`);
  top.forEach((t) => console.log(`     ${t}`));
  if (!p.hits.length) console.log('     none');
}

await b.close();
