// Does the toe point the way they walk? Find a walker actually moving, stand
// perpendicular to its travel, and shoot the profile.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-40,0,0,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
for(let attempt=0;attempt<6;attempt++){
 const a=await p.evaluate(()=>(window.__ct.walkers()||[]).map(c=>({x:c.x,z:c.z})));
 await p.waitForTimeout(700);
 const c2=await p.evaluate(()=>(window.__ct.walkers()||[]).map(c=>({x:c.x,z:c.z})));
 // pick the fastest mover on the main street
 let best=-1,bi=-1;
 for(let i=0;i<a.length;i++){ const d=Math.hypot(c2[i].x-a[i].x,c2[i].z-a[i].z);
  if(Math.abs(c2[i].x)<8 && d>best){best=d;bi=i;} }
 if(bi<0||best<0.2){ continue; }
 const w=c2[bi], dx=(c2[bi].x-a[bi].x)/best, dz=(c2[bi].z-a[bi].z)/best;
 // stand perpendicular to travel, 3.2 m off, at eye height
 const px=w.x - dz*3.2, pz=w.z + dx*3.2;
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[px,pz]);
 await p.evaluate(([x,z,y,g])=>window.__ct.warp(x,z,y,g,-0.22),[px,pz,Math.atan2(w.x-px,-(w.z-pz)),gy]);
 await afterFrames(p,2);
 await p.screenshot({path:'shots/ft-side.png'});
 console.log(`walker ${bi} moving (${dx.toFixed(2)}, ${dz.toFixed(2)}) at ${(best/0.7).toFixed(2)} m/s`);
 console.log(`  camera (${px.toFixed(1)}, ${pz.toFixed(1)}) -> subject (${w.x.toFixed(1)}, ${w.z.toFixed(1)})`);
 console.log('  shots/ft-side.png');
 break;
}
await b.close();
