// "123 ground-facing surfaces across the world are untextured flat colour
// (~454 m2)". A published the helpers and correctly stopped, because neither
// file A owns creates a ground mesh. So the question now is how many are left.
//
// MY DEFINITION, stated so the number can be compared with A's: a mesh whose
// largest face is horizontal, sitting at ground level, big enough to walk on,
// whose material carries NO texture map. material.color is a TINT on textured
// surfaces, so "untextured" must be map == null, never a colour test.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  const flat=[], bare=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    if(sy>0.30) return;                       // flat, not a wall or a block
    const area=sx*sz; if(area<1.0) return;    // big enough to be a surface
    const y=(bb.min.y+bb.max.y)/2;
    // ACTUAL GROUND. y up to 1.6 swept in counter tops and shelves - one of my
    // 'largest untextured ground surfaces' was at y 1.23, which is a worktop.
    if(y<-0.35||y>0.55) return;
    const ms=Array.isArray(o.material)?o.material:[o.material];
    const m=ms[0]; if(!m) return;
    const rec={area:+area.toFixed(1), y:+y.toFixed(2),
               x:+((bb.min.x+bb.max.x)/2).toFixed(1), z:+((bb.min.z+bb.max.z)/2).toFixed(1)};
    rec.interior = rec.x>400;
    flat.push(rec);
    const mapped=ms.some(mm=>mm&&mm.map);
    if(!mapped) bare.push(rec); });
  return {flat:flat.length, bare, areaFlat:flat.reduce((a,q)=>a+q.area,0),
          areaBare:bare.reduce((a,q)=>a+q.area,0)}; });
const out=r.bare.filter(q=>!q.interior), ins=r.bare.filter(q=>q.interior);
console.log(`\nflat surfaces at true ground level, 1 m2+: ${r.flat}  (${r.areaFlat.toFixed(0)} m2)`);
console.log(`of those, carrying NO texture map:          ${r.bare.length}  (${r.areaBare.toFixed(0)} m2)`);
console.log(`   outdoors (x < 400):                      ${out.length}  (${out.reduce((a,q)=>a+q.area,0).toFixed(0)} m2)`);
console.log(`   interiors (x > 400):                     ${ins.length}  (${ins.reduce((a,q)=>a+q.area,0).toFixed(0)} m2)`);
console.log(`   A's starting figure was 123 surfaces, ~454 m2`);
const byArea=[...r.bare].sort((a,b)=>b.area-a.area).slice(0,10);
console.log(`\nlargest untextured ground surfaces remaining:`);
for(const q of byArea) console.log(`   ${String(q.area).padStart(7)} m2 at (${q.x}, ${q.z}) y ${q.y}`);
await b.close();
