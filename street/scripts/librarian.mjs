// "put this librarian behind the desk" - OPEN, rejected twice by me: once she
// stood 0.39 m in FRONT of the desk, once she was not rendered at all.
// Measure her against the desk, then look from the customer side.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const d=await p.evaluate(()=>window.__ct.roomDims().find(r=>r.id==='library'));
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[d.cx,d.cz]); await p.waitForTimeout(500);
const found=await p.evaluate(([cx,cz])=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  const figs=[], desks=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry||!o.visible) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const x=(bb.min.x+bb.max.x)/2, z=(bb.min.z+bb.max.z)/2, h=bb.max.y-bb.min.y;
    if(Math.abs(x-cx)>12||Math.abs(z-cz)>13) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    const map=m&&m.map, ry=map&&map.repeat?Math.abs(map.repeat.y):0;
    if(ry>1e-6&&ry<0.9&&h>1.4) figs.push({x:+x.toFixed(2),z:+z.toFixed(2),
      base:+bb.min.y.toFixed(2),top:+bb.max.y.toFixed(2)});
    // a desk: waist-high, wide, flat-topped
    if(h>0.6&&h<1.25&&bb.max.y>0.6&&bb.max.y<1.3&&(bb.max.x-bb.min.x)*(bb.max.z-bb.min.z)>1.2)
      desks.push({x:+x.toFixed(2),z:+z.toFixed(2),
        zmin:+bb.min.z.toFixed(2),zmax:+bb.max.z.toFixed(2),
        xmin:+bb.min.x.toFixed(2),xmax:+bb.max.x.toFixed(2),top:+bb.max.y.toFixed(2)}); });
  return {figs,desks}; },[d.cx,d.cz]);
console.log(`\nfigures in the library: ${found.figs.length}`);
for(const f of found.figs) console.log(`   figure at (${f.x}, ${f.z})  base ${f.base} top ${f.top}`);
console.log(`\ndesk-like masses: ${found.desks.length}`);
for(const q of found.desks.slice(0,6))
  console.log(`   desk x ${q.xmin}..${q.xmax}  z ${q.zmin}..${q.zmax}  top ${q.top}`);
if(found.figs.length&&found.desks.length){
  const f=found.figs[0];
  let best=null,bd=1e9;
  for(const q of found.desks){ const dd=Math.hypot(q.x-f.x,q.z-f.z); if(dd<bd){bd=dd;best=q;} }
  console.log(`\n  nearest desk to the figure is ${bd.toFixed(2)} m away: z ${best.zmin}..${best.zmax}`);
  const side = f.z>best.zmax ? `+z side, ${(f.z-best.zmax).toFixed(2)} m clear of its far edge`
             : f.z<best.zmin ? `-z side, ${(best.zmin-f.z).toFixed(2)} m clear of its near edge`
             : 'WITHIN the desk footprint';
  console.log(`  the figure is on the ${side}`);
}
await b.close();
