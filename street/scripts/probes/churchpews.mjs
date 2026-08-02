// "pews in the church clip into the confession booths". A NAMED PAIR, which is
// the only overlap question a box test answers well - my global censuses were
// unusable because assemblies legitimately interpenetrate.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const rm=await p.evaluate(()=>window.__ct.roomDims().find(r=>r.id==='church'));
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[rm.cx,rm.cz]); await p.waitForTimeout(400);
const r=await p.evaluate(([cx,cz,w,d])=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  const groups=new Map();
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const x=(bb.min.x+bb.max.x)/2, z=(bb.min.z+bb.max.z)/2;
    if(Math.abs(x-cx)>w/2+2||Math.abs(z-cz)>d/2+2) return;
    // GROUP BY IMMEDIATE PARENT. Walking up to a child-of-scene put the whole
    // church interior in ONE group and the test then reported 0 overlapping
    // pairs - a check that cannot fail, which is the shape I have been finding
    // in other people's checks all session and just wrote into my own.
    const top=o.parent||o;
    const g=groups.get(top.uuid)||{n:0,min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9]};
    g.n++;
    for(let i=0;i<3;i++){ const lo=[bb.min.x,bb.min.y,bb.min.z][i], hi=[bb.max.x,bb.max.y,bb.max.z][i];
      g.min[i]=Math.min(g.min[i],lo); g.max[i]=Math.max(g.max[i],hi); }
    groups.set(top.uuid,g); });
  const G=[...groups.values()].filter(g=>g.n>=1);
  if(G.length<3) return {groups:G.length, pairs:[], total:-1};   // cannot answer
  const size=g=>[g.max[0]-g.min[0],g.max[1]-g.min[1],g.max[2]-g.min[2]];
  const inside=(a,b2)=>a.min[0]>=b2.min[0]-0.02&&a.max[0]<=b2.max[0]+0.02&&a.min[2]>=b2.min[2]-0.02&&a.max[2]<=b2.max[2]+0.02;
  const pairs=[];
  for(let i=0;i<G.length;i++) for(let j=i+1;j<G.length;j++){
    const o=[0,1,2].map(k=>Math.min(G[i].max[k],G[j].max[k])-Math.max(G[i].min[k],G[j].min[k]));
    if(!o.every(v=>v>0)) continue;
    if(inside(G[i],G[j])||inside(G[j],G[i])) continue;
    const vol=o[0]*o[1]*o[2];
    if(vol<=0.002) continue;
    pairs.push({vol:+vol.toFixed(3), o:o.map(v=>+v.toFixed(2)),
      a:size(G[i]).map(v=>+v.toFixed(2)), b:size(G[j]).map(v=>+v.toFixed(2)),
      ac:[+((G[i].min[0]+G[i].max[0])/2).toFixed(1),+((G[i].min[2]+G[i].max[2])/2).toFixed(1)],
      bc:[+((G[j].min[0]+G[j].max[0])/2).toFixed(1),+((G[j].min[2]+G[j].max[2])/2).toFixed(1)]}); }
  pairs.sort((x,y)=>y.vol-x.vol);
  return {groups:G.length, pairs:pairs.slice(0,8), total:pairs.length};
},[rm.cx,rm.cz,rm.w,rm.d]);
console.log(`\nchurch: ${r.groups} multi-mesh assemblies`);
console.log(`interpenetrating pairs (containment excluded): ${r.total}`);
for(const q of r.pairs)
  console.log(`   ${JSON.stringify(q.ac)} ${JSON.stringify(q.a)}  x  ${JSON.stringify(q.bc)} ${JSON.stringify(q.b)}   overlap ${JSON.stringify(q.o)} = ${q.vol} m3`);
await b.close();
