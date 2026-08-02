import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
for(const [n,x,z,yaw,pi] of [
 ['edge',  928.2,-4.0, -Math.PI/2, -0.30],   // out over the drop
 ['along', 928.6, 0.0,  Math.PI,   -0.10],   // along the gallery toward the stair head
 ['below', 921.0,-4.0,  Math.PI/2,  0.30],   // from the floor, looking up at it
]){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),[x,z,yaw,pi]);
 await p.waitForTimeout(400);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/libg-${n}.png`});
 console.log(`  libg-${n}.png at (${g[0]}, ${g[2]}) gy ${g[3]}`);
}
await b.close();
