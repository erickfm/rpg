// Two claims I made mid-flight, now that the work has landed:
//   library — doubled to 326 m2 but median clear aisle fell to 2.10 m
//   casino  — 323 m2 interior inside a 165 m2 building, 1.96x
// AISLE is defined here and not borrowed: sample lines across the room every
// 0.5 m, take the widest continuous clear gap on each line, report the median
// and the worst. Same definition for all ten rooms, so they can be compared.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const rooms=await p.evaluate(()=>window.__ct.roomDims());
const doors=await p.evaluate(()=>window.__ct.doors());
const out=[];
for(const rm of rooms){
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[rm.cx,rm.cz]);
  await p.waitForTimeout(220);
  const m=await p.evaluate(([cx,cz,w,d])=>{
    const X0=cx-w/2,X1=cx+w/2,Z0=cz-d/2,Z1=cz+d/2;
    const cols=window.__ct.colliders().filter(c=>c.maxX>X0&&c.minX<X1&&c.maxZ>Z0&&c.minZ<Z1);
    const gapsOn=(fixed,along)=>{ const edges=[];
      for(const c of cols){
        if(along==='x'){ if(fixed>c.minZ&&fixed<c.maxZ) edges.push([Math.max(c.minX,X0),Math.min(c.maxX,X1)]); }
        else            { if(fixed>c.minX&&fixed<c.maxX) edges.push([Math.max(c.minZ,Z0),Math.min(c.maxZ,Z1)]); } }
      edges.sort((a,b)=>a[0]-b[0]);
      const lo=along==='x'?X0:Z0, hi=along==='x'?X1:Z1;
      let best=0,cur=lo;
      for(const [a,bb] of edges){ if(a>cur) best=Math.max(best,a-cur); cur=Math.max(cur,bb); }
      return Math.max(best,hi-cur); };
    // PASSAGE WIDTH, not widest gap. "Widest clear gap on a line" says a room is
    // open if ONE strip of it is, which is exactly the failure I warned about in
    // the library - doubled in area and cut into strips. For every free cell,
    // measure the clear run through it along x and along z and take the SMALLER:
    // that is how wide the passage is where you stand. Median across the room.
    const hit=(x,z)=>cols.some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);
    const run=(x,z,dx,dz)=>{ let t=0; while(t<40){ const nx=x+dx*(t+0.25), nz=z+dz*(t+0.25);
      if(nx<X0||nx>X1||nz<Z0||nz>Z1||hit(nx,nz)) break; t+=0.25; } return t; };
    const widths=[];
    for(let x=X0+0.25;x<X1;x+=0.5) for(let z=Z0+0.25;z<Z1;z+=0.5){
      if(hit(x,z)) continue;
      const wx=run(x,z,-1,0)+run(x,z,1,0), wz=run(x,z,0,-1)+run(x,z,0,1);
      widths.push(Math.min(wx,wz)); }
    const all=widths.sort((a,b)=>a-b);
    if(!all.length) all.push(0);
    // free floor: fraction of grid cells not inside a collider
    let free=0,tot=0;
    for(let x=X0+0.25;x<X1;x+=0.5) for(let z=Z0+0.25;z<Z1;z+=0.5){
      tot++; if(!cols.some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ)) free++; }
    return {aisleMed:+all[all.length>>1].toFixed(2), aisleMin:+all[0].toFixed(2),
            free:+(100*free/tot).toFixed(0), cols:cols.length};
  },[rm.cx,rm.cz,rm.w,rm.d]);
  out.push({id:rm.id, area:+(rm.w*rm.d).toFixed(0), ...m});
}
// exterior footprint: the collider the street door stands on
const ext=await p.evaluate((ds)=>ds.map(d=>{
  const cs=window.__ct.colliders();
  let best=null,bd=1e9;   // bd holds the best AREA once one is found
  for(const c of cs){ const cx=(c.minX+c.maxX)/2, cz=(c.minZ+c.maxZ)/2;
    const dd=Math.hypot(cx-d.point.x,cz-d.point.z);
    const area=(c.maxX-c.minX)*(c.maxZ-c.minZ);
    // the BUILDING, not the nearest lump: must actually contain the door point
    // (with a little slack) - my first pass picked an 8x5 porch for the library
    // and called it the library.
    if(area<40||area>4000) continue;
    if(!(d.point.x>c.minX-1.5&&d.point.x<c.maxX+1.5&&d.point.z>c.minZ-1.5&&d.point.z<c.maxZ+1.5)) continue;
    if(area>bd||bd===1e9){ bd=area; best={b:d.building,w:+(c.maxX-c.minX).toFixed(2),d:+(c.maxZ-c.minZ).toFixed(2),a:+area.toFixed(0)};} }
  return best; }).filter(Boolean), doors);
console.log(`\n room        area   free%  passage med  passage min  colliders`);
for(const r of out.sort((a,b)=>a.aisleMed-b.aisleMed))
  console.log(`  ${r.id.padEnd(10)} ${String(r.area).padStart(4)}   ${String(r.free).padStart(3)}   ${String(r.aisleMed).padStart(6)}      ${String(r.aisleMin).padStart(6)}   ${String(r.cols).padStart(4)}`);
console.log(`\n exterior footprints at the street doors:`);
for(const e of ext) console.log(`  ${e.b.padEnd(14)} ${e.w} x ${e.d} = ${e.a} m2`);
await b.close();
