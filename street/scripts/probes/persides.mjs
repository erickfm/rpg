// "the doors are misaligned ... confirm the logic independently per side"
// So: photograph BOTH flanks of the same car from mirrored positions. If the
// paint is mirrored correctly the two frames show the same features at the same
// distance from the same wheels. Checking one side is how the fault survived.
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-20,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
const cars=await p.evaluate(()=>{const o=[];
 window.__ct.scene().traverse(g=>{ if(g.userData?.wheelbase===undefined)return;
  const e=g.matrixWorld.elements;
  o.push({wb:+g.userData.wheelbase.toFixed(2),x:+e[12].toFixed(2),y:+e[13].toFixed(2),z:+e[14].toFixed(2),
   yaw:+Math.atan2(e[8],e[10]).toFixed(4)});});
 return o;});
const kind={2.9:'sedan',2.4:'hatch',3.3:'pickup',3:'van',5.5:'bus'};
console.log('vehicles:'); for(const c of cars) console.log(`  ${String(kind[c.wb]||c.wb).padEnd(7)} at (${c.x}, ${c.z}) yaw ${c.yaw}`);
// pick one clear sedan and one pickup on the open street
// exclude the fleet TEMPLATES parked at the origin - they are not placed cars
const pick=(wb)=>cars.filter(c=>Math.abs(c.wb-wb)<0.01 && (Math.abs(c.x)>0.5||Math.abs(c.z)>0.5))
  .sort((a,b)=>Math.abs(b.z)-Math.abs(a.z))[0];
for(const [name,wb] of [['sedan',2.9],['pickup',3.3]]){
 const c=pick(wb); if(!c){console.log(`no ${name}`);continue;}
 const cs=Math.cos(c.yaw), sn=Math.sin(c.yaw);
 for(const [side,s] of [['minus',-1],['plus',1]]){
  // a kerbside car has a building on one flank, so try progressively closer
  // until the camera actually lands. A missed shot is not evidence.
  let got=null, used=null;
  for(const d of [3.6,3.0,2.6,2.2,1.9]){
   const ox=c.x+s*d*cs, oz=c.z-s*d*sn;
   const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[ox,oz]);
   const yaw=Math.atan2(c.x-ox,-(c.z-oz));
   await p.evaluate(([x,z,y,g])=>window.__ct.warp(x,z,y,g,-0.05),[ox,oz,yaw,gy]);
   await afterFrames(p,4);
   const q=await p.evaluate(()=>window.__ct.pos());
   if(Math.hypot(q[0]-ox,q[2]-oz)<0.5){got=q;used=d;break;}
  }
  if(!got){console.log(`  ${name}-${side}: NO standoff landed — cannot shoot this flank`);continue;}
  await p.screenshot({path:`shots/ps2-${name}-${side}.png`});
  console.log(`  ps2-${name}-${side}.png  car (${c.x}, ${c.z}) cam (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) standoff ${used} m`);
 }
}
await b.close();
