// Item 230 — RAYCAST vs AABB, over the same points, on the same world.
//
// `w75-site-contained.mjs` decides floor-versus-void from the axis-aligned
// BOUNDING BOX of every floor-shaped mesh. This sweep decides it from an exact
// downward triangle raycast. They are not the same question, and the difference
// has a sign: **a bounding box can only ever cover MORE than the mesh in it**,
// so AABB can say "floor" where there is none and can never say "void" where
// there is floor.
//
// That matters because w75's own header records a walk out to z 16.75 north of
// the car lot — "there is real pavement out to z 16.75… I walked out there and
// photographed it" — and the raycast sweep says the floor at those x stops at
// z 13.8. Both cannot be right, and the answer decides whether the world's
// north clamp needs to become regional or is fine as it stands.
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';

const URL = aim('http://localhost:4410/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 640 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

const out = await page.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);

  // ── w75's predicate, lifted verbatim in shape: floor-shaped meshes, AABB ──
  const boxes = [];
  // ── and the exact triangles, for the raycast ─────────────────────────────
  const T = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const e = o.matrixWorld.elements;
    if (bb) {
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
      if (!(mxy - mny > 0.6) && !(mxx - mnx < 1 || mxz - mnz < 1)) {
        boxes.push({ minX: mnx, maxX: mxx, minZ: mnz, maxZ: mxz, y: mxy, nm: o.name || '?' });
      }
    }
    const pos = o.geometry.getAttribute && o.geometry.getAttribute('position');
    if (!pos) return;
    const idx = o.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
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
      T.push([A, C, D, det, o.name || '?']);
    }
  });

  const EDGE = 0.25, LO = 0.9, HI = 1.2;
  const aabb = (x, z, gy) => boxes.some((fl) =>
    x >= fl.minX - EDGE && x <= fl.maxX + EDGE && z >= fl.minZ - EDGE && z <= fl.maxZ + EDGE
    && fl.y >= gy - LO && fl.y <= gy + HI);
  const ray = (x, z, gy) => T.some(([A, C, D, det]) => {
    const w0 = ((C[0] - x) * (D[2] - z) - (D[0] - x) * (C[2] - z)) / det;
    const w1 = ((D[0] - x) * (A[2] - z) - (A[0] - x) * (D[2] - z)) / det;
    const w2 = 1 - w0 - w1;
    if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) return false;
    const y = w0 * A[1] + w1 * C[1] + w2 * D[1];
    return y >= gy - LO && y <= gy + HI;
  });

  // Which AABB boxes claim the ground north of the car lot, and what are they?
  const claimers = boxes.filter((fl) => fl.minX - EDGE <= 20 && fl.maxX + EDGE >= 20
    && fl.minZ - EDGE <= 16.75 && fl.maxZ + EDGE >= 16.75 && Math.abs(fl.y) < 1.2)
    .map((fl) => `${fl.nm} x${fl.minX.toFixed(1)}…${fl.maxX.toFixed(1)} z${fl.minZ.toFixed(1)}…${fl.maxZ.toFixed(1)} y${fl.y.toFixed(2)}`);

  // The disagreement, swept over the whole street region
  let both = 0, neither = 0, aabbOnly = 0, rayOnly = 0;
  const aabbOnlyPts = [];
  for (let x = -42; x <= 64; x += 0.5) {
    for (let z = -110; z <= 19; z += 0.5) {
      const gy = window.__ct.groundAt(x, z);
      const a = aabb(x, z, gy), r = ray(x, z, gy);
      if (a && r) both++;
      else if (!a && !r) neither++;
      else if (a) { aabbOnly++; if (aabbOnlyPts.length < 6) aabbOnlyPts.push([+x.toFixed(1), +z.toFixed(1)]); }
      else rayOnly++;
    }
  }

  // the north strip in detail
  const strip = [];
  for (let z = 13; z <= 18.5; z += 0.5) {
    const row = [];
    for (let x = 8; x <= 30; x += 2) {
      const gy = window.__ct.groundAt(x, z);
      row.push(`${aabb(x, z, gy) ? 'A' : '.'}${ray(x, z, gy) ? 'R' : '.'}`);
    }
    strip.push(`z ${z.toFixed(1).padStart(5)}  ${row.join(' ')}`);
  }

  return { boxes: boxes.length, tris: T.length, both, neither, aabbOnly, rayOnly, aabbOnlyPts, claimers, strip };
});

console.log(`${out.boxes} floor-shaped AABBs · ${out.tris} triangles\n`);
console.log('over the street region, x -42…64 z -110…19, at 0.5 m:');
console.log(`  both say FLOOR      ${out.both}`);
console.log(`  both say VOID       ${out.neither}`);
console.log(`  AABB floor, ray VOID ${out.aabbOnly}   <- bounding boxes covering ground that is not drawn`);
console.log(`  ray floor, AABB VOID ${out.rayOnly}   <- must be 0: a box always covers its own mesh`);
console.log(`  e.g. AABB-only: ${JSON.stringify(out.aabbOnlyPts)}`);
console.log(`\nAABB boxes claiming (20, 16.75) — w75's photographed "real pavement":`);
console.log(out.claimers.length ? out.claimers.map((c) => `  ${c}`).join('\n') : '  none');
console.log('\nnorth of the car lot, x 8…30 by 2 m — "A"=AABB says floor, "R"=raycast says floor');
console.log(`         ${Array.from({ length: 12 }, (_, i) => String(8 + i * 2).padStart(2)).join(' ')}`);
console.log(out.strip.join('\n'));

await b.close();
