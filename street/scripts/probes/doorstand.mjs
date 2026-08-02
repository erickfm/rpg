// GOTCHAS 8 — a door you cannot stand in front of. Already happened once (the
// bodega entry blocker). For every published door: is its OWN stand point
// swallowed by a collider, how much clear room is there in front of it, and
// does the camera actually land there?
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-20,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const doors=await p.evaluate(()=>window.__ct.doors());
console.log(`published doors: ${doors.length}\n`);
const rows=[];
for(const d of doors){
 const s=d.stand, n={x:d.point.nx, z:d.point.nz};
 const m=await p.evaluate(([sx,sz,nx,nz])=>{
  const cols=window.__ct.colliders();
  const inside=(x,z)=>cols.some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);
  // how far can you back away from the door along its own outward normal?
  let back=0; for(let t=0;t<=3;t+=0.05){ if(inside(sx+nx*t, sz+nz*t)) break; back=t; }
  // and how wide is it ACROSS the door, through the stand point?
  const px=-nz, pz=nx; let l=0,r=0;
  for(let t=0.05;t<=3;t+=0.05){ if(inside(sx+px*t,sz+pz*t)) break; r=t; }
  for(let t=0.05;t<=3;t+=0.05){ if(inside(sx-px*t,sz-pz*t)) break; l=t; }
  return {swallowed:inside(sx,sz), back:+back.toFixed(2), across:+(l+r).toFixed(2),
    gy:+window.__ct.groundAt(sx,sz).toFixed(2)};},[s.x,s.z,n.x,n.z]);
 // WALK IT: warp to the stand point and verify the camera landed there
 await p.evaluate(([x,z,y,g])=>window.__ct.warp(x,z,Math.atan2(-y.nx,y.nz),g,-0.05),[s.x,s.z,n,m.gy]);
 await afterFrames(p,3);
 const got=await p.evaluate(()=>window.__ct.pos());
 const landed=Math.hypot(got[0]-s.x,got[2]-s.z)<0.5;
 rows.push({b:d.building, w:d.widthM, ...m, landed, off:+Math.hypot(got[0]-s.x,got[2]-s.z).toFixed(2)});
 if(m.swallowed||!landed||m.across<0.72) await p.screenshot({path:`shots/dr-${d.building.replace(/\W/g,'')}.png`});
}
console.log('building         doorW  swallowed  clear back  clear across  ground  landed  off');
for(const o of rows) console.log(
 `${o.b.padEnd(15)} ${String(o.w).padStart(5)}  ${String(o.swallowed).padStart(9)}  ${String(o.back).padStart(10)}  ${String(o.across).padStart(12)}  ${String(o.gy).padStart(6)}  ${String(o.landed).padStart(6)}  ${o.off}`);
const bad=rows.filter(o=>o.swallowed||!o.landed||o.across<0.72||o.back<0.72);
console.log(`\ndoors with a problem: ${bad.length} of ${rows.length}`);
for(const o of bad) console.log(`  ** ${o.b}: ${[o.swallowed&&'stand point INSIDE a collider',!o.landed&&`camera did not land (off by ${o.off} m)`,o.across<0.72&&`only ${o.across} m across (player is 0.72)`,o.back<0.72&&`only ${o.back} m to back away`].filter(Boolean).join('; ')}`);
await b.close();
