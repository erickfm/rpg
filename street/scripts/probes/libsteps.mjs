// "library steps climbable" — a CONFIRMED row with 14 characters under it, and
// scripts/steps-walk.mjs now FAILS it. But that run's UP leg starts at gy 0.99,
// already on the landing, so it gains nothing by construction; its DOWN leg
// descends 0.99 -> 0.14, which means the flight exists and is traversable.
// Walk it upward from a bottom I have verified.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const hold=async(k,ms)=>{ await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(90); };
const WEST=-Math.PI/2;
for(const [tag,x,z,wantLo] of [['library',-7.6,-13.0,0.14],['church',10.8,-79.5,0.14]]){
  const yaw = tag==='library' ? WEST : Math.PI/2;    // church door faces +x, approach from east... its own normal
  await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0),[x,z,yaw]);
  await afterFrames(p,5); await p.waitForTimeout(300);
  const a=await pos();
  if(Math.abs(a[3]-wantLo)>0.12){ console.log(`\n${tag}: ** NOT STARTED at the bottom — wanted gy ${wantLo}, landed on ${a[3]} at (${a[0]}, ${a[2]})`); continue; }
  const seen=[];
  for(let i=0;i<24;i++){ await hold('w',120); const q=await pos(); seen.push(q[3]); }
  const c=await pos();
  const lv=[...new Set(seen.map(v=>v.toFixed(2)))].sort((m,n)=>m-n);
  console.log(`\n${tag}: (${a[0]}, ${a[2]}) gy ${a[3]}  ->  (${c[0]}, ${c[2]}) gy ${c[3]}   climbed ${(c[3]-a[3]).toFixed(2)} m over ${Math.hypot(c[0]-a[0],c[2]-a[2]).toFixed(2)} m`);
  console.log(`   ground levels underfoot: ${lv.length}  ${lv.join(' ')}`);
  console.log(`   ${c[3]>a[3]+0.30 ? 'CLIMBED on foot' : '** did not climb'}`);
}
await b.close();
