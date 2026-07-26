// Where does respawn actually land you, from several kinds of "lost"? My first
// test used gy 50, which is far above the building - if the floor picker snaps
// to the nearest floor below and holds it by hysteresis, an extreme value could
// be creating the fault rather than revealing it.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const home=await pos();
console.log(`spawn on load: (${home[0]}, ${home[2]}) gy ${home[3]}\n`);
console.log(`  lost at gy    lands at            ground   same floor as spawn?`);
for(const gy of [50, 12, 9.5, -5, -2, 20]){
  // reload state each time by putting the player back on a good floor first
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,5.4,0),[198.6,-16.3]);
  await afterFrames(p,4); await p.waitForTimeout(300);
  await p.evaluate(([x,z,g])=>window.__ct.warp(x,z,0,g,0),[198.6,-16.3,gy]);
  await afterFrames(p,6); await p.waitForTimeout(900);
  const q=await pos();
  const ok=Math.abs(q[3]-home[3])<0.3;
  console.log(`  ${String(gy).padStart(6)}      (${q[0]}, ${q[2]})   ${String(q[3]).padStart(6)}   ${ok?'yes':'** NO — off by '+(q[3]-home[3]).toFixed(2)+' m'}`);
}
await b.close();
