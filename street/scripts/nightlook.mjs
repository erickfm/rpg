import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-30,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,22); await p.waitForTimeout(1200);
for(const [n,x,z,tx,tz,pi] of [
 ['street', -6.2,-26.0, -6.2,-58.0, -0.06],   // down the walk: pools and the gaps between them
 ['up',     -6.2,-40.0, -6.2,-58.0,  0.95],   // the sky, for stars
]){
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),0.14,pi]);
 await afterFrames(p,5); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/nl-${n}.png`});
 console.log(`  nl-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.7?'landed':'** MISSED'}`);
}
await b.close();
