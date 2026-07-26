// "the front of the bank doesnt match the side fix this" - raised twice.
// The measurable form: are there large building faces carrying FLAT COLOUR
// where their own front carries a texture? Checked world-wide, not just for the
// one colour a builder happened to name.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const flat=[], tex=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(mn[0]>200) return;                                  // skip the interior belt
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  if(h<4) return;                                        // building-scale only
  const face=Math.max(w,d)*h; if(face<25) return;         // a real elevation
  const mats=Array.isArray(o.material)?o.material:[o.material];
  for(const mat of mats){ if(!mat) continue;
   const rec={area:+face.toFixed(0), h:+h.toFixed(1), x:[+mn[0].toFixed(1),+mx[0].toFixed(1)], z:[+mn[2].toFixed(1),+mx[2].toFixed(1)],
     col:mat.color?'#'+mat.color.getHexString():null};
   if(mat.map) tex.push(rec); else flat.push(rec); }
 });
 return {flat,tex};});
console.log(`building-scale elevations (h>=4 m, face area>=25 m2): ${r.tex.length} textured, ${r.flat.length} FLAT COLOUR`);
const key='53382e';
console.log(`the colour D named (#${key}) on flat faces: ${r.flat.filter(f=>f.col&&f.col.includes(key)).length}`);
if(r.flat.length){
 console.log('\nflat-colour elevations, largest first:');
 for(const f of r.flat.sort((a,b)=>b.area-a.area).slice(0,14))
  console.log(`   ${String(f.area).padStart(5)} m2  h ${f.h}  x ${f.x[0]}..${f.x[1]}  z ${f.z[0]}..${f.z[1]}  ${f.col}`);
} else console.log('\nno flat-colour building elevation anywhere in the street world');
await b.close();
