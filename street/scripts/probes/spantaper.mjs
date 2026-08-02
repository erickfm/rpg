// "why does the lighting catch [only half this wall]" — B reports the cause was
// a CLIFF at span < 6 m: a wall built as two meshes, 5.9 m and 6.1 m, had one
// half pooling and the other not, and the seam is invisible because both carry
// the same brick. The fix is a smoothstep, full to 6 m, nothing past 12.
//
// So: plot SPAN against the grade each surface carries. A cliff shows as two
// populations either side of 6; a taper shows as a slope between 6 and 12.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(22,0)); await afterFrames(p,10); await p.waitForTimeout(900);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const out=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!m||!m.color) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    if(sy<1.5) return;                       // a wall, not a kerb
    const span=Math.max(sx,sz);
    if(span<1.0||span>40) return;
    const lum=(m.color.r+m.color.g+m.color.b)/3;
    out.push({span:+span.toFixed(2), lum:+lum.toFixed(3),
              x:+((bb.min.x+bb.max.x)/2).toFixed(1), z:+((bb.min.z+bb.max.z)/2).toFixed(1)}); });
  return out; });
console.log(`\nwall-like surfaces at 22:00: ${r.length}`);
const bands=[[1,4],[4,5.5],[5.5,6.0],[6.0,6.5],[6.5,8],[8,12],[12,20],[20,40]];
console.log(`\n  span band     n    grade: min    median      max`);
for(const [lo,hi] of bands){
  const g=r.filter(q=>q.span>=lo&&q.span<hi).map(q=>q.lum).sort((a,b)=>a-b);
  if(!g.length){ console.log(`  ${String(lo).padStart(4)}-${String(hi).padEnd(5)}   0`); continue; }
  console.log(`  ${String(lo).padStart(4)}-${String(hi).padEnd(5)} ${String(g.length).padStart(4)}     ${g[0].toFixed(3)}     ${g[g.length>>1].toFixed(3)}    ${g[g.length-1].toFixed(3)}`);
}
// the specific shape of the old bug: neighbours straddling 6 m with different grades
let straddle=0, worst=0, ex=null;
for(let i=0;i<r.length;i++) for(let j=i+1;j<r.length;j++){
  const a=r[i], c=r[j];
  if(Math.hypot(a.x-c.x,a.z-c.z)>4) continue;               // adjacent
  if(!((a.span<6&&c.span>6)||(c.span<6&&a.span>6))) continue; // straddling the old cutoff
  straddle++;
  const d=Math.abs(a.lum-c.lum);
  if(d>worst){ worst=d; ex=[a,c]; } }
console.log(`\n  adjacent pairs straddling the old 6 m cutoff: ${straddle}`);
if(ex) console.log(`  largest grade difference across such a pair: ${worst.toFixed(3)}`
  +`\n     span ${ex[0].span} grade ${ex[0].lum} at (${ex[0].x}, ${ex[0].z})`
  +`\n     span ${ex[1].span} grade ${ex[1].lum} at (${ex[1].x}, ${ex[1].z})`);
await b.close();
