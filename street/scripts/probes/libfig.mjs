// My rejection rested on "the librarian at z 4.45". The shot shows no figure at
// all, so enumerate every atlas-framed figure in the library and say what each
// actually is - I may have rejected twice on a misidentified object.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 const d=window.__ct.roomDims().find(q=>q.id==='library');
 let s=`library room ${d.w} x ${d.d} at (${d.cx}, ${d.cz})\n\n`;
 const rows=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  const e=o.matrixWorld.elements;
  if(Math.abs(e[12]-d.cx)>d.w/2+1||Math.abs(e[14]-d.cz)>d.d/2+1) return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[e[0]*X+e[4]*Y+e[8]*Z+e[12],e[1]*X+e[5]*Y+e[9]*Z+e[13],e[2]*X+e[6]*Y+e[10]*Z+e[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  const h=mx[1]-mn[1], w=mx[0]-mn[0], dd=mx[2]-mn[2];
  // o.material.map on a MATERIALS ARRAY is Array.prototype.map - a function,
  // not a texture. Silently truthy, and it has no .repeat.
  const mat=Array.isArray(o.material)?o.material[0]:o.material;
  const map=mat&&mat.map&&mat.map.isTexture?mat.map:null;
  const framed = map && Math.abs(map.repeat.y)<0.9 && Math.abs(map.repeat.y)>1e-6;
  if(h<0.9) return;
  rows.push({framed:!!framed, h:+h.toFixed(2), w:+w.toFixed(2), d:+dd.toFixed(2),
    x:+((mn[0]+mx[0])/2).toFixed(2), z:+((mn[2]+mx[2])/2).toFixed(2), y0:+mn[1].toFixed(2),
    tex: map&&map.image? map.image.width+'x'+map.image.height : 'none'});});
 const people=rows.filter(r=>r.framed && r.h>1.2 && r.h<2.2 && r.w<1.3);
 s+=`objects over 0.9 m tall in the room: ${rows.length}\n`;
 s+=`PERSON-SHAPED (atlas frame, 1.2-2.2 m tall, under 1.3 m wide): ${people.length}\n`;
 for(const q of people) s+=`   at (${q.x}, ${q.z})  ${q.h} m tall, base y ${q.y0}, atlas ${q.tex}\n`;
 const framedOther=rows.filter(r=>r.framed && !people.includes(r));
 s+=`\nother atlas-framed objects (what my detector may have grabbed): ${framedOther.length}\n`;
 for(const q of framedOther.slice(0,6)) s+=`   at (${q.x}, ${q.z})  ${q.h} x ${q.w} x ${q.d}, base y ${q.y0}, atlas ${q.tex}\n`;
 return s;}));
await b.close();
