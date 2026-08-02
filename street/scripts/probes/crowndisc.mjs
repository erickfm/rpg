// B's fix for "the tree is transparent when you look up through it" was a LEVEL
// CROWN DISC facing down, because boards spun on Y alone are edge-on from
// below. So the structural question is simply: which canopies have one?
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const s=window.__ct.scene(); s.updateMatrixWorld(true);
 const leaves=[];
 s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
  if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
  const cy=(bb.min.y+bb.max.y)/2; if(cy<3.0||cy>13) return;
  const m=Array.isArray(o.material)?o.material[0]:o.material; if(!m||!m.color) return;
  const c=m.color; if(!(c.g>=c.r&&c.g>=c.b)) return;
  const w=bb.max.x-bb.min.x, h=bb.max.y-bb.min.y, d=bb.max.z-bb.min.z;
  if(Math.max(w,d)<0.8) return;
  leaves.push({x:(bb.min.x+bb.max.x)/2,z:(bb.min.z+bb.max.z)/2,y:cy,
               flat:h<0.25&&Math.min(w,d)>0.8}); });
 const cl=[];
 for(const L of leaves){ const f=cl.find(c=>Math.hypot(c.x-L.x,c.z-L.z)<3.0);
   if(f){ f.n++; f.flat+=L.flat?1:0; f.x=(f.x*(f.n-1)+L.x)/f.n; f.z=(f.z*(f.n-1)+L.z)/f.n; }
   else cl.push({x:L.x,z:L.z,n:1,flat:L.flat?1:0}); }
 return cl.filter(c=>c.n>=2).map(c=>({x:+c.x.toFixed(1),z:+c.z.toFixed(1),n:c.n,flat:c.flat})); });
const street=r.filter(c=>c.x>-15&&c.x<15), park=r.filter(c=>c.x<=-15);
const rep=(label,a)=>{ const withDisc=a.filter(c=>c.flat>0).length;
  console.log(`  ${label.padEnd(22)} ${String(a.length).padStart(3)} canopies, ${String(withDisc).padStart(3)} with a level crown disc  (${a.length?Math.round(100*withDisc/a.length):0}%)`); };
console.log(`\ncanopies found: ${r.length}`);
rep('street (|x| < 15)', street);
rep('park (x <= -15)', park);
console.log(`\n  park canopies without a disc:`);
for(const c of park.filter(c=>!c.flat).slice(0,8)) console.log(`    (${c.x}, ${c.z})  ${c.n} leaf meshes, 0 flat`);
await b.close();
