// WALK the east-end crossing, both ways, because floors and steps must be
// walked and not warped (CLAUDE.md). Does the 0.14 m kerb stop you, and does
// it feel like a ramp or a step?
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:800,height:500}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(3)));
const hold=async(k,ms)=>{ await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(120); };
const run=async(label,x,z,yaw,ms)=>{
  await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0),[x,z,yaw]);
  await p.waitForTimeout(350);
  const a=await pos(); const track=[];
  for(let i=0;i<Math.round(ms/110);i++){ await hold('w',110); const q=await pos(); track.push(q[3]); }
  const c=await pos();
  const levels=[...new Set(track.map(v=>v.toFixed(3)))];
  console.log(`  ${label}`);
  console.log(`     from (${a[0]}, ${a[2]}) gy ${a[3]}  ->  (${c[0]}, ${c[2]}) gy ${c[3]}   moved ${Math.hypot(c[0]-a[0],c[2]-a[2]).toFixed(2)} m`);
  console.log(`     ground heights along the way: ${levels.join(' ')}   ${levels.length>2?'(intermediate steps present)':'(no intermediate height)'}`);
  return {a,c,levels};
};
console.log(`\nWALKING THE CROSSING (w held, ~110 ms at a time):`);
const up=await run('road -> pavement, across the crossing', 53.8,-104.5, Math.PI, 2600);
const dn=await run('pavement -> road, back again',          53.8,-108.5, 0,       2600);
console.log(`\nCONTROL — the bodega corner, where groundAt does ramp:`);
const ct=await run('road -> pavement at the bodega',        7.6,-95.0, Math.PI/2, 2600);
await b.close();
const climbed = up.c[3] > up.a[3] + 0.10;
console.log(`\n  crossing: ${climbed?'the kerb IS climbable on foot':'** the player did NOT get up the kerb'}`);
