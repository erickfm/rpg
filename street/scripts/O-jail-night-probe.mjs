import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(aim('http://localhost:4186/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(400);

// discover the jail room's slab centre the same way interiors-walk does:
// enter via E from its own door landing (60.12, -100.8), then read pos()
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const pos = () => p.evaluate(() => window.__ct.pos());
await warp(60.25, -103, Math.PI, 0.14);
await p.waitForTimeout(150);
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(400);
const p0 = await pos();
console.log('entered at', p0);
const cx = p0[0];

const sample = () => p.evaluate((cx) => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const wp = new o.position.constructor();
    o.getWorldPosition(wp);
    if (Math.abs(wp.x - cx) > 8 || Math.abs(wp.z) > 8) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m && m.color && !m.transparent) {
        out.push({
          hex: m.color.getHex(),
          name: o.name || '(unnamed)',
          type: o.type,
          matType: m.type,
          wx: wp.x, wy: wp.y, wz: wp.z,
          uuid: m.uuid,
          userData: JSON.stringify(o.userData || {}),
          matUserData: JSON.stringify(m.userData || {}),
        });
      }
    }
  });
  return out;
}, cx);

await p.evaluate(() => window.__ct.clock(12, 0));
await p.waitForTimeout(500);
const noon = await sample();
await p.evaluate(() => window.__ct.clock(2, 0));
await p.waitForTimeout(900);
const night = await sample();

console.log('noon count', noon.length, 'night count', night.length);
let dimmed = 0;
for (let i = 0; i < noon.length; i++) {
  if (night[i] === undefined) continue;
  if (night[i].hex !== noon[i].hex) {
    dimmed++;
    console.log('--- DIMMED', i, '---');
    console.log('  noon ', noon[i]);
    console.log('  night', night[i]);
  }
}
console.log('total dimmed', dimmed, 'of', noon.length);

await b.close();
