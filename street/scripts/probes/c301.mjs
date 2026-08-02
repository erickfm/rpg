// C's 301 cluster: door leaf vs opening (0.99 in 0.95, +0.020 each side,
// +0.050 head, 0.030 undercut), the [E] open/close verb, and the neighbour's
// frequency (0.7 -> 0.16 at peak with a cooldown, no consecutive hours).
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000); await setClock(p,13);
const q=await p.evaluate(()=>window.__ct.pos());
console.log('spawn', q.map(v=>+v.toFixed(1)));
// 1. the door leaf and its opening
console.log(await p.evaluate(([px,py,pz])=>{
 const cands=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(Math.hypot((mn[0]+mx[0])/2-px,(mn[2]+mx[2])/2-pz)>7) return;
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  const span=Math.max(w,d), thin=Math.min(w,d);
  if(h>1.8&&h<2.4&&span>0.8&&span<1.2&&thin<0.20)
   cands.push({span:+span.toFixed(3), h:+h.toFixed(3), y:[+mn[1].toFixed(3),+mx[1].toFixed(3)], thin:+thin.toFixed(3)});});
 let s=`door-leaf-like meshes near the spawn: ${cands.length}\n`;
 for(const c of cands.slice(0,4)) s+=`   leaf ${c.span} m wide, ${c.h} m tall (y ${c.y[0]}..${c.y[1]}), ${c.thin} thick\n`;
 return s;},[q[0],q[1],q[2]]));
// 2. the neighbour, sampled across many game hours
const N=await p.evaluate(async ()=>{
 const out=[]; const near=(h)=>{ let n=0;
  window.__ct.scene().traverse(m=>{ if(!m.isMesh||!m.material?.map?.image||!m.geometry)return;
   const rep=m.material.map.repeat; if(Math.abs(rep.y)>0.9||Math.abs(rep.y)<1e-6) return;
   m.geometry.computeBoundingBox(); if(m.geometry.boundingBox.max.y-m.geometry.boundingBox.min.y<1.0) return;
   const e=m.matrixWorld.elements; if(e[12]>190&&e[12]<215&&e[14]>-25&&e[14]<-5) n++;});
  return n;};
 for(let d=0; d<40; d++) for(let h=0; h<24; h++){
  window.__ct.clock(h,0); out.push({h, n:near(h)});
 }
 return out;});
const afternoons=N.filter(o=>o.h>=12&&o.h<=18);
const outCount=afternoons.filter(o=>o.n>0).length;
console.log(`\nneighbour sampled over ${N.length} game hours (${afternoons.length} of them 12:00-18:00)`);
console.log(`  afternoons with a figure near the flat: ${outCount} of ${afternoons.length} = ${(100*outCount/afternoons.length).toFixed(1)}%   (C: 69.9% -> 12.2%)`);
let pairs=0; for(let i=1;i<N.length;i++) if(N[i].n>0&&N[i-1].n>0) pairs++;
console.log(`  consecutive-hour pairs with him out: ${pairs}   (C: 973 -> 0)`);
await b.close();
