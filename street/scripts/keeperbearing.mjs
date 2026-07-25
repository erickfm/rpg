// READ AUTHORED FACING THROUGH THE ATLAS FRAME.
//
// The interior figures billboard, so mesh rotation is the camera's, not theirs
// (proved in billboardtest.mjs: every yaw moved when the camera did). But the
// frame their material shows DOES encode facing: a 160x128 atlas, 5 columns,
// picked from the angle between authored facing and the viewer.
//
// So stand at the SAME RELATIVE BEARING from every keeper — 3 m to +x — and
// compare frames. Same authored facing gives the same frame; a different frame
// means a different facing. This is the fix's own test ("stand where a player
// stands and ask whether it is looking at you") made external.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(URL,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p,URL);

const keepers = await p.evaluate(() => {
  const out=[]; const rooms=(typeof window.__ct.roomDims==='function'?window.__ct.roomDims():window.__ct.roomDims)||[];
  window.__ct.scene().traverse(o=>{
    if(!o.isMesh||!o.geometry?.parameters) return;
    const g=o.geometry.parameters,w=g.width??0,h=g.height??0;
    if(!(w>0.9&&w<1.0&&h>1.8&&h<2.0)) return;
    const v=o.position.clone(); o.getWorldPosition(v);
    if(v.x<400) return;
    const rm=rooms.find(r=>Math.abs(r.cx-v.x)<=r.w/2+1.5);
    out.push({room:rm?rm.id:'?', x:+v.x.toFixed(2), z:+v.z.toFixed(2)});
  });
  return out.sort((a,c)=>a.x-c.x);
});

// VERIFY THE CAMERA LANDED. warp can be refused or slid by collision, and a
// refused warp leaves the camera where it was — so the frame you read is from
// the PREVIOUS bearing, silently. This showed up as one keeper's reading
// changing between two otherwise identical runs.
const frameAt = async (k, dx, dz) => {
  await p.evaluate(([x,z]) => window.__ct.warp(x, z, 0, 0, 0), [k.x+dx, k.z+dz]);
  await p.waitForTimeout(500);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));  // HOOK.LATE: the sprite carries the PREVIOUS frame
  const at = await p.evaluate(() => window.__ct.pos());
  const off = Math.hypot(at[0] - (k.x+dx), at[2] - (k.z+dz));
  if (off > 0.6) return 'MOVED';   // did not reach the requested bearing
  return p.evaluate(([kx,kz]) => {
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
  }, [k.x, k.z]);
};

console.log('  room       frame @ +x    frame @ -x    frame @ +z    frame @ -z');
const rows=[];
for (const k of keepers) {
  const a=await frameAt(k,3,0), c=await frameAt(k,-3,0), d=await frameAt(k,0,3), e=await frameAt(k,0,-3);
  rows.push({k,a,c,d,e});
  console.log(`  ${k.room.padEnd(10)} ${a.padEnd(13)} ${c.padEnd(13)} ${d.padEnd(13)} ${e}`);
}
const sig=r=>`${r.a}|${r.c}|${r.d}|${r.e}`;
const groups=new Map();
for(const r of rows){ const s=sig(r); if(!groups.has(s)) groups.set(s,[]); groups.get(s).push(r.k.room); }
console.log(`\ndistinct facing signatures: ${groups.size}`);
for(const [s,v] of groups) console.log(`   ${s}   ← ${v.join(', ')}`);
await b.close();
