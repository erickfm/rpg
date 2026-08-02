// THE VIEW THROUGH ROOM 301'S WINDOW — the half of this ask I could not reach
// last time. The light well is at x 201.20-202.40, z -11.60..-9.42, so the
// opening is in the wall at x ~201.2 around z -10.5. Stand inside the room and
// look at it, rather than measuring it from outside.
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000); await setClock(p,13);
const EAST=Math.PI/2;                                   // look toward +x
for(const [n,x,z,yaw,pi] of [
 ['a', 200.2,-10.50, EAST, 0.00],
 ['b', 199.4,-10.50, EAST, 0.00],
 ['c', 200.2,-10.50, EAST, -0.30],                      // down, for the floor of the well
 ['d', 200.2,-12.00, Math.atan2(201.2-200.2,-(-10.5+12.0)), 0.00],
]){
 await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,5.4,0),[x,z,yaw]);
 await afterFrames(p,4);
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.pos()[3],pi),[x,z,yaw,pi]);
 await afterFrames(p,4);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/win301-${n}.png`});
 console.log(`  win301-${n}.png  asked (${x}, ${z})  landed (${g[0]}, ${g[2]}) ground ${g[3]}  ${Math.hypot(g[0]-x,g[2]-z)<0.9?'ok':'** MISSED'}`);
}
await b.close();
