// The two furniture-height "floaters" in the hotel, looked at before anyone is
// routed to fix them: G's lobby has a payphone alcove and a leaflet rack, and a
// wall-mounted fixture is SUPPOSED to have air under it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);
for(const [n,x,z,tx,tz,pi] of [
 ['pair',  837.5,-5.5, 834.9,-5.5, -0.10],
 ['angle', 837.0,-8.0, 834.9,-5.4, -0.08],
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),
   [x,z,Math.atan2(tx-x,-(tz-z)),pi]);
 await afterFrames(p,5);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/hf-${n}.png`});
 console.log(`  hf-${n}.png at (${g[0]}, ${g[2]})`);
}
// is there a wall right behind them?
const wall=await p.evaluate(()=>{
  const cs=window.__ct.colliders().filter(c=>c.minX<834.6&&c.maxX>834.2&&c.minZ<-4.5&&c.maxZ>-6.5);
  return cs.length; });
console.log(`  colliders forming a wall just behind them: ${wall}`);
await b.close();
