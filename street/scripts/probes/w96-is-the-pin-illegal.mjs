// IS A PINNED WALKER *INSIDE* THE CAR'S BOX, OR MERELY BESIDE IT?
//
// Item 207 asks for `escapeFrom` to "handle being beside a box as well as inside
// one". That is a claim about `ct/crowd.ts`'s `unstick`, and it is worth
// settling with a number before changing it, because the two cases want opposite
// treatment:
//
//   INSIDE  the position is ILLEGAL — `clearAt` would refuse it — and `unstick`
//           must push the walker out. `escapeFrom` already does this.
//   BESIDE  the position is LEGAL. `escapeFrom` returns null (crowd.ts:346) and
//           `unstick` records it as fine, which is CORRECT: the same routine is
//           what stops a walker resting legally against a wall from being shoved
//           (crowd.ts:318-320), and that property is load-bearing.
//
// So if pinned walkers are always merely beside the box, "make escapeFrom handle
// beside" would not fix the pin — it would break the wall case to no purpose,
// and the real fault is that the walker cannot RETREAT from a legal-but-trapped
// spot.
//
// RUN THIS AGAINST THE PRE-RETREAT crowd.ts, or it measures nothing: with the
// retreat in place nobody gets close enough to be pinned at all.
//
// The threshold is not a taste call - `CIT_R` is 0.28 and `clearAt` inflates by
// the same 0.28, so gap < 0.28 is exactly "inside" as this file defines it.
//
//   SHOT_URL=http://localhost:4520/ SECONDS=150 node scripts/probes/w96-is-the-pin-illegal.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const SECONDS = Number(process.env.SECONDS ?? 150);
const CROSS_Z = -90.2;
const CIT_R = 0.28;             // ct/crowd.ts — the footprint clearAt tests with

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const S_PARK = await p.evaluate(async (cz) => {
  let best = null;
  for (let s = 80; s < 115; s += 1) {
    window.__ct.drive('NE', 'taxi', s);
    await new Promise((r) => requestAnimationFrame(r));
    const t = window.__ct.traffic()[0];
    if (t) { const d = Math.hypot(t.z - cz, t.x - 1.5); if (!best || d < best.d) best = { s, d }; }
  }
  return best?.s ?? 98;
}, CROSS_Z);

let inside = 0, beside = 0, minGap = Infinity, where = null, jammedFrames = 0;
const t0 = Date.now();
while (Date.now() - t0 < SECONDS * 1000) {
  const s = await p.evaluate((sv) => {
    window.__ct.drive('NE', 'taxi', sv);
    return { w: window.__ct.walkers(),
      cars: window.__ct.citAvoid().filter((b) => b.actor && b.minX < 900) };
  }, S_PARK);
  const car = s.cars[0];
  if (car) {
    for (const w of s.w) {
      if (Math.abs(w.x) > 5 || Math.abs(w.z - CROSS_Z) > 6) continue;
      const g = Math.hypot(Math.max(car.minX - w.x, 0, w.x - car.maxX),
        Math.max(car.minZ - w.z, 0, w.z - car.maxZ));
      if (g > 1.2) continue;                       // not up against it
      if (w.jam > 0.5) jammedFrames++;
      if (g < CIT_R) inside++; else beside++;
      if (g < minGap) { minGap = g; where = [+w.x.toFixed(2), +w.z.toFixed(2)]; }
    }
  }
  await p.waitForTimeout(100);
}

console.log(`\nframes with a walker up against the parked taxi: ${inside + beside}`);
console.log(`  INSIDE the box (gap < ${CIT_R}, illegal, escapeFrom acts):   ${inside}`);
console.log(`  BESIDE it      (gap >= ${CIT_R}, legal, escapeFrom is null): ${beside}`);
console.log(`  of those, frames with jam > 0.5 s (a real pin):             ${jammedFrames}`);
console.log(`closest any walker got to the box: ${minGap === Infinity ? 'n/a' : minGap.toFixed(3)} m`
  + (where ? ` at (${where})` : ''));
if (inside + beside === 0) {
  console.log('\nREFUSING TO REPORT: nobody was ever up against the taxi.');
  console.log('(Are you running this against the RETREAT build? It must be the pre-fix one.)');
  await b.close(); process.exit(3);
}
console.log(inside === 0
  ? '\n=> Every pin was BESIDE the box, never inside it. The pinned walker is in a\n'
    + '   LEGAL position, so there is nothing for escapeFrom to push out of, and\n'
    + '   making it push anyway would shove walkers who are resting against walls.'
  : `\n=> ${inside} frames were genuinely inside the box; escapeFrom does have work to do.`);
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
await b.close();
