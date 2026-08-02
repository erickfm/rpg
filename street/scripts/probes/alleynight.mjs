// "lighting on this alley back" / "why does the lighting catch [half a wall]".
// The complaint is visual and my grade census could not separate the population,
// so: stand in the alley at night and look at the back wall.
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(22,0)); await afterFrames(p,10); await p.waitForTimeout(900);
for(const [n,x,z,tx,tz,pi] of [
 ['d-in',    12.0,-50.0, 12.0,-58.0, 0.02],   // D's alley, looking down it
 ['d-back',  12.0,-56.0, 12.0,-60.0, 0.05],   // at the back wall
 ['d-wall',  12.0,-54.0, 15.0,-54.0, 0.02],   // across at the side wall
 ['w-in',   -12.0,-44.0,-12.0,-52.0, 0.02],   // the west alley
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),
   [x,z,Math.atan2(tx-x,-(tz-z)),pi]);
 await afterFrames(p,5);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/an-${n}.png`});
 console.log(`  an-${n}.png at (${g[0]}, ${g[2]}) ${Math.hypot(g[0]-x,g[2]-z)<1.2?'':'** PUSHED'}`);
}
await b.close();
