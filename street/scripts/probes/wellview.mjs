// Room 301's window is in the WEST wall (x 196.73-196.87), opening z -16.9..-15.6,
// y 6.25-7.55. Shoot the VIEW THROUGH IT: straight on for the brick, angled for
// the side returns, down for the floor 4.25 m below.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000);
const W=-Math.PI/2;
for(const [n,x,z,yaw,pi] of [
 ['on',   197.6,-16.25, W, 0.02],                                   // square on, at the glass
 ['left', 197.6,-15.75, W, 0.02],                                   // off-axis: the far return
 ['right',197.6,-16.75, W, 0.02],                                   // off-axis the other way
 ['down', 197.3,-16.25, W, -0.45],                                  // the well floor
 ['up',   197.3,-16.25, W,  0.45],                                  // up the light well
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.pos()[3],pi),[x,z,yaw,pi]);
 await afterFrames(p,4);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/well301-${n}.png`});
 console.log(`  well301-${n}.png at (${g[0]}, ${g[2]}) ground ${g[3]}`);
}
await b.close();
