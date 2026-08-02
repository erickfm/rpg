// Is the librarian behind the desk or in front of it? Compare her z against the
// desk's own z extent. "Behind" means on the far side from the room she serves.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>{
 let s='', fig=null; const desks=[];
 window.__ct.scene().traverse(m=>{ if(!m.isMesh||!m.geometry)return;
  const e=m.matrixWorld.elements; if(e[12]<900||e[12]>940) return;
  m.geometry.computeBoundingBox(); const bb=m.geometry.boundingBox;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[e[0]*X+e[4]*Y+e[8]*Z+e[12],e[1]*X+e[5]*Y+e[9]*Z+e[13],e[2]*X+e[6]*Y+e[10]*Z+e[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  const rep=m.material?.map?.repeat;
  if(rep&&Math.abs(rep.y)<0.9&&Math.abs(rep.y)>1e-6&&(mx[1]-mn[1])>0.5&&(bb.max.y-bb.min.y)>0.5){
   fig={x:+e[12].toFixed(2), z:+e[14].toFixed(2), zr:[+mn[2].toFixed(2),+mx[2].toFixed(2)]}; return; }
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  if(h>0.6&&h<1.4&&w>1.5&&d>0.4&&d<2.5&&mn[1]<0.4)
   desks.push({x:[+mn[0].toFixed(2),+mx[0].toFixed(2)], z:[+mn[2].toFixed(2),+mx[2].toFixed(2)], y:[+mn[1].toFixed(2),+mx[1].toFixed(2)]});
 });
 s+=`librarian at x ${fig.x}, z ${fig.z}\n`;
 s+=`desk-like objects near her: ${desks.length}\n`;
 for(const d of desks) s+=`   x ${d.x[0]}..${d.x[1]}  z ${d.z[0]}..${d.z[1]}  y ${d.y[0]}..${d.y[1]}\n`;
 const near=desks.filter(d=>fig.x>d.x[0]-1&&fig.x<d.x[1]+1).sort((a,b)=>Math.abs((a.z[0]+a.z[1])/2-fig.z)-Math.abs((b.z[0]+b.z[1])/2-fig.z))[0];
 if(near){ const dz=(near.z[0]+near.z[1])/2;
  s+=`\nnearest desk spans z ${near.z[0]}..${near.z[1]} (centre ${dz.toFixed(2)}); librarian z ${fig.z}\n`;
  s+= fig.z>near.z[1] ? `   -> she is BEYOND the desk's far edge by ${(fig.z-near.z[1]).toFixed(2)} m\n`
     : fig.z<near.z[0] ? `   -> she is IN FRONT of the desk's near edge by ${(near.z[0]-fig.z).toFixed(2)} m — ROOM side\n`
     : `   -> she is WITHIN the desk footprint\n`;
  s+=`   the room she serves lies toward -z (the entrance end); the staff side is +z\n`;}
 return s;}));
await b.close();
