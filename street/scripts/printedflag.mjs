// Has the `printed` opt-out actually been applied? B's mechanism landed inert -
// it needs C (lot.ts) and I/H to stamp materials. Counting is the whole test.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); const seen=new Set();
  let printed=0, selfLit=0, mats=0, both=0;
  s.traverse(o=>{ if(!o.isMesh) return;
    for(const m of (Array.isArray(o.material)?o.material:[o.material])){
      if(!m||seen.has(m.uuid)) continue; seen.add(m.uuid); mats++;
      const pr=!!(m.userData&&m.userData.printed);
      const sl=!!(m.userData&&m.userData.selfLit);
      if(pr) printed++; if(sl) selfLit++; if(pr&&sl) both++; }});
  const spots=[];
  s.updateMatrixWorld(true);
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    const ms=Array.isArray(o.material)?o.material:[o.material];
    if(!ms.some(m=>m&&m.userData&&m.userData.printed)) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    spots.push([+((bb.min.x+bb.max.x)/2).toFixed(2),+((bb.min.y+bb.max.y)/2).toFixed(2),
                +((bb.min.z+bb.max.z)/2).toFixed(2),+(bb.max.y-bb.min.y).toFixed(2)]); });
  return {mats,printed,selfLit,both,spots:spots.slice(0,14),nspots:spots.length}; });
console.log(`\n  distinct materials in the world   ${r.mats}`);
console.log(`  carrying userData.selfLit         ${r.selfLit}`);
console.log(`  carrying userData.printed         ${r.printed}`);
console.log(`  both (a sheet claiming to be lit) ${r.both}`);
console.log(r.printed===0
  ? `\n  STILL INERT — nothing has opted in, so the mechanism cannot change a pixel.`
  : `\n  the opt-out is in use on ${r.printed} materials.`);
console.log(`\n  printed meshes: ${r.nspots}; first few (x, y, z, height):`);
for(const q of r.spots) console.log(`    (${q[0]}, ${q[1]}, ${q[2]})  h ${q[3]}`);
await b.close();
