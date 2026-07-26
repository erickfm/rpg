import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000); await setClock(p,13);
// the well: x 201.2..202.4, z -11.6..-9.42. Stand inside it and face the far wall.
for(const [n,x,z,yaw,pi] of [
 ['far',   201.5,-10.5, Math.atan2(1,0),  0.0],
 ['side',  201.8,-10.0, Math.atan2(0,1),  0.0],
 ['down',  201.7,-10.5, Math.atan2(1,0), -0.55],
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,undefined,pi),[x,z,yaw,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/wb-${n}.png`});
 console.log(`  wb-${n}.png at (${got[0].toFixed(2)}, ${got[2].toFixed(2)}) y ${got[1].toFixed(2)}`);
}
await b.close();
