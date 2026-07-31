import { chromium } from 'playwright';
import { reportWorld } from '../scripts/lib/which-world.mjs';
const URL='http://localhost:4391/';
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1280,height:720}});
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(2200);
// E's claim: four piers at z -85.5 / -82.9 / -76.1 / -73.5, three stages 0.92/0.76/0.60
console.log(JSON.stringify(await p.evaluate(()=>{
  const out=[]; const V=window.THREE? null:null;
  window.__ct.scene().traverse(o=>{
    if(!o.isMesh||!o.geometry) return;
    const g=o.geometry; if(g.type!=='BoxGeometry') return;
    o.updateWorldMatrix(true,false);
    const pos=o.getWorldPosition(new o.position.constructor());
    if(pos.x>-2&&pos.x<12&&pos.z<-70&&pos.z>-90&&pos.y>0.5&&pos.y<16){
      const pr=g.parameters;
      out.push({w:+pr.width.toFixed(2),h:+pr.height.toFixed(2),d:+pr.depth.toFixed(2),
        x:+pos.x.toFixed(2),y:+pos.y.toFixed(2),z:+pos.z.toFixed(2)});
    }});
  // keep the pier-like ones: tall, narrow, on the front face
  return out.filter(o=>o.h>1.5&&o.w<1.2).sort((a,b)=>a.z-b.z||a.y-b.y).slice(0,20);
}), null, 0));
await b.close();
