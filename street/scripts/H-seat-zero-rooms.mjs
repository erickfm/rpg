// H: WHICH ROOMS hold the coincident sit/stand seats? Resolved against
// roomDims() live, because the room a coordinate names is not stable.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats && window.__ct.roomDims, null, { timeout: 60000 });
const out = await p.evaluate(() => {
  const seats = window.__ct.seats(), spots = window.__ct.spots(), rooms = window.__ct.roomDims();
  const where = (x, z) => {
    for (const r of rooms) if (Math.abs(x - r.cx) <= r.w / 2 + 0.5 && Math.abs(z - r.cz) <= r.d / 2 + 0.5) return r.id;
    return 'street';
  };
  const zero = {}, inside = {};
  for (const s of seats) {
    const px = s.pose.x, pz = s.pose.z, room = where(px, pz);
    let best = Infinity, who = '';
    for (const q of spots) {
      if (/stand up/i.test(q.label)) continue;
      const d = Math.hypot(q.x - px, q.z - pz);
      if (d < best) { best = d; who = q.label; }
    }
    if (best <= 0.005) zero[room] = (zero[room] ?? 0) + 1;
    if (best <= 0.5) inside[room] = (inside[room] ?? 0) + 1;
  }
  return { zero, inside, total: seats.length };
});
console.log(`${out.total} seats in the world\n`);
console.log('seats whose sit and stand spots COINCIDE (0.00 m), by room:');
for (const [k, v] of Object.entries(out.zero).sort((a, c) => c[1] - a[1])) console.log(`   ${k.padEnd(10)} ${v}`);
console.log('\nseats with any non-stand spot inside 0.5 m, by room:');
for (const [k, v] of Object.entries(out.inside).sort((a, c) => c[1] - a[1])) console.log(`   ${k.padEnd(10)} ${v}`);
await b.close();
