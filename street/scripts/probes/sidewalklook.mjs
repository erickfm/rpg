import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(12,-97,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
for(const [n,x,z,tx,tz,pi] of [
 ['walk', 11.0,-97.0, 50.0,-97.0, -0.02],   // along the north side-street pavement
 ['down', 24.0,-100.0, 50.0,-97.5, -0.05],  // down the carriageway, detail either side
]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/sw-${n}.png`});
 console.log(`  sw-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.9?'landed':'** MISSED'}`);
}
await b.close();
