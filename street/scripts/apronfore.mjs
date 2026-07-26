import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const CZ=Number(process.env.CZ||0);
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(1.2,0,0,0,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
for(const [n,x,z,tx,tz,gy,pi] of [
  ['apron', 1.2, CZ, 7.0, CZ, 0,   -0.13],   // kerbcut.mjs:174's own view of the cut
  ['fore', -3.0,-14.0,-7.0,-14.0, 0,   -0.16],   // the library forecourt from the road
  ['fore2',-5.6,-11.0,-6.6,-16.0, 0.14,-0.30],   // on the walk, looking along the forecourt steps
]){
  const yaw=Math.atan2(tx-x, -(tz-z));
  await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,gy,pi]);
  await afterFrames(p,3); await p.screenshot({path:`shots/af-${n}.png`});
  console.log(`  af-${n}.png`);
}
await b.close();
