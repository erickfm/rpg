import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(30,-104,0,0,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
for(const [n,x,z,tx,tz,pi] of [
 ['hotel', 30.0,-105.0, 40.0,-96.5, 0.06],   // oblique: hotel front AND its west flank
 ['aces',  43.0,-106.0, 52.0,-96.5, 0.06],   // oblique: casino front AND flank
 ['bank',  4.0,  2.0,  -7.0,  7.5,  0.05],   // FIRST FEDERAL, the actual bank
]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/bk-${n}.png`});
 console.log(`  bk-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.9?'landed':'** MISSED'}`);
}
await b.close();
