// The user says the mowing stripes still look ignored, and I am the one who
// marked that row CONFIRMED. Re-walk from STANDING positions a player reaches,
// in daylight, not from viewpoints chosen to show the feature.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-70,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
const shots=[
 // walking IN off the street, which is how anyone first sees it
 ['enter',   -9.0,-72.0, -22.0,-80.0, -0.10],
 // standing on the field itself, eye level, looking across it
 ['onfield', -20.0,-80.0, -34.0,-84.0, -0.06],
 // the long view down the field
 ['along',   -14.0,-88.0, -34.0,-88.0, -0.05],
 // looking down at the grass at your feet, where a stripe should be widest
 ['atfeet',  -22.0,-82.0, -25.0,-84.0, -0.55],
];
for(const [n,x,z,tx,tz,pi] of shots){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4);
 const got=await p.evaluate(()=>window.__ct.pos());
 const ok=Math.hypot(got[0]-x,got[2]-z)<0.6;
 await p.screenshot({path:`shots/ps-${n}.png`});
 console.log(`  ps-${n}.png  want (${x}, ${z}) got (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${ok?'landed':'** MISSED'}  ground ${gy.toFixed(2)}`);
}
await b.close();
