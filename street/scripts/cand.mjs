// The three off-grid faces that could genuinely be masonry. Ask each what module
// owns it, then LOOK at it -- a face is masonry or it is not, and that is
// visible. Camera is standable + has line of sight + verified to have landed.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const CAND = [
  ['c1', -6.9, 2.8,  -9.0, '3.4x5 m, canvas 32x48, 9.41 px/m'],
  ['c2',  5.7, 2.4,  -1.5, '3x4.5 m, canvas 60x90, 20 px/m'],
  ['c3', 51.0, 22.7, -94.3, '6.8x6.2 m, canvas 92x74, 13.5 px/m'],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
for (const [tag, X, Y, Z, note] of CAND) {
  const r = await p.evaluate(([X,Y,Z]) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    const modOf = o => { for (let q=o;q;q=q.parent) if (q.userData && q.userData.mod) return q.userData.mod; return null; };
    // the face nearest that point
    let best=null, bd=9e9;
    s.traverse(o => { if(!o.isMesh||!o.geometry) return;
      const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
      const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      const c=[(bb.min.x+bb.max.x)/2,(bb.min.y+bb.max.y)/2,(bb.min.z+bb.max.z)/2];
      const d=Math.hypot(c[0]-X,c[1]-Y,c[2]-Z);
      if(d<bd){bd=d;best={o,c,bb};} });
    if(!best) return {ok:false,why:'nothing there'};
    const m = Array.isArray(best.o.material)?best.o.material[0]:best.o.material;
    const RAD=0.36, cols=window.__ct.colliders().filter(c=>c&&isFinite(c.minX)&&Math.abs(c.minX)<500);
    const free=(x,z)=>!cols.some(c=>x>c.minX-RAD&&x<c.maxX+RAD&&z>c.minZ-RAD&&z<c.maxZ+RAD);
    const own=cols.filter(c=>X>c.minX-0.3&&X<c.maxX+0.3&&Z>c.minZ-0.3&&Z<c.maxZ+0.3);
    const blocked=(x,z)=>{const n=Math.ceil(Math.hypot(X-x,Z-z)/0.2);
      for(let i=1;i<n;i++){const t=i/n,px=x+(X-x)*t,pz=z+(Z-z)*t;
        if(cols.some(c=>!own.includes(c)&&px>c.minX&&px<c.maxX&&pz>c.minZ&&pz<c.maxZ))return true;}return false;};
    let cam=null;
    for(const dist of [4,5.5,7,9,11]) { for(let a=0;a<360;a+=7.5){
      const rad=a*Math.PI/180, x=X+Math.sin(rad)*dist, z=Z+Math.cos(rad)*dist;
      if(!free(x,z)||blocked(x,z))continue; cam={x,z,dist}; break; } if(cam)break; }
    if(!cam) return {ok:false,why:'no standable point with line of sight',
      mod:modOf(best.o), dist:+bd.toFixed(2)};
    const eye=0.14+1.6;
    window.__ct.warp(cam.x, cam.z, Math.atan2(X-cam.x,-(Z-cam.z)), 0.14, Math.atan2(Y-eye, cam.dist));
    return { ok:true, mod:modOf(best.o), dist:+bd.toFixed(2),
      canvas: m&&m.map&&m.map.image?[m.map.image.width,m.map.image.height]:null,
      cam:[+cam.x.toFixed(2),+cam.z.toFixed(2),+cam.dist.toFixed(1)] };
  }, [X,Y,Z]);
  if(!r.ok){ console.log(`${tag}  MISS: ${r.why}   owner ${r.mod ?? '(unattributed)'}`); continue; }
  await p.waitForTimeout(280);
  await p.screenshot({path:`shots/cand-${tag}.png`});
  console.log(`${tag}  ${note}\n     owner: ${r.mod ?? '(unattributed)'}   canvas ${r.canvas}   shot from (${r.cam[0]}, ${r.cam[1]}) at ${r.cam[2]} m`);
}
await b.close();
