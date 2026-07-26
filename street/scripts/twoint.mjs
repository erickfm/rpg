import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-20,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const dims=await p.evaluate(()=>window.__ct.roomDims());
for(const id of ['hotel','casino']){
 const d=dims.find(q=>q.id===id);
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[d.cx,d.cz]);
 const z=d.cz-d.d/2+1.6;
 await p.evaluate(([x,z,g])=>window.__ct.warp(x,z,Math.PI,g,-0.02),[d.cx,z,gy]);
 await afterFrames(p,5); await p.waitForTimeout(300);
 const got=await p.evaluate(()=>window.__ct.pos());
 const ok=Math.abs(got[0]-d.cx)<0.6&&Math.abs(got[2]-z)<0.9;
 await p.screenshot({path:`shots/ti-${id}.png`});
 console.log(`  ti-${id}.png  ${d.w} x ${d.d} m  want (${d.cx}, ${z.toFixed(1)}) got (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) ${ok?'landed':'** MISSED'}`);
}
await b.close();
