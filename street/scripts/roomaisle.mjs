// "bodega interior is very cramped". Declared floor area is not what a player
// feels - the aisle between the fittings is. Same instrument as the sidewalk
// audit: largest continuous free run, room by room, so the set can be compared.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const dims=window.__ct.roomDims(), cols=window.__ct.colliders(), out=[];
 for(const d of dims){
  const x0=d.cx-d.w/2, x1=d.cx+d.w/2, z0=d.cz-d.d/2, z1=d.cz+d.d/2;
  const runs=[];
  for(let z=z0+0.3;z<=z1-0.3;z+=0.25){
   const iv=[];
   for(const c of cols){ if(c.minZ>z||c.maxZ<z) continue;
    const a=Math.max(c.minX,x0), e=Math.min(c.maxX,x1); if(e>a) iv.push([a,e]); }
   iv.sort((u,v)=>u[0]-v[0]);
   let cur=x0,best=0;
   for(const [a,e] of iv){ if(a-cur>best) best=a-cur; if(e>cur)cur=e; }
   if(x1-cur>best) best=x1-cur;
   runs.push(+best.toFixed(2));}
  const s=[...runs].sort((a,b)=>a-b);
  // free floor fraction: sample a grid
  let free=0,tot=0;
  for(let z=z0+0.25;z<=z1-0.25;z+=0.4) for(let x=x0+0.25;x<=x1-0.25;x+=0.4){ tot++;
   let hit=false; for(const c of cols) if(x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ){hit=true;break;}
   if(!hit) free++;}
  out.push({id:d.id, area:+(d.w*d.d).toFixed(0), min:s[0], med:s[s.length>>1], max:s[s.length-1],
   under072:runs.filter(v=>v<0.72).length, n:runs.length, freePct:+(100*free/tot).toFixed(0)});}
 return out;});
console.log('room       area  aisle min   med   max   samples<0.72m   free floor');
for(const o of r.sort((a,b)=>a.med-b.med)) console.log(
 `${o.id.padEnd(9)} ${String(o.area).padStart(5)} m2   ${String(o.min).padStart(4)}  ${String(o.med).padStart(4)}  ${String(o.max).padStart(4)}    ${String(o.under072+'/'+o.n).padStart(8)}      ${String(o.freePct).padStart(3)}%`);
const med=r.map(o=>o.med).sort((a,b)=>a-b);
console.log(`\nmedian clear aisle across the set: min ${med[0]}  med ${med[med.length>>1]}  max ${med[med.length-1]}`);
await b.close();
