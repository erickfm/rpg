// More evidence-less CONFIRMED rows. Two with hard predicates first.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:700}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);

// ── 1. "block protruding from wheels on all vehicles"
// PREDICATE: no solid may stick out past its own tyre's outer face.
console.log(`\n1. BLOCKS PROTRUDING FROM WHEELS`);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  const tyres=[], solids=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    const m=Array.isArray(o.material)?o.material[0]:o.material; if(!m) return;
    const rec={minX:bb.min.x,maxX:bb.max.x,minY:bb.min.y,maxY:bb.max.y,minZ:bb.min.z,maxZ:bb.max.z};
    if(m.color&&m.color.getHexString()==='101114'&&(o.geometry.type||'').match(/Cylinder/)&&bb.max.y<1.2){
      tyres.push({...rec,cx:(bb.min.x+bb.max.x)/2,cz:(bb.min.z+bb.max.z)/2}); return; }
    if(sx<6&&sz<6&&sy<3&&bb.min.y<1.2) solids.push(rec);
  });
  // for each tyre, does any solid overlap it in y/z and stick out past its outer x face?
  let bad=0; const ex=[];
  for(const t of tyres){
    for(const q of solids){
      if(q.maxY<t.minY||q.minY>t.maxY) continue;
      if(q.maxZ<t.minZ||q.minZ>t.maxZ) continue;
      const outL=t.minX-q.minX, outR=q.maxX-t.maxX;
      const out=Math.max(outL,outR);
      if(out>0.06 && q.minX<t.maxX && q.maxX>t.minX){ bad++;
        if(ex.length<5) ex.push(`tyre at (${t.cx.toFixed(1)}, ${t.cz.toFixed(1)}) — a solid sticks out ${out.toFixed(3)} m past its face`);
        break; }
    }
  }
  return {tyres:tyres.length, solids:solids.length, bad, ex};
});
console.log(`   tyres ${r.tyres}, candidate solids ${r.solids}`);
console.log(`   tyres with something protruding past their outer face by >6 cm: ${r.bad}`);
for(const e of r.ex) console.log(`      ** ${e}`);
console.log(`   ${r.bad===0 ? 'nothing protrudes' : '** blocks still protrude'}`);

// ── 2. "PVBLIC vs PUBLIC on the library" — read the frieze
console.log(`\n2. THE LIBRARY FRIEZE`);
const lib=await p.evaluate(()=>window.__ct.doors().find(d=>/LIBRARY/i.test(d.building)));
const sx=lib.stand.x + lib.point.nx*9.0, sz=lib.stand.z + lib.point.nz*9.0;
await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),
  [sx,sz,Math.atan2(lib.point.x-sx,-(lib.point.z-sz)),0.30]);
await afterFrames(p,5);
const at=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
await p.screenshot({path:'shots/frieze.png'});
console.log(`   read from (${at[0]}, ${at[2]}), ${Math.hypot(at[0]-lib.point.x,at[2]-lib.point.z).toFixed(1)} m from the door — shots/frieze.png`);

// ── 3. "cat directly ahead from the alley mouth"
console.log(`\n3. THE CAT FROM THE ALLEY MOUTH`);
const cat=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); let best=null;
  s.traverse(o=>{ let tagged=false;
    for(let q=o;q;q=q.parent) if(q.userData&&(q.userData.cat||q.userData.isCat)){ tagged=true; break; }
    if(!tagged||!o.isMesh) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if(!best) best={x:+((bb.min.x+bb.max.x)/2).toFixed(2),z:+((bb.min.z+bb.max.z)/2).toFixed(2)}; });
  return best; });
console.log(`   cat by tag: ${cat? `(${cat.x}, ${cat.z})` : 'not tagged — cannot locate by name'}`);
await b.close();
