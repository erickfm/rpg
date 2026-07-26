// Four stations around the casino figure, so at least one has a clear line to
// its feet. Guessing one angle and reading whatever it shows is how you end up
// certain about a cabinet.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000);
const [TX,TZ]=(process.env.AT??'602.44,13.42').split(',').map(Number), R=2.5;
for(const [n,dx,dz] of [['w',-R,0],['e',R,0],['n',0,R],['s',0,-R]]){
 const sx=TX+dx, sz=TZ+dz, yaw=Math.atan2(TX-sx,-(TZ-sz));
 await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,0,-0.33),[sx,sz,yaw]);
 await afterFrames(p,4);
 const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
 const landed=Math.hypot(g[0]-sx,g[2]-sz)<0.6;
 await p.screenshot({path:`shots/casring-${n}.png`});
 console.log(`  casring-${n}.png asked (${sx.toFixed(1)}, ${sz.toFixed(1)}) landed (${g[0]}, ${g[2]}) ${landed?'ok':'** PUSHED OUT'}`);
}
await b.close();
