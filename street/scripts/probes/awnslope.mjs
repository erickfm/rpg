// Which END of the awning is low? rotation.x is local and the tilt is on a
// parent, so ask the VERTICES: y at the wall end vs y at the outer end.
// Outward here is -z (frontage BODEGA face -96, out -1), so the outer edge is
// the more-negative z. An awning sheds water: the OUTER edge must be LOWER.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(9.5,-97.2,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
console.log(await p.evaluate(()=>{let s='';
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry?.attributes?.position)return;
  const m=o.matrixWorld.elements, pos=o.geometry.attributes.position;
  let zmin=1e9,zmax=-1e9, yAtZmin=[], yAtZmax=[], xs=[1e9,-1e9], ys=[1e9,-1e9];
  const V=[];
  for(let i=0;i<pos.count;i++){ const X=pos.getX(i),Y=pos.getY(i),Z=pos.getZ(i);
   const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12], wy=m[1]*X+m[5]*Y+m[9]*Z+m[13], wz=m[2]*X+m[6]*Y+m[10]*Z+m[14];
   V.push([wx,wy,wz]); if(wz<zmin)zmin=wz; if(wz>zmax)zmax=wz;
   if(wx<xs[0])xs[0]=wx; if(wx>xs[1])xs[1]=wx; if(wy<ys[0])ys[0]=wy; if(wy>ys[1])ys[1]=wy;}
  if(xs[0]<9||xs[1]>18||zmin<-97||zmax>-95) return;
  if(ys[0]<2.3||ys[1]>3.9||(xs[1]-xs[0])<1.5) return;
  for(const [x,y,z] of V){ if(Math.abs(z-zmin)<1e-4) yAtZmin.push(y); if(Math.abs(z-zmax)<1e-4) yAtZmax.push(y);}
  const avg=(a)=>a.length?a.reduce((p,c)=>p+c,0)/a.length:NaN;
  const outerY=avg(yAtZmin), wallY=avg(yAtZmax);   // outer = more negative z
  s+=`mesh x ${xs[0].toFixed(2)}..${xs[1].toFixed(2)}  z ${zmin.toFixed(3)}..${zmax.toFixed(3)}\n`+
     `   OUTER edge (z ${zmin.toFixed(3)}, away from the wall): y ${outerY.toFixed(3)}\n`+
     `   WALL  edge (z ${zmax.toFixed(3)}):                      y ${wallY.toFixed(3)}\n`+
     `   -> outer is ${(outerY-wallY<0?'LOWER by '+((wallY-outerY)*1000).toFixed(0)+' mm — sheds outward, CORRECT':'HIGHER by '+((outerY-wallY)*1000).toFixed(0)+' mm — tilts UP, the reported fault')}\n`;});
 return s||'no awning-like mesh matched';}));
for(const [n,x,z,tx,tz,pi] of [['awn2',11.5,-98.6,13.0,-96.2,0.22],['crate2',9.6,-98.0,11.2,-96.3,-0.18]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,Math.atan2(tx-x,-(tz-z)),gy,pi]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/bg-${n}.png`});
 console.log(`  bg-${n}.png at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-x,got[2]-z)<0.6?'landed':'** MISSED'}`);
}
await b.close();
