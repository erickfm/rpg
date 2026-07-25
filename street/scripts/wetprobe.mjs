// Does clock(14) actually make the world wet, and how long does it take?
import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4184/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
const road = () => p.evaluate(()=>{
  let best=null;
  window.__ct.scene().traverse(o=>{
    if(!o.isMesh||!o.geometry?.parameters) return;
    const g=o.geometry.parameters;
    const w=g.width??0, h=g.height??0;
    // the road deck: a very large plane near z<0, y about 0
    if(w>8 && h>50){ const v=o.position.clone(); o.getWorldPosition(v);
      if(Math.abs(v.x)<6 && Math.abs(v.y)<0.5){ const m=Array.isArray(o.material)?o.material[0]:o.material;
        if(m?.color) best={w,h,y:+v.y.toFixed(2),lum:+(0.2126*m.color.r+0.7152*m.color.g+0.0722*m.color.b).toFixed(4)}; } }
  });
  return best;
});
for (const h of [13,14]) {
  await p.evaluate(hh=>window.__ct.clock(hh), h);
  const seq=[];
  for (let i=0;i<8;i++){ await p.waitForTimeout(2000); const r=await road(); seq.push(r?r.lum:null); }
  console.log(`hour ${h}: road lum over 16s -> ${seq.join(' ')}`);
}
await b.close();
