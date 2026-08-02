// Validate the axis mapping by LOOKING, the way the user did. For a room my
// data-method calls correct (DINER) and one it calls wrong (A-1 TAX):
//   inside  — stand mid-room, face the front wall; which side is the doorway?
//   outside — stand mid-frontage, face the building; which side is the door?
// They must disagree. If the DINER pair disagree and the TAX pair agree, my
// mapping is right and TAX is a real finding. If both pairs behave the same,
// my mapping is inverted and the finding dissolves.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const shots = await p.evaluate(async () => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  const ways = window.__ct.spots().filter(q => /out to the street/i.test(q.label||'') && q.x > 400);
  const floors = {};
  s.traverse(o => { if(!o.isMesh||!o.geometry) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox)return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2; if(cx<400) return;
    if (bb.max.y-bb.min.y > 0.25) return;
    if (bb.max.x-bb.min.x < 3 || bb.max.z-bb.min.z < 3) return;
    const slab=Math.floor((cx-400)/80); if(slab<0||slab>7) return;
    if (!floors[slab] || bb.min.y < floors[slab].y)
      floors[slab] = { y:bb.min.y, x0:bb.min.x, x1:bb.max.x, z0:bb.min.z, z1:bb.max.z }; });
  return { ways: ways.map(w=>({x:+w.x.toFixed(2), z:+w.z.toFixed(2), slab:Math.floor((w.x-400)/80)})),
           floors: Object.entries(floors).map(([k,v])=>({slab:+k, x0:+v.x0.toFixed(2), x1:+v.x1.toFixed(2), z0:+v.z0.toFixed(2), z1:+v.z1.toFixed(2)})) };
});
const F = Object.fromEntries(shots.floors.map(f=>[f.slab,f]));
const W = Object.fromEntries(shots.ways.map(w=>[w.slab,w]));
// slab 3 = diner, slab 6 = tax
for (const [slab, tag] of [[5,'pawn'],[0,'bodega']]) {
  const f = F[slab], w = W[slab];
  if (!f || !w) { console.log(`${tag}: missing floor or way-out`); continue; }
  const cx = (f.x0+f.x1)/2;
  // stand mid-room, back from the front wall, facing it. The way-out marks the front.
  const backZ = (Math.abs(w.z - f.z0) > Math.abs(w.z - f.z1)) ? f.z0 : f.z1;
  const standZ = w.z + (backZ - w.z) * 0.55;
  const yaw = Math.atan2(cx - cx, -(w.z - standZ));
  await p.evaluate(([x,z,yaw]) => window.__ct.warp(x,z,yaw,0.14,0.02), [cx, standZ, yaw]);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/dl-${tag}-inside.png` });
  console.log(`${tag} INSIDE  from (${cx.toFixed(2)}, ${standZ.toFixed(2)}) facing the front wall; way-out at x ${w.x} (room x ${f.x0}…${f.x1})`);
}
// …and the street side: stand mid-frontage, back from the facade, facing it.
const fronts = await p.evaluate(() => (globalThis.__frontages||[]).map(f=>({
  name:f.name, axis:f.axis, lo:f.loWorld, hi:f.hiWorld, face:f.facePos, door:f.doorWorld })));
for (const [name, tag] of [['PAWN','pawn'],['BODEGA','bodega']]) {
  const f = fronts.find(q => q.name === name);
  if (!f) { console.log(`${tag} OUTSIDE: no frontage named ${name}`); continue; }
  const c = (f.lo + f.hi) / 2;
  const standX = f.face + (f.face < 0 ? 8.5 : -8.5);      // out from the facade
  const yaw = f.face < 0 ? -Math.PI/2 : Math.PI/2;         // face the building
  await p.evaluate(([x,z,yaw]) => window.__ct.warp(x,z,yaw,0.14,0.04), [standX, c, yaw]);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/dl-${tag}-outside.png` });
  console.log(`${tag} OUTSIDE from (${standX.toFixed(2)}, ${c.toFixed(2)}) facing the facade; door at z ${f.door.toFixed(2)}, frontage centre ${c.toFixed(2)}`);
}
await b.close();
