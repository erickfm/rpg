// Two rows: detail extended down the side street, and pedestrians going out that
// way. Both make measurable claims - gaps that GROW with x, and every walker
// visiting several distinct stretches.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const SECS=Number(process.env.SECS||150), HZ=2;
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(20,-100,0,0,0)); await afterFrames(p,10); await p.waitForTimeout(1500);
// 1. trees and parked cars along the side street
const det=await p.evaluate(()=>{
 const pits=[], cars=[];
 window.__ct.scene().traverse(o=>{
  if(o.userData?.wheelbase!==undefined){ const e=o.matrixWorld.elements;
   if(e[12]>8&&e[12]<60&&e[14]<-93&&e[14]>-112) cars.push(+e[12].toFixed(1)); return; }
  if(!o.isMesh||!o.geometry) return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox, m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  if(h<0.1 && Math.abs(w-1.4)<0.15 && Math.abs(d-0.56)<0.05 && mn[0]>8 && mn[0]<60)
   pits.push(+((mn[0]+mx[0])/2).toFixed(1));
 });
 return {pits:[...new Set(pits)].sort((a,b)=>a-b), cars:[...new Set(cars)].sort((a,b)=>a-b)};});
const gaps=(a)=>a.slice(1).map((v,i)=>+(v-a[i]).toFixed(1));
console.log(`side-street tree pits at x: ${det.pits.join(', ')||'none'}`);
console.log(`   gaps: ${gaps(det.pits).join(', ')||'-'}   (H says 8, 10, 12 - growing)`);
console.log(`side-street parked cars at x: ${det.cars.join(', ')||'none'}`);
console.log(`   gaps: ${gaps(det.cars).join(', ')||'-'}   (H says 11 then 13 - growing)`);
// 2. do the walkers go out that way?
await p.evaluate(([SECS,HZ])=>{ window.__ss={pos:[]};
 const read=()=>{const w=window.__ct.walkers?window.__ct.walkers():[];
  return (w||[]).map(c=>({x:+(c.x??0).toFixed(2), z:+(c.z??0).toFixed(2)}));};
 window.__ssT=setInterval(()=>window.__ss.pos.push(read()),1000/HZ);
 setTimeout(()=>clearInterval(window.__ssT),SECS*1000+500);},[SECS,HZ]);
console.log(`\nwatching walkers ${SECS} s ...`);
await p.waitForTimeout(SECS*1000+1500);
const S=await p.evaluate(()=>window.__ss.pos);
const N=S[0].length;
const where=(q)=>{
 if(q.x<-4 && q.z>-112 && q.z<16) return 'west walk';
 if(q.x>4 && q.x<8 && q.z>-97 && q.z<16) return 'east walk';
 if(q.x>7 && q.z>-99 && q.z<-95) return 'side st north';
 if(q.z<-107 && q.z>-112) return 'side st south';
 return 'junction/other';};
console.log('\nwalker   stretches visited');
const all=new Set();
for(let i=0;i<N;i++){ const seen=new Set();
 for(const row of S){ const q=row[i]; if(q) seen.add(where(q)); }
 for(const s of seen) all.add(s);
 console.log(`   ${String(i).padStart(3)}   ${seen.size}  ${[...seen].join(', ')}`);}
console.log(`\ndistinct stretches reached by the crowd overall: ${all.size} — ${[...all].join(' | ')}`);
await b.close();
