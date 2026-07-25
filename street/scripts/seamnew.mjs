// Seam sweep of the areas that have never had one: the side street (lit only
// just now) and the park's far half (unreachable until the clamp lifted, so
// every earlier sweep of mine stopped seven metres in).
//
// A seam shows at a GRAZING angle, not square on -- that is the whole reason
// the original brief asked for two angles per junction. So: find building
// corners in the new ground, stand off to one side of each, and look along the
// face rather than at it. Standable + line of sight + verified landing.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(11, 0));
await p.waitForTimeout(900);

const corners = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const big = [];
  s.traverse(o => { if(!o.isMesh||!o.geometry) return;
    for(let q=o;q;q=q.parent) if(q.visible===false) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(bb.max.x>400) return;
    if(bb.max.y-bb.min.y < 6) return;                 // building-scale only
    if((bb.max.x-bb.min.x) < 3 && (bb.max.z-bb.min.z) < 3) return;
    big.push({x0:bb.min.x,x1:bb.max.x,z0:bb.min.z,z1:bb.max.z,h:+(bb.max.y-bb.min.y).toFixed(1)}); });
  // vertical corners of the new ground: the side street (z < -92) and the park's
  // far half (x < -22)
  const out = [];
  for (const q of big) {
    for (const [cx, cz] of [[q.x0,q.z0],[q.x0,q.z1],[q.x1,q.z0],[q.x1,q.z1]]) {
      const sideSt = cz < -92 && cx > 8;
      const parkFar = cx < -22 && cz < -60 && cz > -100;
      if (!sideSt && !parkFar) continue;
      out.push({ cx:+cx.toFixed(2), cz:+cz.toFixed(2), h:q.h, where: sideSt ? 'side street' : 'park far half' });
    }
  }
  // thin them out so we shoot distinct corners, not 40 coincident ones
  const kept = [];
  for (const c of out) if (!kept.some(k => Math.hypot(k.cx-c.cx, k.cz-c.cz) < 6)) kept.push(c);
  return kept;
});
console.log(`${corners.length} distinct building corners in the new ground`);

let i = 0;
for (const c of corners.slice(0, 8)) {
  const r = await p.evaluate(([cx, cz]) => {
    const RAD=0.36, cols=window.__ct.colliders().filter(q=>q&&isFinite(q.minX)&&Math.abs(q.minX)<500);
    const free=(x,z)=>!cols.some(q=>x>q.minX-RAD&&x<q.maxX+RAD&&z>q.minZ-RAD&&z<q.maxZ+RAD);
    const own=cols.filter(q=>cx>q.minX-0.6&&cx<q.maxX+0.6&&cz>q.minZ-0.6&&cz<q.maxZ+0.6);
    const blocked=(x,z)=>{const n=Math.ceil(Math.hypot(cx-x,cz-z)/0.25);
      for(let k=1;k<n;k++){const t=k/n,px=x+(cx-x)*t,pz=z+(cz-z)*t;
        if(cols.some(q=>!own.includes(q)&&px>q.minX&&px<q.maxX&&pz>q.minZ&&pz<q.maxZ))return true;}return false;};
    // GRAZING: stand well off to the side so the face runs away from the eye
    for (const dist of [7, 10, 14, 18]) {
      for (let a = 0; a < 360; a += 10) {
        const rad=a*Math.PI/180, x=cx+Math.sin(rad)*dist, z=cz+Math.cos(rad)*dist;
        if(!free(x,z)||blocked(x,z)) continue;
        window.__ct.warp(x, z, Math.atan2(cx-x,-(cz-z)), 0.14, -0.02);
        return { ok:true, x:+x.toFixed(2), z:+z.toFixed(2), dist };
      }
    }
    return { ok:false };
  }, [c.cx, c.cz]);
  if (!r.ok) { console.log(`   MISS corner (${c.cx}, ${c.cz}) — no standable point with line of sight`); continue; }
  await p.waitForTimeout(280);
  const q = await p.evaluate(()=>window.__ct.pos());
  const landed = Math.abs(q[0]-r.x)<0.06 && Math.abs(q[2]-r.z)<0.06;
  await p.screenshot({ path:`shots/seam-${i}.png` });
  console.log(`   ${landed?'shot ':'DRIFT'} seam-${i}  ${c.where.padEnd(14)} corner (${c.cx}, ${c.cz}) h${c.h}  from ${r.dist} m`);
  i++;
}
await b.close();
