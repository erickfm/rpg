// "make sure all the clocks throughout the world tell the same time"
//
// Find clocks by BEHAVIOUR, not by looks: set game time, and anything whose
// orientation follows is a hand. The control matters - citizens, traffic and
// flags move on their own - so sample twice at the SAME game time first and
// treat whatever moved then as noise, not as a clock.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1500);
const snap=async()=>p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const m={};
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox;
    const sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    const dims=[sx,sy,sz].sort((a,b)=>b-a);
    if(dims[0]>1.2||dims[0]<0.04) return;            // a hand is small
    if(dims[0]/Math.max(dims[1],1e-4)<2.5) return;   // and long and thin
    const e=o.matrixWorld.elements;
    m[o.uuid]={r:[+o.rotation.x.toFixed(4),+o.rotation.y.toFixed(4),+o.rotation.z.toFixed(4)],
               p:[+e[12].toFixed(2),+e[13].toFixed(2),+e[14].toFixed(2)]}; });
  return m; });
const setT=async(h,mm)=>{ await p.evaluate(([h,mm])=>window.__ct.clock(h,mm),[h,mm]); await afterFrames(p,8); await p.waitForTimeout(400); };
await setT(13,0);  const A =await snap();
await afterFrames(p,8); await p.waitForTimeout(400);
const A2=await snap();                                   // CONTROL: same time, later
await setT(16,0);  const B =await snap();
const moved=(x,y)=>x&&y&&[0,1,2].some(i=>Math.abs(x.r[i]-y.r[i])>0.02);
const noise=new Set(Object.keys(A).filter(k=>moved(A[k],A2[k])));
const hands=Object.keys(A).filter(k=>!noise.has(k)&&moved(A[k],B[k]));
console.log(`\nthin candidate meshes: ${Object.keys(A).length}`);
console.log(`  moving on their own (control, dropped): ${noise.size}`);
console.log(`  turning with GAME TIME — clock hands:   ${hands.length}`);
// cluster hands into clocks by position
const cl=[];
for(const k of hands){ const q=A[k].p;
  const f=cl.find(c=>Math.hypot(c.p[0]-q[0],c.p[1]-q[1],c.p[2]-q[2])<0.9);
  if(f) f.k.push(k); else cl.push({p:q,k:[k]}); }
console.log(`  distinct clocks (hands within 0.9 m):   ${cl.length}`);
const delta=(k)=>{ const d=[0,1,2].map(i=>B[k].r[i]-A[k].r[i]);
  return d.map(v=>{ while(v>Math.PI)v-=2*Math.PI; while(v<-Math.PI)v+=2*Math.PI; return +v.toFixed(3); }); };
console.log(`\n  clock at                     hands   rotation over 13:00 -> 16:00`);
const sigs=[];
for(const c of cl.sort((a,b)=>a.p[0]-b.p[0])){
  const ds=c.k.map(delta).map(d=>d.map(v=>Math.abs(v)).reduce((a,b)=>Math.max(a,b),0)).sort((a,b)=>b-a);
  sigs.push(ds.map(v=>v.toFixed(2)).join('/'));
  console.log(`   (${String(c.p[0]).padStart(7)}, ${String(c.p[1]).padStart(5)}, ${String(c.p[2]).padStart(7)})  ${String(c.k.length).padStart(2)}     ${ds.map(v=>v.toFixed(3)).join('  ')}`);
}
// THE OTHER HALF: clock FACES that did not move. "All the clocks agree" is only
// answered by finding the ones that do not follow game time, and a converted
// clock cannot report those.
const faces=await p.evaluate(()=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const out=[];
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox;
    const sx=bb.max.x-bb.min.x, sy=bb.max.y-bb.min.y, sz=bb.max.z-bb.min.z;
    const d=[sx,sy,sz].sort((a,b)=>b-a);
    // a face: roughly a flat disc/plate 0.2-0.8 m across, mounted above waist
    if(d[0]<0.18||d[0]>0.85) return;
    if(Math.abs(d[0]-d[1])>0.12) return;          // roughly square/round
    if(d[2]>0.22) return;                          // flat
    const e=o.matrixWorld.elements;
    const y=e[13]; if(y<1.4||y>6.0) return;
    const g=o.geometry.type||'';
    // ROUND ONLY. 'flat, roughly square, wall-mounted' matched 223 meter boxes
    // and sign panels - a list that size is a broken filter, not a finding.
    if(!/Circle|Cylinder|Ring/i.test(g)) return;
    out.push({p:[+e[12].toFixed(2),+y.toFixed(2),+e[14].toFixed(2)],g,d:d.map(v=>+v.toFixed(2))}); });
  return out; });
const near=(a,b,r)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<r;
const live=cl.map(c=>c.p);
const dead=faces.filter(f=>!live.some(l=>near(f.p,l,1.0)));
console.log(`\n  clock-face-shaped meshes in the world: ${faces.length}`);
console.log(`  of those, NOT within 1 m of a moving hand: ${dead.length}`);
for(const f of dead.slice(0,14)) console.log(`     (${f.p[0]}, ${f.p[1]}, ${f.p[2]})  ${f.g}  ${f.d.join(' x ')}`);
// IN PHASE, not merely at the same RATE. Two clocks can each advance 90 degrees
// over three hours and still be four hours apart - "they moved the same amount"
// is not "they tell the same time". Compare the ABSOLUTE hand angle at one
// instant, and check it against what the hour actually is.
console.log(`\n  absolute hand angle at 13:00, and at 16:00:`);
const rows=[];
for(const c of cl.sort((a,b)=>a.p[0]-b.p[0])){
  for(const k of c.k){
    const pick=(r)=>r.reduce((best,v,i)=>Math.abs(v)>Math.abs(r[best])?i:best,0);
    const i=pick(A[k].r);
    rows.push({at:c.p, a:A[k].r[i], b:B[k].r[i], axis:'xyz'[i]});
    console.log(`   (${String(c.p[0]).padStart(7)}, ${String(c.p[2]).padStart(7)})  axis ${'xyz'[i]}   13:00 ${A[k].r[i].toFixed(3)}   16:00 ${B[k].r[i].toFixed(3)}`); } }
if(rows.length>1){
  const spread=Math.max(...rows.map(r=>r.a))-Math.min(...rows.map(r=>r.a));
  console.log(`\n  spread between clocks at the same instant: ${spread.toFixed(4)} rad (${(spread*180/Math.PI).toFixed(2)} deg)`);
  const hoursOff=spread/(Math.PI/6);
  console.log(`  that is ${hoursOff.toFixed(2)} hours apart — ${Math.abs(spread)<0.02?'IN PHASE, they tell the same time':'** they do NOT agree'}`);
}
const uniq=[...new Set(sigs)];
console.log(`\n  distinct rotation signatures: ${uniq.length}`);
console.log(uniq.length<=1 ? '  every clock moved the same amount — they agree'
                           : `  ** clocks DISAGREE: ${uniq.length} different signatures`);
await b.close();
