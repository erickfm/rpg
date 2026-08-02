import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-20,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
// where does the bodega's geometry actually sit?
console.log(await p.evaluate(()=>{
 let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9,mny=1e9,mxy=-1e9,n=0;
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  const m=o.matrixWorld.elements; if(m[12]<400||m[12]>480) return; n++;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox;
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12], wy=m[1]*X+m[5]*Y+m[9]*Z+m[13], wz=m[2]*X+m[6]*Y+m[10]*Z+m[14];
   if(wx<mnx)mnx=wx; if(wx>mxx)mxx=wx; if(wz<mnz)mnz=wz; if(wz>mxz)mxz=wz; if(wy<mny)mny=wy; if(wy>mxy)mxy=wy;}});
 return `bodega belt geometry: ${n} meshes  x ${mnx.toFixed(1)}..${mxx.toFixed(1)}  y ${mny.toFixed(2)}..${mxy.toFixed(2)}  z ${mnz.toFixed(1)}..${mxz.toFixed(1)}`;}));
for(const [n,x,z,gy] of [['c',440,0,0],['c2',440,0,0.02],['n',440,-3,0],['s',440,3,0],['off',441,1,0]]){
 const got=await p.evaluate(([x,z,g])=>{window.__ct.warp(x,z,Math.PI,g,-0.02); return window.__ct.pos();},[x,z,gy]);
 console.log(`  warp(${x}, ${z}, gy ${gy}) -> x ${got[0].toFixed(1)} y ${got[1].toFixed(2)} z ${got[2].toFixed(1)}  ${Math.abs(got[0]-x)<0.5?'OK':'** REFUSED'}`);
 if(Math.abs(got[0]-x)<0.5){ await afterFrames(p,4); await p.screenshot({path:`shots/bod-${n}.png`}); console.log(`     shots/bod-${n}.png`);}
}
await b.close();
