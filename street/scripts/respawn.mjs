// "i want the respawn to be my room" — the half E left untested.
// apartment.ts:2262: inside the walk-up (px > 100), a floor height outside
// [-0.6, 3*ST+1.0] held for 0.1 s jumps you to SPAWN. Two controls, because a
// respawn test that only ever respawns proves nothing.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const spawn=await pos();
console.log(`spawn on load: (${spawn[0]}, ${spawn[2]}) ground ${spawn[3]}`);
const trial=async(label,x,z,gy,expect)=>{
  await p.evaluate(([x,z,gy])=>window.__ct.warp(x,z,0,gy,0),[x,z,gy]);
  await afterFrames(p,6); await p.waitForTimeout(900);          // well past the 0.1 s hold
  const q=await pos();
  const home=Math.hypot(q[0]-spawn[0],q[2]-spawn[2])<1.0;
  const ok=home===expect;
  console.log(`  ${label.padEnd(46)} -> (${q[0]}, ${q[2]}) gy ${q[3]}   ${home?'RETURNED HOME':'stayed put'}   ${ok?'as expected':'** NOT AS EXPECTED'}`);
  return ok;
};
let all=true;
console.log(`\nthe fault it exists for:`);
all &= await trial('lost floor INSIDE the walk-up (gy 50)',  198.6,-16.3, 50,  true);
console.log(`\ncontrols — it must NOT fire for these:`);
all &= await trial('valid floor inside the walk-up (gy 5.4)',201.0,-12.0, 5.4, false);
all &= await trial('lost floor OUT on the street (gy 50)',   -6.2,-40.0, 50,  false);
console.log(`\n${all?'PASS — respawn fires for a lost floor in the walk-up, and only there':'** FAIL'}`);
await b.close();
process.exit(all?0:1);
