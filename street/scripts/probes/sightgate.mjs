// "shouldnt be able to select things through objects ever", tested properly.
// Mirroring through a bar stool proves nothing — a stool is not an occluder.
// For each spot, sample bearings on a circle INSIDE its trigger radius, and
// classify each station by whether the segment station->spot crosses a collider
// AABB. Sight-gating means: clear stations offer the prompt, blocked ones do not.
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:800,height:600}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(2000);
// COLLIDER HEIGHTS, because the claim is about walls and colliders() is xz only.
// D aims the sight ray 1.1 m up ON PURPOSE, so a bench or a table is meant to be
// seen over; counting those as occluders makes the gate look broken when it is
// working as designed. Height each box by the tallest mesh standing inside it.
const cols=await p.evaluate(()=>{
  const cs=window.__ct.colliders().map(c=>({...c,top:0}));
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2;
    for(const c of cs) if(cx>c.minX&&cx<c.maxX&&cz>c.minZ&&cz<c.maxZ&&bb.max.y>c.top) c.top=bb.max.y; });
  return cs; });
const TALL=1.25;   // above the 1.1 m sight ray: a thing you cannot see over
console.log(`colliders: ${cols.length}, of which ${cols.filter(c=>c.top>=TALL).length} stand taller than the ${TALL} m sight line`);
// EXCLUDE THE TARGET'S OWN COLLIDER. A spot sits on or inside the thing it
// names, so every ray to it crosses that thing's box — my first run called 20
// of 33 stations "blocked" and they were all the ATM's own cabinet. An AABB
// answers "could this object reach here", never "is something in the way".
const crosses=(ax,az,bx,bz)=>{ const N=48;
  const own=cols.filter(c=>bx>c.minX-0.05&&bx<c.maxX+0.05&&bz>c.minZ-0.05&&bz<c.maxZ+0.05);
  const skip=new Set(own);
  for(let i=1;i<N;i++){ const t=i/N, x=ax+(bx-ax)*t, z=az+(bz-az)*t;
    for(const c of cols) if(!skip.has(c)&&c.top>=TALL&&x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ) return true; }
  return false; };
const spots=await p.evaluate(()=>window.__ct.spots().filter(s=>s.ok));
let clearOffer=0, clearTot=0, blockOffer=0, blockTot=0, examples=[];
for(const s of spots.slice(0,18)){
 for(let k=0;k<12;k++){
  const th=k*Math.PI/6, r=Math.max(0.85,s.r*0.9);
  const sx=s.x+Math.cos(th)*r, sz=s.z+Math.sin(th)*r;
  const blocked=crosses(sx,sz,s.x,s.z);
  await p.evaluate(([x,z,y])=>window.__ct.warp(x,z,y,window.__ct.pos()[3],0),
    [sx,sz,Math.atan2(s.x-sx,-(s.z-sz))]);
  await afterFrames(p,3);
  const got=await p.evaluate(()=>window.__ct.pos());
  if(Math.hypot(got[0]-sx,got[2]-sz)>0.45) continue;      // pushed out: not this station
  const pr=await p.evaluate(()=>{ const m=(document.body.innerText||'').match(/\[E\][^\n]*/); return m?m[0].trim():null; });
  const offered=!!pr&&pr.includes(s.label.split('—')[0].trim().slice(0,14));
  if(blocked){ blockTot++; if(offered){ blockOffer++; if(examples.length<6) examples.push(`${s.label.slice(0,30)} from (${sx.toFixed(1)}, ${sz.toFixed(1)})`); } }
  else { clearTot++; if(offered) clearOffer++; }
 }
}
console.log(`\n  CLEAR line of sight : ${clearOffer} of ${clearTot} stations offered the prompt`);
console.log(`  BLOCKED by something TALLER than the sight line : ${blockOffer} of ${blockTot} stations offered the prompt`);
for(const e of examples) console.log(`     ** leaked: ${e}`);
if(!clearTot||!blockTot){ console.log(`\nCANNOT ANSWER — need both kinds of station (clear ${clearTot}, blocked ${blockTot}).`); process.exit(3); }
const clearRate=clearOffer/clearTot, blockRate=blockOffer/blockTot;
console.log(`\n  clear ${(clearRate*100).toFixed(0)}%  vs  blocked ${(blockRate*100).toFixed(0)}%`);
const ok = blockRate < 0.15 && clearRate > 0.5;
console.log(ok?'\nPASS — sight gates selection':'\nFAIL — selection is not gated by sight');
process.exit(ok?0:1);
