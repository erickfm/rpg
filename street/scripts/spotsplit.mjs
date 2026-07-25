// The 55 spots gated by ok() from the street are not one undifferentiated
// blob. seats-walk.mjs already passes 57/57 seats, and many seats are interior
// -- so some of the 55 are already covered. Split the registry and find out how
// many are genuinely unverified rather than merely unverified BY ME.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.goto('http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(900);
const out = await p.evaluate(() => {
  const spots = window.__ct.spots();
  const seats = window.__ct.seats ? window.__ct.seats() : [];
  const near = (a, b2) => Math.hypot(a.x-b2.x, a.z-b2.z) < 0.75;
  const rows = spots.map(s => ({
    label: s.label, x:+s.x.toFixed(2), z:+s.z.toFixed(2), r:+s.r.toFixed(2), ok: s.ok,
    interior: s.x > 400,
    // A seat is TWO ordinary spots (crosstown.ts:157): one to sit, one to
    // stand. __ct.seats() does not expose x/z at top level, so proximity
    // matching returns nothing -- classify by LABEL, which is what the player
    // reads anyway.
    isSeat: /^(stand up|sit\b|sit at|sit on|sit in)/i.test(s.label || ''),
  }));
  return { nSpots: spots.length, nSeats: seats.length, rows };
});
const R = out.rows;
const g = (f) => R.filter(f).length;
console.log(`${out.nSpots} spots · ${out.nSeats} seats registered\n`);
console.log(`live from the street (ok === true):        ${g(r=>r.ok)}`);
console.log(`gated (ok === false):                      ${g(r=>!r.ok)}`);
console.log(`   of the gated, matching a seat:          ${g(r=>!r.ok && r.isSeat)}   <- seats-walk covers these`);
console.log(`   of the gated, interior (x > 400):       ${g(r=>!r.ok && r.interior)}`);
console.log(`   gated, NOT a seat:                      ${g(r=>!r.ok && !r.isSeat)}`);
console.log('\ngated non-seat spots — the genuinely unverified set:');
for (const r of R.filter(r=>!r.ok && !r.isSeat).slice(0, 20))
  console.log(`   ${(r.label||'(no label)').padEnd(34)} r ${String(r.r).padStart(5)}  at (${r.x}, ${r.z})  ${r.interior?'interior':'street'}`);
writeFileSync('shots/spotsplit.json', JSON.stringify(out,null,2));
await b.close();
