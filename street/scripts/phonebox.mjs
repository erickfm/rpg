// "we gotta move this phone thing" — B moved it to the alley mouth and rebuilt
// it with depth, against a hard constraint: the walk is 1.94 m and walkers run
// at x -6.00 +/- 0.55, so anything against a facade may be 0.45 m deep at most.
// So: where is it, how deep is it, and what walk is left beside it.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const cand=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    const x=(bb.min.x+bb.max.x)/2, z=(bb.min.z+bb.max.z)/2;
    if(Math.abs(x)>12) return;                       // on the main street's walks
    if(sy<0.9||sy>2.4) return;                       // phone-box height
    const foot=Math.max(sx,sz), depth=Math.min(sx,sz);
    if(foot<0.4||foot>1.6||depth<0.15||depth>1.0) return;
    cand.push({x:+x.toFixed(2),z:+z.toFixed(2),w:+foot.toFixed(2),d:+depth.toFixed(2),
               h:+sy.toFixed(2),base:+bb.min.y.toFixed(2),
               minX:+bb.min.x.toFixed(2),maxX:+bb.max.x.toFixed(2)}); });
  // cluster: one phone is several meshes
  const cl=[];
  for(const c of cand){ const f=cl.find(q=>Math.hypot(q.x-c.x,q.z-c.z)<1.2);
    if(f){ f.n++; f.minX=Math.min(f.minX,c.minX); f.maxX=Math.max(f.maxX,c.maxX); f.h=Math.max(f.h,c.h); }
    else cl.push({...c,n:1}); }
  return cl.filter(c=>c.n>=2).sort((a,b)=>a.z-b.z); });
console.log(`\nphone-box-sized clusters on the main street walks: ${r.length}`);
for(const c of r) console.log(`   (${c.x}, ${c.z})  ${c.n} meshes  h ${c.h}  x ${c.minX}..${c.maxX}  depth ${(c.maxX-c.minX).toFixed(2)} m`);
await b.close();
