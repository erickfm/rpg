// C's other claim: he is drawn ONLY on his own landing. Before the fix he was
// drawn on every landing at his own storey's height, which is what "why is my
// 3rd floor neighbor floating" was a picture of. Tested at 17:30, the one hour
// on day 0 when the schedule has him out.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:900,height:600}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ct.hermit(null));
await p.evaluate(()=>window.__ct.clock(17,30)); await afterFrames(p,6);
const look=()=>p.evaluate(()=>{ const s=window.__ct.scene(); s.updateMatrixWorld(true); const f=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry||!o.visible) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material; const map=m&&m.map;
    if(!map||!map.repeat) return; const ry=Math.abs(map.repeat.y); if(ry>0.9||ry<1e-6) return;
    for(let q=o;q;q=q.parent) if(!q.visible) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(bb.max.y-bb.min.y<1.4) return;
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2;
    if(Math.hypot(cx-201.95,cz+16.5)<1.6) f.push({base:+bb.min.y.toFixed(2),top:+bb.max.y.toFixed(2)}); });
  return f; });
for(const [n,gy] of [['lobby',0],['201/202',2.7],['301/302 — HIS',5.4],['top',8.1]]){
 await p.evaluate((gy)=>window.__ct.warp(200.6,-16.5,Math.PI/2,gy,0),gy);
 await afterFrames(p,8); await p.waitForTimeout(250);
 const got=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 const f=await look();
 console.log(`  ${n.padEnd(14)} player ground ${String(got[3]).padStart(5)}  figure ${f.length?`VISIBLE base ${f[0].base} top ${f[0].top}`:'not drawn'}`);
}
await b.close();
