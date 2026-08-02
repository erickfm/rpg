// THE PARK FROM THE GATE — the canonical station the user ruled on: arriving on
// foot from the pavement, not a viewpoint chosen to make a point.
// Also verifies the clock actually moved; my last few park shots were stamped
// 22:11 while I believed I had set 13:00.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,6); await p.waitForTimeout(600);
const now=await p.evaluate(()=>window.__ct.clockNow?.());
console.log(`  clock now: ${JSON.stringify(now)}`);
const W=-Math.PI/2;
for(const [n,x,z,yaw,pi] of [
 ['approach', -4.0,-83.0, W,      -0.02],   // on the pavement, walking up to the gate
 ['gate',     -6.6,-83.0, W,      -0.02],   // AT the gate, looking in along the axis
 ['gate-l',   -6.6,-83.0, W-0.55, -0.02],   // the same station, panning left
 ['gate-r',   -6.6,-83.0, W+0.55, -0.02],   // and right
 ['gate-dn',  -6.6,-83.0, W,      -0.30],   // at the grass in front of me
 ['in',      -12.0,-83.0, W,      -0.05],   // a few paces in
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),[x,z,yaw,pi]);
 await afterFrames(p,5);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/pg-${n}.png`});
 console.log(`  pg-${n}.png  asked (${x}, ${z})  landed (${g[0]}, ${g[2]})  ${Math.hypot(g[0]-x,g[2]-z)<0.8?'ok':'** PUSHED'}`);
}
await b.close();
