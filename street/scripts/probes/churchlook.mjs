// The church, looked at: pews and confession booths. Scene-graph grouping
// cannot separate objects here (every mesh shares one parent), so the box test
// cannot answer and said so. Eyes next.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
const rm=await p.evaluate(()=>window.__ct.roomDims().find(r=>r.id==='church'));
console.log(`church centre (${rm.cx}, ${rm.cz}) ${rm.w} x ${rm.d}, door at z ${rm.door.z}`);
const L=[
 ['nave',   rm.cx,      rm.cz+9,  0,          -0.03],  // from the door up the nave
 ['west',   rm.cx-4.5,  rm.cz+2,  Math.PI/2,  -0.05],  // across the pews to the west wall
 ['east',   rm.cx+4.5,  rm.cz+2, -Math.PI/2,  -0.05],  // and the east wall
 ['back',   rm.cx,      rm.cz-9,  Math.PI,    -0.03],  // from the altar back
];
for(const [n,x,z,yaw,pi] of L){
 await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),[x,z,yaw,pi]);
 await afterFrames(p,5);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 await p.screenshot({path:`shots/ch-${n}.png`});
 console.log(`  ch-${n}.png at (${g[0]}, ${g[2]}) gy ${g[3]} ${Math.hypot(g[0]-x,g[2]-z)<0.9?'':'** PUSHED'}`);
}
await b.close();
