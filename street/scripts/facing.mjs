// Do the four ~6 px/m candidates and their declared-16 partners FACE THE SAME
// WAY? Two faces can share space and still never be seen together -- a park
// boundary wall and the shopfront on the far side of the same masonry are
// back to back. "Touching" is a 3D test; "visible together" is not.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const CAND = [[-14.1,2.8,-97.9],[-25.2,2.7,-97.9],[-26.9,2.5,-68.1],[-17.1,3.0,-68.1]];
  const all = [];
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let q=o;q;q=q.parent) if (q.visible===false) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if (!m||!m.map||!m.map.image) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const e=o.matrixWorld.elements;
    const n={x:e[8],y:e[9],z:e[10]};                       // the plane's +z in world
    const L=Math.hypot(n.x,n.y,n.z)||1;
    all.push({ c:[(bb.min.x+bb.max.x)/2,(bb.min.y+bb.max.y)/2,(bb.min.z+bb.max.z)/2],
      n:[+(n.x/L).toFixed(2),+(n.y/L).toFixed(2),+(n.z/L).toFixed(2)],
      stamped: !!(m.map.userData && m.map.userData.masonry),
      ppm: m.map.userData && m.map.userData.masonry ? m.map.userData.masonry.ppm : null,
      w: bb.max.x-bb.min.x, h: bb.max.y-bb.min.y, d: bb.max.z-bb.min.z });
  });
  return CAND.map(([x,y,z]) => {
    const me = all.filter(q=>Math.hypot(q.c[0]-x,q.c[1]-y,q.c[2]-z) < 1.2 && !q.stamped)
      .sort((a,c)=>Math.hypot(a.c[0]-x,a.c[2]-z)-Math.hypot(c.c[0]-x,c.c[2]-z))[0];
    const partners = all.filter(q => q.stamped && q.ppm===16 &&
      Math.abs(q.c[0]-x)<4 && Math.abs(q.c[2]-z)<4 && Math.abs(q.c[1]-y)<3);
    return { at:[x,y,z], mine: me?{n:me.n}:null,
      partners: partners.map(q=>({ n:q.n, c:q.c.map(v=>+v.toFixed(1)),
        dot: me ? +(me.n[0]*q.n[0]+me.n[2]*q.n[2]).toFixed(2) : null })) };
  });
});
for (const r of out) {
  console.log(`\ncandidate at (${r.at.join(', ')})   its normal ${r.mine? r.mine.n.join(',') : 'not found'}`);
  if (!r.partners.length) { console.log('   no declared-16 face within 4 m'); continue; }
  for (const q of r.partners)
    console.log(`   partner at (${q.c.join(', ')}) normal ${q.n.join(',')}   dot ${q.dot}  ->  ${q.dot === null ? '?' : q.dot < -0.5 ? 'BACK TO BACK — never seen together' : q.dot > 0.5 ? 'same way' : 'perpendicular — both visible at a corner'}`);
}
await b.close();
