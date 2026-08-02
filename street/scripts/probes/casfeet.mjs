// The FEET of the casino figures. cas-a showed the figure cut off at the waist
// by the slot cabinet, which is no evidence either way about a 0.165 m float.
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000);
for(const [n,sx,sz,tx,tz,pi] of [
 ['aisle', 602.44, 10.4, 602.44, 13.42, -0.30],   // straight down the aisle at them
 ['close', 602.44, 11.9, 602.44, 13.42, -0.42],   // 1.5 m away, looking at the floor line
 ['bfeet', 598.20,  7.6, 598.20, 10.22, -0.38],
]){
 const yaw=Math.atan2(tx-sx,-(tz-sz));
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,0,pi),[sx,sz,yaw,pi]);
 await afterFrames(p,4);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/casfeet-${n}.png`});
 console.log(`  casfeet-${n}.png stood (${g[0]}, ${g[2]})`);
}
await b.close();
