// -- LEFT ON THE AABB BOX ON PURPOSE. ITEM 250, 2026-08-03. ----------------
// Item 250 converted the world's floor CLASSIFIERS to the raycast query
// (`installRayFloorQuery`), because the AABB pass over-claims 11,948 cells and
// 88.4% of those are on open walkable ground -- the false-green direction. On
// this world the AABB pass keeps **357 of 7,866 meshes**; the ray reads all of
// them (93,493 triangles).
//
// THIS FILE IS NOT A CLASSIFIER AND WAS DELIBERATELY NOT CONVERTED.
// It validates a fast accelerator AGAINST `makeHasFloor` on random cells, then
// locates where the box under-claims. `makeHasFloor` is its reference, not its
// tool.
// Converting it would delete the question it exists to ask. If you are here
// looking for a floor predicate to USE, use the raycast -- see
// scripts/interiors-walk.mjs for the converted call sites, and mind GOTCHAS 90:
// the ray query is ASYNC and an un-awaited call is always truthy.
// --------------------------------------------------------------------------
// ITEM 238 — WHERE ARE THE 7289 CELLS THE BOXES MISS?
//
// `w91-floor-predicate-reconcile.mjs` found the AABB predicate UNDER-claims as
// well as over-claims. My first guess was "it is all the park, whose ground
// crossed the 0.6 m thickness threshold today" — **and the assertion I wrote to
// prove that went RED at 15.8%.** So the park is one cause, not the cause.
//
// This attributes every under-claimed cell to the mesh that floors it, and
// buckets by the reason the AABB pass threw that mesh away.
//
//   SHOT_URL=http://localhost:4470/ node scripts/probes/w91-where-is-the-underclaim.mjs
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';
import { EDGE, FLOOR_LO, FLOOR_HI, sampleFloors, makeHasFloor, sweepFloorsRay } from './../lib/floors.mjs';

const SITE = aim('http://localhost:4470/');
const GRID = 0.5;
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(SITE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, SITE);
await page.evaluate(() => window.__ct.clock(13, 0));

const floors = await sampleFloors(page);
const hasFloor = makeHasFloor(floors);
const sweep = await sweepFloorsRay(page, { GRID, FLOOR_LO, FLOOR_HI });
const { x0, z0, NX, NZ } = sweep;

// bucketed AABB, checked against the real predicate below
const BUCKET = 16;
const buckets = new Map();
const bkey = (i, j) => `${i},${j}`;
floors.forEach((fl) => {
  const i0 = Math.floor((fl.minX - EDGE) / BUCKET), i1 = Math.floor((fl.maxX + EDGE) / BUCKET);
  const j0 = Math.floor((fl.minZ - EDGE) / BUCKET), j1 = Math.floor((fl.maxZ + EDGE) / BUCKET);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const k = bkey(i, j);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(fl);
  }
});
const fast = (x, z, gy) => {
  const list = buckets.get(bkey(Math.floor(x / BUCKET), Math.floor(z / BUCKET)));
  if (!list) return false;
  return list.some((fl) => x >= fl.minX - EDGE && x <= fl.maxX + EDGE
    && z >= fl.minZ - EDGE && z <= fl.maxZ + EDGE
    && fl.y >= gy - FLOOR_LO && fl.y <= gy + FLOOR_HI);
};
{
  let ok = 0;
  for (let n = 0; n < 3000; n++) {
    const i = Math.floor(Math.random() * NX), j = Math.floor(Math.random() * NZ);
    const x = x0 + i * GRID, z = z0 + j * GRID, gy = sweep.gy[i * NZ + j];
    if (hasFloor(x, z, gy) === fast(x, z, gy)) ok++;
  }
  console.log(`accelerator agrees with makeHasFloor on ${ok}/3000 random cells`);
  if (ok !== 3000) { console.log('ACCELERATOR IS NOT THE PREDICATE — stopping'); await b.close(); process.exit(3); }
}

// collect the under-claimed cells
const pts = [];
for (let i = 0; i < NX; i++) {
  for (let j = 0; j < NZ; j++) {
    const k = i * NZ + j;
    if (sweep.floor[k] !== 1) continue;
    const x = x0 + i * GRID, z = z0 + j * GRID;
    if (fast(x, z, sweep.gy[k])) continue;
    pts.push([x, z, sweep.gy[k]]);
  }
}
console.log(`\n${pts.length} under-claimed cells (raycast FLOOR, AABB VOID)`);

// attribute each to the mesh that floors it, in one page call
const attrib = await page.evaluate(([pts, LO, HI]) => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.getAttribute && o.geometry.getAttribute('position');
    if (!pos) return;
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
      mnx = Math.min(mnx, X); mxx = Math.max(mxx, X); mny = Math.min(mny, Y);
      mxy = Math.max(mxy, Y); mnz = Math.min(mnz, Z); mxz = Math.max(mxz, Z);
    }
    const dx = mxx - mnx, dy = mxy - mny, dz = mxz - mnz;
    const thick = dy > 0.6, small = dx < 1 || dz < 1;
    meshes.push({ o, pos, ty: o.geometry.type, dx, dy, dz, minX: mnx, maxX: mxx, minZ: mnz, maxZ: mxz,
      why: !thick && !small ? 'KEPT' : (thick && small ? 'THICK+SMALL' : (thick ? 'THICK' : 'SMALL')) });
  });
  const tally = new Map();
  const examples = new Map();
  for (const [x, z, gy] of pts) {
    let found = null;
    for (const m of meshes) {
      if (x < m.minX - 0.01 || x > m.maxX + 0.01 || z < m.minZ - 0.01 || z > m.maxZ + 0.01) continue;
      const idx = m.o.geometry.getIndex();
      const n = idx ? idx.count : m.pos.count;
      const e = m.o.matrixWorld.elements;
      const xf = (k) => {
        const vx = m.pos.getX(k), vy = m.pos.getY(k), vz = m.pos.getZ(k);
        return [e[0] * vx + e[4] * vy + e[8] * vz + e[12],
          e[1] * vx + e[5] * vy + e[9] * vz + e[13],
          e[2] * vx + e[6] * vy + e[10] * vz + e[14]];
      };
      let hit = false;
      for (let t = 0; t + 2 < n && !hit; t += 3) {
        const A = xf(idx ? idx.getX(t) : t), C = xf(idx ? idx.getX(t + 1) : t + 1), D = xf(idx ? idx.getX(t + 2) : t + 2);
        const det = (C[0] - A[0]) * (D[2] - A[2]) - (D[0] - A[0]) * (C[2] - A[2]);
        if (!(Math.abs(det) > 1e-9)) continue;
        const w0 = ((C[0] - x) * (D[2] - z) - (D[0] - x) * (C[2] - z)) / det;
        const w1 = ((D[0] - x) * (A[2] - z) - (A[0] - x) * (D[2] - z)) / det;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const y = w0 * A[1] + w1 * C[1] + w2 * D[1];
        if (y >= gy - LO && y <= gy + HI) hit = true;
      }
      if (hit) { found = m; break; }
    }
    const label = found
      ? `${found.why}  ${found.ty} ${found.dx.toFixed(1)}x${found.dy.toFixed(2)}x${found.dz.toFixed(1)} `
        + `@ x${found.minX.toFixed(0)}…${found.maxX.toFixed(0)} z${found.minZ.toFixed(0)}…${found.maxZ.toFixed(0)}`
      : 'NO MESH FOUND (grid/exact edge case)';
    tally.set(label, (tally.get(label) || 0) + 1);
    if (!examples.has(label)) examples.set(label, [+x.toFixed(1), +z.toFixed(1)]);
  }
  return [...tally.entries()].sort((a, c) => c[1] - a[1])
    .map(([label, n]) => ({ label, n, eg: examples.get(label) }));
}, [pts, FLOOR_LO, FLOOR_HI]);

console.log('\nwhat floors them, and why the AABB pass never saw it:');
let shown = 0;
for (const a of attrib) {
  if (shown++ >= 16) break;
  console.log(`  ${String(a.n).padStart(5)}  ${a.label}   e.g. (${a.eg})`);
}
const byWhy = new Map();
for (const a of attrib) {
  const w = a.label.split(/\s+/)[0];
  byWhy.set(w, (byWhy.get(w) || 0) + a.n);
}
console.log('\ntotals by reason the mesh was excluded from the AABB predicate:');
for (const [w, n] of [...byWhy.entries()].sort((a, c) => c[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${w}`);
}

await b.close();
