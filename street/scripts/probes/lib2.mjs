import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(916.5,0,0,0,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
// from the customer side (-z), which is the entrance end
for(const [n,z,pi] of [['front',1.4,-0.03],['near',2.6,-0.05]]){
 await p.evaluate(([z,pi])=>window.__ct.warp(916.5,z,Math.PI,undefined,pi),[z,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/lb2-${n}.png`});
 console.log(`  lb2-${n}.png from z ${got[2].toFixed(1)} looking +z at the desk`);
}
await b.close();
