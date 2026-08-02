// M's bank: "14 x 12 m at 3.6 m, the tallest interior in the world", a 10.8 m
// teller line with three windows (window 3 closed), and a vault you can walk
// into with a 0.30 m door standing open at 100 degrees.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:700}});
await p.goto(aim('http://localhost:4184/'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await afterFrames(p,10); await p.waitForTimeout(1200);
await p.evaluate(()=>window.__ct.clock(13,0)); await afterFrames(p,5);
const dims=await p.evaluate(()=>window.__ct.roomDims());
const bank=dims.find(r=>r.id==='bank');
if(!bank){ console.error('CANNOT ANSWER — no room with id "bank".'); process.exit(3); }
console.log(`\nbank by id: cx ${bank.cx}, cz ${bank.cz}, ${bank.w} x ${bank.d} m`);
// ceiling height, and is it the tallest?
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[bank.cx,bank.cz]); await p.waitForTimeout(400);
const heights=await p.evaluate((ds)=>ds.map(r=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); let top=0;
  s.traverse(o=>{ if(!o.isMesh||!o.geometry) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2, cz=(bb.min.z+bb.max.z)/2;
    if(Math.abs(cx-r.cx)>r.w/2||Math.abs(cz-r.cz)>r.d/2) return;
    if(bb.max.y>top&&bb.max.y<12) top=bb.max.y; });
  return {id:r.id, top:+top.toFixed(2)}; }).sort((a,b)=>b.top-a.top), dims);
console.log(`tallest interiors by highest mesh:`);
for(const h of heights.slice(0,4)) console.log(`   ${h.id.padEnd(8)} ${h.top} m`);
console.log(`   bank is ${heights[0].id==='bank'?'the TALLEST':'ranked '+(heights.findIndex(h=>h.id==='bank')+1)}`);
// spots inside
const spots=await p.evaluate(([cx,cz,w,d])=>window.__ct.spots()
  .filter(s=>Math.abs(s.x-cx)<w/2+2&&Math.abs(s.z-cz)<d/2+2)
  .map(s=>({l:s.label,x:+s.x.toFixed(2),z:+s.z.toFixed(2),ok:s.ok})), [bank.cx,bank.cz,bank.w,bank.d]);
console.log(`\nspots inside the bank: ${spots.length}`);
for(const s of spots) console.log(`   (${s.x}, ${s.z}) ok=${s.ok}  "${s.l}"`);
// walk it
const shot=async(n,x,z,yaw,pi)=>{
  await p.evaluate(([x,z,y,pi])=>window.__ct.warp(x,z,y,window.__ct.groundAt(x,z),pi),[x,z,yaw,pi]);
  await afterFrames(p,5); const g=await p.evaluate(()=>window.__ct.pos().map(v=>+v.toFixed(2)));
  await p.screenshot({path:`shots/bank-${n}.png`});
  console.log(`   bank-${n}.png at (${g[0]}, ${g[2]})`); };
console.log(`\nstations:`);
// yaw 0 looks along -z. The door is at +z, so Math.PI faced the ENTRANCE and my
// 'tellers' shot photographed the way I had come in.
await shot('hall',    bank.cx,     bank.cz+4.5, 0,          -0.02);
await shot('tellers', bank.cx,     bank.cz+1.0, 0,           0.02);
await shot('vault',   bank.cx-3.0, bank.cz-2.0, -Math.PI/2,  0.02);
await shot('officer', bank.cx+3.0, bank.cz-2.0,  Math.PI/2,  0.02);
await b.close();
