// My pit filter found none on the side street. Given three previous tree-pit
// finder failures, widen first: list EVERY ground-level patch and every tall
// thin trunk along the side street, with dimensions, and let the data speak.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const flat=[], tall=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox, m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  const cx=(mn[0]+mx[0])/2, cz=(mn[2]+mx[2])/2;
  if(cx<8||cx>60) return;
  if(cz<-113||cz>-93) return;
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  if(h<0.12 && w>0.3 && w<3 && d>0.3 && d<3) flat.push({x:+cx.toFixed(1), z:+cz.toFixed(1), w:+w.toFixed(2), d:+d.toFixed(2), y:+mn[1].toFixed(2)});
  if(h>2.5 && w<1.2 && d<1.2) tall.push({x:+cx.toFixed(1), z:+cz.toFixed(1), h:+h.toFixed(1), w:+w.toFixed(2)});
 });
 let s=`ground patches (h<0.12) along the side street: ${flat.length}\n`;
 for(const q of flat.sort((a,b)=>a.x-b.x).slice(0,14)) s+=`   x ${String(q.x).padStart(5)} z ${String(q.z).padStart(7)}  ${q.w} x ${q.d}  at y ${q.y}\n`;
 s+=`\ntall thin objects (h>2.5, footprint<1.2) — trunks and posts: ${tall.length}\n`;
 for(const q of tall.sort((a,b)=>a.x-b.x).slice(0,16)) s+=`   x ${String(q.x).padStart(5)} z ${String(q.z).padStart(7)}  height ${q.h}  width ${q.w}\n`;
 const xs=tall.map(q=>q.x).sort((a,b)=>a-b);
 s+=`\ngaps between tall objects along x: ${xs.slice(1).map((v,i)=>+(v-xs[i]).toFixed(1)).join(', ')}\n`;
 return s;}));
await b.close();
