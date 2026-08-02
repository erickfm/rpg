// B claims "156 ramp-band vertices at each corner against the bodega control's
// 207". groundAt says the walkable surface steps 0 -> 0.140 with nothing
// between. Those can BOTH be true: a bevel you can see and a ground function
// that does not follow it. Count vertices at intermediate heights directly, and
// use B's own control so the number means something.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(process.env.SHOT_URL||'http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2000);
const count=(x0,x1,z0,z1)=>p.evaluate(([x0,x1,z0,z1])=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true);
  let ramp=0, low=0, high=0; const hs=new Set();
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    const pos=o.geometry.attributes&&o.geometry.attributes.position; if(!pos) return;
    const m=o.matrixWorld.elements;
    for(let i=0;i<pos.count;i++){
      const X=pos.getX(i), Y=pos.getY(i), Z=pos.getZ(i);
      const wx=m[0]*X+m[4]*Y+m[8]*Z+m[12];
      const wy=m[1]*X+m[5]*Y+m[9]*Z+m[13];
      const wz=m[2]*X+m[6]*Y+m[10]*Z+m[14];
      if(wx<x0||wx>x1||wz<z0||wz>z1) continue;
      if(wy>0.02&&wy<0.125){ ramp++; hs.add(wy.toFixed(3)); }
      else if(wy<=0.02&&wy>=-0.01) low++;
      else if(wy>=0.125&&wy<0.20) high++; }});
  return {ramp,low,high,levels:hs.size}; },[x0,x1,z0,z1]);
const A=await count(52.0,56.0,-109.5,-105.0);
const B2=await count(52.0,56.0,-101.0,-96.5);
const C=await count(6.0,11.0,-98.0,-92.0);      // the bodega corner, B's control
console.log(`\n                       ramp-band verts   distinct heights   at 0    at kerb top`);
console.log(`  crossing, south corner   ${String(A.ramp).padStart(6)}         ${String(A.levels).padStart(6)}      ${String(A.low).padStart(6)}   ${String(A.high).padStart(6)}`);
console.log(`  crossing, north corner   ${String(B2.ramp).padStart(6)}         ${String(B2.levels).padStart(6)}      ${String(B2.low).padStart(6)}   ${String(B2.high).padStart(6)}`);
console.log(`  bodega corner (control)  ${String(C.ramp).padStart(6)}         ${String(C.levels).padStart(6)}      ${String(C.low).padStart(6)}   ${String(C.high).padStart(6)}`);
await b.close();
