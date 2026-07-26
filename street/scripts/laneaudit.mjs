// SIDEWALK ENCROACHMENT, whole block. "in general we should not encroach the
// already cramped sidewalk."
//
// Two populations, reported separately, because conflating them is wrong:
//   FIXTURES — bins, benches, poles, fences, shopfront projections. The user's
//              rule is about these. They never move, so a pinch is permanent.
//   PEOPLE   — crowd.ts:153 boxes, deliberately +-0.25 so the player can pass.
//              They move, so a pinch is transient.
// Player capsule 0.72 m across (RADIUS 0.36). GOTCHAS 9: the 2 m lane is sacred.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const STEP=0.25;
const LANES=[
 {id:'west walk',      axis:'z', x0:-7.25, x1:-5.25,  a0:-108, a1:15},
 {id:'east walk',      axis:'z', x0: 5.25, x1: 7.25,  a0:-96,  a1:15},
 {id:'side st north',  axis:'x', x0:-97.75,x1:-96.25, a0:8,    a1:56},
 {id:'side st south',  axis:'x', x0:-110.25,x1:-108.25,a0:-6,  a1:56},
];
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const res=await p.evaluate(([LANES,STEP])=>{
 const cols=window.__ct.colliders();
 const isPerson=(c)=>Math.abs((c.maxX-c.minX)-0.5)<1e-6 && Math.abs((c.maxZ-c.minZ)-0.5)<1e-6;
 const objs=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements; let mn=[1e9,1e9],mx=[-1e9,-1e9],hi=-1e9;
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12], wy=m[1]*X+m[5]*Y+m[9]*Z+m[13], wz=m[2]*X+m[6]*Y+m[10]*Z+m[14];
   if(wx<mn[0])mn[0]=wx; if(wx>mx[0])mx[0]=wx; if(wz<mn[1])mn[1]=wz; if(wz>mx[1])mx[1]=wz; if(wy>hi)hi=wy;}
  objs.push({mn,mx,hi,ud:o.userData||{},name:o.name});});
 const nameOf=(c)=>{ let best=null,bd=1e9;
  for(const o of objs){const d=Math.abs(o.mn[0]-c.minX)+Math.abs(o.mx[0]-c.maxX)+Math.abs(o.mn[1]-c.minZ)+Math.abs(o.mx[1]-c.maxZ);
   if(d<bd){bd=d;best=o;}}
  if(!best||bd>1.5) return {label:'unmatched',mod:null};
  const u=best.ud; const tag=best.name||u.litter||u.kind||u.prop||u.atmPart||Object.keys(u).filter(k=>k!=='mod'&&k!=='groundY').join(',')||'(untagged)';
  return {label:tag,mod:u.mod||null,h:+best.hi.toFixed(2)};};
 const out=[];
 for(const L of LANES){
  for(let a=L.a0;a<=L.a1;a+=STEP){
   for(const mode of ['fixtures','all']){
    const iv=[];
    for(const c of cols){
     if(mode==='fixtures'&&isPerson(c)) continue;
     let lo,hi2,cross;
     if(L.axis==='z'){ cross=(c.minZ<=a&&c.maxZ>=a); lo=Math.max(c.minX,L.x0); hi2=Math.min(c.maxX,L.x1); }
     else            { cross=(c.minX<=a&&c.maxX>=a); lo=Math.max(c.minZ,L.x0); hi2=Math.min(c.maxZ,L.x1); }
     if(cross&&hi2>lo) iv.push([lo,hi2,c]);}
    iv.sort((u,v)=>u[0]-v[0]);
    let cur=L.x0,best=0,bl=null,br=null,last=null;
    const take=(lo,hi2,cl,cr)=>{ if(hi2-lo>best){best=hi2-lo;bl=cl;br=cr;} };
    for(const [lo,hi2,c] of iv){ if(lo>cur) take(cur,lo,last,c); if(hi2>cur){cur=hi2;last=c;} }
    if(cur<L.x1) take(cur,L.x1,last,null);
    out.push({lane:L.id,mode,at:+a.toFixed(2),clear:+best.toFixed(3),
      l:bl?nameOf(bl):null,r:br?nameOf(br):null,
      lbox:bl?[+bl.minX.toFixed(2),+bl.maxX.toFixed(2),+bl.minZ.toFixed(1),+bl.maxZ.toFixed(1)]:null,
      rbox:br?[+br.minX.toFixed(2),+br.maxX.toFixed(2),+br.minZ.toFixed(1),+br.maxZ.toFixed(1)]:null});}}}
 return {out, people:cols.filter(isPerson).length, total:cols.length};},[LANES,STEP]);
const {out,people,total}=res;
if(!out.length){console.error('CANNOT ANSWER — no lane samples.');process.exit(3);}
const runs=(mode)=>{ const bad=[]; let r=null;
 for(const o of out.filter(o=>o.mode===mode).sort((a,b)=>a.lane.localeCompare(b.lane)||a.at-b.at)){
  if(o.clear<1.40){ if(r&&r.lane===o.lane&&Math.abs(o.at-r.a1-STEP)<1e-6){r.a1=o.at; if(o.clear<r.min){r.min=o.clear;r.at=o;}}
   else {if(r)bad.push(r); r={lane:o.lane,a0:o.at,a1:o.at,min:o.clear,at:o};} }
  else { if(r){bad.push(r);r=null;} } }
 if(r)bad.push(r); return bad.sort((a,b)=>a.min-b.min);};
// A citizen box is 0.5 m wide (crowd.ts:153). Where a FIXTURE leaves less than
// 0.72 + 0.50 = 1.22 m, one pedestrian standing there can close the walk to
// less than the player's own width - which is a way to be stuck that no static
// sweep can see.
{const F=out.filter(o=>o.mode==='fixtures');
 const block=F.filter(o=>o.clear<1.22);
 console.log(`\nPINNABLE: fixture clearance under 1.22 m (0.72 player + 0.50 citizen): ${block.length} of ${F.length} samples`);
 const byLane={}; for(const o of block)(byLane[o.lane]??=[]).push(o.at);
 for(const [k,v] of Object.entries(byLane)) console.log(`   ${k}: ${v.length} samples, from ${Math.min(...v).toFixed(1)} to ${Math.max(...v).toFixed(1)}`);
 const worst=F.slice().sort((a,b)=>a.clear-b.clear).filter(o=>o.clear>0.8)[0];
 if(worst) console.log(`   tightest real fixture gap: ${worst.clear} m at ${worst.lane} ${worst.at}`);
}
let md=`# Sidewalk lane audit — the whole block\n\n`;
md+=`> *"in general we should not encroach the already cramped sidewalk"*\n\n`;
md+=`Player capsule **0.72 m** across (RADIUS 0.36). GOTCHAS §9: the 2 m lane is\n`;
md+=`sacred. Measured, not eyeballed: at every ${STEP} m along each lane, take the\n`;
md+=`nominal walk band, subtract every collider crossing it, keep the **largest\n`;
md+=`continuous free run**. ${out.filter(o=>o.mode==='fixtures').length} samples per population.\n\n`;
md+=`**Two populations, reported separately.** ${total} colliders, of which **${people} are people**\n`;
md+=`(\`crowd.ts:153\`, boxes deliberately ±0.25 so the player can pass, and they\n`;
md+=`move — a pinch there is transient). The user's rule is about **fixtures**,\n`;
md+=`which never move, so a pinch there is permanent.\n\n`;
for(const mode of ['fixtures','all']){
 const bands=[['IMPASSABLE  <0.72',0,0.72],['URGENT  0.72–0.80',0.72,0.80],['PROBLEM 0.80–1.00',0.80,1.00],['tight   1.00–1.40',1.00,1.40]];
 const S=out.filter(o=>o.mode===mode);
 md+=`## ${mode==='fixtures'?'FIXTURES ONLY — the user\'s rule':'WITH PEOPLE — what a player meets'}\n\n`;
 md+=`| band | samples | % |\n|---|---|---|\n`;
 for(const [lab,lo,hi] of bands){const n=S.filter(o=>o.clear>=lo&&o.clear<hi).length;
  md+=`| ${lab} | ${n} | ${(100*n/S.length).toFixed(1)}% |\n`;}
 md+=`| clear ≥1.40 | ${S.filter(o=>o.clear>=1.40).length} | ${(100*S.filter(o=>o.clear>=1.40).length/S.length).toFixed(1)}% |\n\n`;
 const bad=runs(mode);
 md+=`Stretches under 1.40 m: **${bad.length}**\n\n`;
 for(const r of bad.slice(0,18)){
  const nm=(q)=>q?`\`${q.label}\`${q.mod?` [${q.mod}]`:''}`:'kerb / lane edge';
  md+=`- **${r.min.toFixed(2)} m** — ${r.lane}, ${r.at.lane.startsWith('side')?'x':'z'} ${r.a0.toFixed(1)}…${r.a1.toFixed(1)} (${(r.a1-r.a0+STEP).toFixed(1)} m long), between ${nm(r.at.l)} and ${nm(r.at.r)}\n`;
  if(r.at.lbox) md+=`  - left  \`x ${r.at.lbox[0]}…${r.at.lbox[1]}  z ${r.at.lbox[2]}…${r.at.lbox[3]}\`\n`;
  if(r.at.rbox) md+=`  - right \`x ${r.at.rbox[0]}…${r.at.rbox[1]}  z ${r.at.rbox[2]}…${r.at.rbox[3]}\`\n`;}
 md+=`\n`;}
writeFileSync('notes/lane-audit.md',md);
console.log(md.replace(/\n\n+/g,'\n').slice(0,3200));
await b.close();
