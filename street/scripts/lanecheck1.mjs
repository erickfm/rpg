// My lane audit reported 8 IMPASSABLE samples at 0.25 m around z 14.2..20.2,
// blamed on an "(untagged) [street]" collider spanning x -7..7. builtlane says
// the narrowest static pinch anywhere is 1.12 m. Both cannot be right.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
const r=await p.evaluate(()=>{
  const cs=window.__ct.colliders();
  const hits=cs.filter(c=>c.minZ<20.5&&c.maxZ>14.0&&c.maxX-c.minX>3);
  return {total:cs.length, hits:hits.map(c=>({x:[+c.minX.toFixed(2),+c.maxX.toFixed(2)],
    z:[+c.minZ.toFixed(2),+c.maxZ.toFixed(2)], w:+(c.maxX-c.minX).toFixed(2)}))}; });
console.log(`\ncolliders spanning the walk near z 14..20 and wider than 3 m: ${r.hits.length} of ${r.total}`);
for(const h of r.hits) console.log(`   x ${h.x[0]}..${h.x[1]} (${h.w} m wide)   z ${h.z[0]}..${h.z[1]}`);
// can the player stand there at all?
const probe=await p.evaluate(()=>{ const out=[];
  for(const z of [13.5,14.5,15.5,17,19,21]){ for(const x of [-6.2,0,6.2]){
    const blocked=window.__ct.colliders().some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);
    out.push(`   (${x}, ${z}) ${blocked?'BLOCKED':'free'}`); } }
  return out.join('\n'); });
console.log(`\nis the walk itself standable there?`);
console.log(probe);
await b.close();
