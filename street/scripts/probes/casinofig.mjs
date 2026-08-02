// The four casino figures footpaint says are 0.165 m off the floor.
// Stand in the room and look at them before calling it a float.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000);
for(const [n,tx,tz,d] of [['a',602.44,13.42,3.0],['b',598.2,10.22,3.0],['c',596.28,14.58,2.6]]){
 const sx=tx-d, sz=tz;                                   // stand west of them, look east
 const yaw=Math.atan2(tx-sx,-(tz-sz));
 await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,0,-0.20),[sx,sz,yaw]);
 await afterFrames(p,4);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/cas-${n}.png`});
 console.log(`  cas-${n}.png stood (${g[0]}, ${g[2]}) ground ${g[3]} looking at (${tx}, ${tz})`);
}
await b.close();
