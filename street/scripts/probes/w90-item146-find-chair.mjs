// w90 / item 146 — find the apartment chair in WORLD coordinates and look at it.
//
// It is not a registered seat (it is scenery — "a chair with yesterday's clothes
// over the back", ct/apartment.ts:3045-3063), so the seat-driven sweep in
// w90-item146-floating-backs.mjs cannot see it. Found by its own material
// colour instead: chairM is 0x6b5033, the clothes are 0x3f5a6b and 0x7a5a4a.
//
// Usage: SHOT_URL=http://localhost:4460/ node scripts/probes/w90-item146-find-chair.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
await goto(page, aim('http://localhost:4177/'));
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(1200);

const parts = await page.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const want = new Set(['6b5033', '3f5a6b', '7a5a4a']);
  const out = [];
  S.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.color) return;
    const hex = o.material.color.getHexString();
    if (!want.has(hex)) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox; if (!bb) return;
    let minY = Infinity, maxY = -Infinity;
    const v = new o.position.constructor();
    let sx = 0, sz = 0, n = 0;
    for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
      v.set(cx, cy, cz).applyMatrix4(o.matrixWorld);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      sx += v.x; sz += v.z; n++;
    }
    const p = g.parameters ?? {};
    out.push({ hex, x: +(sx / n).toFixed(2), z: +(sz / n).toFixed(2),
               minY: +minY.toFixed(3), maxY: +maxY.toFixed(3),
               w: p.width, h: p.height, d: p.depth });
  });
  return out;
});
console.log(`${parts.length} meshes wearing a chair/clothes colour:`);
for (const p of parts) console.log(`  ${p.hex}  (${p.x},${p.z})  y ${p.minY}..${p.maxY}  `
  + `box ${p.w}x${p.h}x${p.d}`);

// group by rough location so each chair reads as one thing
const at = {};
for (const p of parts) (at[`${Math.round(p.x)},${Math.round(p.z)}`] ??= []).push(p);
console.log(`\nclusters: ${Object.keys(at).join('  |  ')}`);

for (const [k, ps] of Object.entries(at)) {
  const [gx, gz] = k.split(',').map(Number);
  const seat = ps.filter((p) => p.h !== undefined && p.h <= 0.10).sort((a, b) => b.maxY - a.maxY)[0];
  const back = ps.filter((p) => p.h !== undefined && p.h >= 0.30).sort((a, b) => a.minY - b.minY)[0];
  if (seat && back) console.log(`  ${k}: panTop ${seat.maxY}  backBottom ${back.minY}  GAP ${(back.minY - seat.maxY).toFixed(3)} m`);
  // ⚠ gy IS NOT OPTIONAL HERE. 301 is on the THIRD FLOOR, and warping with the
  // street's ground puts the player under the building looking at a corridor —
  // which is exactly what my first run photographed and nearly reported on.
  // Same lesson as scripts/A-verify-301-door.mjs:62.
  const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [gx, gz]);
  console.log(`  ground at (${gx},${gz}) = ${gy}`);
  // stand back and look at it from three sides
  for (const [tag, ox, oz] of [['a', 1.3, 0], ['b', 0, 1.3], ['c', 1.0, 1.0]]) {
    const px = gx + ox, pz = gz + oz;
    await page.evaluate(([px, pz, gx, gz, gy]) =>
      window.__ct.warp(px, pz, Math.atan2(gx - px, -(gz - pz)), gy, -0.25), [px, pz, gx, gz, gy]);
    await waitPainted(page, { quiet: true });
    await page.screenshot({ path: `shots/w90-chair-${k.replace(/[^0-9-]/g, '_')}-${tag}.png` });
  }
}
console.log('\nshots -> shots/w90-chair-*.png');
await browser.close();
