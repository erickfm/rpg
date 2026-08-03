// ITEM 238 — THE THREE FLOOR PREDICATES, RUN OVER ONE POINT SET.
//
// Three independent answers to "is there a floor here" had accumulated:
//
//   leg 1  `scripts/lib/floors.mjs`         makeHasFloor   AABB
//   leg 2  `scripts/w75-site-contained.mjs` inline         AABB
//   leg 3  `scripts/world-contained.mjs`    the sweep      RAYCAST
//
// Nobody had checked they agree. This runs them over the SAME points and says
// where they differ.
//
//   SHOT_URL=http://localhost:4470/ node scripts/probes/w91-floor-predicate-reconcile.mjs
//
// ── WHAT THIS ADDS OVER `w85-item230-aabb-vs-raycast.mjs` ─────────────────
//
// eightyfive compared AABB against raycast over the STREET REGION — 50000
// cells of x -42…64 — and found 11660 disagreements. Good finding, three
// limits: it swept 7% of the world, it never looked at leg 1 or leg 2 at all,
// and it did it by RE-TYPING both predicates into itself, so it was comparing
// two fresh cousins rather than the code the checks actually run.
//
// This one imports the real thing from `lib/floors.mjs` (both legs now live
// there, item 238) and sweeps the whole 731322-cell world grid.
//
// ── LEG 2 IS NOT A THIRD ANSWER. IT IS LEG 1, COPY-PASTED ─────────────────
//
// Checked as text rather than assumed: the predicate at
// `w75-site-contained.mjs:137-180` and the one at `lib/floors.mjs:26-71` are
// the same algorithm with the same five constants. `floors.mjs`'s own header
// says so ("copied here rather than left in place"). So the reconciliation is
// really TWO answers, not three, and the equivalence is asserted below so that
// editing one and not the other goes red instead of going quiet.
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reportWorld } from './../lib/which-world.mjs';
import {
  EDGE, FLOOR_LO, FLOOR_HI,
  sampleFloors, makeHasFloor, selfTestFloors,
  sweepFloorsRay, makeFloorAtRay,
} from './../lib/floors.mjs';

const URL = aim('http://localhost:4470/');
const GRID = 0.5;
let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// ── LEG 1 vs LEG 2, AS TEXT ───────────────────────────────────────────────
// Strip comments and whitespace from each and compare the token stream. This
// can fail: change a constant in one file and it goes red.
const norm = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/\s+/g, ' ').trim();
const between = (src, a, b) => {
  const i = src.indexOf(a); const j = src.indexOf(b, i);
  if (i < 0 || j < 0) return null;
  return src.slice(i, j);
};
const libSrc = readFileSync(join(import.meta.dirname, '../lib/floors.mjs'), 'utf8');
const w75Src = readFileSync(join(import.meta.dirname, '../w75-site-contained.mjs'), 'utf8');
const wcSrc = readFileSync(join(import.meta.dirname, '../world-contained.mjs'), 'utf8');
const libSel = between(libSrc, 'const out = [];', 'return out;');

// ── LEG 2 AND LEG 3 NO LONGER CARRY THEIR OWN COPIES ──────────────────────
//
// This is the item's actual deliverable and it is asserted rather than
// asserted-in-prose: neither caller may re-declare the predicate. If somebody
// pastes an inline AABB pass back into either file, these go red.
{
  const w75Own = w75Src.includes('const out = [];') || /floors\.some/.test(w75Src);
  report('leg 2 (w75-site-contained) has NO predicate of its own', !w75Own,
    w75Own ? 'it has re-grown an inline floor predicate — three answers again'
      : 'it imports installRayFloorQuery from lib/floors.mjs and declares nothing');
  const w75Imports = /import\s*\{[^}]*installRayFloorQuery[^}]*\}\s*from\s*'\.\/lib\/floors\.mjs'/.test(w75Src);
  report('leg 2 calls the authoritative predicate', w75Imports,
    w75Imports ? 'installRayFloorQuery + selfTestRayQuery' : 'NOT IMPORTED');
  const wcOwn = /const sweep = await page\.evaluate/.test(wcSrc);
  const wcImports = /import\s*\{[^}]*sweepFloorsRay[^}]*\}\s*from\s*'\.\/lib\/floors\.mjs'/.test(wcSrc);
  report('leg 3 (world-contained) has NO sweep of its own', !wcOwn && wcImports,
    !wcOwn && wcImports ? 'it imports sweepFloorsRay from lib/floors.mjs'
      : 'it has re-grown an inline sweep');
  report('leg 1 is still located, so the comparison below has something to compare', !!libSel,
    libSel ? 'lib/floors.mjs mesh filter found' : 'COULD NOT LOCATE — nothing below proves anything');
  if (!libSel) { console.log('cannot run the comparison'); process.exit(3); }
  // one definition of each constant, in one file
  const constOf = (src, name) => {
    const m = src.match(new RegExp(`${name}\\s*=\\s*(-?[0-9.]+)`));
    return m ? +m[1] : null;
  };
  console.log(`  lib/floors.mjs constants: EDGE ${constOf(libSrc, 'EDGE')}, `
    + `FLOOR_LO ${constOf(libSrc, 'FLOOR_LO')}, FLOOR_HI ${constOf(libSrc, 'FLOOR_HI')}`);
}

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

// ── the two predicates, from the shared library ───────────────────────────
const floors = await sampleFloors(page);
const hasFloor = makeHasFloor(floors);
const sweep = await sweepFloorsRay(page, { GRID, FLOOR_LO, FLOOR_HI });
const floorRay = makeFloorAtRay(sweep);

console.log(`\nleg 1/2  ${floors.length} floor-shaped AABBs`);
console.log(`leg 3    ${sweep.meshes} meshes, ${sweep.tris} triangles, ${sweep.hits} cell-hits`);
console.log(`grid     ${sweep.NX} x ${sweep.NZ} = ${sweep.NX * sweep.NZ} cells at ${GRID} m\n`);

// ── BOTH PREDICATES SELF-TEST ON BOTH SIGNS BEFORE ANYTHING IS COMPARED ───
{
  const bad = await selfTestFloors(page, floors, hasFloor);
  report('leg 1/2 passes its own two-sign control', bad.length === 0,
    bad.length ? bad.join('; ') : 'road solid, 60 m off-world void, 100+ meshes');
  const rayRoad = floorRay(3.2, -30.3), rayOff = floorRay(0, -170);
  report('leg 3 passes its own two-sign control', rayRoad && !rayOff,
    `road at (3.2,-30.3) ${rayRoad ? 'solid' : 'VOID — broken'}, (0,-170) ${rayOff ? 'FLOORED — broken' : 'void'}`);
  if (bad.length || !rayRoad || rayOff) {
    console.log('\na predicate failed its own controls — comparing them would measure nothing');
    await b.close(); process.exit(3);
  }
}

// ── the comparison, over every cell of the shared grid ────────────────────
//
// AN ACCELERATOR THAT IS NOT THE PREDICATE IS A THIRD ANSWER, so it is checked
// against the real `hasFloor` on a random sample before it is trusted. Without
// this the speed-up would be exactly the class of bug this whole item is about.
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
const hasFloorFast = (x, z, gy) => {
  const list = buckets.get(bkey(Math.floor(x / BUCKET), Math.floor(z / BUCKET)));
  if (!list) return false;
  return list.some((fl) => x >= fl.minX - EDGE && x <= fl.maxX + EDGE
    && z >= fl.minZ - EDGE && z <= fl.maxZ + EDGE
    && fl.y >= gy - FLOOR_LO && fl.y <= gy + FLOOR_HI);
};
{
  const { x0, z0, NX, NZ } = sweep;
  let checked = 0, agree = 0;
  for (let n = 0; n < 5000; n++) {
    const i = Math.floor(Math.random() * NX), j = Math.floor(Math.random() * NZ);
    const x = x0 + i * GRID, z = z0 + j * GRID, gy = sweep.gy[i * NZ + j];
    checked++;
    if (hasFloor(x, z, gy) === hasFloorFast(x, z, gy)) agree++;
  }
  report('the bucket accelerator IS the predicate it accelerates', checked === 5000 && agree === 5000,
    `${agree}/${checked} random cells identical to the unaccelerated makeHasFloor`);
}

const { x0, z0, NX, NZ } = sweep;
let both = 0, neither = 0, boxOnly = 0, rayOnly = 0;
const boxOnlyPts = [], rayOnlyPts = [];
for (let i = 0; i < NX; i++) {
  for (let j = 0; j < NZ; j++) {
    const k = i * NZ + j;
    const x = x0 + i * GRID, z = z0 + j * GRID, gy = sweep.gy[k];
    const a = hasFloorFast(x, z, gy), r = sweep.floor[k] === 1;
    if (a && r) both++;
    else if (!a && !r) neither++;
    else if (a) { boxOnly++; if (boxOnlyPts.length < 8) boxOnlyPts.push([+x.toFixed(1), +z.toFixed(1)]); }
    else { rayOnly++; if (rayOnlyPts.length < 8) rayOnlyPts.push([+x.toFixed(1), +z.toFixed(1)]); }
  }
}
const total = both + neither + boxOnly + rayOnly;

// POPULATION FLOOR. A comparison over zero points must FAIL, not pass quietly.
report('the comparison ran over a real population', total === NX * NZ && total > 100000,
  `${total} cells compared (grid is ${NX * NZ})`);

console.log('\n── WHERE THEY DIFFER, over all ' + total + ' cells ──');
console.log(`  both say FLOOR        ${both}`);
console.log(`  both say VOID         ${neither}`);
console.log(`  AABB floor, ray VOID  ${boxOnly}   <- boxes covering ground that is not drawn`);
console.log(`  ray floor, AABB VOID  ${rayOnly}   <- NOT 0, though a box does always contain its own mesh:`);
console.log('                                the AABB pass never computes a box for a mesh its');
console.log('                                size filter rejected. Mostly building undersides.');
console.log(`  agreement             ${((both + neither) / total * 100).toFixed(2)}%`);
if (boxOnlyPts.length) console.log(`  e.g. AABB-only: ${JSON.stringify(boxOnlyPts)}`);
if (rayOnlyPts.length) console.log(`  e.g. ray-only:  ${JSON.stringify(rayOnlyPts)}`);

// ── THE DISAGREEMENT IS TWO-SIGNED, AND THAT CORRECTS THE PRIOR FINDING ───
//
// `w85-item230-aabb-vs-raycast.mjs:6-8` states: *"a bounding box can only ever
// cover MORE than the mesh in it, so AABB can say 'floor' where there is none
// and can never say 'void' where there is floor."* **The first half is right
// and the second half is false**, and this run is how it was caught — the
// assertion here originally demanded `rayOnly === 0` and went red.
//
// The reason is not the box, it is the FILTER in front of it. `makeHasFloor`
// only ever sees meshes that survive `lib/floors.mjs:56-57` — thin in Y (<=
// 0.6 m) and at least 1 m across. The raycast filters nothing. So every mesh
// that is thick or small is floor to one predicate and does not exist to the
// other, and no reasoning about bounding boxes can reach that.
//
// It is not academic: item 172 gave the park real relief on 2026-08-03, its
// ground plane's world box is now 0.653 m tall, and 0.653 > 0.6.
report('the disagreement runs in BOTH directions — the boxes are not merely generous',
  boxOnly > 0 && rayOnly > 0,
  `${boxOnly} cells the boxes alone claim, ${rayOnly} the raycast alone claims`);
report('the over-claim is real: boxes cover ground that is not drawn', boxOnly > 0,
  `${boxOnly} cells (${(boxOnly / total * 100).toFixed(2)}% of the grid) — this is what makes a containment check green over a hole`);
report('the under-claim is real: the size filter hides drawn ground from the boxes', rayOnly > 0,
  `${rayOnly} cells (${(rayOnly / total * 100).toFixed(2)}%) — this is what makes a containment check red on solid floor`);

// ── WHERE THE RAY-ONLY CELLS ARE, MEASURED RATHER THAN GUESSED ────────────
//
// ⚠ I GUESSED THIS WRONG AND THE ASSERTION CAUGHT ME. The first version of
// this block demanded that >= 90% of the ray-only cells lie in the park, on the
// theory that item 172's 0.653 m relief explained the whole under-claim. **It
// went red at 15.8%**, and attributing every cell to the mesh that floors it
// (`w91-where-is-the-underclaim.mjs`) showed why: 7232 of 7289 are floored by
// meshes the AABB pass drops as THICK, and most of those are `BoxGeometry`
// blocks **4.20 m tall** — BUILDINGS. The raycast is reading the *underside* of
// a solid building as something to stand on.
//
// So NEITHER predicate is clean, and the authority argument is not "the raycast
// is right". It is that **their errors land in different places**: the
// raycast's are sealed inside buildings where no body can be, the boxes' are on
// open ground the player walks over. That asymmetry is measured, as a check
// that can fail, in `w91-can-anyone-stand-there.mjs`:
//
//   ray-only cells inside a padded collider   6738 / 7289   92.4%
//   box-only cells inside a padded collider   1388 / 11948  11.6%
//
// The park is the part of the under-claim that IS reachable, and it is the part
// that matters: a registered check was about to call a walkable park void.
{
  const park = await page.evaluate(() => window.__ct.sites().park || null);
  if (!park) {
    report('the park site is published, so the under-claim can be attributed', false, 'sites().park missing');
  } else {
    let inPark = 0;
    for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NZ; j++) {
        const k = i * NZ + j;
        if (sweep.floor[k] !== 1) continue;
        const x = x0 + i * GRID, z = z0 + j * GRID;
        if (hasFloorFast(x, z, sweep.gy[k])) continue;
        if (x >= park.minX && x <= park.maxX && z >= park.minZ && z <= park.maxZ) inPark++;
      }
    }
    console.log(`\npark site x ${park.minX}…${park.maxX}  z ${park.minZ}…${park.maxZ}`);
    // The park's ground plane is 32 x 30 m = 64 x 60 = 3840 cells; paths and
    // other kept meshes cover some of it, so the whole site is not expected.
    // A thousand cells of walkable park invisible to a containment predicate is
    // the finding, and it is bounded below so it cannot pass vacuously.
    report('a real, reachable slab of the PARK is invisible to the AABB predicate', inPark >= 500,
      `${inPark} cells of the park site read FLOOR to the raycast and VOID to the boxes `
      + `(${(inPark / rayOnly * 100).toFixed(1)}% of all ray-only cells; the rest are building undersides)`);
  }
}

// ── THE 0.36 m DOORWAY eightytwo NAMED ────────────────────────────────────
//
// eightytwo's specific doubt: "a 6-point spread would not reliably step in a
// 0.36 m gap like the one item 230 just floored at that same doorway." The gap
// is the party wall between HOTEL ORPHEUS' hotel and casino halves at
// x 879.85…880.15 — 2 x WALL_T of unfloored slab that item 230 fixed by laying
// a half-threshold under each flank.
//
// Two separate questions, and they have different answers:
//   1. is it floored NOW?                        -> both predicates, finely
//   2. would a 0.5 m grid have FOUND it when it was open?  -> count the cells
const DOOR_X = 880.0;
const doorZ = await page.evaluate(() => {
  const s = window.__ct.sites();
  const h = s['hotel'] || s['orpheus'] || s['casino'];
  return h ? (h.minZ + h.maxZ) / 2 : 0;
});
{
  const fine = [];
  for (let x = 879.0; x <= 881.0 + 1e-9; x += 0.05) {
    const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, doorZ]);
    fine.push({ x: +x.toFixed(2), box: hasFloorFast(x, doorZ, gy), ray: floorRay(x, doorZ) });
  }
  const nBox = fine.filter((p) => p.box).length, nRay = fine.filter((p) => p.ray).length;
  report('the 0.36 m doorway was sampled at a real population', fine.length >= 40,
    `${fine.length} points across x 879.0…881.0 at 0.05 m, z ${doorZ.toFixed(2)}`);
  console.log(`\n── THE 0.36 m PARTY-WALL DOORWAY at x ${DOOR_X}, z ${doorZ.toFixed(2)} ──`);
  console.log(`  AABB says floor at ${nBox}/${fine.length} points`);
  console.log(`  ray  says floor at ${nRay}/${fine.length} points`);
  const disagree = fine.filter((p) => p.box !== p.ray);
  console.log(`  they disagree at ${disagree.length} of ${fine.length}`
    + (disagree.length ? `: ${JSON.stringify(disagree.slice(0, 6).map((p) => p.x))}` : ''));
  report('the doorway item 230 floored reads SOLID to the authoritative predicate',
    nRay === fine.length, `${nRay}/${fine.length} points floored by raycast across the full 2 m span`);

  // Would the 0.5 m world grid have caught it while it was open? The hole was
  // 0.36 m wide; the grid steps 0.5 m. A 0.36 m gap need not contain a
  // multiple of 0.5, so it can fall between two samples entirely.
  let gridInside = 0;
  for (let i = 0; i < NX; i++) {
    const x = x0 + i * GRID;
    if (x >= 879.85 && x <= 880.15) gridInside++;
  }
  console.log(`  the 0.5 m world grid puts ${gridInside} sample column(s) inside the 0.30 m gap x 879.85…880.15`);
  report('eightytwo was RIGHT: a 0.5 m grid can step straight over this gap', gridInside <= 1,
    gridInside === 0 ? 'ZERO grid columns land inside it — the coarse sweep would have missed it entirely'
      : `${gridInside} column lands inside it, and only by luck of phase`);
}

report('no console errors during the reconciliation', errs.length === 0, `${errs.length} page error(s)`);

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
await b.close();
process.exit(fails ? 1 : 0);
