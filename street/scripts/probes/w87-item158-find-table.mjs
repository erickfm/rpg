// ITEM 158 — WHICH table intersects the shelving?
//
// The user: *"remove this weird table in the library."* In his frame a table
// juts from a shelf end AT AN ANGLE and intersects the shelving. The room has
// several tables (the entrance bench-table, the reading room's rank, a gallery
// table, the terminal table), so "the weird one" has to be identified rather
// than guessed — removing the wrong one is a change the user did not ask for.
//
// Finds it geometrically: inside the library's own room box, report every pair
// of meshes whose world AABBs OVERLAP by more than a rendering hair, where one
// is table-height and the other is shelf-height. An intersection is the defect
// the user is pointing at, so let the intersection name the object.
//
// ROTATION IS THE TELL. "At an angle" means a non-zero rotation.y in a room laid
// out on the axes, so each candidate's yaw is printed too.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const out = await p.evaluate(() => {
  // roomDims() returns an ARRAY of {id, w, d, cx, cz}, not an object keyed by
  // name. My first version did `dims.library`, got undefined, and fell through
  // to sweeping EVERY interior in the world — which is how an angled table 550 m
  // away in another room nearly became the answer to a question about the
  // library. Ask by id, and fail loudly if the id is not there.
  const dims = window.__ct.roomDims ? window.__ct.roomDims() : null;
  const lib = Array.isArray(dims) ? dims.find((d) => d.id === 'library') : null;
  if (!lib) throw new Error('no library in roomDims() — refusing to sweep the whole world instead');
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // room box: prefer the published dims, else fall back to a wide interior band
  const box = lib ? { x0: lib.cx - lib.w / 2 - 1, x1: lib.cx + lib.w / 2 + 1,
                      z0: lib.cz - lib.d / 2 - 1, z1: lib.cz + lib.d / 2 + 1 } : null;
  const items = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const g = n.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    if (box) { if (cx < box.x0 || cx > box.x1 || cz < box.z0 || cz > box.z1) return; }
    else if (cx < 400) return;
    // yaw from the world matrix's x basis
    const e = n.matrixWorld.elements;
    const yaw = Math.atan2(e[2], e[0]);
    items.push({ id: n.id, bb: { x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y, z0: bb.min.z, z1: bb.max.z },
      yaw: +yaw.toFixed(3),
      w: +(bb.max.x - bb.min.x).toFixed(2), h: +(bb.max.y - bb.min.y).toFixed(2), d: +(bb.max.z - bb.min.z).toFixed(2) });
  });
  // overlap in all three axes by > 2 cm
  const ov = (a, c) => Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0) > 0.02
    && Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0) > 0.02
    && Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0) > 0.02;
  // table-ish: top between 0.6 and 1.1 m. shelf-ish: taller than 1.2 m.
  const tables = items.filter((i) => i.bb.y1 > 0.6 && i.bb.y1 < 1.15 && i.w > 0.5 && i.d > 0.5);
  const shelves = items.filter((i) => i.bb.y1 - i.bb.y0 > 1.2);
  const pairs = [];
  for (const t of tables) for (const sh of shelves) {
    if (!ov(t.bb, sh.bb)) continue;
    pairs.push({
      table: t.id, tYaw: t.yaw, tSize: `${t.w}x${t.h}x${t.d}`,
      tAt: [+((t.bb.x0 + t.bb.x1) / 2).toFixed(2), +((t.bb.z0 + t.bb.z1) / 2).toFixed(2)],
      shelf: sh.id, shSize: `${sh.w}x${sh.h}x${sh.d}`,
      shAt: [+((sh.bb.x0 + sh.bb.x1) / 2).toFixed(2), +((sh.bb.z0 + sh.bb.z1) / 2).toFixed(2)],
      overlap: +(Math.min(t.bb.x1, sh.bb.x1) - Math.max(t.bb.x0, sh.bb.x0)).toFixed(3),
      overlapZ: +(Math.min(t.bb.z1, sh.bb.z1) - Math.max(t.bb.z0, sh.bb.z0)).toFixed(3),
    });
  }
  return { lib, items: items.length, tables: tables.length, shelves: shelves.length, pairs,
    angled: tables.filter((t) => Math.abs(t.yaw) > 0.03 && Math.abs(Math.abs(t.yaw) - Math.PI) > 0.03
      && Math.abs(Math.abs(t.yaw) - Math.PI / 2) > 0.03)
      .map((t) => ({ id: t.id, yaw: t.yaw, size: `${t.w}x${t.h}x${t.d}`,
        at: [+((t.bb.x0 + t.bb.x1) / 2).toFixed(2), +((t.bb.z0 + t.bb.z1) / 2).toFixed(2)] })) };
});
console.log('library dims:', JSON.stringify(out.lib));
console.log(`meshes in the room ${out.items}   table-height ${out.tables}   shelf-height ${out.shelves}`);
console.log(`\ntable/shelf INTERSECTIONS (>2 cm in all three axes): ${out.pairs.length}`);
for (const q of out.pairs) {
  console.log(`  table#${q.table} ${q.tSize} yaw ${q.tYaw} at (${q.tAt})  X  shelf#${q.shelf} ${q.shSize} at (${q.shAt})   overlap x ${q.overlap} z ${q.overlapZ}`);
}
console.log(`\ntables at a NON-AXIS angle: ${out.angled.length}`);
for (const t of out.angled) console.log(`  #${t.id} yaw ${t.yaw} rad  ${t.size}  at (${t.at})`);
await b.close();
