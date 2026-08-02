import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:700}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
for(const [n,x,z,yaw] of [
 ['inside-301', 198.3,-16.0,  Math.PI/2],   // in the room, looking at the shut door
 ['landing',    201.3,-16.4, -Math.PI/2],   // on the landing, looking back at it
]){
 await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.pos()[3],0.02),[x,z,yaw]);
 await afterFrames(p,5);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/plate-${n}.png`});
 console.log(`  plate-${n}.png at (${g[0]}, ${g[2]}) gy ${g[3]}`);
}
await b.close();
