// w93 / item 92 — the user: *"[screenshot] would love more detail here, also the
// window is misaligned?"* on the church's altar wall.
//
// The desk's account: `ct/int-church.ts` says the rose belongs "at centre" and
// in the frame it is visibly off the crucifix's axis, "so one of the two is
// wrong". THE SOURCE SAYS THEY AGREE — the rose is `room.sign(roseT, 2.4, 3.6,
// 0, 6.6, -hd + 0.09)` and every crucifix part is `put(..., 0, ...)`, and both
// helpers bottom out in the same `place(m, lx, y, lz)` (ct/interior.ts:1788,
// 1828). So either the source is not what is running, or the misalignment is
// not in x, or it is not these two objects. Measure, do not argue.
//
// Reports every mesh standing against the altar wall, with its world x, its
// offset from the ROOM's own centre line, and its y band — so "misaligned"
// can be pinned to an axis and an object instead of a feeling.
//
//   SHOT_URL=http://localhost:4490/ node scripts/probes/w93-item92-eastwall.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4490/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const out = await p.evaluate(() => {
  // ⚠ roomDims() IS AN ARRAY. `dims.church` is undefined and would silently
  // sweep the whole world — the documented trap that cost worker eightyseven.
  const dims = window.__ct.roomDims();
  if (!Array.isArray(dims)) return { err: 'roomDims() is not an array — the trap moved' };
  const ch = dims.find((d) => d.id === 'church');
  if (!ch) return { err: 'no church room in roomDims()' };
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // The altar wall is the room's far end in z. Take a slab of the room one
  // metre deep against it, DERIVED from the published footprint rather than
  // from -hd, which is a local constant this probe would have to retype.
  const zFar = ch.cz - ch.d / 2, zNear = ch.cz + ch.d / 2;
  const band = 1.2;
  const items = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const mx = (bb.min.x + bb.max.x) / 2, mz = (bb.min.z + bb.max.z) / 2;
    if (Math.abs(mx - ch.cx) > ch.w / 2 + 0.5) return;          // inside the room in x
    if (mz > zFar + band || mz < zFar - 0.6) return;            // against the far wall
    const h = bb.max.y - bb.min.y, w = bb.max.x - bb.min.x;
    if (h < 0.05 && w < 0.05) return;
    items.push({
      type: g.type, w: +w.toFixed(3), h: +h.toFixed(3),
      x: +mx.toFixed(4), dx: +(mx - ch.cx).toFixed(4),
      x0: +bb.min.x.toFixed(3), x1: +bb.max.x.toFixed(3),
      y0: +bb.min.y.toFixed(3), y1: +bb.max.y.toFixed(3), z: +mz.toFixed(3),
      col: o.material && o.material.color ? '#' + o.material.color.getHexString() : null,
      hasMap: !!(o.material && o.material.map),
      mapName: o.material && o.material.map && o.material.map.name ? o.material.map.name : null,
    });
  });
  return { ch, zFar, zNear, items };
});

if (out.err) { console.error(out.err); await b.close(); process.exit(3); }
const { ch, items } = out;
console.log(`church room: centre x ${ch.cx} z ${ch.cz}, w ${ch.w} d ${ch.d}`);
console.log(`altar wall at z ${out.zFar.toFixed(2)}; room centre line is x ${ch.cx}\n`);

// POPULATION FLOOR. Every statement below is about this set, and an empty set
// makes "everything is centred" true for free. (GOTCHAS 34.)
if (items.length < 10) {
  console.error(`POPULATION FLOOR: only ${items.length} meshes on the altar wall — nothing measured.`);
  await b.close(); process.exit(3);
}
console.log(`${items.length} meshes against the altar wall, by |offset from the room's centre line|:\n`);
for (const it of items.sort((a, c) => Math.abs(a.dx) - Math.abs(c.dx))) {
  console.log(`  dx ${String(it.dx).padStart(9)}  ${it.type.replace('Geometry', '').padEnd(9)}`
    + ` ${String(it.w).padStart(6)}x${String(it.h).padStart(6)}  y ${String(it.y0).padStart(6)}…${String(it.y1).padStart(6)}`
    + `  z ${String(it.z).padStart(7)}  ${it.hasMap ? 'MAP' : '   '} ${it.col ?? ''}`);
}

const off = items.filter((i) => Math.abs(i.dx) > 0.005);
console.log(`\ncentred within 5 mm: ${items.length - off.length} of ${items.length}`);
if (off.length) {
  console.log('OFF THE CENTRE LINE:');
  for (const i of off.sort((a, c) => Math.abs(c.dx) - Math.abs(a.dx)))
    console.log(`  ${String(i.dx).padStart(9)} m   ${i.type} ${i.w}x${i.h} at y ${i.y0}…${i.y1}`);
}

// SELF-TEST, BOTH SIGNS. The "centred" verdict is an absence — it is free if
// the offsets are not really being read. Prove the same arithmetic separates a
// deliberately displaced copy of the widest item on the wall.
const widest = items.slice().sort((a, c) => c.w - a.w)[0];
const fakeDx = +(widest.x + 0.4 - ch.cx).toFixed(4);
console.log(`\nself-test: the widest wall item (${widest.type} ${widest.w} m) reads dx ${widest.dx};`
  + ` displaced 0.4 m it would read dx ${fakeDx} — `
  + `${Math.abs(fakeDx - widest.dx) > 0.39 && Math.abs(fakeDx) > 0.005 ? 'PASS, the test can see an offset'
    : '*** FAIL: the offset arithmetic is not live ***'}`);
await b.close();
