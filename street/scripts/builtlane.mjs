// Is the 2 m sidewalk lane still there — in the geometry, before anyone stands in it?
//
// GOTCHAS §9 calls the 2 m lane sacred and nothing asserted it. What exists:
//
//   lot-frontage   the CAR LOT specifically, does it take any of the walk
//   crowd-walk     a stopped CITIZEN must not seal it (81603988)
//   footprint      does anything on the pavement clip the KERB
//   lanelive       a REPORT — prints numbers, asserts nothing, unregistered
//
// None of those catches the case this one is for: a builder places a bench, a
// planter, a stall, a sign post, and the BUILT lane narrows. That is static
// geometry, it is permanent, and every fix I have made in this area — the
// 0.18 m cushion, the boundary rail that was eating 0.36 m — was exactly it.
//
// STATIC ONLY, and that is load-bearing rather than a convenience. 03d90436
// reported the tightest passage on the street as 0.77 m, bounded by "a 0.50 x
// 0.50 post standing mid-pavement … no citizen involved". This check drops that
// box and reports 1.12 m. The box is a PERSON — watched over six seconds it
// tracks a published walker position exactly and walks 2.8 m down the pavement,
// standing still in x only because they are walking the centreline. Evidence in
// notes/D-the-post-is-a-person.md. So the disagreement is not a hole here; it is
// two different questions, and this one is "what did the BUILDERS leave".
//
// STATIC ONLY, on purpose, and asked of the world rather than inferred:
// `__ct.staticColliders()` is the collider array minus the boxes the citizen
// and vehicle registration hooks declared, BY OBJECT IDENTITY. That makes this
// deterministic and about GEOMETRY, and it leaves the moving case to
// crowd-walk, which now owns it properly.
//
// THE UNITS, because this is where the domain bites. `free(x, z)` asks whether
// a capsule CENTRE may sit at (x, z), testing against colliders inflated by the
// 0.36 m radius. So a run of free positions is a CENTRE-SPAN, and the clear
// width a body passes through is `centre + 2 * RADIUS`. 81603988 hit this
// exactly — "it compares a centre-span against a DIAMETER" — and reported 93
// sealed samples that were not sealed. A centre-span of 0.00 m is a passable
// knife-edge, not a wall.
//
// SCOPE, and a mutation taught me to state it. This reads COLLIDERS, so it is
// about what a body can walk through. My first mutation moved the boundary
// rail's MESH 0.75 m into the walk and this check did not move — correctly:
// ct/street.ts registers that rail's collider in a separate `solid(...)` call
// with its own arithmetic, so the mesh and the barrier are two facts and I had
// changed the wrong one. Moving the collider fires it at once (0.92 m, three
// sections). A prop that LOOKS like it overhangs the walk without colliding is
// invisible here, and that is the right scope for this file rather than an
// oversight — but it is a real gap in coverage and nothing else fills it.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/builtlane.mjs [--selftest]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { assertStaticColliders } from './lib/collide.mjs';
import { reportWorld, integrationNoise } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

// GOTCHAS §34 shape one: a flag that matches nothing must not pass silently.
// `--selftest` is the only argument these take, and `argv.includes` would let
// `--seltest` through — you would believe you had run the selftest, the normal
// check would run instead, and it would print a pass. Refuse what we do not
// understand rather than quietly doing something else.
for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');
const URL = aim('http://localhost:4177/');
// ct/gap.ts: PASSABLE = 0.95, "0.72 m of capsule plus room to turn". Taken from
// the project rather than invented, so this agrees with every other judgement
// about what a body fits through.
const PASSABLE = 0.95;
const CAPSULE = 0.72;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on('pageerror', (e) => {
  // integrationNoise() is the HMR socket in the live world and nothing else.
  if (integrationNoise(e.message)) return;
  errors.push('pageerror: ' + String(e.message));
});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await setClock(page, 13, 0);

// ── the boxes that do not walk ────────────────────────────────────────────
//
// This measured the widest free run across each pavement, which is a question
// about GEOMETRY: is the lane the world was drawn with wide enough? A citizen
// standing in it narrows the run for a second and then leaves, and scoring that
// is how a lane check reports a pinch nobody built.
//
// IT USED TO SAMPLE TWICE, 1.5 s APART, AND KEEP WHAT LOOKED THE SAME. Two
// separate faults in one line, both invisible at the call site: a citizen who
// merely PAUSED (and they pause constantly — see crowd-walk.mjs) was scored as
// masonry, and the comparison was `set.has(key)` over FOOTPRINTS, so any box
// whose 4-tuple matched any other box's kept it alive regardless of which
// object it was. `__ct.staticColliders()` asks by object identity against the
// registration hooks (crosstown.ts:1411) and has neither failure mode.
const counts = await assertStaticColliders(page);
const stat = await page.evaluate(() => window.__ct.staticColliders()
  .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
  .map((c) => [+c.minX.toFixed(3), +c.maxX.toFixed(3), +c.minZ.toFixed(3), +c.maxZ.toFixed(3)]));

const scan = await page.evaluate((boxes) => {
  const RAD = 0.36, S = 0.05;
  // The two pavements, and the bounds are THE PAVEMENT -- ct/rng.ts has
  // ROAD_HALF 5.0, WALK 2.0, FACE 7.0, so the walk is x 5.0..7.0, exactly 2 m.
  //
  // I first wrote -7.4..-4.6, which is 2.8 m: 0.4 m of ROAD and 0.4 m of
  // BUILDING counted as pavement. A scan for the widest free run then returns
  // a corridor partly in the carriageway, and this check reported the street
  // clearing 1.12 m while the tightest passage on it was 0.77 m. 03d90436
  // found that pinch by clipping to the real pavement; the band was the whole
  // difference, and a too-generous band fails in the reassuring direction.
  const WALKS = [
    { lo: -7.0, hi: -5.0, from: 12, to: -104, side: 'west' },
    { lo: 5.0, hi: 7.0, from: 12, to: -94, side: 'east' },
  ];
  const free = (x, z) => !boxes.some((c) =>
    x > c[0] - RAD && x < c[1] + RAD && z > c[2] - RAD && z < c[3] + RAD);
  const out = [];
  for (const W of WALKS) {
    for (let v = W.from; v >= W.to; v -= 0.5) {
      let best = 0, run = 0;
      for (let c = W.lo; c <= W.hi; c += S) {
        run = free(c, v) ? run + S : 0;
        if (run > best) best = run;
      }
      // centre-span -> clear width. See the note at the top of this file.
      out.push({ z: +v.toFixed(1), side: W.side, clear: +(best + 2 * RAD).toFixed(2) });
    }
  }
  return out;
}, stat);

let fails = 0;
const say = (ok, name, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
};

const sorted = [...scan].sort((a, b) => a.clear - b.clear);
const worst = sorted[0];
const sealed = scan.filter((s) => s.clear < CAPSULE);
const tight = scan.filter((s) => s.clear < PASSABLE);
const where = (s) => `${s.clear} m at z ${s.z} on the ${s.side} walk`;

console.log(`  ${counts.all} colliders, ${counts.statics} static `
  + `(${counts.actors} moving — citizens and traffic, dropped by __ct.staticColliders())`);
console.log(`  ${scan.length} cross-sections sampled every 0.5 m\n`);

// ── the mover window is GONE, and so is the guard that watched it ─────────
//
// What stood here: a third snapshot 8 s later, a "ghost" list of boxes that had
// held still through the 1.5 s window and moved afterwards, a full re-scan
// without them, and an assertion that the two scans agreed. Roughly seventy
// lines, all of it compensating for the two-snapshot idiom above — which
// classified by MOTION, so a citizen standing still across the whole window was
// byte-identical in both snapshots and counted as furniture. That is the
// mistake that produced 3f7b2623, a stopped citizen read as a mid-pavement post.
//
// ITS OWN CLOSING PARAGRAPH ASKED FOR THIS, and named the shape exactly:
//
//     "The better fix is not mine: 19e1e9f9 suggests the collider list carry
//      the userData.mod tag that lot, walkup and vice already use, so 'is this
//      a mover' becomes a DECLARATION instead of an inference from two frames.
//      That is ct/props.ts's call, and it would retire this whole section."
//
// The declaration landed with item 81 — `actorBoxes`, populated at the two
// registration hooks and published as `__ct.staticColliders()` — so the
// inference is gone and there is nothing left for the guard to catch. It also
// recorded honestly that it "IS NOT WATCHED FAILING": nobody could manufacture
// a citizen that held still through the short window and moved later, so it was
// seventy lines and an 8 s wait that had never once fired. Deleting a guard is
// normally the wrong move; deleting the guard along with the defect it guarded
// is the point of the migration.
//
// The direction-of-error note it left behind is still true and still worth
// having: a misclassified mover is an ADDED collider, so it can only SHRINK a
// free run. This check could never be fooled into calling a blocked lane clear
// — only into calling a clear lane blocked. That was the residual risk, and it
// is now zero rather than small.

// IS THE WALK STILL WHERE THIS CHECK THINKS IT IS? The bands above are literal
// -7.0..-5.0 and 5.0..7.0, taken from ct/rng.ts's ROAD_HALF 5.0 and FACE 7.0.
// A hard-coded world constant does not fail when the constant moves — it
// quietly measures a different strip. That is exactly how scripts/alley.mjs
// spent an unknown number of runs photographing a DRY alley after rainAt was
// replaced and 15:00 stopped raining.
//
// So the check verifies its own premise: the building line has to be where the
// bands assume, found from the shells rather than from the constant.
const faceX = await page.evaluate(() => {
  let east = -1e9, west = 1e9;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || o.userData?.facing !== 'x') return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.min.x > 0) east = Math.max(east, -bb.min.x); else west = Math.min(west, bb.max.x);
  });
  return { east: -east, west };
});
say(Math.abs(faceX.east - 7.0) < 0.05 && Math.abs(faceX.west + 7.0) < 0.05,
  'the building line is where these bands assume',
  `facades at x ${faceX.west.toFixed(2)} and ${faceX.east.toFixed(2)}, bands assume ±7.00`);

say(scan.length > 300, 'the walk was actually sampled', `${scan.length} cross-sections`);
// A CHECK THAT CAN PASS ON AN EMPTY WORLD HAS ASSERTED NOTHING — GOTCHAS §34,
// which this was one of the instances behind. 32d9d6521 found
// five of its own that could; this was one of mine. The scan walks fixed bands
// of x whatever the world contains, so with no colliders every section reads as
// clear and all three assertions below go green — measured, by making
// colliders() return nothing: "0 colliders, 0 static ... the lane is still 2 m
// of nothing". The count was printed in its own output and nothing consumed it.
//
// Two guards, because they fail for different reasons. The population one
// catches the API going away; the bounded one catches a world that loaded but
// has no geometry on the walk — the free band is 2.0 m of centre-span, so a
// narrowest of 2.72 m means nothing bounded it anywhere along 446 sections.
say(stat.length > 50, 'the world actually has colliders to measure',
  `${stat.length} static of ${counts.all}`);
say(worst.clear < 2.6, 'and the walk is bounded by geometry, not by the band',
  `narrowest ${worst.clear} m against a ${(2.0 + 0.72).toFixed(2)} m unbounded band`);
// The load-bearing one. Static geometry that a body cannot pass is a wall
// across the pavement, and it is permanent — unlike a citizen, it never
// moves out of the way.
say(sealed.length === 0, 'no static geometry seals the walk',
  sealed.length ? `${sealed.length} sections under ${CAPSULE} m, worst ${where(sealed[0])}`
    : `narrowest is ${where(worst)}`);
// ct/gap.ts's line, not one of mine. Between 0.72 and 0.95 a body fits and
// cannot turn, which that file calls a trap.
say(tight.length === 0, 'and none of it is a trap to squeeze through',
  tight.length ? `${tight.length} sections under ${PASSABLE} m: `
    + tight.slice(0, 3).map(where).join(', ') : `all at or above ${PASSABLE} m`);
// What used to be here — "no stopped citizen was counted as furniture" — was an
// assertion about the SNAPSHOT IDIOM, not about the world. The idiom is gone;
// the property it was defending is now structural, and it is worth stating as
// one: every box this scanned came from the static set, so no citizen, standing
// still or otherwise, could be in it. That is asserted where it can actually
// fail, in assertStaticColliders() above, which refuses a world that separated
// nothing rather than reporting a stability it never tested.
say(counts.statics < counts.all, 'the actors really were separated from the geometry',
  `${counts.actors} of ${counts.all} colliders walk, and none of them reached this scan`);
say(errors.length === 0, 'no page errors', errors.length ? errors[0] : 'none');

if (SELFTEST) {
  // Inverting the assertions proves this reads the world. It does NOT prove it
  // would catch a regression in ct/street.ts — that needs a source mutation,
  // and the one it was watched failing on is in notes/D-alley-report.md.
  console.log('\nselftest — asserting the defect, which must FAIL');
  const before = fails;
  say(sealed.length > 0, 'static geometry blocks the walk (the bug)', `${sealed.length} sealed`);
  say(tight.length > 5, 'the walk is full of traps (the bug)', `${tight.length} under ${PASSABLE} m`);
  say(stat.length <= 50, 'the world is empty (the bug)', `${stat.length} static colliders`);
  const caught = fails - before;
  console.log(caught === 3
    ? '\nSELFTEST PASSED — all three inverted assertions were caught'
    : `\nSELFTEST FAILED — only ${caught} of 3 caught`);
  await browser.close();
  process.exit(caught === 3 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nthe lane is still 2 m of nothing');
process.exit(fails ? 1 : 0);
