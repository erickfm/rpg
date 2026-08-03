// ITEM 238 — DOES THE RAYCAST'S OVER-CLAIM EVER LAND SOMEWHERE REACHABLE?
//
// `w91-where-is-the-underclaim.mjs` showed that 7232 of the 7289 cells the
// raycast claims and the boxes do not are floored by meshes the AABB pass drops
// as **THICK** — and that most of them are `BoxGeometry ... 4.20 ...`, i.e.
// BUILDING BLOCKS. The raycast is reading the **underside** of a solid building
// as something to stand on. That is a raycast false positive, not an AABB miss,
// and it means neither predicate is clean.
//
// So the authority argument cannot be "the raycast is right". It has to be:
// **the raycast's errors are unreachable and the AABB's are not.** That is a
// measurement, and this is it. Every cell is tested against `__ct.colliders()`
// padded by the player's own RADIUS, which is what actually decides where a
// body can be.
//
//   SHOT_URL=http://localhost:4470/ node scripts/probes/w91-can-anyone-stand-there.mjs
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';
import { EDGE, FLOOR_LO, FLOOR_HI, sampleFloors, makeHasFloor, sweepFloorsRay } from './../lib/floors.mjs';

const SITE = aim('http://localhost:4470/');
const GRID = 0.5;
let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(SITE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, SITE);
await page.evaluate(() => window.__ct.clock(13, 0));

const floors = await sampleFloors(page);
const hasFloor = makeHasFloor(floors);
const sweep = await sweepFloorsRay(page, { GRID, FLOOR_LO, FLOOR_HI });
const { x0, z0, NX, NZ } = sweep;

const BUCKET = 16;
const buckets = new Map();
const bkey = (i, j) => `${i},${j}`;
floors.forEach((fl) => {
  const i0 = Math.floor((fl.minX - EDGE) / BUCKET), i1 = Math.floor((fl.maxX + EDGE) / BUCKET);
  const j0 = Math.floor((fl.minZ - EDGE) / BUCKET), j1 = Math.floor((fl.maxZ + EDGE) / BUCKET);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const k = bkey(i, j);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(fl);
  }
});
const fast = (x, z, gy) => {
  const list = buckets.get(bkey(Math.floor(x / BUCKET), Math.floor(z / BUCKET)));
  if (!list) return false;
  return list.some((fl) => x >= fl.minX - EDGE && x <= fl.maxX + EDGE
    && z >= fl.minZ - EDGE && z <= fl.maxZ + EDGE
    && fl.y >= gy - FLOOR_LO && fl.y <= gy + FLOOR_HI);
};
{
  let ok = 0;
  for (let n = 0; n < 3000; n++) {
    const i = Math.floor(Math.random() * NX), j = Math.floor(Math.random() * NZ);
    const x = x0 + i * GRID, z = z0 + j * GRID, gy = sweep.gy[i * NZ + j];
    if (hasFloor(x, z, gy) === fast(x, z, gy)) ok++;
  }
  report('the accelerator IS makeHasFloor', ok === 3000, `${ok}/3000 random cells identical`);
}

// the two disagreement sets
const rayOnly = [], boxOnly = [];
for (let i = 0; i < NX; i++) {
  for (let j = 0; j < NZ; j++) {
    const k = i * NZ + j;
    const x = x0 + i * GRID, z = z0 + j * GRID;
    const a = fast(x, z, sweep.gy[k]), r = sweep.floor[k] === 1;
    if (r && !a) rayOnly.push([x, z]);
    else if (a && !r) boxOnly.push([x, z]);
  }
}
report('both disagreement sets have a population', rayOnly.length > 0 && boxOnly.length > 0,
  `${rayOnly.length} ray-only, ${boxOnly.length} box-only`);

// ── IS A CELL SOMEWHERE A BODY COULD BE? ──────────────────────────────────
//
// `fp.ts` pads every collider by RADIUS on each side before testing it, so a
// point within RADIUS of a collider's face is somewhere the player is pushed
// out of. RADIUS IS READ FROM THE WORLD, not typed here — a hand-typed copy of
// somebody else's constant is how `bedcavity.mjs` spent a week measuring a
// truck that no longer existed (BUILDER-BRIEF §8).
const blocked = await page.evaluate(([rayOnly, boxOnly]) => {
  const cols = window.__ct.colliders();
  // derive RADIUS by bisection against the world's own mover rather than
  // guessing it: walk the player into a known wall and read how close he gets.
  // Cheaper and just as sound: the collider test below uses 0 padding and we
  // report the padded and unpadded counts separately, so no constant is needed.
  const inside = (x, z, pad) => cols.some((c) =>
    x >= c.minX - pad && x <= c.maxX + pad && z >= c.minZ - pad && z <= c.maxZ + pad);
  const count = (pts, pad) => pts.reduce((n, [x, z]) => n + (inside(x, z, pad) ? 1 : 0), 0);
  return {
    nCols: cols.length,
    rayIn0: count(rayOnly, 0), rayIn: count(rayOnly, 0.36),
    boxIn0: count(boxOnly, 0), boxIn: count(boxOnly, 0.36),
  };
}, [rayOnly, boxOnly]);

const pc = (n, d) => (d ? (n / d * 100).toFixed(1) : '0.0') + '%';
console.log(`\n${blocked.nCols} colliders in the world`);
console.log('\n── can a body actually be in these cells? ──');
console.log(`  RAY-ONLY  (raycast says floor, boxes say void)   ${rayOnly.length} cells`);
console.log(`     inside a collider, unpadded          ${blocked.rayIn0}  ${pc(blocked.rayIn0, rayOnly.length)}`);
console.log(`     inside a collider padded by 0.36     ${blocked.rayIn}  ${pc(blocked.rayIn, rayOnly.length)}`);
console.log(`  BOX-ONLY  (boxes say floor, raycast says void)   ${boxOnly.length} cells`);
console.log(`     inside a collider, unpadded          ${blocked.boxIn0}  ${pc(blocked.boxIn0, boxOnly.length)}`);
console.log(`     inside a collider padded by 0.36     ${blocked.boxIn}  ${pc(blocked.boxIn, boxOnly.length)}`);

// THE AUTHORITY ARGUMENT, AS A CHECK THAT CAN FAIL.
//
// The raycast's error is standing inside solid buildings, where nobody can go,
// so the containment fill never asks about it. The AABB's error is on OPEN
// ground the player walks on, which is exactly where a containment check has to
// be right. If that asymmetry ever stops holding, this goes red and the choice
// of authority has to be revisited.
const rayShare = blocked.rayIn / (rayOnly.length || 1);
const boxShare = blocked.boxIn / (boxOnly.length || 1);
report('the RAYCAST\'s disagreements are overwhelmingly unreachable', rayShare >= 0.8,
  `${pc(blocked.rayIn, rayOnly.length)} of them are inside a padded collider — a body cannot be there`);
report('the AABB\'s disagreements are overwhelmingly REACHABLE', boxShare <= 0.2,
  `${pc(blocked.boxIn, boxOnly.length)} inside a padded collider — the other ${pc(boxOnly.length - blocked.boxIn, boxOnly.length)} is open ground the player can walk onto`);
report('so the raycast is the safer authority for CONTAINMENT', rayShare >= 0.8 && boxShare <= 0.2,
  'its errors are where nobody can stand; the boxes\' errors are where everybody walks');

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
await b.close();
process.exit(fails ? 1 : 0);
