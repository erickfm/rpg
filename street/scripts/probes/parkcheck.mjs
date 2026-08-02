// Re-check of the audit's strongest claim: "the park has zero light sources and
// is a black rectangle at night." 7f67c56b added a park lantern. Same method as
// the original: count light sources inside the park bbox from the scene graph,
// then look at it at night.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const P = { x0: -21, x1: -7, z0: -96, z1: -60 };
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const day = await p.evaluate((P) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let meshes = 0, glows = 0, tall = 0, emissive = 0;
  const lights = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = [(bb.min.x+bb.max.x)/2, (bb.min.y+bb.max.y)/2, (bb.min.z+bb.max.z)/2];
    if (c[0] < P.x0 || c[0] > P.x1 || c[2] < P.z0 || c[2] > P.z1) return;
    meshes++;
    if (bb.max.y - bb.min.y > 2.5) tall++;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return;
    if (m.blending === 2) { glows++; lights.push({ kind: 'additive glow', at: c.map(v=>+v.toFixed(2)),
      size: [bb.max.x-bb.min.x, bb.max.y-bb.min.y, bb.max.z-bb.min.z].map(v=>+v.toFixed(2)) }); }
    else if (m.fog === false) { emissive++; lights.push({ kind: 'fog-off (neon/lit)', at: c.map(v=>+v.toFixed(2)),
      size: [bb.max.x-bb.min.x, bb.max.y-bb.min.y, bb.max.z-bb.min.z].map(v=>+v.toFixed(2)) }); }
  });
  return { meshes, tall, glows, emissive, lights };
}, P);
console.log(`park: ${day.meshes} meshes, ${day.tall} over 2.5 m`);
console.log(`LIGHT SOURCES: ${day.glows} additive glow + ${day.emissive} fog-disabled = ${day.glows + day.emissive}`);
day.lights.forEach(l => console.log(`   ${l.kind}  ${l.size.join('×')}  at (${l.at.join(', ')})`));
const look = (x,z,tx,tz) => Math.atan2(tx-x, -(tz-z));
for (const [name, h, x, z, tx, tz, pitch] of [
  ['park-night-in',  [22,30], -12, -70, -12, -88, 0.06],
  ['park-night-st',  [22,30],  -3, -76, -12, -80, 0.12],
  ['park-day-in',    [13, 0], -12, -70, -12, -88, 0.06],
]) {
  await p.evaluate(([h,x,z,yaw,pitch]) => { window.__ct.clock(h[0],h[1]); window.__ct.warp(x,z,yaw,0.14,pitch); },
    [h, x, z, look(x,z,tx,tz), pitch]);
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `shots/pk-${name}.png` });
}
await b.close(); console.log('shots written');
