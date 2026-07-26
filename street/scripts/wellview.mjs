import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000); await setClock(p,13);
// the well measured at x 201.2..202.4, z -11.6..-9.42 -> window on the x 201.2 face
for(const [n,x,z,pi] of [['a',200.3,-10.5,0],['b',200.7,-10.5,0],['down',200.7,-10.5,-0.40],['side',200.7,-11.2,0]]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,undefined,pi),[x,z,Math.atan2(1,0),pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/wv-${n}.png`});
 console.log(`  wv-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) y ${got[1].toFixed(2)} pitch ${pi}`);
}
await b.close();
