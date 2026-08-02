// "bench clips into fountain" and "bin is in the sign", as SPECIFIC PAIRS.
// Three global overlap censuses this session were unusable because assemblies
// legitimately interpenetrate; a named pair is the version that answers.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const out=await p.evaluate(()=>{
 const s=window.__ct.scene(); s.updateMatrixWorld(true);
 const inPark=(x,z)=>x>-40&&x<-6&&z>-97&&z<-68;
 const groups=new Map();
 s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
  if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
  const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2;
  if(!inPark(cx,cz)) return;
  let top=o; while(top.parent&&top.parent.parent&&!top.parent.isScene) top=top.parent;
  const k=top.uuid; const g=groups.get(k)||{n:0,min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9],name:top.name||''};
  g.n++; g.min=[Math.min(g.min[0],bb.min.x),Math.min(g.min[1],bb.min.y),Math.min(g.min[2],bb.min.z)];
  g.max=[Math.max(g.max[0],bb.max.x),Math.max(g.max[1],bb.max.y),Math.max(g.max[2],bb.max.z)];
  groups.set(k,g); });
 const G=[...groups.values()].filter(g=>g.n>1);
 const size=g=>[g.max[0]-g.min[0],g.max[1]-g.min[1],g.max[2]-g.min[2]];
 const ov=(a,b2)=>{ const o=[0,1,2].map(i=>Math.min(a.max[i],b2.max[i])-Math.max(a.min[i],b2.min[i]));
   return o.every(v=>v>0)?o:null; };
 const pairs=[];
 for(let i=0;i<G.length;i++) for(let j=i+1;j<G.length;j++){
  const o=ov(G[i],G[j]); if(!o) continue;
  const vol=o[0]*o[1]*o[2];
  // A SHELTER'S BOX CONTAINS EVERYTHING UNDER ITS ROOF, and a weed tuft is a
  // 0.30x0.35 quad that legitimately grows beside a bench leg. Neither is a
  // clip. Excluded: pairs where one footprint sits wholly inside the other
  // (that is "under", not "through"), and anything under 0.5 m in every
  // dimension (tufts). What is left is furniture actually intersecting.
  const sa=size(G[i]), sb=size(G[j]);
  const tuft=(t)=>t[0]<0.5&&t[1]<0.6&&t[2]<0.5;
  const inside=(a,b2)=>a.min[0]>=b2.min[0]-0.02&&a.max[0]<=b2.max[0]+0.02&&a.min[2]>=b2.min[2]-0.02&&a.max[2]<=b2.max[2]+0.02;
  if(tuft(sa)||tuft(sb)) continue;
  if(inside(G[i],G[j])||inside(G[j],G[i])) continue;
  if(vol>0.002) pairs.push({vol:+vol.toFixed(3), o:o.map(v=>+v.toFixed(2)),
    a:size(G[i]).map(v=>+v.toFixed(2)), b:size(G[j]).map(v=>+v.toFixed(2)),
    ac:[+((G[i].min[0]+G[i].max[0])/2).toFixed(1),+((G[i].min[2]+G[i].max[2])/2).toFixed(1)],
    bc:[+((G[j].min[0]+G[j].max[0])/2).toFixed(1),+((G[j].min[2]+G[j].max[2])/2).toFixed(1)]}); }
 pairs.sort((x,y)=>y.vol-x.vol);
 return {groups:G.length, pairs:pairs.slice(0,12), total:pairs.length};
});
console.log(`\nmulti-mesh park assemblies: ${out.groups}`);
console.log(`real furniture-on-furniture intersections (tufts and under-roof containment excluded): ${out.total}`);
for(const q of out.pairs)
 console.log(`   ${JSON.stringify(q.ac)} ${JSON.stringify(q.a)}  x  ${JSON.stringify(q.bc)} ${JSON.stringify(q.b)}   overlap ${JSON.stringify(q.o)} = ${q.vol} m3`);
await b.close();
