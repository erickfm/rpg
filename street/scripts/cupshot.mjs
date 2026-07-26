import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { setClock } from './lib/clock.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-20,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const cups=await p.evaluate(()=>{const o=[];window.__ct.scene().traverse(m=>{const n=m.userData?.litter;
 if(n&&/cup/i.test(n))o.push({n,x:m.position.x,z:m.position.z});});return o;});
console.log(JSON.stringify(cups));
for(const c of cups){
  // stand 1.1 m away on the street side, eye 1.62 above the walk, looking down at it
  const x=c.x-1.0, z=c.z+0.6;
  const yaw=Math.atan2(c.x-x,-(c.z-z));
  await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,0.14,-0.62]);
  await afterFrames(p,3); const f=`shots/cup-${c.n.replace(/\W/g,'')}.png`;
  await p.screenshot({path:f}); console.log(`  ${f}  at (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`);
}
await b.close();
