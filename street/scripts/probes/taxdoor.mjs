// "the entrence to the tax service is not aligned with the door of the facade"
// Both are on the STREET: the opening you walk through vs the door painted on
// the shopfront. Stand outside and compare them.
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(5.6,-20,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
console.log(await p.evaluate(()=>{
 const d=window.__ct.doors().find(q=>q.building==='A-1 TAX');
 const f=(window.__frontages||[]).find(q=>q.name==='A-1 TAX');
 let s=`A-1 TAX  published door point (${d.point.x}, ${d.point.z.toFixed(3)})  stand (${d.stand.x.toFixed(2)}, ${d.stand.z.toFixed(2)})  width ${d.widthM}\n`;
 s+=`         frontage ${f.loWorld}..${f.hiWorld} on face ${f.facePos}, doorWorld ${f.doorWorld.toFixed(3)}\n`;
 // the physical opening: where along the facade is there a gap in the colliders?
 const cols=window.__ct.colliders();
 const inside=(x,z)=>cols.some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);
 let gap=[]; const runs=[];
 for(let z=-22;z<=-9;z+=0.05){ const solid=inside(7.15,z);
  if(!solid) gap.push(+z.toFixed(2)); else { if(gap.length){runs.push([gap[0],gap[gap.length-1]]); gap=[];} } }
 if(gap.length) runs.push([gap[0],gap[gap.length-1]]);
 s+=`         gaps in the facade collider at x 7.15: ${runs.map(r=>`${r[0]}..${r[1]} (${(r[1]-r[0]).toFixed(2)} m)`).join(', ')||'none'}\n`;
 return s;}));
for(const [n,x,z,tx,tz,pi] of [
 ['face',  4.2,-20.13, 7.0,-20.13, -0.02],
 ['obliq', 4.6,-15.0,  7.0,-21.0,  -0.04],
]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/tx-${n}.png`});
 console.log(`  tx-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.6?'landed':'** MISSED'}`);
}
await b.close();
