import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-36,-78,Math.PI,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
console.log(await p.evaluate(()=>{let s='';
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.material?.map?.image)return;
  const e=o.matrixWorld.elements, x=e[12], y=e[13], z=e[14];
  if(Math.abs(z+83)>1.5 || y<1.5) return;
  if(Math.abs(x+38.1)>1 && Math.abs(x+33.7)>1) return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox, m=o.material.map;
  s+=`at (${x.toFixed(1)}, ${y.toFixed(2)}, ${z.toFixed(1)})  name "${o.name}"  ud ${JSON.stringify(o.userData)}\n`+
     `   geometry ${o.geometry.type} ${(bb.max.x-bb.min.x).toFixed(2)} x ${(bb.max.y-bb.min.y).toFixed(2)}\n`+
     `   atlas ${m.image.width}x${m.image.height}  repeat ${m.repeat.x.toFixed(3)},${m.repeat.y.toFixed(3)}  offset ${m.offset.x.toFixed(3)},${m.offset.y.toFixed(3)}\n`+
     `   parent "${o.parent?.name}" ${o.parent?.type}\n`;});
 return s||'nothing matched';}));
for(const [n,x,z,tx,tz,pi] of [['float',-36,-76,-36,-83,0.14],['float2',-30,-79,-36,-83,0.10]]){
  const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
  await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
  await afterFrames(p,3); await p.screenshot({path:`shots/pf-${n}.png`}); console.log(`  pf-${n}.png`);
}
await b.close();
