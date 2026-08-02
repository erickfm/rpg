// H: the cat looks up when you stand OVER her - pose not pitch, near AND above,
// hysteresis 1.6/0.9 in and 1.95/0.75 out. The canonical station is standing
// over it, not flat-on, so shoot from there and from far for contrast.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-40.1,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
// find the cat: a small dark prop on the alley floor near the paper
const cat=await p.evaluate(()=>{let best=null;
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  const cx=(mn[0]+mx[0])/2, cz=(mn[2]+mx[2])/2;
  if(cx>-9.5||cx<-10.5||cz>-42.0||cz<-42.7) return;
  const h=mx[1]-mn[1]; if(h<0.15||h>1.1) return;   // the cat is a 0.82 m BILLBOARD, not a small box
  if(!best||h>best.h) best={x:+cx.toFixed(2), z:+cz.toFixed(2), h:+h.toFixed(2), top:+mx[1].toFixed(2)};});
 return best;});
console.log('cat-sized prop:', JSON.stringify(cat));
if(!cat){console.error('cat not found');process.exit(3);}
// H's hysteresis: in at 1.6 near / 0.9 above, out at 1.95 / 0.75
for(const [n,d] of [['far',4.5],['edge',1.9],['over',0.75]]){
 const px=cat.x+d*0.55, pz=cat.z+d*0.84;
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[px,pz]);
 const dist=Math.hypot(cat.x-px,cat.z-pz);
 const pitch=Math.atan2((cat.top+0.1)-(gy+1.62), dist);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[px,pz,Math.atan2(cat.x-px,-(cat.z-pz)),gy,pitch]);
 await afterFrames(p,6); await p.waitForTimeout(400); await afterFrames(p,4);
 await p.screenshot({path:`shots/co-${n}.png`});
 console.log(`  co-${n}.png  standing ${dist.toFixed(2)} m away, eye ${(gy+1.62).toFixed(2)}, looking down ${(-pitch).toFixed(2)} rad`);
}
await b.close();
