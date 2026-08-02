// The "kid" is p1 - the smallest CITIZEN, one of the six walkers, in a ball cap.
// Match walkers() to their sprite meshes and take the shortest, then stand in
// front of it. My last attempt took the shortest atlas billboard in the world and
// photographed a wall.
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.evaluate(()=>window.__ct.warp(0,-40,0,0.14,0)); await afterFrames(p,10); await p.waitForTimeout(2000);
await setClock(p,13);
const kid=await p.evaluate(()=>{
 const ws=window.__ct.walkers()||[];
 const out=ws.map((c,i)=>({i, x:c.x, z:c.z, h:null}));
 window.__ct.scene().traverse(m=>{ if(!m.isMesh||!m.material?.map?.image||!m.geometry)return;
  const rep=m.material.map.repeat; if(Math.abs(rep.y)>0.9||Math.abs(rep.y)<1e-6) return;
  m.geometry.computeBoundingBox(); const bb=m.geometry.boundingBox;
  const h=bb.max.y-bb.min.y; if(h<1.0) return;
  const e=m.matrixWorld.elements;
  for(const o of out) if(Math.hypot(e[12]-o.x, e[14]-o.z)<0.6){ o.h=+h.toFixed(3); o.mx=e[12]; o.mz=e[14]; }});
 const known=out.filter(o=>o.h!==null).sort((a,b)=>a.h-b.h);
 return {all:out.map(o=>({i:o.i,h:o.h})), kid:known[0]};});
console.log('walker sprite heights:', JSON.stringify(kid.all));
if(!kid.kid){console.error('CANNOT ANSWER — no walker matched a sprite.');process.exit(3);}
console.log(`smallest walker: #${kid.kid.i} at ${kid.kid.h} m, (${kid.kid.x.toFixed(1)}, ${kid.kid.z.toFixed(1)})`);
// stand in front of them, road side, eye on the head
for(const [n,d] of [['a',1.8],['b',2.6]]){
 const cx=kid.kid.x + (kid.kid.x<0? d : -d), cz=kid.kid.z;
 const gy=await p.evaluate(([x,z])=>window.__ct.groundAt(x,z),[cx,cz]);
 await p.evaluate(([x,z,y,g,pi])=>window.__ct.warp(x,z,y,g,pi),[cx,cz,Math.atan2(kid.kid.x-cx,-(kid.kid.z-cz)),gy,0.02]);
 await afterFrames(p,3); await p.screenshot({path:`shots/kf-${n}.png`});
 const got=await p.evaluate(()=>window.__ct.pos());
 console.log(`  kf-${n}.png from (${got[0].toFixed(1)}, ${got[2].toFixed(1)}) at ${d} m`);
}
await b.close();
