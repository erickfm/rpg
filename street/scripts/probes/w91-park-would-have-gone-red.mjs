// ITEM 238 — WOULD THE OLD PREDICATE HAVE CALLED THE PARK AN ESCAPE?
//
// The claim to be proved or dropped: `w75-site-contained park` — a REGISTERED
// check — was about to report escapes all over a park that has a floor, because
// item 172 took the park ground plane's world box to 0.653 m on 2026-08-03 and
// the AABB predicate drops anything over 0.600 m.
//
// Arguing it from cell counts is not the same as showing it. So this WALKS the
// player onto the park the way the check does — `__ct.warp` then held `w`, no
// teleporting past anything — and at each place he actually stands it asks BOTH
// predicates. An "escape" in that file is exactly `!hasFloor(x, z, groundAt)`.
//
//   SHOT_URL=http://localhost:4470/ node scripts/probes/w91-park-would-have-gone-red.mjs
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';
import {
  sampleFloors, makeHasFloor, selfTestFloors,
  installRayFloorQuery, selfTestRayQuery,
} from './../lib/floors.mjs';

const SITE = aim('http://localhost:4470/');
let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(SITE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, SITE);
await page.evaluate(() => window.__ct.clock(13, 0));

// OLD predicate (AABB) and NEW predicate (raycast), side by side
const floors = await sampleFloors(page);
const oldHasFloor = makeHasFloor(floors);
const ray = await installRayFloorQuery(page);

{
  const badOld = await selfTestFloors(page, floors, oldHasFloor);
  const badNew = await selfTestRayQuery(page, ray.query, ray.tris);
  report('the OLD predicate still passes its own two-sign control', badOld.length === 0,
    badOld.length ? badOld.join('; ') : 'road solid, off-world void — so it is not simply broken everywhere');
  report('the NEW predicate passes its own two-sign control', badNew.length === 0,
    badNew.length ? badNew.join('; ') : `${ray.tris} triangles, road solid, off-world void`);
  if (badOld.length || badNew.length) { await b.close(); process.exit(3); }
}

const park = await page.evaluate(() => window.__ct.sites().park);
console.log(`\npark site x ${park.minX}…${park.maxX}  z ${park.minZ}…${park.maxZ}`);

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => page.evaluate(([x, z, yaw]) =>
  window.__ct.warp(x, z, yaw), [x, z, yaw]);
const groundAt = (x, z) => page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);

// WALK IN FROM THE FRONTAGE, never teleport into the middle. The park's
// frontage is its east edge (maxX, nearest the street), entered walking west.
// Eight starts spread down the frontage, each held west for 1.2 s.
const starts = [];
for (let n = 0; n < 8; n++) {
  starts.push([park.maxX + 1.5, park.minZ + (park.maxZ - park.minZ) * (n + 0.5) / 8]);
}

// TWELVE LEGS, NOT FOUR. The first version walked 4 x 700 ms — about 9 m at the
// world's 3.3 m/s — which stops in the park's perimeter PATH, and the paths are
// flat meshes the AABB predicate keeps. So it measured the one part of the park
// where the two predicates were always going to agree, and its verdict ("the
// old predicate was fine here") was a fact about the stride, not about the
// park. GOTCHAS 48, exactly. The park is 32 m across; crossing it needs ~14 legs.
const stood = [];
for (const [sx, sz] of starts) {
  await warp(sx, sz, -Math.PI / 2);          // face west, into the park
  await page.waitForTimeout(90);
  for (let leg = 0; leg < 14; leg++) {
    await page.keyboard.down('w');
    await page.waitForTimeout(700);
    await page.keyboard.up('w');
    await page.waitForTimeout(80);
    const p = await pos();
    stood.push([p[0], p[2]]);
  }
}

const inPark = stood.filter(([x, z]) => x >= park.minX && x <= park.maxX && z >= park.minZ && z <= park.maxZ);
report('the walk actually got into the park', inPark.length >= 8,
  `${inPark.length} of ${stood.length} standing positions are inside the park rectangle`);

let oldVoid = 0, newVoid = 0, bothOk = 0;
const oldEscapes = [];
for (const [x, z] of inPark) {
  const gy = await groundAt(x, z);
  const o = oldHasFloor(x, z, gy);
  const r = await ray.query(x, z, gy);
  if (!o) { oldVoid++; if (oldEscapes.length < 8) oldEscapes.push([+x.toFixed(2), +z.toFixed(2)]); }
  if (!r) newVoid++;
  if (o && r) bothOk++;
}

console.log('\n── at places the player is actually standing, inside the park ──');
console.log(`  places stood in-park                      ${inPark.length}`);
console.log(`  OLD (AABB) says NO FLOOR — i.e. ESCAPE    ${oldVoid}`);
console.log(`  NEW (raycast) says NO FLOOR               ${newVoid}`);
console.log(`  both agree there IS floor                 ${bothOk}`);
if (oldEscapes.length) console.log(`  e.g. the old check's escapes: ${JSON.stringify(oldEscapes)}`);

report('the NEW predicate finds floor everywhere the player stands in the park', newVoid === 0,
  `${newVoid} of ${inPark.length} standing positions read void — the park is floored and the raycast says so`);

// ── AND THE CLAIM I COULD NOT MAKE ────────────────────────────────────────
//
// I expected `oldVoid > 0` here — "the park leg was about to go red" — and it
// is 0, twice, at 4 legs and at 14. **So that claim is withdrawn.** The walk
// enters across the perimeter PATH, and the paths are flat meshes the AABB
// predicate keeps; it never gets far enough onto the open grass for the dropped
// ground plane to matter. Reporting this is worth more than a claim that reads
// well (BUILDER-BRIEF §12).
report('the walk-based park regression is NOT reproducible — claim withdrawn', oldVoid === 0,
  `${oldVoid} of ${inPark.length} in-park standing positions read void to the OLD predicate; `
  + 'the walk lands on paths, which the AABB pass keeps');

// What IS true is narrower and still worth knowing: on the open GRASS, away
// from the paths, the two predicates disagree outright. This warps rather than
// walks, so it is a statement about the PREDICATES and NOT about reachability —
// said out loud because conflating the two is how this file's first version
// got it wrong.
{
  const gx0 = park.minX + 2, gx1 = park.maxX - 2;
  const gz0 = park.minZ + 2, gz1 = park.maxZ - 2;
  let n = 0, oldSaysVoid = 0, newSaysVoid = 0, standable = 0, oldVoidStandable = 0;
  for (let x = gx0; x <= gx1; x += 1.5) {
    for (let z = gz0; z <= gz1; z += 1.5) {
      const gy = await groundAt(x, z);
      const o = oldHasFloor(x, z, gy);
      const r = await ray.query(x, z, gy);
      n++;
      if (!o) oldSaysVoid++;
      if (!r) newSaysVoid++;
      // is it somewhere a body could be? colliders padded by the player radius
      const free = await page.evaluate(([x, z]) => !window.__ct.colliders().some((c) =>
        x >= c.minX - 0.36 && x <= c.maxX + 0.36 && z >= c.minZ - 0.36 && z <= c.maxZ + 0.36), [x, z]);
      if (free) { standable++; if (!o) oldVoidStandable++; }
    }
  }
  console.log('\n── across the park interior on a 1.5 m lattice (WARPED, not walked) ──');
  console.log(`  points sampled                          ${n}`);
  console.log(`  OLD (AABB) says NO FLOOR                ${oldSaysVoid}`);
  console.log(`  NEW (raycast) says NO FLOOR             ${newSaysVoid}`);
  console.log(`  clear of every padded collider          ${standable}`);
  console.log(`  clear of colliders AND old-void         ${oldVoidStandable}   <- a body can be here and the old predicate calls it the void`);
  report('the park interior lattice had a population', n >= 200, `${n} points at 1.5 m`);
  report('the NEW predicate floors the whole park interior', newSaysVoid === 0,
    `${newSaysVoid} of ${n} points read void to the raycast`);
  report('the OLD predicate calls open, collider-free park ground the VOID', oldVoidStandable > 0,
    oldVoidStandable > 0
      ? `${oldVoidStandable} points where a body fits and the AABB predicate finds no floor — latent, not currently walked into`
      : 'no disagreement on standable park ground — the under-claim does not reach anywhere a body can be');
}

report('no console errors', errs.length === 0, `${errs.length} page error(s)`);

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
await b.close();
process.exit(fails ? 1 : 0);
