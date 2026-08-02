// WHAT IS ACTUALLY BEHIND THE STATUE?
//
// The first probe found the west wall 0.78 m away. But in the player's frame
// the statue reads against a flat plaster field that fills the RIGHT of the
// shot, while the west wall recedes edge-on to the LEFT — so the surface the
// eye pairs it with may be the narthex face at z = hd - NAR_D = 9.4, not the
// west wall at all. Settle it: list every large mesh within 3 m of the statue.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from './lib/reachable.mjs';

const URL = aim('http://localhost:4192/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const press = async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(90);
  await p.keyboard.up('e'); await p.waitForTimeout(400);
};
const stand = await p.evaluate(async () => {
  const dm = await import('/src/proto/ct/doors.ts');
  return dm.doorStandFor('ST BRIGID');
});
await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0.14, 0), [stand.x, stand.z]);
await p.waitForTimeout(300);
await press();
const inside = await p.evaluate(() => window.__ct.pos());
const cx = 400 + Math.floor((inside[0] - 400) / 80) * 80 + 40;

const r = await p.evaluate(([cx]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // statue centre, room-local
  const SX = -5.55, SY = 1.75, SZ = 7.74;
  const out = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    for (let q = n; q; q = q.parent) if (q.visible === false) return;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    const lx0 = w.min.x - cx, lx1 = w.max.x - cx;
    if (lx1 < -30 || lx0 > 30) return;
    const big = (lx1 - lx0) > 0.8 || (w.max.z - w.min.z) > 0.8;
    if (!big) return;
    // does it come within 3 m of the statue in every axis?
    const dx = Math.max(lx0 - SX, SX - lx1, 0);
    const dz = Math.max(w.min.z - SZ, SZ - w.max.z, 0);
    const dy = Math.max(w.min.y - SY, SY - w.max.y, 0);
    const d = Math.hypot(dx, dy, dz);
    if (d > 3) return;
    out.push({ d: +d.toFixed(2), dx: +dx.toFixed(2), dy: +dy.toFixed(2), dz: +dz.toFixed(2),
      lx0: +lx0.toFixed(2), lx1: +lx1.toFixed(2),
      y0: +w.min.y.toFixed(2), y1: +w.max.y.toFixed(2),
      z0: +w.min.z.toFixed(2), z1: +w.max.z.toFixed(2),
      type: n.geometry.type });
  });
  return out.sort((a, b) => a.d - b.d);
}, [cx]);

console.log('every large mesh within 3 m of the statue centre (-5.55, 1.75, 7.74):\n');
console.log(' dist   dx    dy    dz  |  x range        y range        z range        geom');
for (const q of r) {
  console.log(` ${String(q.d).padStart(4)} ${String(q.dx).padStart(5)} ${String(q.dy).padStart(5)} ${String(q.dz).padStart(5)}  |  `
    + `${String(q.lx0).padStart(6)}..${String(q.lx1).padEnd(6)} ${String(q.y0).padStart(6)}..${String(q.y1).padEnd(6)} `
    + `${String(q.z0).padStart(6)}..${String(q.z1).padEnd(6)} ${q.type}`);
}
await b.close();
