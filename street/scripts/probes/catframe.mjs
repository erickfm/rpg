// "put the cat on the right side of the paper trash"
// D's finding: "right" is only meaningful in the FRAME it was computed for.
// So do not argue from coordinates - project cat, paper and cardboard to screen
// space from several natural viewpoints and report their left-to-right order.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-40.1,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
// locate the three objects from the world rather than trusting quoted numbers
const obj=await p.evaluate(()=>{const o=[];
 window.__ct.scene().traverse(m=>{ if(!m.isMesh||!m.geometry)return;
  const e=m.matrixWorld.elements; const x=e[12], z=e[14];
  if(x>-7||x<-13||z>-39||z<-45) return;
  m.geometry.computeBoundingBox(); const bb=m.geometry.boundingBox;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[e[0]*X+e[4]*Y+e[8]*Z+e[12],e[1]*X+e[5]*Y+e[9]*Z+e[13],e[2]*X+e[6]*Y+e[10]*Z+e[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  const ud=m.userData||{};
  if(ud.litter) o.push({tag:ud.litter, x:+((mn[0]+mx[0])/2).toFixed(2), z:+((mn[2]+mx[2])/2).toFixed(2), h:+h.toFixed(2)});
  else if(h>0.15&&h<0.6&&w<0.8&&d<0.8&&mn[1]<0.2) o.push({tag:'cat?', x:+((mn[0]+mx[0])/2).toFixed(2), z:+((mn[2]+mx[2])/2).toFixed(2), h:+h.toFixed(2)});
 });
 return o;});
console.log('objects on the alley floor:');
for(const q of obj) console.log(`   ${String(q.tag).padEnd(20)} (${q.x}, ${q.z})  height ${q.h}`);
// project each to screen-x from several natural viewpoints
const views=[['mouth',-6.2,-40.1,-11.0,-42.0],['walkin',-8.0,-41.0,-11.5,-42.3],['close',-8.8,-41.6,-11.5,-42.6]];
for(const [n,cx,cz,tx,tz] of views){
 const fx=tx-cx, fz=tz-cz, fl=Math.hypot(fx,fz);
 const f=[fx/fl, fz/fl], right=[-f[1], f[0]];      // screen right = forward x up
 const order=obj.map(q=>({tag:q.tag, s:+(((q.x-cx)*right[0]+(q.z-cz)*right[1])).toFixed(2)}))
   .sort((a,b)=>a.s-b.s);
 console.log(`\n${n}: standing (${cx}, ${cz}) looking at (${tx}, ${tz})`);
 console.log(`   left -> right: ${order.map(q=>`${q.tag}[${q.s}]`).join('  ')}`);
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[cx,cz]);
 await p.evaluate(([x,z,y,g])=>window.__ct.warp(x,z,y,g,-0.30),[cx,cz,Math.atan2(tx-cx,-(tz-cz)),gy]);
 await afterFrames(p,4); await p.screenshot({path:`shots/cf-${n}.png`});
}
await b.close();
