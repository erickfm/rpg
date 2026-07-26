// F's station, NAMED not numbered: stand at the "[E] buy cereal" spot in the
// BODEGA and face the counter. If you can see his face, this is fixed.
// F's own lesson is why: a new `bank` room shifted every slab, so the numbers in
// the old evidence now land in a different room.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);
const rooms=await p.evaluate(()=>window.__ct.roomDims().map(r=>`${r.id}@${r.cx}`).join(' '));
console.log(`\nrooms as the world publishes them: ${rooms}`);
const spot=await p.evaluate(()=>window.__ct.spots().find(s=>/cereal/i.test(s.label)));
if(!spot){ console.error('CANNOT ANSWER — no "buy cereal" spot published.'); process.exit(3); }
const bodega=await p.evaluate(()=>window.__ct.roomDims().find(r=>r.id==='bodega'));
console.log(`the station: "${spot.label}" at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)})`);
console.log(`bodega by id: cx ${bodega.cx}, cz ${bodega.cz}  — the spot is ${Math.abs(spot.x-bodega.cx).toFixed(2)} m from its centre in x`);
// the keeper: the atlas-framed figure in the bodega
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[bodega.cx,bodega.cz]); await p.waitForTimeout(400);
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
    if(!best) best={x:+x.toFixed(2),z:+z.toFixed(2),col:Math.round(map.offset.x/Math.abs(map.repeat.x))}; });
  return best; },[bodega.cx,bodega.cz,bodega.w,bodega.d]);
console.log(`figure in the bodega: ${fig? `(${fig.x}, ${fig.z}) atlas column ${fig.col}` : 'none found'}`);
const yaw=fig? Math.atan2(fig.x-spot.x,-(fig.z-spot.z)) : 0;
await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0.02),[spot.x,spot.z,yaw]);
await afterFrames(p,5);
const at=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
await p.screenshot({path:'shots/kf2-bodega.png'});
console.log(`stood at (${at[0]}, ${at[2]}) facing the counter — shots/kf2-bodega.png`);
console.log(`  atlas column 0 = looking at you, 4 = dead away`);
await b.close();
