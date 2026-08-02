// Which meshes sit in a given xz box, with their world position and the ground
// under them. Written because footpaint said 26 figures were 14 cm INTO the
// sidewalk and a gap number does not tell you WHAT is sunk.
//   node scripts/whofig.mjs                 # the -9.2,-13 cluster
//   BOX=x,z,r node scripts/whofig.mjs
import { aim } from '../lib/aim.mjs';
import {chromium} from 'playwright';
const [cx,cz,r]=(process.env.BOX??'-9.2,-13,2.5').split(',').map(Number);
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction('!!window.__ct',{timeout:60000}); await p.waitForTimeout(2500);
const r2=await p.evaluate(([cx,cz,r])=>{ const out=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh) return;
  o.updateWorldMatrix(true,false); const e=o.matrixWorld.elements;
  const x=e[12],y=e[13],z=e[14];
  if(Math.abs(x-cx)<=r && Math.abs(z-cz)<=r){
   const g=o.geometry?.parameters||{};
   if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
   const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
   const names=[]; for(let q=o;q;q=q.parent) if(q.name) names.push(q.name);
   out.push({n:o.name||'(anon)', chain:names.join(' < ')||'(unnamed chain)',
    x:+x.toFixed(2), y:+y.toFixed(2), z:+z.toFixed(2),
    h:g.height??null, w:g.width??null,
    bx:[+bb.min.x.toFixed(2),+bb.max.x.toFixed(2)], by:[+bb.min.y.toFixed(2),+bb.max.y.toFixed(2)],
    bz:[+bb.min.z.toFixed(2),+bb.max.z.toFixed(2)]}); }});
 return out; },[cx,cz,r]);
console.log(`${r2.length} meshes within ${r} m of (${cx}, ${cz})`);
r2.sort((a,b)=>a.bx[0]-b.bx[0]);
for(const o of r2) console.log(` x ${String(o.bx[0]).padStart(7)}..${String(o.bx[1]).padStart(7)}  y ${String(o.by[0]).padStart(6)}..${String(o.by[1]).padStart(6)}  z ${String(o.bz[0]).padStart(7)}..${String(o.bz[1]).padStart(7)}`);
await b.close();
