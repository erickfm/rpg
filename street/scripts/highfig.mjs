// The one citizen-frame figure whose foot is at 5.4 with street ground beneath.
// Is it a neighbour in an upstairs window (right) or a citizen in mid-air (wrong)?
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000); await setClock(p,13);
for(const [n,x,z,pi] of [['up',195.0,-16.5,0.52],['ang',196.5,-22.0,0.42]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 const yaw=Math.atan2(201.95-x,-(-16.5-z));
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/highfig-${n}.png`});
 console.log(`  highfig-${n}.png at (${got[0].toFixed(1)}, ${got[1].toFixed(2)}, ${got[2].toFixed(1)}) ground ${gy.toFixed(2)}`);
}
await b.close();
