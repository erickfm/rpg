// The east-end crossing: is there a RAMP at the kerb, or a step? A ramp and a
// step do not look alike in a ground profile, and the contrast is the proof —
// same method that settled the driveway apron.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
const prof=async(label,x0,z0,x1,z1,n=60)=>{
  const g=await p.evaluate(([x0,z0,x1,z1,n])=>{ const o=[];
    for(let i=0;i<=n;i++){ const t=i/n, x=x0+(x1-x0)*t, z=z0+(z1-z0)*t;
      o.push([+x.toFixed(2),+z.toFixed(2),+window.__ct.groundAt(x,z).toFixed(3)]); }
    return o; },[x0,z0,x1,z1,n]);
  const hs=g.map(a=>a[2]);
  const lo=Math.min(...hs), hi=Math.max(...hs);
  // count DISTINCT levels between lo and hi: a ramp has many, a step has two
  const mid=hs.filter(h=>h>lo+0.012&&h<hi-0.012);
  const uniq=[...new Set(mid.map(h=>h.toFixed(3)))];
  console.log(`  ${label.padEnd(30)} ${lo.toFixed(3)} -> ${hi.toFixed(3)}   intermediate samples ${String(mid.length).padStart(3)}  distinct levels ${String(uniq.length).padStart(3)}  ${uniq.length>=4?'RAMP':(hi-lo<0.02?'flat':'STEP')}`);
  return {lo,hi,mid:mid.length,uniq:uniq.length};
};
console.log(`\nprofiles across the kerb line (60 samples each):`);
const a=await prof('crossing, z -107.4 corner', 53.8,-109.5, 53.8,-105.5);
const c=await prof('crossing, z -98.6 corner',  53.8,-100.5, 53.8,-96.5);
console.log(`\nCONTROL — a plain kerb where no crossing was built:`);
const d=await prof('plain kerb, x 53.8 z -70',  53.8,-72.0, 53.8,-68.0);
const e=await prof('plain kerb, x 45 z -103',   45.0,-105.0, 45.0,-101.0);
console.log(`\nalong the crossing itself (should be continuous, no lip):`);
const f=await prof('across, z -103',            51.5,-103.0, 56.5,-103.0);
await b.close();
const ramped=(a.uniq>=4)||(c.uniq>=4);
console.log(`\n${ramped?'RAMPED at the crossing':'** NO RAMP FOUND at the crossing'}`);
