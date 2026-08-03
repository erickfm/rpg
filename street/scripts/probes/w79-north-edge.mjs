// WHERE DOES THE WORLD END AT THE NORTH, AND WHAT LETS THE PLAYER PAST IT?
// Item 221. Read-only: measures the rig's bounds, the floor coverage north of
// the car lot, and the colliders in that band. Nothing is asserted here — this
// is the "measure before you demolish" step.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4350/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const out = await page.evaluate(() => {
  const sc = window.__ct.scene();
  sc.updateMatrixWorld(true);
  const floors = [];
  sc.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox; if (!bb) return;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    const e = o.matrixWorld.elements;
    for (let i = 0; i < 8; i++) {
      const vx = i & 1 ? bb.max.x : bb.min.x, vy = i & 2 ? bb.max.y : bb.min.y, vz = i & 4 ? bb.max.z : bb.min.z;
      const X = e[0] * vx + e[4] * vy + e[8] * vz + e[12];
      const Y = e[1] * vx + e[5] * vy + e[9] * vz + e[13];
      const Z = e[2] * vx + e[6] * vy + e[10] * vz + e[14];
      mnx = Math.min(mnx, X); mxx = Math.max(mxx, X);
      mny = Math.min(mny, Y); mxy = Math.max(mxy, Y);
      mnz = Math.min(mnz, Z); mxz = Math.max(mxz, Z);
    }
    if (mxy - mny > 0.6) return;
    if (mxx - mnx < 1 || mxz - mnz < 1) return;
    floors.push({ name: o.name || '(anon)', mod: o.userData.mod || '', minX: mnx, maxX: mxx, minZ: mnz, maxZ: mxz, y: mxy });
  });
  return {
    sites: window.__ct.sites(),
    bounds: window.__ct.bounds ? window.__ct.bounds() : null,
    nFloors: floors.length,
    // every floor reaching north of z 12
    north: floors.filter((f) => f.maxZ > 12).map((f) => ({
      mod: f.mod, x: [+f.minX.toFixed(2), +f.maxX.toFixed(2)], z: [+f.minZ.toFixed(2), +f.maxZ.toFixed(2)], y: +f.y.toFixed(2),
    })).sort((a, c) => c.z[1] - a.z[1]),
    colliders: (window.__ct.colliders() ?? []).filter((c) => c.maxZ > 12 && c.minX > -12 && c.minX < 40)
      .map((c) => ({ x: [+c.minX.toFixed(2), +c.maxX.toFixed(2)], z: [+c.minZ.toFixed(2), +c.maxZ.toFixed(2)] }))
      .sort((a, c) => c.z[1] - a.z[1]).slice(0, 40),
  };
});
console.log('sites:', JSON.stringify(out.sites));
console.log('bounds:', JSON.stringify(out.bounds));
console.log(`floor meshes total ${out.nFloors}; reaching north of z=12: ${out.north.length}`);
for (const f of out.north) console.log(`  ${String(f.mod).padEnd(10)} x ${String(f.x)} z ${String(f.z)} y ${f.y}`);
console.log(`colliders with maxZ>12 near the street (${out.colliders.length}):`);
for (const c of out.colliders) console.log(`  x ${String(c.x)} z ${String(c.z)}`);

// walk the actual north clamp: warp far north and read back where we land
const probe = await page.evaluate(async () => {
  const r = [];
  for (const x of [-9, -6, -3, 0, 3, 6, 9, 12, 15, 20, 25, 30]) {
    window.__ct.warp(x, 12, 0, window.__ct.groundAt(x, 12) ?? 0.14, 0);
    r.push({ x, before: window.__ct.pos() });
  }
  return r;
});
console.log('warp targets ok:', probe.length);
await b.close();
