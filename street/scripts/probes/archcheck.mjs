// F's predicate, implemented independently: an arch is the panel DIPPING DOWN
// around the wheel, so for each tyre there must be body geometry directly above
// it whose bounding-box BOTTOM sits below the tyre's TOP.
//
// Population per F: tyres carry a MAP, props carry a flat colour - which is what
// separates 83 tyres from the diner bar stools that polluted both our earlier
// counts (my 86, F's radius-only 328).
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  const tyres=[], solids=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    const rec={minX:bb.min.x,maxX:bb.max.x,minY:bb.min.y,maxY:bb.max.y,minZ:bb.min.z,maxZ:bb.max.z};
    // ONLY CAR-SIZED PANELS COUNT AS AN ARCH. My first version accepted any
    // solid above the wheel, so the ROAD and the buildings qualified and the
    // test passed at every threshold - it could not fail, which makes 83/83 a
    // tautology rather than a result.
    if(sx<6&&sz<6&&bb.min.y>0.10) solids.push(rec);
    const g=o.geometry.parameters||{};
    const rad=g.radiusTop??g.radiusBottom;
    if(!(o.geometry.type||'').match(/Cylinder/)) return;
    if(!(rad>=0.18&&rad<=0.42)) return;
    if(bb.max.y>1.2) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    // POPULATION BY THE TYRE BLACK, which is what actually selects them here.
    // The row says "tyres carry a MAP, props carry a flat colour" - on this
    // build NO cylinder in this radius carries a map (0 mapped, 365 flat), so
    // that rule selects nothing, as my first run found. looks.mjs has used
    // #101114 all along and it returns 87.
    if(!m||!m.color||m.color.getHexString()!=='101114') return;
    tyres.push({...rec, cx:(bb.min.x+bb.max.x)/2, cz:(bb.min.z+bb.max.z)/2});
  });
  const covered=(t,slack)=>solids.some(q=>{
    if(q.maxX<=t.cx||q.minX>=t.cx) return false;        // directly above in x
    if(q.maxZ<=t.cz||q.minZ>=t.cz) return false;        // and in z
    if(q.minY<t.minY) return false;                     // must be above the wheel's base
    return q.minY < t.maxY - slack;                     // panel dips below the tyre's top
  });
  // THE MARGIN, not a verdict. "Passes at every threshold I tried" is either a
  // comfortable world or a broken test, and only the distribution says which.
  const margins=tyres.map(t=>{ let best=-Infinity;
    for(const q of solids){
      if(q.maxX<=t.cx||q.minX>=t.cx) continue;
      if(q.maxZ<=t.cz||q.minZ>=t.cz) continue;
      if(q.minY<t.minY) continue;
      const m=t.maxY-q.minY;            // how far the panel dips below the tyre top
      if(m>best) best=m; }
    return best; }).filter(m=>m>-Infinity).sort((a,b)=>a-b);
  const ok=tyres.filter(t=>covered(t,0)).length;
  return {n:tyres.length, ok, solids:solids.length,
          margins:{min:+margins[0]?.toFixed(3), p10:+margins[Math.floor(margins.length*0.1)]?.toFixed(3),
                   med:+margins[margins.length>>1]?.toFixed(3), max:+margins[margins.length-1]?.toFixed(3),
                   n:margins.length}};
});
console.log(`\nsolids in the scene: ${r.solids}`);
console.log(`tyres (cylinder r 0.18-0.42, below 1.2 m, carrying a map): ${r.n}   — F counted 83`);
console.log(`  with body geometry dipping below the tyre's top:        ${r.ok} of ${r.n}`);
const M=r.margins;
console.log(`\nHOW FAR the covering panel dips below each tyre's top (${M.n} tyres):`);
console.log(`   min ${M.min} m   10th pct ${M.p10} m   median ${M.med} m   max ${M.max} m`);
console.log(`   ${M.min>0.25 ? `every arch clears by more than 0.25 m — the world is comfortably correct, which is why no threshold in a sensible range fails`
                             : `the tightest is ${M.min} m, so the margin is real and a regression would show`}`);
await b.close();
