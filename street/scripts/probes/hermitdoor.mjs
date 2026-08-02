// "neighbors door should be closed when neighbor is not out" — the door is the
// visible half of the schedule, so it has to track it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.hermit(null));
await p.evaluate(()=>window.__ct.warp(200.6,-16.5,Math.PI/2,5.4,0)); await afterFrames(p,6);
// the 302 leaf: a door-sized mesh on his side of the landing
const leaf=()=>p.evaluate(()=>{ const s=window.__ct.scene(); s.updateMatrixWorld(true); let best=null;
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox, h=bb.max.y-bb.min.y, w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z);
    if(h<1.7||h>2.3||w<0.7||w>1.2) return;
    const wp=new (o.position.constructor)(); o.getWorldPosition(wp);
    if(Math.hypot(wp.x-201.95,wp.z+15.0)>2.6) return;
    const a=+o.rotation.y.toFixed(3);
    if(!best||Math.abs(a)>Math.abs(best.a)) best={a,x:+wp.x.toFixed(2),z:+wp.z.toFixed(2)}; });
  return best; });
for(const h of [16,17,18,19]){
 await p.evaluate((h)=>window.__ct.clock(h,30),h); await afterFrames(p,8); await p.waitForTimeout(400);
 const L=await leaf();
 const out=await p.evaluate(()=>{ const s=window.__ct.scene(); let n=0;
   s.traverse(o=>{ if(!o.isMesh||!o.visible) return;
     const m=Array.isArray(o.material)?o.material[0]:o.material; const map=m&&m.map;
     if(!map||!map.repeat) return; const ry=Math.abs(map.repeat.y); if(ry>0.9||ry<1e-6) return;
     if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
     const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
     if(bb.max.y-bb.min.y>1.4 && Math.hypot((bb.min.x+bb.max.x)/2-201.95,(bb.min.z+bb.max.z)/2+16.5)<1.6) n++; });
   return n>0; });
 console.log(`  ${h}:30  neighbour ${out?'OUT':'in '}   302 leaf angle ${L?L.a:'(not found)'} rad  ${L?`at (${L.x}, ${L.z})`:''}`);
}
await b.close();
