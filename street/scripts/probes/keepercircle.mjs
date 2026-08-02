// Circle one keeper and read the frame at every bearing.
// Resolves the bodega flag: is its sprite stuck, or did my +-x sampling just
// land badly? Radius kept small so both samples stay well inside the room, and
// the landing tolerance is 0.25 m rather than 0.6 -- a slide smaller than the
// old tolerance is exactly what a wall-adjacent sample does.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import { reportWorld } from '../lib/which-world.mjs';
const URL = aim('http://localhost:4184/');
const ROOM = process.env.ROOM ?? 'bodega';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(URL,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p,URL);
const k = await p.evaluate((room) => {
  const rooms=(typeof window.__ct.roomDims==='function'?window.__ct.roomDims():window.__ct.roomDims)||[];
  const rm=rooms.find(r=>r.id===room); if(!rm) return null;
  let f=null;
  window.__ct.scene().traverse(o=>{
    if(!o.isMesh||!o.geometry?.parameters) return;
    const g=o.geometry.parameters,w=g.width??0,h=g.height??0;
    if(!(w>0.9&&w<1.0&&h>1.8&&h<2.0)) return;
    const v=o.position.clone(); o.getWorldPosition(v);
    if(Math.abs(v.x-rm.cx)>rm.w/2+1.5) return;
    f={x:+v.x.toFixed(2), z:+v.z.toFixed(2), room:rm.id, w:rm.w, d:rm.d, cx:rm.cx, cz:rm.cz};
  });
  return f;
}, ROOM);
if(!k){ console.error('keeper not found'); process.exit(2); }
console.log(`${k.room}: keeper at (${k.x}, ${k.z}), room ${k.w}x${k.d} centred (${k.cx}, ${k.cz})\n`);
console.log('  bearing   camera at        landed?   frame');
const R = Number(process.env.RADIUS ?? 2.0);
for (let i=0;i<8;i++){
  const a = i*Math.PI/4;
  const cx = k.x + Math.cos(a)*R, cz = k.z + Math.sin(a)*R;
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0), [cx,cz]);
  await afterFrames(p);   // GOTCHAS 30 via lib/frames.mjs — two rendered frames, then read
  const at = await p.evaluate(()=>window.__ct.pos());
  const off = Math.hypot(at[0]-cx, at[2]-cz);
  const fr = await p.evaluate(([kx,kz])=>{
    let f='?';
    window.__ct.scene().traverse(o=>{
      if(!o.isMesh||!o.geometry?.parameters) return;
      const g=o.geometry.parameters,w=g.width??0,h=g.height??0;
      if(!(w>0.9&&w<1.0&&h>1.8&&h<2.0)) return;
      const v=o.position.clone(); o.getWorldPosition(v);
      if(Math.abs(v.x-kx)>0.1||Math.abs(v.z-kz)>0.1) return;
      const m=Array.isArray(o.material)?o.material[0]:o.material;
      if(m?.map?.offset) f=m.map.offset.x.toFixed(3)+(m.map.repeat.x<0?'M':' ');
    });
    return f;
  },[k.x,k.z]);
  console.log(`  ${String(i*45).padStart(5)}°   (${cx.toFixed(2)}, ${cz.toFixed(2)})   ` +
    `${off<0.25?'  yes  ':`slid ${off.toFixed(2)}`}   ${off<0.25?fr:'(discarded)'}`);
}
await b.close();
