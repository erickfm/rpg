// "collision is odd in this same corner". A chamfered building with a SQUARE
// collider leaves an invisible wall in the triangle the building cuts away.
// Test: for each point, is it inside a collider, and is there any BUILDING
// above it? Solid with nothing overhead = you bump into air.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{
 const cols=window.__ct.colliders();
 const inside=(x,z)=>cols.some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);
 // footprints of every mesh with real height near the corner
 const solidsAbove=[];
 window.__ct.scene().traverse(o=>{ if(!o.isMesh||!o.geometry)return; o.geometry.computeBoundingBox();
  const bb=o.geometry.boundingBox,m=o.matrixWorld.elements; let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  for(const X of [bb.min.x,bb.max.x])for(const Y of [bb.min.y,bb.max.y])for(const Z of [bb.min.z,bb.max.z]){
   const v=[m[0]*X+m[4]*Y+m[8]*Z+m[12],m[1]*X+m[5]*Y+m[9]*Z+m[13],m[2]*X+m[6]*Y+m[10]*Z+m[14]];
   for(let i=0;i<3;i++){if(v[i]<mn[i])mn[i]=v[i];if(v[i]>mx[i])mx[i]=v[i];}}
  if(mx[1]<1.2||mn[1]>2.0) return;                      // must exist at chest height
  if(mx[0]<4||mn[0]>13||mx[2]<-99||mn[2]>-91) return;
  solidsAbove.push(mn.concat(mx));});
 const covered=(x,z)=>solidsAbove.some(s=>x>=s[0]-0.02&&x<=s[3]+0.02&&z>=s[2]-0.02&&z<=s[5]+0.02);
 const rows=[];
 for(let z=-92.0;z>=-97.0;z-=0.25){ let line='';
  for(let x=5.0;x<=12.0;x+=0.25){ const c=inside(x,z), v=covered(x,z);
   line += c&&v ? '#' : (c&&!v ? '!' : (!c&&v ? 'o' : '.')); }
  rows.push({z:+z.toFixed(2),line});}
 let ghost=0, phantom=0;
 for(const r of rows){ for(const ch of r.line){ if(ch==='!')ghost++; if(ch==='o')phantom++; } }
 return {rows,ghost,phantom,n:solidsAbove.length};});
console.log(`meshes at chest height near the corner: ${r.n}`);
console.log(`\n  # solid AND built   ! SOLID WITH NOTHING THERE (invisible wall)   o built but walkable   . open`);
console.log('                x 5.0 ----------------------> 12.0');
for(const q of r.rows) console.log(`  z ${String(q.z).padStart(6)}  ${q.line}`);
console.log(`\ninvisible wall cells (solid, nothing above): ${r.ghost}`);
console.log(`walk-through cells (built, no collider)   : ${r.phantom}`);
await b.close();
