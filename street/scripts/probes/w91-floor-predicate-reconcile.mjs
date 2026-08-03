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
// the mesh-selection pass, from each file, as source text to be RUN in the page
const libSel = between(libSrc, 'const out = [];', 'return out;');
const w75Sel = between(w75Src, 'const out = [];', 'return out;');
// the point test
const libTest = between(libSrc, '(x, z, gy) => floors.some', 'FLOOR_HI);');
const w75Test = between(w75Src, '(x, z, gy) => floors.some', 'FLOOR_HI);');
{
  const got = [libSel, w75Sel, libTest, w75Test].every(Boolean);
  report('leg 1 and leg 2 were both located in their files', got,
    got ? 'mesh filter and point test found in each' : 'COULD NOT LOCATE — the equivalence below proves nothing');
  if (!got) { console.log('cannot compare legs 1 and 2'); process.exit(3); }

  // THE POINT TEST IS COMPARED AS TEXT because it is one expression and it is
  // genuinely character-identical. THE MESH FILTER IS NOT — the two files
  // declare the same six accumulators differently (`let a, b, c;` on two lines
  // against one), which is a formatting difference and not a behavioural one.
  // Asserting on the text there would go red on whitespace and teach everyone
  // to ignore it, so the mesh filter is compared by RUNNING BOTH instead, a few
  // lines below, once the page is up.
  report('leg 2 IS leg 1 — the point test, character for character', norm(libTest) === norm(w75Test),
    norm(libTest) === norm(w75Test) ? 'w75-site-contained.mjs:178-180 == lib/floors.mjs:67-70'
      : 'THEY HAVE DIVERGED — one was edited and the other was not');

  // and the constants, read from each file rather than retyped here
  const constOf = (src, name) => {
    const m = src.match(new RegExp(`${name}\\s*=\\s*(-?[0-9.]+)`));
    return m ? +m[1] : null;
  };
  const same = ['EDGE', 'FLOOR_LO', 'FLOOR_HI'].filter((k) => constOf(libSrc, k) === constOf(w75Src, k));
  report('leg 1 and leg 2 carry the same three constants', same.length === 3,
    `${same.join(', ')} agree (EDGE ${constOf(libSrc, 'EDGE')}, LO ${constOf(libSrc, 'FLOOR_LO')}, HI ${constOf(libSrc, 'FLOOR_HI')})`);
}

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

// ── LEG 2 IS LEG 1, PROVED BY RUNNING BOTH ────────────────────────────────
//
// Each file's own mesh-filter source is lifted out and executed against the
// same live scene. If the two arrays match element for element, the two files
// select the same meshes and compute the same boxes — which is the only sense
// of "the same predicate" that matters. This CAN fail: change a threshold in
// one file and the arrays diverge.
{
  const run = (body) => page.evaluate(`(() => { ${body} return out; })()`);
  const [a, c] = [await run(libSel), await run(w75Sel)];
  const same = a.length === c.length && JSON.stringify(a) === JSON.stringify(c);
  report('leg 2 IS leg 1 — both files\' mesh filters, run on the same scene', same,
    same ? `both selected the identical ${a.length} floor boxes`
      : `leg 1 selected ${a.length} boxes, leg 2 selected ${c.length} — THEY HAVE DIVERGED`);
  report('the mesh-filter comparison had a population to compare', a.length >= 100,
    `${a.length} floor-shaped meshes (want >= 100)`);
}

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
console.log(`  ray floor, AABB VOID  ${rayOnly}   <- must be 0: a box always contains its own mesh`);
console.log(`  agreement             ${((both + neither) / total * 100).toFixed(2)}%`);
if (boxOnlyPts.length) console.log(`  e.g. AABB-only: ${JSON.stringify(boxOnlyPts)}`);
if (rayOnlyPts.length) console.log(`  e.g. ray-only:  ${JSON.stringify(rayOnlyPts)}`);

// THE SIGN OF THE DISAGREEMENT IS THE WHOLE ARGUMENT FOR WHICH ONE WINS.
// A bounding box always contains the mesh it was computed from, so it can
// over-claim and can never under-claim. If `rayOnly` is non-zero the raycast is
// missing geometry the boxes can see, and that argument collapses.
report('the disagreement is one-signed — boxes over-claim, never under-claim', rayOnly === 0,
  rayOnly === 0 ? `${boxOnly} cells claimed by the boxes alone, 0 by the raycast alone`
    : `${rayOnly} cells the RAYCAST alone claims — it is missing geometry, the authority argument fails`);
report('the two predicates measurably disagree', boxOnly > 0,
  `${boxOnly} cells (${(boxOnly / total * 100).toFixed(2)}% of the grid) — at least one containment check is wrong about them`);

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
