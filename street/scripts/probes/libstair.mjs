// F/G's library stair: "built and climbed (2.65 m, balustrade). AUDITOR to
// confirm." Find the rise by scanning the room, then WALK it - a floor is not
// verified from a height map (CLAUDE.md), and my last attempt at this scanned
// the wrong axis and nearly filed "a mezzanine you cannot reach".
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const dims=await p.evaluate(()=>window.__ct.roomDims().find(r=>r.id==='library'));
const X0=dims.cx-dims.w/2, X1=dims.cx+dims.w/2, Z0=dims.cz-dims.d/2, Z1=dims.cz+dims.d/2;
console.log(`library: x ${X0}..${X1}, z ${Z0}..${Z1}`);
// put the player inside first: groundAt is context-dependent (notes/groundat-context.md)
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[dims.cx,dims.cz]);
await p.waitForTimeout(500);
const grid=await p.evaluate(([X0,X1,Z0,Z1])=>{ const o=[];
  for(let x=X0+0.5;x<X1;x+=0.5){ for(let z=Z0+0.5;z<Z1;z+=0.5){
    o.push([+x.toFixed(1),+z.toFixed(1),+window.__ct.groundAt(x,z).toFixed(3)]); } }
  return o; },[X0,X1,Z0,Z1]);
const hs=grid.map(g=>g[2]); const hi=Math.max(...hs), lo=Math.min(...hs);
const levels=[...new Set(hs.map(h=>h.toFixed(2)))].sort((a,c)=>a-c);
console.log(`ground across the room: ${lo.toFixed(2)} .. ${hi.toFixed(2)}, ${levels.length} distinct levels`);
console.log(`levels: ${levels.join(' ')}`);
const top=grid.filter(g=>g[2]>hi-0.05);
const mid=grid.filter(g=>g[2]>lo+0.08&&g[2]<hi-0.08);
console.log(`cells at the top level: ${top.length}   on the rise between: ${mid.length}`);
if(mid.length){ const mx=mid.map(m=>m[0]), mz=mid.map(m=>m[1]);
  console.log(`  the rise spans x ${Math.min(...mx)}..${Math.max(...mx)}, z ${Math.min(...mz)}..${Math.max(...mz)}`); }
if(top.length){ const tx=top.map(t=>t[0]), tz=top.map(t=>t[1]);
  console.log(`  the top spans  x ${Math.min(...tx)}..${Math.max(...tx)}, z ${Math.min(...tz)}..${Math.max(...tz)}`); }
await b.close();
