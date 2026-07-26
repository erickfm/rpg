// Which meshes sit in a given xz box, with their world position and the ground
// under them. Written because footpaint said 26 figures were 14 cm INTO the
// sidewalk and a gap number does not tell you WHAT is sunk.
//   node scripts/whofig.mjs                 # the -9.2,-13 cluster
//   BOX=x,z,r node scripts/whofig.mjs
import {chromium} from 'playwright';
const [cx,cz,r]=(process.env.BOX??'-9.2,-13,2.5').split(',').map(Number);
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL??'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction('!!window.__ct',{timeout:60000}); await p.waitForTimeout(2500);
const r2=await p.evaluate(([cx,cz,r])=>{ const out=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh) return;
  o.updateWorldMatrix(true,false); const e=o.matrixWorld.elements;
  const x=e[12],y=e[13],z=e[14];
  if(Math.abs(x-cx)<=r && Math.abs(z-cz)<=r){
   const g=o.geometry?.parameters||{};
   const names=[]; for(let q=o;q;q=q.parent) if(q.name) names.push(q.name);
   out.push({n:o.name||'(anon)', chain:names.join(' < ')||'(unnamed chain)',
    x:+x.toFixed(2), y:+y.toFixed(2), z:+z.toFixed(2),
    h:g.height??null, w:g.width??null, gy:+window.__ct.groundAt(x,z).toFixed(3)}); }});
 return out; },[cx,cz,r]);
console.log(`${r2.length} meshes within ${r} m of (${cx}, ${cz})`);
for(const o of r2) console.log(` y=${String(o.y).padStart(6)} ground=${o.gy}  ${o.w}x${o.h}  ${o.chain}`);
await b.close();
