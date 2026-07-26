// The window family: four rows, the user's most repeated ask. C claims a real
// light well 1.9 across x 1.2 deep with both side returns and a floor far below.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
await setClock(p,13);
const spawn=await p.evaluate(()=>{ const s=window.__ct.spots?window.__ct.spots():null; return {pos:window.__ct.pos(), spots:s?s.length:null};});
console.log('player at', spawn.pos.map(v=>+v.toFixed(1)));
// geometry of the well: everything just outside the room's window wall
const geo=await p.evaluate(([px,pz])=>{
 const out=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(Math.hypot((mn[0]+mx[0])/2-px,(mn[2]+mx[2])/2-pz)>9) return;
  out.push({x:[+mn[0].toFixed(2),+mx[0].toFixed(2)],y:[+mn[1].toFixed(2),+mx[1].toFixed(2)],z:[+mn[2].toFixed(2),+mx[2].toFixed(2)]});});
 return out;},[spawn.pos[0],spawn.pos[2]]);
console.log(`meshes within 9 m of the player: ${geo.length}`);
const deep=geo.filter(q=>q.y[0]<spawn.pos[1]-4);
console.log(`  of those, extending more than 4 m BELOW the player (a well floor far down): ${deep.length}`);
for(const q of deep.slice(0,5)) console.log(`     x ${q.x[0]}..${q.x[1]}  y ${q.y[0]}..${q.y[1]}  z ${q.z[0]}..${q.z[1]}`);
// look out: sweep yaw for the brightest view (the window)
let best=null;
for(let k=0;k<12;k++){ const yaw=k*Math.PI/6;
 await p.evaluate(([y])=>window.__ct.warp(window.__ct.pos()[0],window.__ct.pos()[2],y,undefined,0),[yaw]);
 await afterFrames(p,2);
 const L=await p.evaluate(()=>{const c=document.querySelector('canvas'),t=document.createElement('canvas');
  t.width=64;t.height=36;const g=t.getContext('2d');g.drawImage(c,0,0,64,36);
  const d=g.getImageData(16,8,32,20).data; let s=0,n=0;
  for(let i=0;i<d.length;i+=4){s+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];n++;} return +(s/n).toFixed(1);});
 if(!best||L>best.L) best={yaw,L};
}
await p.evaluate(([y])=>window.__ct.warp(window.__ct.pos()[0],window.__ct.pos()[2],y,undefined,0),[best.yaw]);
await afterFrames(p,4); await p.screenshot({path:'shots/r301-window.png'});
console.log(`brightest view at yaw ${best.yaw.toFixed(2)} (luminance ${best.L}) -> shots/r301-window.png`);
await b.close();
