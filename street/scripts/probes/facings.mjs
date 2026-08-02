// Three facing rows at once. Facing lives in the ATLAS FRAME, not rotation.y,
// so look rather than read a transform - but shoot from where the player enters,
// which is the only viewpoint that decides "backwards".
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-20,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const dims=await p.evaluate(()=>window.__ct.roomDims());
for(const id of ['tax','library','church']){
 const d=dims.find(q=>q.id===id);
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[d.cx,d.cz]);
 // stand just inside the near wall, looking the length of the room
 const z=d.cz-d.d/2+1.4;
 await p.evaluate(([x,z,g])=>window.__ct.warp(x,z,Math.PI,g,-0.02),[d.cx,z,gy]);
 await afterFrames(p,5); await p.waitForTimeout(250);
 const got=await p.evaluate(()=>window.__ct.pos());
 const ok=Math.abs(got[0]-d.cx)<0.6&&Math.abs(got[2]-z)<0.9;
 await p.screenshot({path:`shots/fc-${id}.png`});
 console.log(`  fc-${id}.png  ${d.w} x ${d.d}  ${ok?'landed':'** MISSED'}`);
 // and the reverse view, since "reversed" is a claim about which end is which
 await p.evaluate(([x,z,g])=>window.__ct.warp(x,z,0,g,-0.02),[d.cx,d.cz+d.d/2-1.4,gy]);
 await afterFrames(p,5); await p.screenshot({path:`shots/fc-${id}-back.png`});
}
await b.close();
