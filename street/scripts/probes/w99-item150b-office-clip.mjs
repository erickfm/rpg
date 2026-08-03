#!/usr/bin/env node
// ITEM 150b — DOES THE OFFICE FIGURE ACTUALLY CLIP HIS CHAIR?
//
//   *"[screenshot] fix this"* — an office interior with filing cabinets and a
//   corkboard, where a figure clips a chair.
//
// The room is the TAX OFFICE (`ct/int-tax.ts` — the filing-cabinet run at :142
// and the cork pinboard at :277 are both there and nowhere else together).
//
// Its preparer is deliberately STANDING, not seated — `int-tax.ts:268` says the
// atlas has no sitting view and *"faking a sit by sinking the sprite into the
// floor would cut his legs off at the shin"*. He is placed at `PREP_CZ − 0.30`,
// *"stood behind his chair"*. So the question is not the item-93 seated-pose
// family at all: it is whether 0.30 m is enough clearance behind a chair whose
// backrest also sits behind its centre.
//
// MEASURED, NOT REASONED: the figure's world AABB against every chair mesh's
// world AABB, and the overlap on each axis. A citizen plane is a billboard, so
// its depth is thin and its FACING matters — the overlap is reported per axis
// rather than as one number, because "he stands inside the backrest" and "he
// stands too close" are different faults with different fixes.
//
// POPULATION FLOOR: the room must yield at least one citizen and at least two
// chairs (the preparer's and the client's, `int-tax.ts:418`). Otherwise exit 3.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w99-item150b-office-clip.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const out = await p.evaluate(() => {
  const dimsRaw = window.__ct.roomDims();
  const dims = Array.isArray(dimsRaw) ? dimsRaw : Object.values(dimsRaw);
  // roomDims entries are { id, w, d, cx, cz } — a CENTRE AND A SIZE, not a box.
  const tax = dims.find((r) => (r.id ?? '') === 'tax');
  if (!tax) return { error: 'no room id "tax"', ids: dims.map((r) => r.id) };
  const R = { x0: tax.cx - tax.w / 2, x1: tax.cx + tax.w / 2,
              z0: tax.cz - tax.d / 2, z1: tax.cz + tax.d / 2 };

  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const box = (o) => {
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return null;
    return g.boundingBox.clone().applyMatrix4(o.matrixWorld);
  };
  const inRoom = (bb) => {
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    return cx >= R.x0 && cx <= R.x1 && cz >= R.z0 && cz <= R.z1;
  };

  const people = [], furniture = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const bb = box(o); if (!bb || !inRoom(bb)) return;
    const rec = {
      x0: +bb.min.x.toFixed(3), x1: +bb.max.x.toFixed(3),
      y0: +bb.min.y.toFixed(3), y1: +bb.max.y.toFixed(3),
      z0: +bb.min.z.toFixed(3), z1: +bb.max.z.toFixed(3),
    };
    // the kit stamps every citizen; int-casino.ts's own comment records the one
    // time a room forgot and five figures went invisible to every people-sweep
    let cit = false;
    for (let q = o; q; q = q.parent) if (q.userData && q.userData.citizen) { cit = true; break; }
    if (cit) people.push({ ...rec, seated: !!(o.userData && o.userData.seated) });
    // a chair: knee-to-shoulder height, small footprint, not the floor or a wall
    else {
      const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, h = bb.max.y - bb.min.y;
      if (bb.min.y < 1.1 && bb.max.y > 0.35 && w < 1.2 && d < 1.2 && h > 0.03) {
        furniture.push({ ...rec, w: +w.toFixed(3), d: +d.toFixed(3), h: +h.toFixed(3) });
      }
    }
  });
  return { room: R, people, furniture };
});

if (out.error) { console.log(`EXIT 3 — ${out.error}; ids: ${JSON.stringify(out.ids)}`); await b.close(); process.exit(3); }
console.log(`tax office x ${out.room.x0.toFixed(2)}..${out.room.x1.toFixed(2)}  z ${out.room.z0.toFixed(2)}..${out.room.z1.toFixed(2)}`);
console.log(`citizen meshes in it: ${out.people.length}   candidate furniture boxes: ${out.furniture.length}`);
if (out.people.length < 1 || out.furniture.length < 2) {
  console.log('EXIT 3 — population floor: need >= 1 citizen and >= 2 furniture boxes. Measuring nothing.');
  await b.close(); process.exit(3);
}

const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
let worst = null, clips = 0;
for (const person of out.people) {
  console.log(`\nfigure  x ${person.x0}..${person.x1}  y ${person.y0}..${person.y1}  z ${person.z0}..${person.z1}`
    + `  ${person.seated ? '(seated)' : '(standing)'}`);
  const near = out.furniture
    .map((f) => ({ f, dx: ov(person.x0, person.x1, f.x0, f.x1), dy: ov(person.y0, person.y1, f.y0, f.y1), dz: ov(person.z0, person.z1, f.z0, f.z1) }))
    .filter((q) => q.dx > -0.4 && q.dz > -0.4)
    .sort((a, z) => (Math.min(z.dx, z.dy, z.dz)) - (Math.min(a.dx, a.dy, a.dz)));
  for (const q of near.slice(0, 5)) {
    const solidOverlap = q.dx > 0 && q.dy > 0 && q.dz > 0;
    const pen = solidOverlap ? Math.min(q.dx, q.dy, q.dz) : 0;
    console.log(`   box ${q.f.w}x${q.f.h}x${q.f.d} at y ${q.f.y0}..${q.f.y1}`
      + `   overlap  x ${q.dx.toFixed(3)}  y ${q.dy.toFixed(3)}  z ${q.dz.toFixed(3)}`
      + `   ${solidOverlap ? `INTERSECTS by ${pen.toFixed(3)} m` : 'clear'}`);
    if (solidOverlap) { clips++; if (!worst || pen > worst.pen) worst = { pen, q, person }; }
  }
}

console.log(`\nfigure/furniture intersections in this room: ${clips}`);
if (worst) console.log(`  deepest: ${worst.pen.toFixed(3)} m`);
await b.close();
console.log(`\n${clips === 0 ? 'PASS — no figure intersects furniture here.' : `FAIL — ${clips} intersection(s).`}`);
process.exit(clips === 0 ? 0 : 1);
