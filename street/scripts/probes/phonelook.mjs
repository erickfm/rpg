// The payphone in its new home. B moved it to the alley mouth precisely so it
// could have real depth without taking any of the 1.94 m walk.
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);
for(const [n,x,z,tx,tz,pi] of [
 ['walk',   -6.2,-37.4, -8.0,-37.4, -0.05],   // from the walk, square on
 ['along',  -6.2,-33.0, -7.6,-37.4, -0.05],   // walking down the pavement toward it
 ['past',   -6.2,-42.0, -7.6,-37.4, -0.05],   // and from the other side
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),
   [x,z,Math.atan2(tx-x,-(tz-z)),pi]);
 await afterFrames(p,5);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/ph-${n}.png`});
 console.log(`  ph-${n}.png at (${g[0]}, ${g[2]}) ${Math.hypot(g[0]-x,g[2]-z)<0.9?'':'** PUSHED'}`);
}
await b.close();
