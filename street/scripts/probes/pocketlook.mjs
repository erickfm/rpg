import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(6.2,-76,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
// stand OUTSIDE each pocket and look at it
for(const [n,x,z,tx,tz,pi] of [
 ['p1',6.0,-73.6, 8.6,-73.6, -0.10],
 ['p2',6.0,-83.0, 8.6,-83.0, -0.10],
 ['p3',-35.0,-78.0, -38.2,-81.4, -0.12],
]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/pk-${n}.png`});
 console.log(`  pk-${n}.png  from (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.8?'landed':'** MISSED'}`);
}
// what encloses them?
console.log(await p.evaluate(()=>{let s='';
 for(const [cx,cz,tag] of [[8.6,-73.6,'p1'],[8.6,-83,'p2'],[-38.2,-81.4,'p3']]){
  const near=window.__ct.colliders().filter(c=>c.maxX>cx-4&&c.minX<cx+4&&c.maxZ>cz-4&&c.minZ<cz+4);
  s+=`${tag} (${cx}, ${cz}): ${near.length} colliders within 4 m\n`;
  for(const c of near.slice(0,5)) s+=`     x ${c.minX.toFixed(2)}..${c.maxX.toFixed(2)}  z ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)}\n`;
 } return s;}));
await b.close();
