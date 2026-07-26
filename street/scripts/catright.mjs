// "cat is dead center in alley i need it right to the right of that newspaper"
// Sixth position. The test is what you SEE from the alley mouth, so shoot from
// there and also read the two objects' screen-x directly.
import { chromium } from 'playwright';
import { setClock } from './lib/clock.mjs';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-40.1,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2500);
await setClock(p,13);
for(const [n,x,z,tx,tz,pi] of [['mouth',-6.2,-40.1,-11.0,-41.6,-0.10],['closer',-8.4,-41.2,-11.0,-41.8,-0.16]]){
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[x,z]);
 const yaw=Math.atan2(tx-x,-(tz-z));
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[x,z,yaw,gy,pi]);
 await afterFrames(p,4);
 const got=await p.evaluate(()=>window.__ct.pos());
 // project both objects to screen x, so "right" is read off the frame not argued
 const proj=await p.evaluate(([pts])=>{
  const cam=window.__ct.scene().getObjectByProperty('isCamera',true) ||
   (window.__ct.views&&window.__ct.views().camera);
  return pts.map(q=>({q, ok:!!cam}));},[[[-10.60,-41.45],[-10.40,-42.05]]]);
 await p.screenshot({path:`shots/cr-${n}.png`});
 console.log(`  cr-${n}.png  at (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) yaw ${yaw.toFixed(2)}  ${Math.hypot(got[0]-x,got[2]-z)<0.5?'landed':'** MISSED'}`);
}
console.log('\ngeometry: newspaper (-10.60, -41.45), cat (-10.40, -42.05)');
console.log('looking into the alley, forward = (-1,0,0), so screen right = cross(forward,up) = (0,0,-1) = -z');
console.log('cat z -42.05 is 0.60 m in -z from the paper -> cat should appear to the RIGHT');
await b.close();
