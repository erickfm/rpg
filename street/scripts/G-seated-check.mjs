// EVERY SEATED FIGURE IN THE WORLD, AND WHETHER IT IS ACTUALLY ON ITS SEAT.
//
// Built for one user report — "the seated figure is intersecting the stool" —
// and kept because it found a SECOND instance in a room I do not own, which a
// by-eye check of the reported stool never would have.
//
// WHAT IT COMPARES, and the three numbers have to be kept apart or the answer is
// meaningless:
//   origin_y      where the sprite plane's origin actually sits
//   registered_h  what ctx.seat() claims the seat height is
//   top_under     the top face of the highest solid mesh directly beneath it
// A correct sitter has all three equal. `origin_y` below `top_under` is sinking
// into the seat; above it is floating.
//
// THE POINT IS THAT IT SEPARATES TWO CAUSES. If origin_y matches registered_h
// but not top_under, the SEAT is lying about itself and the room is at fault. If
// origin_y is 0.445 below registered_h, the room placed the figure at the floor
// instead of the seat. If origin_y matches both and it still looks wrong, the
// atlas hip offset is wrong and that is H's — see notes/H-seated-sprite.md,
// "if you find yourself adding a fudge to the y, stop and tell me".
//
// LIMITS, stated because two of its columns can be blank for innocent reasons:
//  · it collects any person-sized PlaneGeometry, so signs, posters and door
//    leaves come in too. Rows reading "no solid under it" are usually those.
//  · it cannot see F's per-site FLOOR REGISTRY, only meshes — so a figure on the
//    library gallery reads as floating by the height of the gallery. That is the
//    probe's blind spot, not a fault in the room, and it must not be reported as
//    one.
// Read the rows with a real seat under them; ignore the rest.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:4186/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
const r = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const seats = window.__ct.seats();
  // every citizen plane in an interior slab (x > 400), with its origin y
  const sitters = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return;
    const wp = new o.position.constructor(); o.getWorldPosition(wp);
    if (wp.x < 400) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const h = bb.max.y - bb.min.y;
    if (h < 1.0 || h > 2.4) return;                    // person-sized planes only
    sitters.push({ x: +wp.x.toFixed(2), z: +wp.z.toFixed(2), oy: +wp.y.toFixed(3),
      y0: +bb.min.y.toFixed(3), y1: +bb.max.y.toFixed(3) });
  });
  // for each sitter, the nearest registered seat and the top face of whatever
  // solid mesh is directly under it
  const out = sitters.filter(t => t.oy > 0.05).map((t) => {
    const near = seats.map(q => ({ q, d: Math.hypot(q.pose.x - t.x, q.pose.z - t.z) }))
      .sort((a, c) => a.d - c.d)[0];
    let topUnder = null;
    s.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.geometry.type === 'PlaneGeometry') return;
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox) return;
      const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (t.x < bb.min.x - 0.02 || t.x > bb.max.x + 0.02) return;
      if (t.z < bb.min.z - 0.02 || t.z > bb.max.z + 0.02) return;
      if (bb.max.y > t.oy + 0.30 || bb.max.y < 0.1) return;
      if (topUnder === null || bb.max.y > topUnder) topUnder = bb.max.y;
    });
    return { ...t, seatH: near ? +near.q.pose.h.toFixed(3) : null,
      seatD: near ? +near.d.toFixed(2) : null, topUnder: topUnder === null ? null : +topUnder.toFixed(3) };
  });
  return { nSeats: seats.length, out };
});
console.log(`${r.nSeats} registered seats;  ${r.out.length} seated figures found`);
console.log('origin_y  registered_h  actual_top_under  verdict');
for (const t of r.out) {
  const gap = t.topUnder === null ? null : +(t.oy - t.topUnder).toFixed(3);
  const v = t.topUnder === null ? 'no solid under it'
    : Math.abs(gap) < 0.006 ? 'ON the seat'
    : gap < 0 ? `SUNK ${(-gap * 100).toFixed(1)} cm INTO it`
    : `FLOATING ${(gap * 100).toFixed(1)} cm above it`;
  console.log(`  ${t.oy}      ${t.seatH}          ${t.topUnder}        ${v}   at (${t.x}, ${t.z})`);
}
await b.close();
