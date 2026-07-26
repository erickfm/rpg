// "all buildings need to be much deeper otherwise it looks like a fake building"
// The row names two shells that went 3.4 -> 14 m. But the request says ALL, so
// measure every building mass in the world and report the SHALLOWEST.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const seen=new Map();
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return;
  o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox,m=o.matrixWorld.elements;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(mn[0]>200) return;                                  // skip the interior belt
  const w=mx[0]-mn[0], h=mx[1]-mn[1], d=mx[2]-mn[2];
  if(h<8) return;                                        // a building mass, not a shopfront
  if(w<4||d<1.5) return;
  const key=`${mn[0].toFixed(1)},${mn[2].toFixed(1)},${w.toFixed(1)},${d.toFixed(1)},${h.toFixed(1)}`;
  if(!seen.has(key)) seen.set(key,{w:+w.toFixed(2),d:+d.toFixed(2),h:+h.toFixed(1),
    x:+mn[0].toFixed(1), z:+mn[2].toFixed(1), foot:+Math.min(w,d).toFixed(2)});
 });
 return [...seen.values()];});
if(!r.length){console.error('CANNOT ANSWER — no building mass matched.');process.exit(3);}
r.sort((a,b)=>a.foot-b.foot);
console.log(`building masses (h >= 8 m): ${r.length}\n`);
console.log('  shallowest dimension   w x d x h        at');
for(const q of r.slice(0,16))
 console.log(`     ${String(q.foot).padStart(6)} m        ${String(q.w).padStart(6)} x ${String(q.d).padStart(6)} x ${String(q.h).padStart(5)}   x ${q.x}, z ${q.z}`);
const shallow=r.filter(q=>q.foot<8);
console.log(`\nmasses with a footprint dimension under 8 m: ${shallow.length} of ${r.length}`);
console.log(`under 5 m (the "fake building" complaint was 3.4 m): ${r.filter(q=>q.foot<5).length}`);
const st=(a)=>{const s=[...a].sort((x,y)=>x-y);return `min ${s[0]} median ${s[s.length>>1]} max ${s[s.length-1]}`;};
console.log(`shallowest-dimension distribution: ${st(r.map(q=>q.foot))}`);
await b.close();
