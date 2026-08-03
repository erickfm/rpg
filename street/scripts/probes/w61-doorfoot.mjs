// WHAT IS THE BRIGHT STRIP AT THE FOOT OF THE FLAT DOORS?
//
// After hanging the six flat leaves in real openings, every one of them shows
// a pale band along its bottom edge. A shut door should show dim behind its
// undercut, not something brighter than the hall. This walks close to 401 and
// 101, shoots the foot of the door, and lists every mesh whose box spans the
// undercut band so the strip can be named rather than guessed at.
//
// Usage: SHOT_URL=http://localhost:4192/ node scripts/probes/w61-doorfoot.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4192/');
const outDir = 'shots/w61-doorfoot';
mkdirSync(outDir, { recursive: true });
const APT_X = 200, APT_Z = -20, ST = 2.7;
const AX = (l) => APT_X + l, AZI = (l) => APT_Z + l;
const at = (dx, dz) => Math.atan2(dx, -dz);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ct, null, { timeout: 60000 });
await afterFrames(page, 3);

for (const f of [0, 3]) {
  const y = f * ST;
  // stand close, and LOOK DOWN at the foot of the west door
  const sx = AX(1.05), sz = AZI(4.3);
  await page.evaluate(([x, z, yaw, gy, p]) => window.__ct.warp(x, z, yaw, gy, p),
    [sx, sz, at(AX(0) - sx, AZI(3.5) - sz), y, -0.42]);
  await afterFrames(page, 3);
  await page.screenshot({ path: `${outDir}/floor${f + 1}-foot.png` });
}

// every mesh sitting in the undercut band of 101's doorway
const near = await page.evaluate(({ x0, x1, zc, y0, y1 }) => {
  const sc = window.__ct.scene(); sc.updateMatrixWorld(true);
  const out = [];
  sc.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (b.max.x < x0 || b.min.x > x1) return;
    if (b.max.z < zc - 0.5 || b.min.z > zc + 0.5) return;
    if (b.max.y < y0 || b.min.y > y1) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    out.push({
      type: o.geometry.type, name: o.name || '',
      box: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(3)),
      color: m && m.color ? '#' + m.color.getHexString() : null,
      map: !!(m && m.map),
    });
  });
  return out;
}, { x0: AX(-0.30), x1: AX(0.10), zc: AZI(3.5), y0: -0.02, y1: 0.14 });

console.log('meshes spanning 101\'s undercut band (x AX(-0.30..0.10), y 0..0.14):');
for (const n of near) {
  console.log(`  ${n.type.padEnd(15)} ${(n.name || '-').padEnd(10)} `
    + `color=${n.color ?? '-'} map=${n.map}  box=${JSON.stringify(n.box)}`);
}
console.log(`\nshots -> ${outDir}`);
await browser.close();
