// Is there ANY route up the library forecourt within the player's step limit?
// A single line can miss a ramp that runs the other way - the library's own
// interior stair runs in z, and I nearly filed that as a cliff. So: stand on a
// GRID and look for a path from the 0.14 pavement to the 0.99 landing whose
// every step is <= 0.6 m.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:600,height:400}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1000);
const X0=-11.4, X1=-7.6, Z0=-18.0, Z1=-8.0, S=0.5;
const grid=new Map();
for(let x=X0;x<=X1;x+=S) for(let z=Z0;z<=Z1;z+=S){
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,window.__ct.groundAt(x,z),0),[x,z]);
  await afterFrames(p,2);
  const q=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
  if(Math.hypot(q[0]-x,q[2]-z)<0.45) grid.set(`${x.toFixed(1)},${z.toFixed(1)}`,q[3]);
}
console.log(`\nstandable cells on the library forecourt: ${grid.size}`);
const lv=[...new Set([...grid.values()].map(v=>v.toFixed(2)))].sort((a,b)=>a-b);
console.log(`levels present: ${lv.join(' ')}`);
// flood from every 0.14 cell, stepping at most 0.6 m up
const LIM=0.6, seen=new Set(), q=[];
for(const [k,v] of grid) if(Math.abs(v-0.14)<0.03){ seen.add(k); q.push(k); }
console.log(`starting from ${q.length} pavement cells at 0.14`);
while(q.length){
  const k=q.shift(); const [x,z]=k.split(',').map(Number); const h=grid.get(k);
  for(const [dx,dz] of [[S,0],[-S,0],[0,S],[0,-S]]){
    const nk=`${(x+dx).toFixed(1)},${(z+dz).toFixed(1)}`;
    if(seen.has(nk)||!grid.has(nk)) continue;
    if(grid.get(nk)-h>LIM) continue;                 // too tall to step up
    seen.add(nk); q.push(nk);
  }
}
const top=[...grid.entries()].filter(([,v])=>v>0.9);
const reached=top.filter(([k])=>seen.has(k));
console.log(`\n  landing cells (gy > 0.9): ${top.length}`);
console.log(`  reachable from the pavement in steps of <= ${LIM} m: ${reached.length}`);
console.log(`  ${reached.length? 'THERE IS A WAY UP' : '** NO ROUTE UP within the step limit — the landing is only reachable by dropping onto it'}`);
await b.close();
