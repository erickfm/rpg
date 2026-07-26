// Does the DINER FACADE (not its blade) have the depth treatment? Depth is a
// PROFILE: the facade plane is x=-7 with outward +1, so projecting elements sit
// at x > -7 and set-back glass at x < -7. Measure the whole frontage band.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-49,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
const r=await p.evaluate(()=>{const out=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements; let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(mx[2]<-55.5||mn[2]>-43.5) return;             // the diner's own frontage
  if(mx[0]<-9.2||mn[0]>-5.0) return;               // near the facade plane x=-7
  if(mx[1]>7) return;                              // shopfront zone only
  const mat=Array.isArray(o.material)?o.material[0]:o.material;
  out.push({x0:+mn[0].toFixed(3),x1:+mx[0].toFixed(3),y0:+mn[1].toFixed(2),y1:+mx[1].toFixed(2),
   z0:+mn[2].toFixed(1),z1:+mx[2].toFixed(1),tex:!!mat?.map,
   col:mat?.color?'#'+mat.color.getHexString():null, op:mat?.opacity, tr:!!mat?.transparent});});
 return out.sort((a,b)=>b.x1-a.x1);});
console.log(`meshes in the diner shopfront zone: ${r.length}\n`);
console.log('   x range          y range      z range     tex   colour    note');
for(const o of r){
 const proj=o.x1>-7.0+0.005, rec=o.x1<-7.0-0.005;
 const note = proj?`PROJECTS ${((o.x1+7)*1000).toFixed(0)} mm`:(rec?`set back ${((-7-o.x1)*1000).toFixed(0)} mm`:'flush');
 console.log(`  ${String(o.x0).padStart(7)}..${String(o.x1).padEnd(7)} ${String(o.y0).padStart(5)}..${String(o.y1).padEnd(5)} ${String(o.z0).padStart(6)}..${String(o.z1).padEnd(6)} ${String(o.tex).padStart(5)}  ${String(o.col).padEnd(8)}  ${note}`);
}
const front=r.filter(o=>o.x1>-7.0+0.005), back=r.filter(o=>o.x1<-7.0-0.005);
console.log(`\nprojecting past the facade plane: ${front.length}   set back behind it: ${back.length}   flush: ${r.length-front.length-back.length}`);
if(front.length) console.log(`deepest projection: ${(Math.max(...front.map(o=>o.x1))+7).toFixed(3)} m`);
if(back.length)  console.log(`deepest set-back  : ${(-7-Math.min(...back.map(o=>o.x1))).toFixed(3)} m`);
// and photograph it, from the pavement and from across the street
for(const [n,x,z,tx,tz,pi] of [['walk',-6.0,-49.0,-7.0,-49.0,-0.02],['across',5.5,-49.0,-7.0,-49.0,-0.02],['oblq',-6.0,-42.0,-7.0,-52.0,-0.04]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4);
 const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/df-${n}.png`});
 console.log(`  df-${n}.png  got (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.6?'landed':'** MISSED'}`);
}
await b.close();
