// The car lot's 44 tyres are the 0.803 m class and I never looked at one. My
// "wheel arches read as arches" DONE covered two street cars of the 0.663
// class. Same method, applied to the class I missed: stand beside a lot car at
// standing eye height and look at the wheel.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const info = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const tyres = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const m = Array.isArray(o.material)?o.material[0]:o.material;
    if (!m || !m.color || m.color.getHexString() !== '101114') return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x > 400 || bb.min.y > 0.2) return;
    if (Math.abs(bb.max.y - 0.803) > 0.01) return;         // the lot class
    tyres.push({ x:+((bb.min.x+bb.max.x)/2).toFixed(2), z:+((bb.min.z+bb.max.z)/2).toFixed(2), top:+bb.max.y.toFixed(3) });
  });
  // pick one with a standable point 3 m to its west (the aisle side)
  const RAD=0.36, cols=window.__ct.colliders().filter(q=>q&&isFinite(q.minX)&&Math.abs(q.minX)<500);
  const free=(x,z)=>!cols.some(q=>x>q.minX-RAD&&x<q.maxX+RAD&&z>q.minZ-RAD&&z<q.maxZ+RAD);
  for (const t of tyres) {
    for (const d of [2.6, 3.2, 4.0]) {
      for (const [dx,dz] of [[-d,0],[d,0],[0,-d],[0,d]]) {
        const x=t.x+dx, z=t.z+dz;
        if (!free(x,z)) continue;
        const eye=0.14+1.6;
        window.__ct.warp(x, z, Math.atan2(t.x-x, -(t.z-z)), 0.14, Math.atan2(0.55-eye, d));
        return { tyre:t, cam:[+x.toFixed(2),+z.toFixed(2)], dist:d, nTyres:tyres.length };
      }
    }
  }
  return { nTyres: tyres.length, cam:null };
});
console.log(`${info.nTyres} tyres in the 0.803 m (lot) class`);
if (!info.cam) { console.log('no standable camera beside any of them'); }
else {
  await p.waitForTimeout(320);
  const q = await p.evaluate(()=>window.__ct.pos());
  console.log(`   tyre at (${info.tyre.x}, ${info.tyre.z}) top ${info.tyre.top}`);
  console.log(`   camera (${info.cam.join(', ')}) at ${info.dist} m, eye 1.74 — landed ${Math.abs(q[0]-info.cam[0])<0.06?'yes':'DRIFT'}`);
  await p.screenshot({ path: 'shots/lotarch.png' });
  console.log('   shot shots/lotarch.png');
}
await b.close();
