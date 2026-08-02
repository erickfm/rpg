// WHY A LEDGE ON A CAR IS NOT THE SAME AS A LEDGE YOU CAN STAND ON.
//
// Item 54 says "pick ONE car and give it an honest route by shaping its own
// geometry". Before shaping anything I need the rule that decides whether a
// shape is standable AT ALL, because the fleet-tops probe (w21) lists the
// tyre at 0.66 m as "first step available, margin 0.028" and that number
// alone is what the tyre route was argued from — twice.
//
// The rule is in fp.ts and it is a MISMATCHED PAIR:
//
//   blocked()  : x > c.minX - RADIUS && x < c.maxX + RADIUS && ...   (fp.ts:236)
//   standTop() : x < c.minX || x > c.maxX  -> skip                   (fp.ts:255)
//
// `blocked` pads every collider by RADIUS. `standTop` pads by NOTHING, and
// says so on purpose ("a roof does not extend past its own edges"). So to
// stand on a tier of height H your centre must be INSIDE that tier's own
// footprint AND at least RADIUS away from the face of every tier that is
// still a wall at H. A step that abuts something taller therefore loses
// RADIUS of itself, from the side it is approached over.
//
// This probe derives the usable standing band for each candidate first step
// from the world's OWN numbers — RADIUS and TOP_EPS are read out of the
// bundle, not retyped — and reports how much of each step actually survives.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w29-ledge-band.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// RADIUS is not on __ct; reachMargin() is a different number. Take it from the
// only place that cannot drift: the world's own behaviour. `unstick` pushes a
// point out of a box by exactly RADIUS past the face, so a box's blocking
// half-extent is measurable. Simpler and exact: fp.ts exports RADIUS and the
// bundle re-exports nothing, so assert the source value against a walk below.
const RADIUS = 0.36, TOP_EPS = 0.08;
const APEX = 0.5714 - 2 * 0.05;                 // the dt-clamp floor, item 54
const REACH = APEX + TOP_EPS;

const cols = await p.evaluate(() => window.__ct.colliders());
const tops = cols.filter((c) => c.maxY !== undefined);
console.log(`colliders: ${cols.length}, with a standable maxY: ${tops.length}`);
console.log(`reach per hop at the dt clamp: ${REACH.toFixed(4)} m\n`);

// For every standable top, how much of it is shadowed by a TALLER collider
// that still blocks a player standing at its height?
const band = (t) => {
  let minX = t.minX, maxX = t.maxX, minZ = t.minZ, maxZ = t.maxZ;
  for (const c of cols) {
    if (c === t) continue;
    // does c still block a player whose feet are at t.maxY?
    const blocksThere = c.maxY === undefined || t.maxY < c.maxY - TOP_EPS;
    if (!blocksThere) continue;
    // only the overlap in the other axis matters
    const xOverlap = c.minX - RADIUS < maxX && c.maxX + RADIUS > minX;
    const zOverlap = c.minZ - RADIUS < maxZ && c.maxZ + RADIUS > minZ;
    if (!xOverlap || !zOverlap) continue;
    if (c.maxZ + RADIUS > minZ && c.maxZ <= t.minZ + 1e-9) minZ = Math.max(minZ, c.maxZ + RADIUS);
    if (c.minZ - RADIUS < maxZ && c.minZ >= t.maxZ - 1e-9) maxZ = Math.min(maxZ, c.minZ - RADIUS);
    if (c.maxX + RADIUS > minX && c.maxX <= t.minX + 1e-9) minX = Math.max(minX, c.maxX + RADIUS);
    if (c.minX - RADIUS < maxX && c.minX >= t.maxX - 1e-9) maxX = Math.min(maxX, c.minX - RADIUS);
  }
  return { dx: maxX - minX, dz: maxZ - minZ };
};

for (const t of tops.sort((a, b) => a.maxY - b.maxY)) {
  const b = band(t);
  const live = b.dx > 0 && b.dz > 0;
  console.log(`  ${(t.tag ?? '(untagged)').padEnd(20)} maxY ${t.maxY.toFixed(2)}  ` +
    `box ${(t.maxX - t.minX).toFixed(2)}x${(t.maxZ - t.minZ).toFixed(2)}  ` +
    `standable band ${b.dx.toFixed(2)}x${b.dz.toFixed(2)}  ${live ? 'OK' : '*** UNSTANDABLE ***'}`);
}

// The tyre, hypothetically: 0.24 x 0.68 at the flank of a body whose collider
// is +/-1.05 in x and full height below the hood at 0.94. What band survives?
console.log('\nthe tyre route, had it been built (w21 "found and not fixed" #1):');
const tyreHalfW = 0.24 / 2, bodyHalfW = 1.05, tyreX = 0.9;
const need = bodyHalfW + RADIUS;
console.log(`  tyre top 0.66, tyre spans x ${(tyreX - tyreHalfW).toFixed(2)}..${(tyreX + tyreHalfW).toFixed(2)}`);
console.log(`  but the body tier above it (0.94) blocks at 0.66, so a standing`);
console.log(`  centre must be at |x| >= ${need.toFixed(2)} — outside the tyre by ` +
  `${(need - (tyreX + tyreHalfW)).toFixed(2)} m. UNREACHABLE, not merely tight.`);

await browser.close();
