// If the figures billboard to the camera, their authored facing must live in
// WHICH ATLAS FRAME they show, not in the transform. Read the map offset.
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
const read = () => p.evaluate(() => {
  const out=[];
  window.__ct.scene().traverse(o=>{
    if(!o.isMesh||!o.geometry?.parameters) return;
    const g=o.geometry.parameters, w=g.width??0, h=g.height??0;
    if(!(w>0.9&&w<1.0&&h>1.8&&h<2.0)) return;
    const v=o.position.clone(); o.getWorldPosition(v);
    if(v.x<400) return;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    const t=m?.map;
    out.push({x:+v.x.toFixed(1),
      off: t?.offset ? `${t.offset.x.toFixed(3)},${t.offset.y.toFixed(3)}` : 'none',
      rep: t?.repeat ? `${t.repeat.x.toFixed(3)},${t.repeat.y.toFixed(3)}` : 'none',
      img: t?.image ? `${t.image.width}x${t.image.height}` : 'none'});
  });
  return out.sort((a,c)=>a.x-c.x);
});
const A = await read();
await p.evaluate(()=>window.__ct.warp(760, 3.0, 1.6, 0, 0));
await p.waitForTimeout(1200);
await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));  // HOOK.LATE: the sprite carries the PREVIOUS frame
const B = await read();
console.log('  room x    atlas      offset @camA      offset @camB     frame changed?');
for(let i=0;i<A.length;i++)
  console.log(`  ${String(A[i].x).padStart(7)}  ${A[i].img.padEnd(9)} ${A[i].off.padEnd(16)} ${B[i].off.padEnd(15)}  ${A[i].off!==B[i].off?'YES':'no'}`);
await b.close();
