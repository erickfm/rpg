// Two corrections. The door leaf is ~0.99 m, not the 1.11 m opening I matched.
// And the neighbour must be found by TOGGLING, not by presence: my box counts
// static residents who never leave, so "100% of afternoons" measured nothing.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000); await setClock(p,13);
const q=await p.evaluate(()=>window.__ct.pos());
console.log(await p.evaluate(([px,pz])=>{
 const all=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(Math.hypot((mn[0]+mx[0])/2-px,(mn[2]+mx[2])/2-pz)>7) return;
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  const span=Math.max(w,d);
  if(h>1.7&&h<2.4&&span>0.85&&span<1.15) all.push({span:+span.toFixed(3), h:+h.toFixed(3), y0:+mn[1].toFixed(3)});});
 const near99=all.filter(a=>Math.abs(a.span-0.99)<0.04);
 let s=`meshes 1.7-2.4 m tall and 0.85-1.15 m wide near the spawn: ${all.length}\n`;
 s+=`  spans present: ${[...new Set(all.map(a=>a.span))].sort().join(', ')}\n`;
 s+=`  matching a 0.99 m LEAF (±0.04): ${near99.length}\n`;
 return s;},[q[0],q[2]]));
// neighbour by TOGGLING
const N=await p.evaluate(()=>{
 const count=()=>{ let n=0;
  window.__ct.scene().traverse(m=>{ if(!m.isMesh||!m.material?.map?.image||!m.geometry)return;
   const rep=m.material.map.repeat; if(Math.abs(rep.y)>0.9||Math.abs(rep.y)<1e-6) return;
   m.geometry.computeBoundingBox(); if(m.geometry.boundingBox.max.y-m.geometry.boundingBox.min.y<1.0) return;
   const e=m.matrixWorld.elements; if(e[12]>190&&e[12]<215&&e[14]>-25&&e[14]<-5) n++;});
  return n;};
 const rows=[];
 for(let d=0; d<40; d++) for(let h=0; h<24; h++){ window.__ct.clock(h,0); rows.push({h,n:count()}); }
 return rows;});
const hist={}; for(const r of N) hist[r.n]=(hist[r.n]||0)+1;
console.log(`\nfigure count near the flat across ${N.length} game hours: ${JSON.stringify(hist)}`);
const base=Math.min(...N.map(r=>r.n));
const out=N.map(r=>({h:r.h, out:r.n>base}));
const aft=out.filter(o=>o.h>=12&&o.h<=18);
console.log(`baseline (nobody extra) = ${base} figures; "he is out" = more than ${base}`);
console.log(`  afternoons 12-18 with him out: ${aft.filter(o=>o.out).length} of ${aft.length} = ${(100*aft.filter(o=>o.out).length/aft.length).toFixed(1)}%   (C: 69.9% -> 12.2%)`);
let pairs=0; for(let i=1;i<out.length;i++) if(out[i].out&&out[i-1].out) pairs++;
console.log(`  consecutive-hour pairs with him out: ${pairs}   (C: 973 -> 0)`);
await b.close();
