// H (verifier): C's seat-exit row. Two measurable claims:
//   (1) seated on the bed, a NON-stand spot is live inside the stand radius;
//   (2) of 225 seats, 149 have one inside 0.5 m and 12+ at exactly 0.00 m.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats && window.__ct.spots, null, { timeout: 60000 });

// ── (1) sit on the bed and see what else is live ──────────────────────────
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z), 0), [198.30, -16.30]);
await p.waitForTimeout(600);
await p.mouse.click(450, 280); await p.waitForTimeout(250);
await p.keyboard.press('KeyE');
await p.waitForTimeout(900);
const seated = await p.evaluate(() => window.__ct.seated());
const near = await p.evaluate(() => {
  const pos = window.__ct.pos();
  return window.__ct.spots()
    .map((s) => ({ label: s.label, d: +Math.hypot(s.x - pos[0], s.z - pos[2]).toFixed(2), r: s.r, ok: s.ok }))
    .filter((s) => s.d <= 1.2).sort((a, c) => a.d - c.d);
});
console.log('seated on the bed:', seated ? 'yes' : 'NO');
console.log('spots within 1.2 m while seated:');
for (const s of near) console.log(`   ${String(s.d).padStart(5)} m  r ${String(s.r).padEnd(5)} ok=${s.ok}  "${s.label}"`);
const rivals = near.filter((s) => !/stand up/i.test(s.label));
console.log(`  -> non-stand spots inside the 0.5 m stand radius: ${rivals.filter(s=>s.d<=0.5).length}`);
await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
console.log('  E again ->', await p.evaluate(() => window.__ct.seated()) ? 'still seated' : 'stood up');

// ── (2) the world-wide blast radius ───────────────────────────────────────
const CENSUS = async (STRICT) => p.evaluate((STRICT) => {
  const seats = window.__ct.seats(), spots = window.__ct.spots();
  let inside = 0, zero = 0; const zeroAt = [];
  for (const s of seats) {
    const px = s.pose.x, pz = s.pose.z;
    let best = Infinity;
    for (const q of spots) {
      if (/stand up/i.test(q.label)) continue;
      if (STRICT && /^sit\b|sit on|sit at|take a booth|sit and wait|sit in/i.test(q.label)
          && Math.hypot(q.x - px, q.z - pz) < 0.01) continue;
      const d = Math.hypot(q.x - px, q.z - pz);
      if (d < best) best = d;
    }
    if (best <= 0.5) inside++;
    if (best <= 0.005) { zero++; if (zeroAt.length < 6) zeroAt.push([+px.toFixed(1), +pz.toFixed(1)]); }
  }
  return { seats: seats.length, inside, zero, zeroAt };
}, STRICT);
for (const [mode, strict] of [['EXCLUDING the seat\'s own sit spot (mine)', true],
                              ['INCLUDING it, which is C\'s framing     ', false]]) {
  const c = await CENSUS(strict);
  console.log(`\n${mode}`);
  console.log(`  seats: ${c.seats}   inside 0.5 m: ${c.inside}   at 0.00 m: ${c.zero}   e.g. ${JSON.stringify(c.zeroAt)}`);
}
await b.close();
