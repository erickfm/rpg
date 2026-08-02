// Two rows: the truck clear of the alley mouth, and the "kid" (p1, the smallest
// citizen, in a ball cap) whose head was three colours that did not join up.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-34,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
// 1. every parked car on the west kerb against the alley span
const t=await p.evaluate(()=>{const o=[];
 window.__ct.scene().traverse(g=>{ if(g.userData?.wheelbase===undefined)return;
  const e=g.matrixWorld.elements; const x=e[12], z=e[14];
  if(Math.abs(x)>9||z>-15||z<-60) return;
  // world extent along z
  let mn=1e9,mx=-1e9;
  g.traverse(m=>{ if(!m.isMesh||!m.geometry)return; m.geometry.computeBoundingBox();
   const bb=m.geometry.boundingBox, e2=m.matrixWorld.elements;
   for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
    const wz=e2[2]*X+e2[6]*Y+e2[10]*Z+e2[14]; if(wz<mn)mn=wz; if(wz>mx)mx=wz; }});
  o.push({x:+x.toFixed(2), wb:+g.userData.wheelbase.toFixed(2), z0:+mn.toFixed(2), z1:+mx.toFixed(2)});});
 return o;});
const AZ0=-37, AZ1=-43.5;
console.log(`alley mouth spans z ${AZ0} .. ${AZ1}\n`);
console.log('  kerb    kind        car z-extent        clear of the mouth');
for(const c of t.sort((a,b)=>b.z1-a.z1)){
 const kind={2.9:'sedan',2.4:'hatch',3.3:'pickup',3:'van'}[c.wb]||c.wb;
 const overlaps = !(c.z0>AZ0 || c.z1<AZ1);
 const clear = c.z1<AZ1 ? (AZ1-c.z1) : (c.z0>AZ0 ? (c.z0-AZ0) : 0);
 console.log(`  ${c.x<0?'WEST':'east'}   ${String(kind).padEnd(8)}  ${String(c.z0).padStart(7)}..${String(c.z1).padEnd(7)}   ${overlaps?'** OVERLAPS THE MOUTH':clear.toFixed(2)+' m'}`);
}
// 2. the smallest citizen
const kid=await p.evaluate(()=>{let best=null;
 window.__ct.scene().traverse(m=>{ if(!m.isMesh||!m.material?.map?.image||!m.geometry)return;
  const rep=m.material.map.repeat; if(Math.abs(rep.y)>0.9||Math.abs(rep.y)<1e-6) return;
  m.geometry.computeBoundingBox(); const bb=m.geometry.boundingBox;
  const h=bb.max.y-bb.min.y; if(h<1.0||h>2.2) return;
  const e=m.matrixWorld.elements;
  if(Math.abs(e[12])>9) return;
  if(!best||h<best.h) best={h:+h.toFixed(2), x:+e[12].toFixed(2), y:+e[13].toFixed(2), z:+e[14].toFixed(2)};});
 return best;});
console.log(`\nsmallest street citizen: height ${kid.h} m at (${kid.x}, ${kid.z})`);
const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[kid.x,kid.z]);
for(const [n,d] of [['face',1.5],['near',2.6]]){
 const cx=kid.x + (kid.x<0? d : -d), cz=kid.z;
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[cx,cz,Math.atan2(kid.x-cx,-(kid.z-cz)),gy,0.10]);
 await afterFrames(p,4); await p.screenshot({path:`shots/kd-${n}.png`});
 console.log(`  kd-${n}.png from ${d} m`);
}
await b.close();
