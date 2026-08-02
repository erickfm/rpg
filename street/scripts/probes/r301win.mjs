import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000); await setClock(p,13);
const q=await p.evaluate(()=>window.__ct.pos());
// the well sits at +x from the player; yaw to face +x is atan2(1,0)
for(const [n,dx,dz,pi] of [['at',0,0,0],['close',1.4,0,0],['down',1.4,0,-0.45],['up',1.4,0,0.30]]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,undefined,pi),[q[0]+dx,q[2]+dz,Math.atan2(1,0),pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/w301-${n}.png`});
 console.log(`  w301-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) pitch ${pi}`);
}
await b.close();
