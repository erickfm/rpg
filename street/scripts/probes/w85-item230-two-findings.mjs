// Item 230 — pin down the two things the grid sweep reported, at a resolution
// the grid cannot have. Both are "is this the world or is it my instrument?"
//
//   1. THE HOLE AT x 880.00, z -9.5…-8.5. That x is EXACTLY the party-wall
//      plane (hotel 874.32 in the slab ending at 880, casino 885.68 in the one
//      starting there). A 0.5 m grid whose cell centre lands exactly on a seam
//      between two floor slabs is the single most likely way to invent a hole,
//      so this walks a 5 mm line across it and reports where coverage really
//      stops.
//   2. HOW FAR NORTH THE STREET GOES, per x. The bound clamps at z 19 while the
//      street's own end is 13. Does the player ever actually reach past 13, or
//      does a collider stop him first? A regional bound is a change to fp.ts,
//      the movement core; it should not be made on a guess about who binds.
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';

const URL = aim('http://localhost:4410/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);

// The same exact downward triangle raycast the sweep uses, but point-major and
// arbitrary-precision, so it can be asked about any single point.
const install = () => page.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const T = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.getAttribute && o.geometry.getAttribute('position');
    if (!pos) return;
    const idx = o.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    const e = o.matrixWorld.elements;
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
      T.push([A, C, D, det, o.name || o.parent?.name || '?']);
    }
  });
  window.__hits = (px, pz) => {
    const out = [];
    for (const [A, C, D, det, nm] of T) {
      const w0 = ((C[0] - px) * (D[2] - pz) - (D[0] - px) * (C[2] - pz)) / det;
      const w1 = ((D[0] - px) * (A[2] - pz) - (A[0] - px) * (D[2] - pz)) / det;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
      out.push({ y: +(w0 * A[1] + w1 * C[1] + w2 * D[1]).toFixed(4), nm });
    }
    return out;
  };
  return T.length;
});
console.log(`raycaster: ${await install()} triangles\n`);

const nearFloor = (hits, gy) => hits.filter((h) => h.y >= gy - 0.9 && h.y <= gy + 1.2);

// ── 1. THE SEAM AT x 880 ──────────────────────────────────────────────────
console.log('── 1. the reported hole at x 880, z -9 ─────────────────────────');
for (const z of [-9.5, -9.0, -8.5]) {
  const row = await page.evaluate(([z]) => {
    const out = [];
    for (let x = 876; x <= 884.0001; x += 0.05) {
      const gy = window.__ct.groundAt(x, z);
      const h = window.__hits(x, z).filter((v) => v.y >= gy - 0.9 && v.y <= gy + 1.2);
      out.push([+x.toFixed(2), h.length]);
    }
    return out;
  }, [z]);
  const gaps = row.filter((r) => r[1] === 0).map((r) => r[0]);
  console.log(`z ${z}:  ${gaps.length ? `NO FLOOR over x ${Math.min(...gaps).toFixed(2)}…${Math.max(...gaps).toFixed(2)} (${gaps.length} of ${row.length} samples)` : 'floored the whole way'}`);
}
const detail = await page.evaluate(() => {
  const out = {};
  for (const x of [879.4, 879.8, 879.9, 880.0, 880.1, 880.2, 880.6]) {
    const gy = window.__ct.groundAt(x, -9);
    out[x] = { gy: +gy.toFixed(3), hits: window.__hits(x, -9).map((h) => `${h.y}@${h.nm}`) };
  }
  return out;
});
console.log(JSON.stringify(detail, null, 1));

// ── 2. HOW FAR NORTH DOES THE STREET REALLY GO? ───────────────────────────
console.log('\n── 2. the street\'s north reach, per x ──────────────────────────');
console.log('  (blocked = fp.ts blocked() against STATIC colliders, RADIUS 0.36)');
const north = await page.evaluate(() => {
  const RADIUS = 0.36;
  const cols = window.__ct.staticColliders();
  const inFrame = (c, x, z) => {
    if (!c.rot) return { x, z };
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const s = Math.sin(c.rot), k = Math.cos(c.rot);
    const dx = x - cx, dz = z - cz;
    return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
  };
  const blocked = (x, z) => cols.some((c) => {
    const q = inFrame(c, x, z);
    return q.x > c.minX - RADIUS && q.x < c.maxX + RADIUS && q.z > c.minZ - RADIUS && q.z < c.maxZ + RADIUS;
  });
  const B = window.__ct.bounds();
  const rows = [];
  for (let x = -42; x <= 64; x += 1) {
    // the highest z at or below the clamp that is not inside a collider, AND
    // has floor under it
    let openTop = null, floorTop = null;
    for (let z = Math.min(B.maxZ, 24); z >= -12; z -= 0.1) {
      if (z > B.maxZ) continue;
      if (blocked(x, z)) continue;
      if (openTop === null) openTop = +z.toFixed(1);
      const gy = window.__ct.groundAt(x, z);
      if (window.__hits(x, z).some((h) => h.y >= gy - 0.9 && h.y <= gy + 1.2)) { floorTop = +z.toFixed(1); break; }
    }
    rows.push({ x, openTop, floorTop });
  }
  return { B, rows };
});
console.log(`clamp maxZ = ${north.B.maxZ}`);
const past13 = north.rows.filter((r) => r.floorTop !== null && r.floorTop > 13.0);
const openPast13 = north.rows.filter((r) => r.openTop !== null && r.openTop > 13.0);
console.log(`x with FLOOR north of z 13: ${past13.length ? past13.map((r) => `${r.x}@${r.floorTop}`).join(' ') : 'none'}`);
console.log(`x with an unblocked cell north of z 13 (floored or not): ${openPast13.length}/${north.rows.length}`);
console.log('per-x  x: openTop/floorTop');
console.log(north.rows.map((r) => `${r.x}:${r.openTop ?? '-'}/${r.floorTop ?? '-'}`).join('  '));

await b.close();
