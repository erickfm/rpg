// The east-end crossing, walked. Row 205: "AUDITOR to confirm on foot."
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,6);
for(const [n,x,z,tx,tz,pi] of [
 ['approach', 53.8,-95.0, 53.8,-104.0, -0.22],   // walking down toward it
 ['onit',     53.8,-103.0, 53.8,-108.0, -0.35],  // standing on the crossing
 ['side',     49.0,-103.0, 55.0,-103.0, -0.20],  // from the side, along the road
 ['down',     53.8,-103.0, 53.8,-104.0, -0.75],  // at my feet
 ['far',      53.8,-112.0, 53.8,-100.0, -0.10],  // from the far side back
]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,5);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/xw-${n}.png`});
 console.log(`  xw-${n}.png at (${g[0]}, ${g[2]}) ground ${g[3]}`);
}
await b.close();
