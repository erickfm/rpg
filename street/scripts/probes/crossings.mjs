// B: TWO crossings on the junction, not four.
//   A across the MAIN street: x -5.00..5.00, z -91.50..-88.90
//   B across the SIDE street: x 9.30..11.90, z -108.00..-98.00
//   both span exactly 10.00 m, kerb to kerb, measured off the built meshes.
// Find the painted bars themselves and measure their extent.
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:700}});
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const bars=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material; if(!m||!m.color) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const y=(bb.min.y+bb.max.y)/2;
    if(y<-0.05||y>0.06) return;                       // paint sits on the road
    const sx=bb.max.x-bb.min.x, sz=bb.max.z-bb.min.z, sy=bb.max.y-bb.min.y;
    if(sy>0.05) return;
    const lum=(m.color.r+m.color.g+m.color.b)/3;
    if(lum<0.55) return;                              // white bars
    const long=Math.max(sx,sz), thin=Math.min(sx,sz);
    if(long<1.2||long>5||thin<0.15||thin>1.2) return; // a zebra bar
    bars.push({x0:+bb.min.x.toFixed(2),x1:+bb.max.x.toFixed(2),
               z0:+bb.min.z.toFixed(2),z1:+bb.max.z.toFixed(2)}); });
  // cluster bars into crossings
  const cl=[];
  for(const q of bars){ const cx=(q.x0+q.x1)/2, cz=(q.z0+q.z1)/2;
    const f=cl.find(c=>Math.hypot(c.cx-cx,c.cz-cz)<7);
    if(f){ f.n++; f.x0=Math.min(f.x0,q.x0); f.x1=Math.max(f.x1,q.x1);
           f.z0=Math.min(f.z0,q.z0); f.z1=Math.max(f.z1,q.z1);
           f.cx=(f.x0+f.x1)/2; f.cz=(f.z0+f.z1)/2; }
    else cl.push({n:1,x0:q.x0,x1:q.x1,z0:q.z0,z1:q.z1,cx,cz}); }
  return {bars:bars.length, cl}; });
console.log(`\npainted bars on the road: ${r.bars}`);
console.log(`crossings (bars clustered within 7 m): ${r.cl.length}   — B says TWO`);
for(const c of r.cl.sort((a,b)=>a.cx-b.cx)){
  const spanX=+(c.x1-c.x0).toFixed(2), spanZ=+(c.z1-c.z0).toFixed(2);
  const across=spanX>spanZ?spanX:spanZ;
  console.log(`   ${String(c.n).padStart(2)} bars   x ${c.x0}..${c.x1}  z ${c.z0}..${c.z1}   spans ${spanX} x ${spanZ}  → ${across} m across`);
}
const shot=async(n,x,z,tx,tz,pi)=>{
  await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),
    [x,z,Math.atan2(tx-x,-(tz-z)),pi]);
  await afterFrames(p,5); await p.screenshot({path:`shots/xing-${n}.png`});
  console.log(`   xing-${n}.png`); };
console.log(`\nstations:`);
await shot('main', 0,-84, 0,-92, -0.32);
// (10.6,-94) was clipped by the bodega block. Crossing B runs N-S across the
// side street, which runs E-W at z ~ -103, so the view is from along that street.
await shot('side', 18,-103.5, 9,-103.5, -0.26);
await shot('side2', 10.6,-112, 10.6,-100, -0.24);
await b.close();
