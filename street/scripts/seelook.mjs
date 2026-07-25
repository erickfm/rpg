import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(13,-94.5,3.1416,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
for(const [n,x,z,yaw,pi] of [
  ['bodega', 13.0,-94.2, 0.0,  -0.10],   // the bodega bay, square on the glass
  ['thrift', -5.6,-59.4,-1.5708,-0.02],  // thrift shopfront, row (5)
]){
  const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
  await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,gy,pi]);
  await afterFrames(p,3); await p.screenshot({path:`shots/see-${n}.png`});
  console.log(`  see-${n}.png`);
}
await b.close();
