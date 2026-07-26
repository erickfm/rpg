import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-5.9,-33,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const t=await p.evaluate(()=>{let r=null;window.__ct.scene().traverse(g=>{
 if(Math.abs((g.userData?.wheelbase??0)-3.30)>0.01)return; const e=g.matrixWorld.elements;
 const d=Math.abs(e[12]+3.9)+Math.abs(e[14]+30); if(d<4){r={x:e[12],z:e[14],yaw:Math.atan2(e[8],e[10])};}});return r;});
const c=Math.cos(t.yaw), s=Math.sin(t.yaw);
const L2W=(lx,lz)=>[t.x + c*lx + s*lz, t.z - s*lx + c*lz];
// the tailgate is at local z ~ +2.4; view it at a GRAZING angle from a distance,
// which is where mipmap crawl showed
for(const [n,lx,lz] of [['graze',3.2,7.5],['near',0.9,4.2]]){
 const [ex,ez]=L2W(lx,lz);
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[ex,ez]);
 const [bx,bz]=L2W(0,2.45);
 await p.evaluate(([x,z,y,g])=>window.__ct.warp(x,z,y,g,-0.05),[ex,ez,Math.atan2(bx-ex,-(bz-ez)),gy]);
 await afterFrames(p,4); const got=await p.evaluate(()=>window.__ct.pos());
 await p.screenshot({path:`shots/tg-${n}.png`});
 console.log(`  tg-${n}.png from (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${Math.hypot(got[0]-ex,got[2]-ez)<1.0?'landed':'** MISSED'}`);
}
await b.close();
