// After respawn the player lands at the right x,z but gy read 8.1, while the
// spawn on load is 5.4 - one storey high. Does it settle, or is respawn putting
// you on the wrong landing?
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
console.log(`on load:            ${JSON.stringify(await pos())}`);
await p.evaluate(()=>window.__ct.warp(198.6,-16.3,0,50,0));
await afterFrames(p,6); await p.waitForTimeout(400);
console.log(`\nafter respawn, sampling ground for 3 s:`);
for(let i=0;i<10;i++){ await p.waitForTimeout(300); const q=await pos();
  console.log(`   t+${((i+1)*0.3).toFixed(1)}s  (${q[0]}, ${q[2]})  gy ${q[3]}`); }
await p.screenshot({path:'shots/respawn-where.png'});
console.log(`\nshots/respawn-where.png — what the player can see from where they landed`);
await b.close();
