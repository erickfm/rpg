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

let PASSABLE = 0.95, ENTERABLE = 0.40;   // replaced by the world's own values below
const showAll = process.argv.includes('--all');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 10000 });
await page.waitForTimeout(300);

// Ask the world for the RULE and the predicate rather than reimplementing them.
// This probe used to carry its own copy of `corridor()` and the two drifted:
// they disagreed about a pair that overlapped on neither axis, so a reported
// trap could not be settled without stepping through both. One implementation.
const rule = await page.evaluate(() => window.__ct.gapRule());
ENTERABLE = rule.ENTERABLE; PASSABLE = rule.PASSABLE;

// The whole pairwise scan runs INSIDE the page, calling ct/gap.ts's own
// corridor() for every pair. Doing it out here would be 9,000 round trips, and
// re-implementing the predicate is what caused the drift this replaces.
const traps = await page.evaluate(async ([lo, hi]) => {
  // ── only STATIC boxes ────────────────────────────────────────────────────
  //
  // Six of the colliders in this world MOVE: the citizens, whose footprints are
  // 0.5 x 0.5 and walk the pavements. A pedestrian passing a parked car forms a
  // 0.78 m corridor for about a second and then walks out of it, and this probe
  // used to report that as a parking defect — which is why the build-time
  // constraint kept reporting success while the probe kept failing. They were
  // both right; they were looking at different moments.
  //
  // You cannot constrain a draw against something that moves, and a person
  // standing near a car is not a trap: they leave. So sample twice and keep only
  // the boxes that stayed put. (The traffic vehicles park their boxes at 999
  // while idle, which the range filter already drops.)
  const key = (q) => `${q.minX.toFixed(3)},${q.minZ.toFixed(3)},${q.maxX.toFixed(3)},${q.maxZ.toFixed(3)}`;
  const first = window.__ct.colliders().map(key);
  await new Promise((r) => setTimeout(r, 1200));
  const now = window.__ct.colliders();
  const solid = now.filter((q, i) => key(q) === first[i]
    && Math.abs(q.minX) < 400 && Math.abs(q.minZ) < 400);
  const out = [];
  const dims = (q) => `${(q.maxX - q.minX).toFixed(2)}x${(q.maxZ - q.minZ).toFixed(2)}`;
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i], b = solid[j];
      const w = window.__ct.corridor(a, b);
      if (w === null || !(w > lo && w < hi)) continue;
      // which axis the slot runs on, for the report only
      const overlapZ = a.minZ < b.maxZ && b.minZ < a.maxZ;
      const axis = overlapZ ? 'x' : 'z';
      const x = axis === 'x' ? (Math.min(a.maxX, b.maxX) + Math.max(a.minX, b.minX)) / 2
        : (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2;
      const z = axis === 'z' ? (Math.min(a.maxZ, b.maxZ) + Math.max(a.minZ, b.minZ)) / 2
        : (Math.max(a.minZ, b.minZ) + Math.min(a.maxZ, b.maxZ)) / 2;
      out.push({ w: +w.toFixed(3), axis, x: +x.toFixed(2), z: +z.toFixed(2),
        pair: `${dims(a)} vs ${dims(b)}` });
    }
  }
  return out;
}, [ENTERABLE, PASSABLE]);
const solid = await page.evaluate(() => window.__ct.colliders()
  .filter((q) => Math.abs(q.minX) < 400 && Math.abs(q.minZ) < 400).length);
console.log('  (moving boxes — the six citizens — are excluded; a person beside a car is not a trap)');
traps.sort((p, q) => p.w - q.w);

console.log(`gap probe: ${solid} solid boxes, ${traps.length} in the trap band ` +
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
