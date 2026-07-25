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
console.log(street.length === 0
  ? '\nOK   no trap-band gaps on the street'
  : `\nFAIL ${street.length} trap-band gap(s) on the street`);
if (errs.length) console.log(`\npage errors:\n${errs.slice(0, 3).join('\n')}`);
await browser.close();
process.exitCode = street.length === 0 ? 0 : 1;
