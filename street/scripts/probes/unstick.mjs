// "im literally stuck here ... we need some sort of stuck protection"
// F added fp.ts:191 unstick(). Test it the only way that matters: put the player
// INSIDE solid geometry and see whether the world gets them out.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-40,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(1500);
// pick real collider centres on the street and drop the player inside each
const targets=await p.evaluate(()=>{
 const c=window.__ct.colliders().filter(q=>q.minX>-40&&q.maxX<60&&q.minZ>-115&&q.maxZ<16)
  .filter(q=>(q.maxX-q.minX)>1.5&&(q.maxZ-q.minZ)>1.5);
 return c.slice(0,6).map(q=>({x:+((q.minX+q.maxX)/2).toFixed(2), z:+((q.minZ+q.maxZ)/2).toFixed(2),
   w:+(q.maxX-q.minX).toFixed(1), d:+(q.maxZ-q.minZ).toFixed(1)}));});
const inside=(x,z)=>p.evaluate(([x,z])=>window.__ct.colliders().some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ),[x,z]);
console.log('dropping the player inside solid colliders, then letting the world run:\n');
let freed=0;
for(const t of targets){
 await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,undefined,0),[t.x,t.z]);
 await afterFrames(p,2);
 const a=await p.evaluate(()=>window.__ct.pos());
 await p.waitForTimeout(1200); await afterFrames(p,20);
 const c=await p.evaluate(()=>window.__ct.pos());
 const stillIn=await inside(c[0],c[2]);
 const moved=Math.hypot(c[0]-a[0],c[2]-a[2]);
 if(!stillIn) freed++;
 console.log(`  collider ${t.w}x${t.d} at (${t.x}, ${t.z}) -> after 1.2 s at (${c[0].toFixed(1)}, ${c[2].toFixed(1)}), moved ${moved.toFixed(2)} m  ${stillIn?'** STILL INSIDE':'FREED'}`);
}
console.log(`\nfreed ${freed} of ${targets.length}`);
await b.close();
