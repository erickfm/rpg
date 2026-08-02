// H: how many interiors actually have a SEATED figure now? The F+G adoption row
// says "0 of 10 int-*.ts call citizenSprite", which was true when written - but
// the bank and the jail have both landed since with people in them.
//
// Detected positionally: a citizen-sized plane standing at a registered seat's
// own pose is a sitter. Resolved against roomDims() live, never by coordinate.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats && window.__ct.roomDims, null, { timeout: 60000 });
const out = await p.evaluate(() => {
  const rooms = window.__ct.roomDims(), seats = window.__ct.seats();
  const root = window.__ct.scene(); root.updateMatrixWorld(true);
  const where = (x, z) => {
    for (const r of rooms) if (Math.abs(x - r.cx) <= r.w / 2 + 0.5 && Math.abs(z - r.cz) <= r.d / 2 + 0.5) return r.id;
    return 'street';
  };
  // citizen-sized upright planes
  const figs = [];
  root.traverse((o) => {
    if (!o.isMesh || !/Plane/.test(o.geometry?.type || '')) return;
    const e = o.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
    if (y < 0.3 || y > 2.2) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    const h = (bb.max.y - bb.min.y) * Math.hypot(e[4], e[5], e[6]);
    const w = (bb.max.x - bb.min.x) * Math.hypot(e[0], e[1], e[2]);
    if (h < 0.7 || h > 2.2 || w < 0.3 || w > 1.6) return;
    figs.push({ x, y, z, h, bottom: y - h / 2 });
  });
  const perRoom = {}, sittersPerRoom = {}, detail = [];
  for (const f of figs) { const r = where(f.x, f.z); perRoom[r] = (perRoom[r] ?? 0) + 1; }
  for (const s of seats) {
    const near = figs.find((f) => Math.hypot(f.x - s.pose.x, f.z - s.pose.z) < 0.35);
    if (near) {
      const r = where(s.pose.x, s.pose.z); sittersPerRoom[r] = (sittersPerRoom[r] ?? 0) + 1;
      // A STANDING sprite parked at a seat has its FEET at the seat top. My
      // seated pose has the origin at the HIP, so its plane reaches BELOW the
      // seat top toward the folded feet. That is what tells the two apart.
      detail.push({ room: r, label: s.label, seatTop: +s.pose.h.toFixed(3),
                    figBottom: +near.bottom.toFixed(3), figH: +near.h.toFixed(2),
                    below: +(s.pose.h - near.bottom).toFixed(3) });
    }
  }
  return { rooms: rooms.map((r) => r.id), figs: figs.length, perRoom, sittersPerRoom, detail };
});
console.log(`${out.figs} citizen-sized figures in the world`);
console.log(`\nby room — figures / of those, SEATED at a registered seat:`);
const all = new Set([...out.rooms, ...Object.keys(out.perRoom)]);
let withSitters = 0, interiors = 0;
for (const r of out.rooms) {
  interiors++;
  const f = out.perRoom[r] ?? 0, s = out.sittersPerRoom[r] ?? 0;
  if (s) withSitters++;
  console.log(`   ${r.padEnd(10)} ${String(f).padStart(3)} figures   ${String(s).padStart(2)} seated`);
}
console.log(`   ${'street'.padEnd(10)} ${String(out.perRoom.street ?? 0).padStart(3)} figures   ${String(out.sittersPerRoom.street ?? 0).padStart(2)} seated`);
console.log(`\n  interiors with a figure AT a registered seat: ${withSitters} of ${interiors}`);
console.log('\n  seat top vs figure bottom (positive = the figure reaches BELOW the seat, i.e. hip-origin seated pose):');
for (const d of out.detail) console.log(`     ${d.room.padEnd(8)} ${d.label.slice(0,26).padEnd(26)} seat ${d.seatTop}  figBottom ${d.figBottom}  below ${d.below >= 0 ? '+' : ''}${d.below}  figH ${d.figH}`);
await b.close();
