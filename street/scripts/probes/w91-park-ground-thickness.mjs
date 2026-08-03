// ITEM 238 — THE ONE MESH THAT DECIDES IT.
//
// The AABB floor predicate (`lib/floors.mjs:56`) drops any mesh whose world
// bounding box is more than **0.6 m** thick in Y: `if (mxy - mny > 0.6) return;`
//
// Item 172 gave the park real topography TODAY, taking its relief from 0.366 m
// to **0.633 m** (`ct/park.ts:648`). 0.633 > 0.6. So the park's entire ground
// plane fell out of the AABB predicate the moment that landed, and every check
// built on that predicate now believes the park has no floor.
//
// This prints the ground planes near the threshold so the margin is a measured
// number and not an inference from a comment.
//
//   SHOT_URL=http://localhost:4470/ node scripts/probes/w91-park-ground-thickness.mjs
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';

const SITE = aim('http://localhost:4470/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(SITE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, SITE);
await page.evaluate(() => window.__ct.clock(13, 0));

const out = await page.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const big = [];
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
    const dx = mxx - mnx, dy = mxy - mny, dz = mxz - mnz;
    // big, groundish things only: >= 8 m across in both axes and near y 0
    if (dx >= 8 && dz >= 8 && mxy < 2 && mxy > -2) {
      big.push({ ty: o.geometry.type, nm: o.name || '', dx: +dx.toFixed(3), dy: +dy.toFixed(3), dz: +dz.toFixed(3),
        minX: +mnx.toFixed(2), maxX: +mxx.toFixed(2), minZ: +mnz.toFixed(2), maxZ: +mxz.toFixed(2),
        minY: +mny.toFixed(3), maxY: +mxy.toFixed(3),
        parkGround: o.userData && o.userData.parkGround ? String(o.userData.parkGround) : '' });
    }
  });
  big.sort((a, c) => c.dy - a.dy);
  const sites = window.__ct.sites();
  return { big, park: sites.park || null };
});

console.log(`\npark site rectangle: ${out.park ? `x ${out.park.minX}…${out.park.maxX}  z ${out.park.minZ}…${out.park.maxZ}` : 'not published'}`);
console.log(`\nbig ground-level meshes (>= 8 m in both axes, |y| < 2), thickest first`);
console.log(`the AABB predicate DROPS anything with dy > 0.600\n`);
console.log('   dy      dx     dz    x span            z span           verdict');
for (const m of out.big.slice(0, 14)) {
  const drop = m.dy > 0.6;
  console.log(`  ${String(m.dy).padStart(6)}  ${String(m.dx).padStart(6)} ${String(m.dz).padStart(6)}  `
    + `${(m.minX + '…' + m.maxX).padEnd(17)} ${(m.minZ + '…' + m.maxZ).padEnd(16)} `
    + `${drop ? 'DROPPED — invisible to the AABB predicate' : 'kept'}${m.parkGround ? `  [parkGround=${m.parkGround}]` : ''}`);
}

const dropped = out.big.filter((m) => m.dy > 0.6);
console.log(`\n${dropped.length} of ${out.big.length} big ground meshes are DROPPED by the 0.6 m thickness test.`);
for (const m of dropped) {
  console.log(`  margin: dy ${m.dy} vs threshold 0.600 — over by ${(m.dy - 0.6).toFixed(3)} m`
    + `  (${m.dx} x ${m.dz} m of ground at x ${m.minX}…${m.maxX}, z ${m.minZ}…${m.maxZ})`);
}

await b.close();
