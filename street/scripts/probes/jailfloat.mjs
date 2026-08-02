// One jail figure has quad base 0 while its two neighbours have -0.12/-0.13.
// That is the citizenPlane padding convention: the quad must hang below the
// floor by the empty rows under the painted shoe. Look before filing.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:640}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);
// A side view settles seated-versus-standing; head-on, the bunk hides the legs.
for(const [n,tx,tz] of [['odd-side',994.75,-1.3],['odd-far',994.75,-1.3]]){
  const sx = n==='odd-side' ? tx : tx+1.2;
  const sz = n==='odd-side' ? tz+2.6 : tz+3.4;
  await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),
    [sx,sz,Math.atan2(tx-sx,-(tz-sz)),-0.16]);
  await afterFrames(p,5);
  const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
  await p.screenshot({path:`shots/jf-${n}.png`});
  console.log(`  jf-${n}.png  target (${tx}, ${tz})  stood (${g[0]}, ${g[2]})`);
}
await b.close();
