// Distance between the confession booths and the nearest pew, by SHAPE, because
// the scene graph cannot separate them (one parent for the whole church).
//   booth : tall, roughly 1-3 m footprint, standing near a side wall
//   pew   : long and low, seat height
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const rm=await p.evaluate(()=>window.__ct.roomDims().find(r=>r.id==='church'));
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[rm.cx,rm.cz]); await p.waitForTimeout(400);
const r=await p.evaluate(([cx,cz,w,d])=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  const booths=[], pews=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const x=(bb.min.x+bb.max.x)/2, z=(bb.min.z+bb.max.z)/2;
    if(Math.abs(x-cx)>w/2||Math.abs(z-cz)>d/2) return;
    const sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    const foot=Math.max(sx,sz), thin=Math.min(sx,sz);
    if(sy>1.6&&foot>=1.0&&foot<=3.5&&thin>=0.6) booths.push({x:+x.toFixed(2),z:+z.toFixed(2),bb:[bb.min.x,bb.max.x,bb.min.z,bb.max.z],h:+sy.toFixed(2)});
    if(sy<1.3&&foot>=2.0&&thin<=1.2&&bb.min.y<0.8) pews.push({x:+x.toFixed(2),z:+z.toFixed(2),bb:[bb.min.x,bb.max.x,bb.min.z,bb.max.z]});
  });
  const gap=(a,b2)=>{ const dx=Math.max(0,Math.max(a.bb[0]-b2.bb[1], b2.bb[0]-a.bb[1]));
                      const dz=Math.max(0,Math.max(a.bb[2]-b2.bb[3], b2.bb[2]-a.bb[3]));
                      return Math.hypot(dx,dz); };
  let worst=1e9, worstPair=null, overlaps=0;
  for(const bo of booths) for(const pe of pews){ const g=gap(bo,pe);
    if(g<=0.0001) overlaps++;
    if(g<worst){ worst=g; worstPair=[bo,pe]; } }
  return {booths:booths.length, pews:pews.length, worst:+worst.toFixed(3), overlaps,
          pair:worstPair?[worstPair[0].x,worstPair[0].z,worstPair[1].x,worstPair[1].z]:null,
          bh:booths.map(b=>b.h)};
},[rm.cx,rm.cz,rm.w,rm.d]);
console.log(`\nbooth-shaped meshes: ${r.booths}  (heights ${r.bh.join(', ')})`);
console.log(`pew-shaped meshes:   ${r.pews}`);
if(!r.booths||!r.pews){ console.log('CANNOT ANSWER — one of the two populations is empty.'); process.exit(3); }
console.log(`\nclosest booth-to-pew gap: ${r.worst} m`);
if(r.pair) console.log(`   booth at (${r.pair[0]}, ${r.pair[1]})  pew at (${r.pair[2]}, ${r.pair[3]})`);
console.log(`pairs actually overlapping: ${r.overlaps}`);
console.log(r.overlaps? '** PEWS CLIP THE BOOTHS' : 'no pew touches a booth');
await b.close();
