// "make sure the people in the buildings are in the right orientation."
// H measured all ten from each room's own customer spot and reports bodega 4 -
// dead away, the only one. Stand where a customer stands and look.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,4);
const rooms=await p.evaluate(()=>window.__ct.roomDims());
for(const rm of rooms){
  // customer spot: just inside the door, along its inward normal
  const sx=rm.cx+rm.door.x+rm.door.nx*2.2, sz=rm.cz+rm.door.z+rm.door.nz*2.2;
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[sx,sz]);
  await afterFrames(p,4);
  const fig=await p.evaluate(([cx,cz,w,d])=>{
    const s=window.__ct.scene(); s.updateMatrixWorld(true); let best=null;
    s.traverse(o=>{ if(!o.isMesh||!o.geometry||!o.visible) return;
      const m=Array.isArray(o.material)?o.material[0]:o.material; const map=m&&m.map;
      if(!map||!map.repeat) return; const ry=Math.abs(map.repeat.y); if(ry>0.9||ry<1e-6) return;
      if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if(bb.max.y-bb.min.y<1.2) return;
      const x=(bb.min.x+bb.max.x)/2, z=(bb.min.z+bb.max.z)/2;
      if(Math.abs(x-cx)>w/2+1||Math.abs(z-cz)>d/2+1) return;
      const col=Math.round(map.offset.x/Math.abs(map.repeat.x));
      if(!best) best={x:+x.toFixed(2),z:+z.toFixed(2),col,ox:+map.offset.x.toFixed(3),rx:+Math.abs(map.repeat.x).toFixed(3)}; });
    return best; },[rm.cx,rm.cz,rm.w,rm.d]);
  if(!fig){ console.log(`  ${rm.id.padEnd(8)} no figure found from the customer spot`); continue; }
  const yaw=Math.atan2(fig.x-sx,-(fig.z-sz));
  const dist=Math.hypot(fig.x-sx,fig.z-sz);
  await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0.02),[sx,sz,yaw]);
  await afterFrames(p,4);
  await p.screenshot({path:`shots/kf-${rm.id}.png`});
  console.log(`  ${rm.id.padEnd(8)} keeper at (${fig.x}, ${fig.z}) ${dist.toFixed(1)} m away  atlas col ${fig.col} (offset ${fig.ox} / ${fig.rx})`);
}
await b.close();
