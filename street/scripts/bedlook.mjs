import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-5.6,-30,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const t=await p.evaluate(()=>{let r=null;window.__ct.scene().traverse(g=>{
 if(Math.abs((g.userData?.wheelbase??0)-3.30)>0.01)return; const e=g.matrixWorld.elements;
 const d=Math.abs(e[12]+3.9)+Math.abs(e[14]+30); if(d<3){r={x:e[12],y:e[13],z:e[14],yaw:Math.atan2(e[8],e[10])};}});return r;});
console.log('street pickup:',JSON.stringify(t));
const c=Math.cos(t.yaw), s=Math.sin(t.yaw);
const L2W=(lx,lz)=>[t.x + c*lx + s*lz, t.z - s*lx + c*lz];   // local -> world
const [bx,bz]=L2W(0,1.45);                                    // bed centre
console.log(`bed centre world (${bx.toFixed(2)}, ${bz.toFixed(2)})`);
// stand around the bed and look DOWN into it, from eye height on the road/walk
for(const [n,lx,lz] of [['side',2.3,1.45],['sideL',-2.3,1.45],['rear',0,4.2],['q',1.9,3.4]]){
  const [ex,ez]=L2W(lx,lz);
  const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[ex,ez]);
  const yaw=Math.atan2(bx-ex, -(bz-ez));
  const dist=Math.hypot(bx-ex,bz-ez), pitch=Math.atan2((t.y+0.75)-(gy+1.62), dist);
  await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[ex,ez,yaw,gy,pitch]);
  await afterFrames(p,3); await p.screenshot({path:`shots/bed4-${n}.png`});
  console.log(`  bed4-${n}.png from (${ex.toFixed(2)}, ${ez.toFixed(2)}) gy ${gy.toFixed(2)} pitch ${pitch.toFixed(2)}`);
}
await b.close();
