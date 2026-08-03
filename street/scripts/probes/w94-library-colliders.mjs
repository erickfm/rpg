// The 26 colliders inside the library, biggest first, with the zone each falls
// in. Companion to w94-library-density.mjs: the map says WHERE the room is
// lumpy, this says WHAT is making the lumps. Item 115.
//
// Same trap guard as its companion: roomDims() is an ARRAY (worker eightyseven
// lost a whole investigation to `dims.library` sweeping the world), and every
// collider is filtered to the room footprint before it is named.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4177/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.colliders, null, { timeout: 60000 });

const out = await p.evaluate(() => {
  const dims = window.__ct.roomDims();
  const r = dims.find((d) => /library/i.test(d.id));
  if (!r) throw new Error('no library room');
  const x0 = r.cx - r.w / 2, x1 = r.cx + r.w / 2, z0 = r.cz - r.d / 2, z1 = r.cz + r.d / 2;
  const cs = window.__ct.colliders()
    .filter((c) => c.maxX > x0 && c.minX < x1 && c.maxZ > z0 && c.minZ < z1)
    .map((c) => ({
      w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2),
      cx: +((c.maxX + c.minX) / 2 - r.cx).toFixed(2),   // LOCAL to room centre
      cz: +((c.maxZ + c.minZ) / 2 - r.cz).toFixed(2),
    }))
    .map((c) => ({ ...c, area: +(c.w * c.d).toFixed(1) }))
    .sort((a, x) => x.area - a.area);
  // A SEAT'S COORDINATES LIVE ON `.pose`, NOT ON THE SEAT.
  // crosstown.ts:358 -- `SEATS: { pose: { x, z, yaw, h }, ... }`. My first
  // version filtered on `s.x`, which is `undefined`, so every comparison was
  // false and it reported "0 seats" for a room whose source makes three
  // `ctx.seat` calls and which worker eightyseven measured at 219/219 green.
  // It printed a suspicious-zero warning rather than a confident 0, which is
  // the only reason it was caught. Population floor below, kept for the same
  // reason.
  const seats = (window.__ct.seats() || [])
    .map((s) => s.pose || s)
    .filter((s) => s.x > x0 && s.x < x1 && s.z > z0 && s.z < z1)
    .map((s) => ({ x: +(s.x - r.cx).toFixed(2), z: +(s.z - r.cz).toFixed(2), label: s.label || '' }));
  return { r, cs, seats };
});

console.log(`library ${out.r.w} x ${out.r.d} m, local coords (x east, z south; 0,0 = centre)\n`);
console.log('  area    w     d      cx      cz');
let tot = 0;
for (const c of out.cs) {
  tot += c.area;
  console.log(`  ${String(c.area).padStart(5)}  ${String(c.w).padStart(5)} ${String(c.d).padStart(5)}  ${String(c.cx).padStart(6)}  ${String(c.cz).padStart(6)}`);
}
if (!out.cs.length) { console.log('FAIL: zero colliders - measuring nothing'); process.exit(1); }
console.log(`\n${out.cs.length} colliders, ${tot.toFixed(1)} m2 of footprint in a ${(out.r.w * out.r.d).toFixed(0)} m2 room`);
console.log(`\n${out.seats.length} seats registered in the room:`);
for (const s of out.seats) console.log(`  (${String(s.x).padStart(6)}, ${String(s.z).padStart(6)})  ${s.label}`);
if (!out.seats.length) console.log('  (none - suspicious, this room has three seat registrations in source)');
await b.close();
