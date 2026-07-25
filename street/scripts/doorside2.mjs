// Signed door offset, inside vs outside, for all eight rooms.
//
//   OUTSIDE: __ct.doors() gives the declared facade door point.
//            Offset = door − centre of that building's frontage (__frontages).
//   INSIDE:  the room's "out to the street" spot sits in the interior doorway.
//            Offset = spot − centre of the room's own floor extent.
//
// A room and its facade are two faces of one wall, so these must have OPPOSITE
// signs. Same sign = the door is on the same hand from both sides, which is the
// defect mirror-walk exists to catch and which it only covered in 3 of 8 rooms.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p);
await p.waitForTimeout(900);
const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const ROOMS = ['bodega','burger','casino','diner','hotel','pawn','tax','thrift'];
  // room floor extents, per 80 m slab
  const floors = {};
  s.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); if(!g.boundingBox) return;
    const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx=(bb.min.x+bb.max.x)/2; if (cx < 400) return;
    if (bb.max.y-bb.min.y > 0.25) return;                    // flat
    const w=bb.max.x-bb.min.x, d=bb.max.z-bb.min.z;
    if (w < 3 || d < 3) return;
    const slab = Math.floor((cx-400)/80); if (slab<0||slab>7) return;
    const cur = floors[slab];
    if (!cur || bb.min.y < cur.y) floors[slab] = { y:bb.min.y, x0:bb.min.x, x1:bb.max.x, z0:bb.min.z, z1:bb.max.z };
  });
  const ways = window.__ct.spots().filter(sp => /out to the street/i.test(sp.label||'') && sp.x > 400);
  const doors = window.__ct.doors ? window.__ct.doors() : [];
  const fronts = globalThis.__frontages || [];
  const res = [];
  for (let slab=0; slab<8; slab++) {
    const f = floors[slab]; if (!f) continue;
    const w = ways.filter(q => Math.floor((q.x-400)/80) === slab)[0];
    if (!w) { res.push({ room:ROOMS[slab], note:'no way-out spot' }); continue; }
    const roomCentreX = (f.x0+f.x1)/2;
    const insideOffset = +(w.x - roomCentreX).toFixed(2);       // along the room's width
    res.push({ room:ROOMS[slab], insideOffset, roomW:+(f.x1-f.x0).toFixed(1), wayOut:[+w.x.toFixed(2),+w.z.toFixed(2)] });
  }
  return { res, doors: doors.map(d=>({ b:d.building, x:+d.point.x.toFixed(2), z:+d.point.z.toFixed(2) })),
           fronts: fronts.map(f=>({ name:f.name, axis:f.axis, c:+((f.loWorld+f.hiWorld)/2).toFixed(2),
             door:+f.doorWorld.toFixed(2), off:+(f.doorWorld-(f.loWorld+f.hiWorld)/2).toFixed(2) })) };
});
const NAME = { bodega:'BODEGA', burger:'BURGER BARN', casino:'GOLDEN ACES', diner:'DINER',
               hotel:'HOTEL ORPHEUS', pawn:'PAWN', tax:'A-1 TAX', thrift:'THRIFT' };
console.log('room       inside offset   outside offset   signs');
for (const r of out.res) {
  if (r.note) { console.log(`${r.room.padEnd(10)} ${r.note}`); continue; }
  const fr = out.fronts.find(f => f.name === NAME[r.room]);
  const outside = fr ? fr.off : null;
  // Math.sign(0) === -Math.sign(0) is true, so a centred door on either side
  // was being reported as "correct". Test centredness FIRST.
  const verdict = outside === null ? 'no frontage published'
    : (Math.abs(r.insideOffset) < 0.05 || Math.abs(outside) < 0.05) ? 'centred — undecidable'
      : (Math.sign(r.insideOffset) === -Math.sign(outside) ? 'OPPOSITE — correct' : '** SAME SIDE **');
  console.log(`${r.room.padEnd(10)} ${String(r.insideOffset).padStart(9)}   ${String(outside).padStart(9)}      ${verdict}`);
}
writeFileSync('shots/doorside2.json', JSON.stringify(out,null,2));
await b.close();
