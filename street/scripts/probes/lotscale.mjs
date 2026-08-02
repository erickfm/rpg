// Are the lot's cars SCALED, or do they have bigger wheels on the same body?
//   ROCKER = 0.34, BELT = 0.84 (cars.ts:532) -> a 0.50 m body slab, unscaled.
//   ARCH_H = 0.38 above the rocker -> arch line 0.72, unscaled.
// If the lot's cars are scaled by s, both scale and 0.803 must be compared with
// 0.72*s. If they are NOT scaled, 0.803 stands 8.3 cm above a 0.72 arch line and
// the defect H fixed for the street fleet is live on the lot's stock.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p); await p.waitForTimeout(800);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const res = { street: [], lot: [] };
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400) return;
    // the body slab: a big box whose base is at the rocker
    const h = bb.max.y-bb.min.y, w=bb.max.x-bb.min.x, d=bb.max.z-bb.min.z;
    if (h < 0.3 || h > 0.9) return;
    if (Math.max(w,d) < 3 || Math.max(w,d) > 7) return;
    const e=o.matrixWorld.elements;
    const sc = [Math.hypot(e[0],e[1],e[2]), Math.hypot(e[4],e[5],e[6]), Math.hypot(e[8],e[9],e[10])];
    const rec = { base:+bb.min.y.toFixed(3), top:+bb.max.y.toFixed(3), h:+h.toFixed(3),
                  scale: sc.map(v=>+v.toFixed(3)), at:[+((bb.min.x+bb.max.x)/2).toFixed(1), +((bb.min.z+bb.max.z)/2).toFixed(1)] };
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2;
    if (cx > 7 && cz > -12 && cz < 14) res.lot.push(rec); else res.street.push(rec);
  });
  return res;
});
const show = (tag, arr) => {
  if (!arr.length) { console.log(`${tag}: none found`); return; }
  const a = arr[0];
  console.log(`${tag}: ${arr.length} body slabs · e.g. base ${a.base} top ${a.top} height ${a.h} scale ${a.scale.join(',')} at (${a.at.join(', ')})`);
};
show('street', out.street); show('lot   ', out.lot);
console.log('\nunscaled reference: ROCKER 0.34, BELT 0.84, slab height 0.50, arch line 0.72');
