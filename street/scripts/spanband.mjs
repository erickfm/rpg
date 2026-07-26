// The stored weights are internal to props.ts, so test the OUTCOME. If the cliff
// is a taper, the BEST-LIT surface in each span band should fall smoothly across
// 6 m rather than dropping off it. Max per band, not median: a band's best case
// shows what the band is ALLOWED to receive, which is the thing under test, and
// it is far less confounded by base colour than an average.
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(23,0)); await afterFrames(p,10); await p.waitForTimeout(900);
const r=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const out=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!m||!m.color) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    if(sy<1.2) return;                       // a wall, not a kerb
    if(bb.min.y>4.5) return;                 // props.ts: poolable only below 4.5
    if(Math.abs((bb.min.x+bb.max.x)/2)>60) return;   // the street, not interiors
    const span=Math.max(sx,sz); if(span<1||span>30) return;
    out.push({span:+span.toFixed(2), lum:+((m.color.r+m.color.g+m.color.b)/3).toFixed(4)}); });
  return out; });
console.log(`\nwall surfaces below 4.5 m on the street at 23:00: ${r.length}`);
const bands=[[1,3],[3,5],[5,6],[6,7],[7,9],[9,12],[12,16],[16,30]];
console.log(`\n  span band      n     best-lit in band     median`);
for(const [lo,hi] of bands){
  const g=r.filter(q=>q.span>=lo&&q.span<hi).map(q=>q.lum).sort((a,b)=>a-b);
  if(!g.length){ console.log(`  ${String(lo).padStart(4)}-${String(hi).padEnd(5)}   0`); continue; }
  console.log(`  ${String(lo).padStart(4)}-${String(hi).padEnd(5)} ${String(g.length).padStart(4)}        ${g[g.length-1].toFixed(4)}        ${g[g.length>>1].toFixed(4)}`);
}
const best=(lo,hi)=>{ const g=r.filter(q=>q.span>=lo&&q.span<hi).map(q=>q.lum); return g.length?Math.max(...g):null; };
const under=best(5,6), over=best(6,7), far=best(12,16);
console.log(`\n  just under 6 m: ${under}   just over 6 m: ${over}   past 12 m: ${far}`);
console.log(`  ${under!=null&&over!=null ? (Math.abs(under-over) < 0.25*Math.max(under,over)
    ? 'no cliff at 6 m — the bands either side receive comparably'
    : '** a step at 6 m remains: ' + (under-over).toFixed(4)) : 'CANNOT ANSWER — a band is empty'}`);
await b.close();
