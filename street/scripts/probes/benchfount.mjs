import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-25,-90,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
// the closest bench/pedestal pair: pedestal (-27.75,-93.5), seat (-28,-93)
for(const [n,x,z,pi] of [['a',-24.5,-91.5,-0.12],['b',-27.9,-90.0,-0.14],['c',-31.0,-92.0,-0.12]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 const yaw=Math.atan2(-27.8-x, -(-93.3-z));
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/bf-${n}.png`});
 console.log(`  bf-${n}.png from (${got[0].toFixed(1)}, ${got[2].toFixed(1)})`);
}
await b.close();
