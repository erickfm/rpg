// SUPERSEDED BY 64c13034b's decode, which is canonical and covers all nine
// sprites. This script produced a WRONG table once (dba3c355e) by reading a
// stale frame, and is fixed, but the published decode is the one to trust.
// Kept as a worked example of the frame yield that fix required.
// APPLY THE PUBLISHED DECODE TO THE FOUR ROOMS IT DID NOT COVER.
//
// 64c13034b decoded keeper facing exactly using the atlas layout 1aa7a871
// published: mirror = repeat.x < 0, col = offset.x*5 - (mirror?1:0), and
// [col,mirror] -> sector is a bijection over eight sectors, so one reading from
// a known bearing pins the authored facing to +-22.5 degrees. It verified
// casino, hotel, tax and pawn -- its own four. bodega, burger, diner and thrift
// belong to another agent and were not covered.
//
// Sector 0 means "looking at the viewer". So sampling from a known bearing gives
// the authored facing directly, and I can ask what that direction runs into.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto(URL,{waitUntil:'networkidle'});
await p.waitForFunction(()=>window.__ct!==undefined,{timeout:15000});
await reportWorld(p,URL);

const keepers = await p.evaluate(() => {
  const rooms=(typeof window.__ct.roomDims==='function'?window.__ct.roomDims():window.__ct.roomDims)||[];
  const out=[];
  window.__ct.scene().traverse(o=>{
    if(!o.isMesh||!o.geometry?.parameters) return;
    const g=o.geometry.parameters,w=g.width??0,h=g.height??0;
    if(!(w>0.9&&w<1.0&&h>1.8&&h<2.0)) return;
    const v=o.position.clone(); o.getWorldPosition(v);
    if(v.x<400) return;
    const rm=rooms.find(r=>Math.abs(r.cx-v.x)<=r.w/2+1.5);
    if(rm) out.push({room:rm.id,x:+v.x.toFixed(2),z:+v.z.toFixed(2),cx:rm.cx,cz:rm.cz,w:rm.w,d:rm.d});
  });
  return out.sort((a,c)=>a.room.localeCompare(c.room));
});

const read = async (k, R) => {
  // stand due +z of the keeper: a known bearing, and inside the room for all of them
  const cx=k.x, cz=k.z+R;
  await p.evaluate(([x,z])=>window.__ct.warp(x,z,0,0,0),[cx,cz]);
  // WARP, THEN WAIT, THEN READ. 32cb7bd76: citizenSprite updates from
  // ctx.onFrame(HOOK.LATE), so the texture carries the PREVIOUS frame's player
  // position. A probe that warps and reads without yielding gets the sector from
  // wherever it stood before -- deterministically, so it looks stable.
  await p.waitForTimeout(450);
  await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.waitForTimeout(120);
  const at=await p.evaluate(()=>window.__ct.pos());
  if (Math.hypot(at[0]-cx, at[2]-cz) > 0.25) return null;      // a warp is a request, not a fact
  return p.evaluate(([kx,kz])=>{
    let r=null;
    window.__ct.scene().traverse(o=>{
      if(!o.isMesh||!o.geometry?.parameters) return;
      const g=o.geometry.parameters,w=g.width??0,h=g.height??0;
      if(!(w>0.9&&w<1.0&&h>1.8&&h<2.0)) return;
      const v=o.position.clone(); o.getWorldPosition(v);
      if(Math.abs(v.x-kx)>0.1||Math.abs(v.z-kz)>0.1) return;
      const m=Array.isArray(o.material)?o.material[0]:o.material;
      if(m?.map) r={off:m.map.offset.x, mir:m.map.repeat.x<0};
    });
    return r;
  },[k.x,k.z]);
};

console.log('  room       col  mir  sector   facing        runs into');
for (const k of keepers) {
  let s=null;
  for (const R of [1.6, 1.2, 2.0, 0.9]) { s = await read(k,R); if(s) break; }
  if(!s){ console.log(`  ${k.room.padEnd(10)} — could not reach a clean bearing`); continue; }
  const col = Math.round(s.off*5) - (s.mir?1:0);
  const sector = s.mir ? (8-col)%8 : col;             // mirrored columns are the far half
  // viewer sat at +z; sector 0 = looking at the viewer, i.e. facing +z.
  const ang = sector * Math.PI/4;                     // rotate away from +z
  const fx = Math.sin(ang), fz = Math.cos(ang);
  // how far to the room wall along that direction
  // march the real colliders along the decoded facing, not the room's bounding
  // box -- the box is arithmetic, a collider is the thing you walk into
  const dist = await p.evaluate(([kx,kz,dx,dz])=>{
    const cols = window.__ct.colliders().filter(c=>c&&isFinite(c.minX));
    const hit=(x,z)=>cols.find(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);
    const own=hit(kx,kz);
    const same=c=>own&&c.minX===own.minX&&c.minZ===own.minZ;
    for(let d=0.15;d<10;d+=0.05){ const c=hit(kx+dx*d, kz+dz*d); if(c&&!same(c)) return +d.toFixed(2); }
    return 10;
  },[k.x,k.z,fx,fz]);
  console.log(`  ${k.room.padEnd(10)} ${String(col).padStart(3)}  ${(s.mir?'yes':'no ').padStart(3)}  ` +
    `${String(sector).padStart(6)}   ${(sector===0?'at you':`${sector*45}°`).padEnd(12)}  ${dist.toFixed(2)} m of room`);
}
await b.close();
