// Item 221 — is there a WALL where the player walks through, and what do you
// see standing at the lot's north end? Lists the tall thin meshes on each site
// flank plane, then photographs the lot's north end from inside.
//
// Why it matters: a collider is only honest if it matches what the eye is told.
// `openSite` DRAWS a party wall on both flanks of every site; if that plane is
// really there, walking through it is the defect and the collider is the fix.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';

const URL = aim('http://localhost:4350/');
const TAG = process.argv[2] || 'before';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(13, 0));

const walls = await page.evaluate(() => {
  const out = [];
  const sc = window.__ct.scene(); sc.updateMatrixWorld(true);
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
      mnx = Math.min(mnx, X); mxx = Math.max(mxx, X); mny = Math.min(mny, Y);
      mxy = Math.max(mxy, Y); mnz = Math.min(mnz, Z); mxz = Math.max(mxz, Z);
    }
    if (mxy - mny < 5) return;                          // tall
    if (mxz - mnz > 0.6) return;                        // thin in z
    if (mxx - mnx < 5) return;                          // and wide in x
    out.push({ x: [+mnx.toFixed(2), +mxx.toFixed(2)], z: +((mnz + mxz) / 2).toFixed(2), h: +(mxy - mny).toFixed(2), mod: o.userData.mod || '' });
  });
  return out.sort((a, c) => a.z - c.z);
});
console.log('tall z-facing planes wider than 5 m (the site flanks are among these):');
for (const w of walls) console.log(`  z ${String(w.z).padStart(8)}  x ${String(w.x).padEnd(18)} h ${w.h}  ${w.mod}`);

const shots = [
  ['lot-north-from-inside', 12, 10.5, Math.PI],
  ['lot-north-wide', 20, 6.0, Math.PI],
];
for (const [nm, x, z, yaw] of shots) {
  await page.evaluate(([x, z, yaw]) =>
    window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, 0), [x, z, yaw]);
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__ct.clock(13, 0));
  // `afterFrames` is not "painted" (GOTCHAS 80) and a black frame is exactly
  // what this probe would otherwise report as evidence.
  await waitPainted(page, { frames: 4 });
  const p = `shots/w79-${nm}-${TAG}.png`;
  const buf = await page.screenshot({ path: p });
  const blk = await blackFraction(page, buf);
  console.log(`wrote ${p}  black ${(blk * 100).toFixed(1)}%${blk > 0.9 ? '  *** PHOTOGRAPHED THE VOID ***' : ''}`);
}
await b.close();
