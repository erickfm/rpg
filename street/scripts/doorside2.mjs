// Signed door offset, inside vs outside, for all eight rooms.
//
//   OUTSIDE: __ct.doors() gives the declared facade door point.
//            Offset = door − centre of that building's frontage (__frontages).
//   INSIDE:  the ROOM'S OWN DECLARED DOOR, read from `__ct.roomDims()`, which
//            publishes `door: {x, z, nx, nz}` in room-local coordinates — so
//            `door.x` IS the signed offset from the room's centre, with no
//            arithmetic and no guessing at where the floor slab starts.
//
//            It used to measure the "out to the street" SPOT against a floor
//            extent recovered by scanning for flat meshes. Both halves were
//            wrong: the spot is placed for standing room, not on the door
//            centreline, and the scan picked whichever flat mesh was lowest.
//            The result was `insideOffset = 0` for five of eight rooms and a
//            verdict of "centred — undecidable" for all five, so the check
//            reported nothing wrong about rooms whose doors are plainly
//            off-centre — the diner declares `at: -2.6` and the thrift -2.2.
//            GOTCHAS 34: a check can pass because it found nothing to check.
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
  const dims = window.__ct.roomDims ? window.__ct.roomDims() : [];
  const doors = window.__ct.doors ? window.__ct.doors() : [];
  const fronts = globalThis.__frontages || [];
  const res = [];
  // EVERY room the world publishes, not the first eight slabs. The bound was
  // `slab < 8` against a hard-coded list of eight names, and the world has ten
  // rooms now — so tax and thrift fell off the end and the check quietly
  // stopped covering the two rooms this item is actually about. GOTCHAS 34.
  for (const rd of dims) {
    if (!rd.door) { res.push({ room:rd.id, note:'room publishes no door' }); continue; }
    const insideOffset = +rd.door.x.toFixed(2);   // already local: signed from room centre
    res.push({ room:rd.id, insideOffset, roomW:+rd.w.toFixed(1),
               doorAt:[+rd.door.x.toFixed(2), +rd.door.z.toFixed(2)] });
  }
  return { res, doors: doors.map(d=>({ b:d.building, x:+d.point.x.toFixed(2), z:+d.point.z.toFixed(2),
             nx:d.point.nx, nz:d.point.nz })),
           fronts: fronts.map(f=>({ name:f.name, axis:f.axis, c:+((f.loWorld+f.hiWorld)/2).toFixed(2),
             door:+f.doorWorld.toFixed(2), off:+(f.doorWorld-(f.loWorld+f.hiWorld)/2).toFixed(2) })) };
});
const NAME = { bodega:'BODEGA', burger:'BURGER BARN', casino:'GOLDEN ACES', diner:'DINER',
               hotel:'HOTEL ORPHEUS', pawn:'PAWN', tax:'A-1 TAX', thrift:'THRIFT' };
console.log('room       inside offset   outside offset   nrm  verdict');
for (const r of out.res) {
  if (r.note) { console.log(`${r.room.padEnd(10)} ${r.note}`); continue; }
  const fr = out.fronts.find(f => f.name === NAME[r.room]);
  const outside = fr ? fr.off : null;
  // WHICH SIDE OF THE STREET THE BUILDING IS ON DECIDES THE EXPECTED SIGN,
  // and leaving that out is what made this check accuse an innocent room.
  //
  // It used to read: opposite signs = correct, full stop. That is only true
  // for buildings whose facade faces one way. A-1 TAX sits at x = +7 with an
  // outward normal of -1; the THRIFT sits at x = -7 with +1. They are on
  // OPPOSITE SIDES of the street, so the mirror runs the other way and their
  // inside/outside offsets are expected to relate with the opposite sign.
  // The old rule called tax "** SAME SIDE **" and I nearly had its `side: 1`
  // changed on the strength of it - a sign that is correct.
  //
  // The relation the mechanism actually encodes is doorWorldFor's:
  //     worldOffset = side * (localOffset / k),  with side = -normal
  // so sign(outside) must equal -sign(normal) * sign(inside). Checked against
  // both verified rooms: thrift normal +1, inside -2.2, outside +2.43; tax
  // normal -1, inside -4.2, outside -4.63. Both satisfy it.
  const dr = out.doors.find(q => q.b === NAME[r.room]);
  const fAxis = fr ? fr.axis : null;
  const normal = !dr ? null : (fAxis === 'x' ? dr.nz : dr.nx);
  const expect = normal === null || !normal ? null : -Math.sign(normal) * Math.sign(r.insideOffset);
  const verdict = outside === null ? 'no frontage published'
    : (Math.abs(r.insideOffset) < 0.05 || Math.abs(outside) < 0.05) ? 'centred — undecidable'
      : expect === null ? 'no door normal published'
        : (Math.sign(outside) === expect ? 'mirrors correctly' : '** DOES NOT MIRROR **');
  const nStr = normal === null ? ' ?' : (normal > 0 ? '+1' : '-1');
  console.log(`${r.room.padEnd(10)} ${String(r.insideOffset).padStart(9)}   ${String(outside).padStart(9)}   ${nStr}   ${verdict}`);
}
writeFileSync('shots/doorside2.json', JSON.stringify(out,null,2));
await b.close();
