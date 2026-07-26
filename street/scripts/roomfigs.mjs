// Where is a room's keeper, actually? Station names promise a figure; framing
// has to deliver one. P14 was called 'diner-keeper', pointed at the CASINO, and
// once re-aimed at the diner still framed no figure at all.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await p.waitForTimeout(2500);
const room=process.env.ROOM??'diner';
const d=await p.evaluate((r)=>window.__ct.roomDims().find(q=>q.id===r),room);
await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[d.cx,d.cz]); await p.waitForTimeout(500);
const figs=await p.evaluate(([cx,cz,w,dd])=>{
  const s=window.__ct.scene(); s.updateMatrixWorld(true); const o=[];
  s.traverse(m=>{ if(!m.isMesh||!m.geometry||!m.visible) return;
    const mm=Array.isArray(m.material)?m.material[0]:m.material; const map=mm&&mm.map;
    if(!map||!map.repeat) return; const ry=Math.abs(map.repeat.y); if(ry>0.9||ry<1e-6) return;
    if(!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb=m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    if(bb.max.y-bb.min.y<1.2) return;
    const x=(bb.min.x+bb.max.x)/2, z=(bb.min.z+bb.max.z)/2;
    if(Math.abs(x-cx)>w/2+1||Math.abs(z-cz)>dd/2+1) return;
    o.push({x:+x.toFixed(2),z:+z.toFixed(2),base:+bb.min.y.toFixed(2),top:+bb.max.y.toFixed(2)}); });
  return o; },[d.cx,d.cz,d.w,d.d]);
console.log(`${room}: centre (${d.cx}, ${d.cz}), ${d.w} x ${d.d}`);
console.log(`figures: ${figs.length}`);
for(const f of figs) console.log(`   (${f.x}, ${f.z})  base ${f.base}  top ${f.top}`);
await b.close();
