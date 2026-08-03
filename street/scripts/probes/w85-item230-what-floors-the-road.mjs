// Item 230 — WHAT, exactly, is under (0, 0)? The sweep's mutation dropped 52
// big flat street-level meshes and the middle of the road still read FLOORED,
// so the road's floor is not (only) what I assumed it was. Naming the surfaces
// is the difference between a mutation that bites and one that is tuned until
// it passes, which BUILDER-BRIEF §7 forbids.
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';

const URL = aim('http://localhost:4410/');
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);

const out = await page.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const found = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.getAttribute && o.geometry.getAttribute('position');
    if (!pos) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const e = o.matrixWorld.elements;
    let ax = Infinity, ay = Infinity, az = Infinity, bx = -Infinity, by = -Infinity, bz = -Infinity;
    for (let i = 0; i < 8; i++) {
      const vx = i & 1 ? bb.max.x : bb.min.x, vy = i & 2 ? bb.max.y : bb.min.y, vz = i & 4 ? bb.max.z : bb.min.z;
      const X = e[0] * vx + e[4] * vy + e[8] * vz + e[12];
      const Y = e[1] * vx + e[5] * vy + e[9] * vz + e[13];
      const Z = e[2] * vx + e[6] * vy + e[10] * vz + e[14];
      ax = Math.min(ax, X); bx = Math.max(bx, X); ay = Math.min(ay, Y);
      by = Math.max(by, Y); az = Math.min(az, Z); bz = Math.max(bz, Z);
    }
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
      const w0 = ((C[0]) * (D[2]) - (D[0]) * (C[2])) / det;      // point (0,0)
      const w1 = ((D[0]) * (A[2]) - (A[0]) * (D[2])) / det;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
      const y = w0 * A[1] + w1 * C[1] + w2 * D[1];
      if (y < -0.9 || y > 1.2) continue;
      found.push({
        y: +y.toFixed(4), type: o.geometry.type,
        params: o.geometry.parameters ? JSON.stringify(o.geometry.parameters).slice(0, 90) : null,
        bbox: `x${ax.toFixed(1)}…${bx.toFixed(1)} y${ay.toFixed(2)}…${by.toFixed(2)} z${az.toFixed(1)}…${bz.toFixed(1)}`,
        spanX: +(bx - ax).toFixed(2), spanZ: +(bz - az).toFixed(2), spanY: +(by - ay).toFixed(2),
        name: o.name || o.parent?.name || '(unnamed)',
      });
      break;
    }
  });
  return found;
});
console.log(`${out.length} surface(s) inside the walkable band directly under (0, 0):\n`);
for (const s of out) console.log(`  y=${String(s.y).padEnd(8)} ${s.type.padEnd(16)} span ${String(s.spanX).padStart(7)} x ${String(s.spanZ).padStart(7)} (Y ${s.spanY})  ${s.name}\n      ${s.bbox}\n      ${s.params}`);
await b.close();
