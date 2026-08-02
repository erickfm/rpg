// Climb the library stair on foot, and come back down.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const pos=()=>p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
const hold=async(k,ms)=>{ await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(100); };
// VERIFY WHERE YOU LANDED BEFORE PRESSING A KEY. My first run started the
// climb at gy 2.17 - already half way up - and then reported "DID NOT CLIMB"
// because it only rose 0.73 m. The harness was wrong, not the stair. The queue
// names this as defect 1 and I walked into it in my own script.
const walk=async(label,x,z,yaw,steps,wantGy)=>{
  await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),0),[x,z,yaw]);
  await p.waitForTimeout(400);
  const a=await pos();
  if(wantGy!==undefined&&Math.abs(a[3]-wantGy)>0.15){
    console.log(`  ${label}\n     ** NOT STARTED: wanted ground ${wantGy}, landed on ${a[3]} at (${a[0]}, ${a[2]}). Not pressing a key.`);
    return null; } const seen=[];
  for(let i=0;i<steps;i++){ await hold('w',130); const q=await pos(); seen.push(q[3]); }
  const c=await pos();
  const lv=[...new Set(seen.map(v=>v.toFixed(2)))];
  console.log(`  ${label}`);
  console.log(`     (${a[0]}, ${a[2]}) gy ${a[3]}  ->  (${c[0]}, ${c[2]}) gy ${c[3]}   climbed ${(c[3]-a[3]).toFixed(2)} m over ${Math.hypot(c[0]-a[0],c[2]-a[2]).toFixed(2)} m`);
  console.log(`     distinct ground levels underfoot: ${lv.length}  ${lv.join(' ')}`);
  return {a,c,lv};
};
console.log(`\nWALKING THE LIBRARY STAIR:`);
const up=await walk('up the flight from the floor (facing -z)', 928.2, 10.5, 0, 30, 0);
const dn=await walk('back down (facing +z)', 928.2, -1.0, Math.PI, 30, 2.90);
// a look from the gallery for the balustrade
await p.evaluate(()=>window.__ct.warp(928.2,-4.0,Math.PI/2,window.__ct.groundAt(928.2,-4.0),-0.25));
await p.waitForTimeout(400); await p.screenshot({path:'shots/lib-gallery.png'});
const g=await pos(); console.log(`\n  shots/lib-gallery.png from the gallery at (${g[0]}, ${g[2]}) gy ${g[3]}`);
await p.evaluate(()=>window.__ct.warp(922.0,4.0,Math.atan2(928.2-922,-(2-4)),window.__ct.groundAt(922,4),0.05));
await p.waitForTimeout(400); await p.screenshot({path:'shots/lib-stair.png'});
console.log(`  shots/lib-stair.png from the floor, looking at the flight`);
await b.close();
console.log(`\n  ${up&&up.c[3]>up.a[3]+2.0?'CLIMBED — the gallery is reachable on foot':'** DID NOT CLIMB'}`);
console.log(`  ${dn&&dn.c[3]<dn.a[3]-2.0?'DESCENDED — and you can get back down':'** DID NOT DESCEND'}`);
