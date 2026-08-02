// The lot's parked stock, looked at. My tyre-cluster finder located only the two
// cars near the entrance, so it cannot enumerate the herringbone rows and I will
// not report a count from it.
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,6);
for(const [n,x,z,tx,tz,pi] of [
 // BOTH earlier guesses were walls. The P-series' "lot-inside" at (14,-30) is
 // stale - the two cars my tyre finder DID locate sit at z ~ -5, so the lot is
 // further north than the old stations assume. Aiming from the world's own
 // evidence instead of from the station list.
 ['rows',   14.0,-6.0,  30.0,-6.0,  -0.05],
 ['along',  20.0,-2.0,  22.0,-16.0, -0.08],
 ['down',   19.0,-8.0,  26.0,-10.0, -0.30],
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),
   [x,z,Math.atan2(tx-x,-(tz-z)),pi]);
 await afterFrames(p,5);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/lot-${n}.png`});
 console.log(`  lot-${n}.png at (${g[0]}, ${g[2]}) ${Math.hypot(g[0]-x,g[2]-z)<1.0?'':'** PUSHED'}`);
}
await b.close();
