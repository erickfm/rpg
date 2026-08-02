// "these signs block each other" + "maybe the aces sign belongs on the other end"
// Blades are tall, thin and project from the facade. Measure where they are and
// how far apart, then look from along the street where overlap would show.
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(30,-104,0,0,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const bl=await p.evaluate(()=>{const o=[];
 window.__ct.scene().traverse(m=>{ if(!m.isMesh||!m.geometry)return; m.geometry.computeBoundingBox();
  const bb=m.geometry.boundingBox,e=m.matrixWorld.elements; let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[e[0]*X+e[4]*Y+e[8]*Z+e[12],e[1]*X+e[5]*Y+e[9]*Z+e[13],e[2]*X+e[6]*Y+e[10]*Z+e[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(mn[0]<30||mx[0]>62||mn[2]<-99||mx[2]>-93) return;
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  if(h<3||w>1.6) return;                       // tall and narrow across the facade
  if(d<0.4) return;                            // must project from the wall
  o.push({x:+((mn[0]+mx[0])/2).toFixed(2), h:+h.toFixed(1), y:[+mn[1].toFixed(1),+mx[1].toFixed(1)],
    z:[+mn[2].toFixed(2),+mx[2].toFixed(2)], w:+w.toFixed(2)});});
 return o.sort((a,b)=>a.x-b.x);});
console.log(`blade-like signs on the side street: ${bl.length}`);
for(const q of bl) console.log(`   x ${q.x}  height ${q.h} (y ${q.y[0]}..${q.y[1]})  projects z ${q.z[0]}..${q.z[1]}  width ${q.w}`);
for(let i=1;i<bl.length;i++) console.log(`   gap ${bl[i-1].x} -> ${bl[i].x} = ${(bl[i].x-bl[i-1].x).toFixed(2)} m`);
for(const [n,x,z,tx,tz,pi] of [
 ['along', 30.0,-101.0, 60.0,-99.0, 0.10],
 ['back',  62.0,-101.0, 30.0,-99.0, 0.10],
 ['night', 30.0,-101.0, 60.0,-99.0, 0.10],
]){
 if(n==='night') await setClock(p,21);
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,5); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/bl-${n}.png`});
 console.log(`  bl-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.9?'landed':'** MISSED'}`);
}
await b.close();
