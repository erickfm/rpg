// EVERY SEAT'S STAND SPOT AGAINST THE NEAREST OTHER SPOT.
//
// Built for C's "pressing e doesnt get me out of it — stuck in the TV seat" row.
// A seat registered WITHOUT an `approach` puts its sit spot and its stand spot on
// the identical coordinate, and the tiebreak between two spots at distance 0 is
// undefined — so which one E fires is luck. This measures the distance, room by
// room, so the claim is a number and not an impression.
//
// It reports rather than asserting a global threshold, because 0.41 m between a
// stool and its NEIGHBOUR's sit spot is fine (they are 0.64 m apart by design)
// while 0.00 m between a seat and its OWN sit spot is the trap. The two are
// distinguishable only by which room and which label, so a human reads the table.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4186/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
const r = await p.evaluate(() => {
  const seats = window.__ct.seats(), spots = window.__ct.spots(), rooms = window.__ct.roomDims();
  const where = (x, z) => {
    const d = rooms.find((q) => Math.abs(x - q.cx) <= q.w / 2 + 1 && Math.abs(z - q.cz) <= q.d / 2 + 1);
    return d ? d.id : (x > 400 ? 'interior-gap' : 'street');
  };
  const out = [];
  for (const s of seats) {
    const near = spots
      .filter((q) => !/stand up|stop watching/i.test(q.label))
      .map((q) => ({ l: q.label, d: Math.hypot(q.x - s.pose.x, q.z - s.pose.z) }))
      .filter((q) => q.d < 0.5).sort((a, c) => a.d - c.d);
    if (near.length) out.push({ room: where(s.pose.x, s.pose.z), seat: s.label,
      nearest: near[0].l, d: +near[0].d.toFixed(3) });
  }
  return { seats: seats.length, out };
});
const zero = r.out.filter((q) => q.d < 0.005);
console.log(`${r.seats} seats; ${r.out.length} with a non-stand spot inside 0.5 m; ${zero.length} at EXACTLY 0.00 m`);
const byRoom = {};
for (const q of r.out) (byRoom[q.room] ??= []).push(q);
for (const [k, v] of Object.entries(byRoom).sort((a, c) => c[1].filter(q => q.d < 0.005).length - a[1].filter(q => q.d < 0.005).length)) {
  const z = v.filter((q) => q.d < 0.005).length;
  console.log(`  ${k.padEnd(14)} ${String(v.length).padStart(4)} inside 0.5 m, ${String(z).padStart(3)} at 0.00 m` +
    `${z ? '   <-- NO `approach` on those seats' : ''}   e.g. "${v[0].seat}" <- "${v[0].nearest}" at ${v[0].d} m`);
}
await b.close();
process.exit(zero.length ? 1 : 0);
