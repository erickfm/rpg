// The 26 figures footpaint says are 14 cm INTO the west pavement.
// Stations are on the sidewalk lane a player actually walks, not chosen angles.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-13,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
for(const [n,x,z,tx,tz,pi] of [
 ['side',  -6.2,-15.3, -9.2,-15.3, -0.06],   // beside them, on the lane
 ['along', -6.2,-20.0, -9.2,-12.0, -0.05],   // walking up to them
 ['feet',  -7.4,-15.3, -9.2,-15.3, -0.28],   // close, looking down at the shoes
]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/sunk-${n}.png`});
 console.log(`  sunk-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ground ${gy.toFixed(2)} ${Math.hypot(got[0]-x,got[2]-z)<0.9?'landed':'** MISSED'}`);
}
await b.close();
