// SIDEWALK ENCROACHMENT — "in general we should not encroach the already
// cramped sidewalk". The player capsule is 0.72 m across and GOTCHAS 9 calls
// the 2 m lane sacred, so the question is not "does a thing touch the walk" but
// "how much CONTINUOUS free width is left to walk through".
//
// Measured, not eyeballed: at every 0.25 m of z, take the nominal 2.0 m lane,
// subtract every collider interval crossing it, and keep the largest free run.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const STEP=0.25, Z0=-102, Z1=15;
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const out=await p.evaluate(([STEP,Z0,Z1])=>{
 const cols=window.__ct.colliders();
 // name every collider by the scene object that matches its footprint
 const objs=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry) return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements; let mn=[1e9,1e9],mx=[-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12], wz=m[2]*X+m[6]*Y+m[10]*Z+m[14];
   if(wx<mn[0])mn[0]=wx; if(wx>mx[0])mx[0]=wx; if(wz<mn[1])mn[1]=wz; if(wz>mx[1])mx[1]=wz;}
  objs.push({mn,mx,mod:o.userData?.mod,ud:o.userData,name:o.name});});
 const nameOf=(c)=>{ let best=null,bd=1e9;
  for(const o of objs){ const d=Math.abs(o.mn[0]-c.minX)+Math.abs(o.mx[0]-c.maxX)+Math.abs(o.mn[1]-c.minZ)+Math.abs(o.mx[1]-c.maxZ);
   if(d<bd){bd=d;best=o;} }
  if(!best||bd>1.2) return {label:'?',mod:null,d:+bd.toFixed(2)};
  const u=best.ud||{}; const tag=best.name||u.litter||u.atmPart||u.kind||u.prop||Object.keys(u).filter(k=>k!=='mod').join(',')||'?';
  return {label:tag,mod:u.mod||null,d:+bd.toFixed(2)};};
 const LANES=[{side:'west',x0:-7.25,x1:-5.25},{side:'east',x0:5.25,x1:7.25}];
 const rows=[];
 for(const L of LANES){
  for(let z=Z0;z<=Z1;z+=STEP){
   const iv=[];
   for(const c of cols){ if(c.minZ>z||c.maxZ<z) continue;
    const a=Math.max(c.minX,L.x0), bb2=Math.min(c.maxX,L.x1);
    if(bb2>a) iv.push([a,bb2,c]); }
   iv.sort((a,b)=>a[0]-b[0]);
   let cur=L.x0, best=0, bl=null, br=null, lastC=null;
   const consider=(lo,hi,cl,cr)=>{ if(hi-lo>best){best=hi-lo;bl=cl;br=cr;} };
   for(const [a,bb2,c] of iv){ if(a>cur) consider(cur,a,lastC,c); if(bb2>cur){cur=bb2;lastC=c;} }
   if(cur<L.x1) consider(cur,L.x1,lastC,null);
   rows.push({side:L.side,z:+z.toFixed(2),clear:+best.toFixed(3),
     l:bl?nameOf(bl):null, r:br?nameOf(br):null,
     lbox:bl?[bl.minX,bl.maxX,bl.minZ,bl.maxZ]:null, rbox:br?[br.minX,br.maxX,br.minZ,br.maxZ]:null});
  }}
 return rows;},[STEP,Z0,Z1]);
if(!out.length){console.error('CANNOT ANSWER — no lane samples.');process.exit(3);}
const N=out.length;
const bands=[['IMPASSABLE  <0.72',0.72],['URGENT   0.72-0.80',0.80],['PROBLEM  0.80-1.00',1.00],['tight   1.00-1.40',1.40]];
console.log(`lane samples: ${N} (${STEP} m of z, both sides, z ${Z0}..${Z1})\n`);
let prev=0;
for(const [lab,lim] of bands){ const n=out.filter(o=>o.clear<lim&&o.clear>=prev).length;
  console.log(`  ${lab.padEnd(20)} ${String(n).padStart(4)} samples  ${(100*n/N).toFixed(1)}%`); prev=lim;}
console.log(`  ${'clear   >=1.40'.padEnd(20)} ${String(out.filter(o=>o.clear>=1.40).length).padStart(4)} samples`);
// group contiguous runs under 1.0
const bad=[]; let run=null;
for(const o of out.slice().sort((a,b)=>a.side.localeCompare(b.side)||a.z-b.z)){
 if(o.clear<1.0){ if(run&&run.side===o.side&&Math.abs(o.z-run.z1-STEP)<1e-6){run.z1=o.z; if(o.clear<run.min){run.min=o.clear;run.at=o;}}
  else {if(run)bad.push(run); run={side:o.side,z0:o.z,z1:o.z,min:o.clear,at:o};} }
 else { if(run){bad.push(run);run=null;} }}
if(run)bad.push(run);
bad.sort((a,b)=>a.min-b.min);
console.log(`\ncontiguous stretches under 1.00 m: ${bad.length}\n`);
for(const r of bad){
 const a=r.at; const nm=(q)=>q?`${q.label}${q.mod?` [${q.mod}]`:''}`:'kerb/edge';
 console.log(`  ${r.min.toFixed(2)} m  ${r.side.padEnd(4)} z ${r.z0.toFixed(1)}..${r.z1.toFixed(1)} (${(r.z1-r.z0+STEP).toFixed(1)} m long)  between ${nm(a.l)} and ${nm(a.r)}`);
 if(a.lbox) console.log(`        left  x ${a.lbox[0].toFixed(2)}..${a.lbox[1].toFixed(2)}  z ${a.lbox[2].toFixed(1)}..${a.lbox[3].toFixed(1)}`);
 if(a.rbox) console.log(`        right x ${a.rbox[0].toFixed(2)}..${a.rbox[1].toFixed(2)}  z ${a.rbox[2].toFixed(1)}..${a.rbox[3].toFixed(1)}`);
}
await b.close();
