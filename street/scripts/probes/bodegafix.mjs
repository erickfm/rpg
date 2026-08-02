// Two D rows at once, both at the bodega corner.
//  1. the awning: an awning sheds water, so the OUTER edge must be the LOW one.
//  2. the crates: one z, backs clear of the wing's proud face, and out of the
//     shop's [E] circle at (7.47,-95.53) r 1.8.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(9.5,-93.5,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
const r=await p.evaluate(()=>{const awn=[],crates=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements; let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(mn[0]<7||mx[0]>18||mn[2]<-98||mx[2]>-94) return;
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  // awning: wide, shallow in y, sits 2.5-3.5 m up, projects out from the wall
  if(mn[1]>2.3&&mx[1]<3.8&&w>1.5&&h<0.6) awn.push({rotX:+o.rotation.x.toFixed(4),
    y0:+mn[1].toFixed(3),y1:+mx[1].toFixed(3),z0:+mn[2].toFixed(3),z1:+mx[2].toFixed(3),x0:+mn[0].toFixed(2),x1:+mx[0].toFixed(2)});
  // crates: small boxes near the ground
  if(mn[1]<0.9&&h>0.15&&h<0.8&&w>0.25&&w<0.9&&d>0.25&&d<0.9)
    crates.push({x0:+mn[0].toFixed(3),x1:+mx[0].toFixed(3),z0:+mn[2].toFixed(3),z1:+mx[2].toFixed(3),y0:+mn[1].toFixed(3)});});
 return {awn,crates};});
console.log(`AWNING candidates: ${r.awn.length}`);
for(const a of r.awn){
 // the wall is at more-negative z; +z is out from the shopfront
 const wallEdgeY = a.z0 < a.z1 ? null : null;
 console.log(`  rotation.x ${a.rotX}  y ${a.y0}..${a.y1}  z ${a.z0}..${a.z1}  x ${a.x0}..${a.x1}`);
 console.log(`     -> outer edge (larger z, away from the wall) is the ${a.rotX>0?'LOW':'HIGH'} one by rotation sign; span in y = ${(a.y1-a.y0).toFixed(3)} m`);
}
console.log(`\nCRATES near the bodega: ${r.crates.length}`);
const zs=[];
for(const c of r.crates){ const back=Math.min(c.z0,c.z1); zs.push(back);
 const far=Math.max(Math.hypot(c.x0-7.47,c.z0+95.53),Math.hypot(c.x1-7.47,c.z1+95.53));
 const near=Math.min(Math.hypot(c.x0-7.47,c.z0+95.53),Math.hypot(c.x1-7.47,c.z1+95.53));
 console.log(`  x ${c.x0}..${c.x1}  z ${c.z0}..${c.z1}  back face ${back}  clear of proud face (-96.12): ${(back+96.12).toFixed(3)} m  nearest corner to the [E] circle: ${near.toFixed(2)} m (r 1.8)`);}
if(zs.length>1) console.log(`  stagger between crate backs: ${(Math.max(...zs)-Math.min(...zs)).toFixed(3)} m  (was 0.030)`);
for(const [n,x,z,tx,tz,pi] of [['awn',10.5,-93.6,12.5,-96.0,0.16],['crate',9.2,-94.2,11.0,-96.0,-0.35]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4); await p.screenshot({path:`shots/bg-${n}.png`});
 const got=await p.evaluate(()=>window.__ct.pos());
 console.log(`  bg-${n}.png ${Math.hypot(got[0]-x,got[2]-z)<0.6?'landed':'** MISSED'}`);
}
await b.close();
