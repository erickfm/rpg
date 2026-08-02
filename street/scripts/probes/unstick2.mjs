// My first test dropped the player 8 m inside buildings, so all six escapes used
// the last-legal-position FALLBACK. The user's case is a SHALLOW pin - wedged
// against a wall by a pedestrian - which should exercise the incremental push.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(-6.2,-40,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(1500);
const spots=await p.evaluate(()=>{
 const c=window.__ct.colliders().filter(q=>q.minX>-40&&q.maxX<60&&q.minZ>-115&&q.maxZ<16&&(q.maxX-q.minX)>2);
 // a point 0.15 m INSIDE the -x face: a shallow overlap, like being pressed to a wall
 return c.slice(0,6).map(q=>({x:+(q.minX+0.15).toFixed(2), z:+((q.minZ+q.maxZ)/2).toFixed(2), face:+q.minX.toFixed(2)}));});
console.log('pressing the player 0.15 m into a wall face, then letting the world run:\n');
let pushed=0, jumped=0;
for(const t of spots){
 await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,undefined,0),[t.x,t.z]);
 await afterFrames(p,2);
 await p.waitForTimeout(900); await afterFrames(p,15);
 const c=await p.evaluate(()=>window.__ct.pos());
 const stillIn=await p.evaluate(([x,z])=>window.__ct.colliders().some(q=>x>q.minX&&x<q.maxX&&z>q.minZ&&z<q.maxZ),[c[0],c[2]]);
 const dist=Math.hypot(c[0]-t.x, c[2]-t.z);
 const local = dist < 2.0;
 if(!stillIn && local) pushed++; else if(!stillIn) jumped++;
 console.log(`  wall face x ${t.face} -> ended (${c[0].toFixed(2)}, ${c[2].toFixed(2)}), moved ${dist.toFixed(2)} m  ${stillIn?'** STILL INSIDE':(local?'pushed out LOCALLY':'jumped to last-legal')}`);
}
console.log(`\nlocal pushes ${pushed}, fallback jumps ${jumped}, still stuck ${spots.length-pushed-jumped}`);
await b.close();
