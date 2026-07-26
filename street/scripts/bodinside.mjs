// The collider map says x 6.75..10.5 at z -94..-96.5 is open. Is that the door
// recess (correct) or the inside of the building (odd collision)? Stand in it.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(6.4,-97.4,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
for(const [n,x,z] of [['n85',8.5,-95.0],['n95',9.5,-95.0],['n102',10.2,-95.0],['n90n',9.0,-96.2]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,g])=>window.__ct.warp(x,z,-2.36,g,-0.05),[x,z,gy]);   // look back out to the SW
 await afterFrames(p,4);
 const got=await p.evaluate(()=>window.__ct.pos());
 const ok=Math.hypot(got[0]-x,got[2]-z)<0.4;
 await p.screenshot({path:`shots/bi-${n}.png`});
 console.log(`  bi-${n}.png  want (${x}, ${z})  got (${got[0].toFixed(2)}, ${got[2].toFixed(2)})  ground ${gy.toFixed(2)}  ${ok?'stood there':'** camera was pushed out'}`);
}
await b.close();
