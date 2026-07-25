// Find gaps the player can walk INTO but not OUT of.
//
// The capsule is RADIUS = 0.36, so 0.72 m across. A corridor between two solid
// boxes should be either comfortably passable (>= 0.95 m) or too narrow to
// enter (< 0.40 m). In between is the trap the user got wedged in: wide enough
// to walk into at an angle, too narrow to turn round or walk out of.
//
// This cannot be found by walking, and it cannot be seen in a screenshot,
// because the parked arrangement is DRAWN from the seeded distribution — the
// trap exists in some arrangements and not others. So measure the geometry.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/gaps.mjs [--all]
import { chromium } from 'playwright';

const PASSABLE = 0.95, ENTERABLE = 0.40;
const showAll = process.argv.includes('--all');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 10000 });
await page.waitForTimeout(300);

const boxes = await page.evaluate(() => window.__ct.colliders());
// the moving vehicles park their boxes at 999 while idle; they are not scenery
const solid = boxes.filter((b) => Math.abs(b.minX) < 400 && Math.abs(b.minZ) < 400);

/** The corridor between two boxes: if their spans OVERLAP on one axis, the
 *  separation on the other axis is a slot of that width. Boxes that are only
 *  diagonal to each other do not form a corridor — you can always leave a
 *  diagonal gap the way you came in. */
const corridor = (a, b) => {
  const overlapX = a.minX < b.maxX && b.minX < a.maxX;
  const overlapZ = a.minZ < b.maxZ && b.minZ < a.maxZ;
  const sx = Math.max(b.minX - a.maxX, a.minX - b.maxX);
  const sz = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ);
  if (overlapZ && sx > 0) return { w: sx, axis: 'x' };
  if (overlapX && sz > 0) return { w: sz, axis: 'z' };
  return null;
};

const traps = [];
for (let i = 0; i < solid.length; i++) {
  for (let j = i + 1; j < solid.length; j++) {
    const c = corridor(solid[i], solid[j]);
    if (!c) continue;
    if (c.w > ENTERABLE && c.w < PASSABLE) {
      // where is it? the middle of the slot
      const a = solid[i], b = solid[j];
      const x = c.axis === 'x' ? (Math.min(a.maxX, b.maxX) + Math.max(a.minX, b.minX)) / 2
        : (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2;
      const z = c.axis === 'z' ? (Math.min(a.maxZ, b.maxZ) + Math.max(a.minZ, b.minZ)) / 2
        : (Math.max(a.minZ, b.minZ) + Math.min(a.maxZ, b.maxZ)) / 2;
      const dims = (q) => `${(q.maxX - q.minX).toFixed(2)}x${(q.maxZ - q.minZ).toFixed(2)}`;
      traps.push({ w: +c.w.toFixed(3), axis: c.axis, x: +x.toFixed(2), z: +z.toFixed(2),
        pair: `${dims(a)} vs ${dims(b)}` });
    }
  }
}
traps.sort((p, q) => p.w - q.w);

console.log(`gap probe: ${solid.length} solid boxes, ${traps.length} in the trap band ` +
  `(${ENTERABLE}–${PASSABLE} m)`);
// The interior belt is parked out at x > 100 and is somebody else's furniture;
// report it separately so the street's own traps are not buried in it.
const street = traps.filter((t) => t.x < 100);
const inside = traps.length - street.length;
for (const t of (showAll ? traps : street).slice(0, 25)) {
  console.log(`  ${t.w.toFixed(2)} m slot on ${t.axis} at (${t.x}, ${t.z})   boxes ${t.pair}`);
}
if (!showAll && inside) console.log(`  …and ${inside} more inside the interiors (x > 100) — pass --all`);
// ── the check that is MINE to keep green ─────────────────────────────────
//
// Most of the corridors above are between boxes I do not own — a building
// against a kerb prop, furniture inside a room. Reporting them is useful and
// reaching into someone else's module is not. What ct/gap.ts constrains is the
// PARKED ARRANGEMENT, so that is what gets asserted: no trap-band corridor may
// involve a vehicle-sized box. A car is about 2.1 x 4-5 m either way round.
const carish = (d) => {
  const [a, b] = d.split('x').map(Number);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return lo > 1.8 && lo < 2.4 && hi > 3.5 && hi < 5.5;
};
const carTraps = street.filter((t) => t.pair.split(' vs ').some(carish));
console.log(`\n  ${street.length} trap-band corridor(s) on the street, ` +
  `${carTraps.length} of them involving a parked vehicle`);
for (const t of carTraps) console.log(`  FAIL ${t.w.toFixed(2)} m at (${t.x}, ${t.z})  ${t.pair}`);
console.log(carTraps.length === 0
  ? 'OK   no parked vehicle leaves a gap the player can enter but not leave'
  : `FAIL ${carTraps.length} parked vehicle gap(s) in the trap band`);
if (errs.length) console.log(`\npage errors:\n${errs.slice(0, 3).join('\n')}`);
await browser.close();
process.exitCode = carTraps.length === 0 ? 0 : 1;
