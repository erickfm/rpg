// Which side of the counter is she on, seen from where a CUSTOMER stands?
// roomDims puts the library door at z +11 with an inward normal, so customers
// enter from +z and the counter's public face is its +z side. My earlier
// rejection shot her from z 1.4, 2.6 and -1.5 - all BEHIND the counter - and
// concluded she stood in front of it.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
for(const [n,x,z,yaw,pi] of [
 ['customer-far',  916.5, 9.5, 0, -0.05],   // just inside the door, facing the counter
 ['customer-at',   916.5, 7.0, 0, -0.05],   // at the counter
 ['staff-side',    916.5, 1.5, Math.PI, -0.05],  // the side I wrongly used before
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),[x,z,yaw,pi]);
 await p.waitForTimeout(400);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/libd-${n}.png`});
 console.log(`  libd-${n}.png at (${g[0]}, ${g[2]})`);
}
await b.close();
