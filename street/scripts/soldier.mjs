// B's soldier course at the bodega cut corner. Parallel to the 45 degree face,
// 2.60 x 0.42, 4 mm proud. Check the geometry AND look from my own check point.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(6.4,-97.4,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
console.log(await p.evaluate(()=>{let s='';
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry?.attributes?.position)return;
  const m=o.matrixWorld.elements, pos=o.geometry.attributes.position;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9]; const V=[];
  for(let i=0;i<pos.count;i++){ const X=pos.getX(i),Y=pos.getY(i),Z=pos.getZ(i);
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12], m[1]*X+m[5]*Y+m[9]*Z+m[13], m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   V.push(v); for(let j=0;j<3;j++){if(v[j]<mn[j])mn[j]=v[j]; if(v[j]>mx[j])mx[j]=v[j];}}
  const cx=(mn[0]+mx[0])/2, cz=(mn[2]+mx[2])/2;
  if(cx<5.5||cx>10.5||cz<-97.5||cz>-93) return;
  if(mn[1]<0.10||mx[1]>0.30) return;                   // ground band only
  const dx=mx[0]-mn[0], dz=mx[2]-mn[2];
  if(dx<0.6||dz<0.6) return;                            // must be the diagonal band
  // long axis: for a 45 deg band the extent along (1,-1)/r2 is the length
  const s1=V.map(v=>(v[0]-v[2])/Math.SQRT2), s2=V.map(v=>(v[0]+v[2])/Math.SQRT2);
  const len=Math.max(...s1)-Math.min(...s1), wid=Math.max(...s2)-Math.min(...s2);
  const faceLine=V.map(v=>v[0]+v[2]);
  s+=`band at (${cx.toFixed(2)}, ${cz.toFixed(2)})  y ${mn[1].toFixed(3)}..${mx[1].toFixed(3)} (proud ${((mx[1]-0.14)*1000).toFixed(0)} mm)\n`+
     `   along the 45 deg face: length ${len.toFixed(2)} m   across it: ${wid.toFixed(2)} m   (B says 2.60 x 0.42)\n`+
     `   x+z spans ${Math.min(...faceLine).toFixed(2)} .. ${Math.max(...faceLine).toFixed(2)}  (the cut face is x+z = -87.01)\n`;});
 return s||'no diagonal ground band found at the corner';}));
for(const [n,x,z,tx,tz,pi] of [['sold',6.4,-97.4,8.2,-95.2,-0.42],['sold2',7.0,-97.0,8.3,-95.6,-0.60]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/sc-${n}.png`});
 console.log(`  sc-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.6?'landed':'** MISSED'}`);
}
await b.close();
