import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(5.9,-30,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
for(const [n,x,z,tx,tz,gy,pi] of [
 ['gutter', 5.9,-30.0, 5.9,-60.0, 0.14,-0.16],   // B's own check: bare gutter z -30..-60
 ['gutter2',5.9,-60.0, 5.9,-30.0, 0.14,-0.16],   // and back the other way
]){
 const yaw=Math.atan2(tx-x,-(tz-z));
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,gy,pi]);
 const got=await p.evaluate(()=>window.__ct.pos());
 await afterFrames(p,3); await p.screenshot({path:`shots/wd-${n}.png`});
 console.log(`  wd-${n}.png  want (${x}, ${z}) got (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.abs(got[0]-x)<0.5&&Math.abs(got[2]-z)<0.5?'landed':'** MISSED'}`);
}
await b.close();
