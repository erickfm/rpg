// DOES EVERY DROPPED PROP STAND WHERE IT WAS PUT DOWN?
//
// Item 225, the guard over item 219. Item 219 was a prop pushing itself out of
// its own side panels: `ct/props.ts` tagged the litter GROUP and the obstacle
// test read the NODE, so a milk crate found its own four uprights in
// `dimWorld`'s `solidsNear` set and the push-out pass shoved it clear of itself.
// The scatter is weighted toward the road, which is how a crate walked into the
// user's thrift-shop doorway. Fixed by walking the parent chain.
//
// ── WHY `footprint.mjs` WOULD NOT HAVE CAUGHT IT, AND WAS RIGHT NOT TO ──────
//
// The crate was pushed OUT into clear pavement, which is a perfectly legal place
// for a crate to be. Every existing check agreed, correctly. Nothing anywhere
// asserted that a prop LANDS ON THE COORDINATE IT WAS AUTHORED AT, so the repair
// was one careless edit from silently reverting and the next person to notice
// would have been the user, again.
//
// ── THE ROW'S "DONE WHEN" IS TOO STRONG AS WRITTEN, AND SAYING SO IS THE JOB ─
//
// "Assert authored-vs-landed for every dropped prop" reads as: nothing ever
// moves. THAT IS FALSE ON MAINLINE AND SHOULD BE. Measured here, three pieces
// land off the coordinate `drop()` was given, and they are not the bug:
//
//   flattened cardboard  authored ( 6.66, -76.00)  placed ( 6.527, -76.00)  landed ( 6.527, -76.455)
//   flattened cardboard  authored ( 6.58, -26.50)  placed ( 6.513, -26.50)  landed ( 6.493, -26.50)
//   flattened cardboard  authored (-9.40, -42.40)  placed (-9.400, -42.40)  landed (-9.332, -42.40)
//
// TWO STAGES MOVE A PROP AND THEY ARE DIFFERENT QUESTIONS. `drop()` itself
// applies `clearOfKerb` and the building-line clamp — deterministic, per-piece,
// and the reason "authored" and "placed" differ above. `dimWorld`'s push-out
// pass (`ct/props.ts:1240`) runs much later, and it exists to keep litter out of
// BUILDINGS: "the footprint rule tests against GROUND SURFACES, it has nothing
// to say about a wall". A sheet of cardboard stepping off a stallriser is that
// feature working. **Item 219 was never "litter moved"; it was "litter moved for
// no reason outside itself".**
//
// ── SO WHAT THIS ASSERTS ────────────────────────────────────────────────────
//
// The invariant worker seventyeight's own note names:
//
//     A PROP MAY NOT BE MOVED BY ITSELF.
//
// and the props that CAN be moved by themselves are exactly identifiable, from
// the world, with no history and no reconstruction: a prop whose own geometry
// clears `dimWorld`'s `h >= 0.25` solid gate is a prop that would have entered
// its own obstacle set under the pre-fix node-only test. Today that is the three
// milk crates and nothing else — cardboard and newspaper lie flatter and never
// entered the set, which is precisely why crates alone suffered.
//
// **Every such prop must stand exactly where `drop()` put it.** Revert the
// ancestry walk and all three leave, by 0.42–0.56 m, and this goes red.
//
// A FIRST CUT TRIED TO BE CLEVERER AND I AM LEAVING THE FAILURE IN THE FILE.
// It asked, of every mover, "put it back where `drop()` left it — is a non-litter
// solid there to explain the move?" That is the more general property and it
// reported the alley cardboard as shoved 0.068 m by NOTHING. It is not the
// item-219 bug — the piece is 0.061 m tall, cannot enter its own obstacle set,
// and lands identically in seventyeight's pre-fix and post-fix dumps — so the
// reconstruction is what is wrong, not the world. The likeliest reason is that
// `dimWorld` calls `Box3.setFromObject` on each MESH, which in three.js also
// swallows that mesh's CHILDREN, while the harness boxes each mesh's own
// geometry; a parent mesh with children therefore has a bigger box in the placer
// than in any harness that reads it back. Written up in the handoff note as a
// finding, NOT worked around here. BUILDER-BRIEF §7: half of all "defects" here
// are the instrument, and an assertion I cannot explain is not one I will ship.
//
// ── FIVE LEGS ───────────────────────────────────────────────────────────────
//
//   1  population floor — 14 litter groups, a real solid set, authored
//      coordinates present, and at least 3 props that CAN self-push
//   2  every self-pushable prop stands exactly where drop() placed it  ← the guard
//   3  the full displacement set matches the recorded baseline, so a NEW mover
//      is red even if it is flat — the other direction, which leg 2 cannot see
//   4  every prop is on the ground it was seated on (no piece left in the air)
//   5  the two user-approved alley crates are on their stated coordinates, pinned
//
// Usage:  SHOT_URL=http://localhost:4360/ node scripts/prop-landing.mjs [--selftest]
// Exit:   0 every prop's position is accounted for
//         1 one or more is not
//         2 the world could not be measured, or no assertion ran — never a pass
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { reportWorld } from './lib/which-world.mjs';

const F = flags(['--selftest']);
const URL = aim('http://localhost:4360/');

// THE WORLD PLACES 14. A floor, not an equality: adding a fifteenth piece of
// litter is an ordinary edit and must not turn this red. Losing eleven of them
// is not — and `drop()` returns SILENTLY for a name that is not in the
// CATALOGUE, so a typo removes a piece with no warning anywhere.
const MIN_GROUPS = 12;
// dimWorld's own solid gate, quoted from ct/props.ts:1300-1301.
const SOLID_MIN_H = 0.25, SOLID_MAX_Y = 1.6;
// AT LEAST THIS MANY PROPS MUST BE ABLE TO SELF-PUSH, or leg 2 is vacuous. The
// world has three milk crates and they are the entire population the item-219
// bug could ever have touched; a build where that set is empty has not proved
// the fix holds, it has stopped testing it (GOTCHAS 79).
const MIN_SELF_PUSHABLE = 3;
// A move under this is float noise in a box round-trip, not a push. The
// legitimate pushes are 0.020 m at the smallest; the bug's were 0.42–0.56 m.
const EPS = 1e-3;

// ── THE DISPLACEMENT BASELINE ───────────────────────────────────────────────
//
// Every prop the push-out pass moves, keyed by where `drop()` placed it. This is
// the `notes/texdensity-baseline.json` pattern: the check fails on a CHANGE, not
// on a threshold somebody chose, so a new mover is red even when the move itself
// is small and legal.
//
// It is a baseline and not an allow-list, and the difference matters: an
// allow-list says "these may move by any amount", which is what the bug did. This
// says "these move by exactly this much". Move a shopfront and this goes red and
// wants a human — which is correct for a guard over a composition the user
// signed off on.
const BASELINE = [
  { at: [6.527, -76.00], to: [6.527, -76.455], why: 'steps off the frontage at the south end' },
  { at: [6.513, -26.50], to: [6.493, -26.50], why: 'steps off the building line' },
  { at: [-9.400, -42.40], to: [-9.332, -42.40], why: 'alley — 0.068 m, mover NOT identified; see the note above' },
];

// THE TWO ALLEY CRATES, PINNED. This IS a hand-typed copy and it is deliberate;
// BUILDER-BRIEF §8 asks for a citation when a copy is the right answer, and here
// it is the whole job. `ct/props.ts:3614-3615` states these two x values with a
// comment saying they are NOT free to tidy: they are what the self-push bug had
// been producing, so they are what the user has been looking at, and
// `ct/cat.ts:239-300` composed the alley frame around them over SEVEN iterations
// against his own screenshots.
//
// Deriving them from props.ts would defeat the purpose. The risk is somebody
// "cleaning up" -11.639 to -11.60, and a check that reads its expectation out of
// the very line it guards cannot see that happen. An independent pin can.
const APPROVED_CRATES = [
  { x: -11.639, z: -39.60 },     // ct/props.ts:3614
  { x: -11.016, z: -40.35 },     // ct/props.ts:3615
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

const results = [];
const check = (name, ok, detail) => { results.push([ok, name, detail]); };
const f3 = (n) => +n.toFixed(3);

const world = await p.evaluate(([SOLID_MIN_H, SOLID_MAX_Y]) => {
  // A WORLD AABB BY HAND. `dimWorld` uses `Box3.setFromObject`, i.e. the box of
  // the WORLD-TRANSFORMED vertices, and worker seventyeight's first probe read
  // `geometry.boundingBox` instead — LOCAL space, before the mesh's own rotation
  // — and so called a flat sheet of cardboard 0.5 m tall and reported 12 of 14
  // groups self-pushing, the exact opposite of the finding. Measure what dimWorld
  // measures.
  const boxOf = (m) => {
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    if (!bb) return null;
    m.updateMatrixWorld(true);
    const e = m.matrixWorld.elements;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
      const v = [e[0] * cx + e[4] * cy + e[8] * cz + e[12],
                 e[1] * cx + e[5] * cy + e[9] * cz + e[13],
                 e[2] * cx + e[6] * cy + e[10] * cz + e[14]];
      for (let i = 0; i < 3; i++) { if (v[i] < lo[i]) lo[i] = v[i]; if (v[i] > hi[i]) hi[i] = v[i]; }
    }
    return { lo, hi };
  };
  const isLitter = (o) => { for (let u = o; u; u = u.parent) if (u.userData?.litter) return true; return false; };

  const scene = window.__ct.scene();
  const groups = [];
  let solidCount = 0;
  scene.traverse((o) => {
    if (o.userData?.litter) {
      // HOW MANY OF THIS GROUP'S OWN MESHES WOULD HAVE ENTERED ITS OWN OBSTACLE
      // SET under the pre-fix node-only tag test at ct/props.ts:1268. Non-zero
      // means this prop is capable of pushing itself, which is what makes it the
      // population leg 2 is about.
      let self = 0, top = -Infinity;
      o.traverse((m) => {
        if (!m.isMesh || !m.geometry) return;
        const bx = boxOf(m);
        if (!bx || !Number.isFinite(bx.lo[0])) return;
        if (bx.hi[1] > top) top = bx.hi[1];
        const h = bx.hi[1] - bx.lo[1];
        if (h >= SOLID_MIN_H && bx.lo[1] <= SOLID_MAX_Y) self++;
      });
      const w = o.getWorldPosition(new o.position.constructor());
      groups.push({
        kind: o.userData.litter,
        landedX: w.x, landedY: w.y, landedZ: w.z,
        authoredX: o.userData.authoredX ?? null, authoredZ: o.userData.authoredZ ?? null,
        placedX: o.userData.placedX ?? null, placedZ: o.userData.placedZ ?? null,
        groundY: o.userData.groundY ?? null, onStreet: !!o.userData.onStreet,
        selfSolids: self, top: Number.isFinite(top) ? top : null,
      });
      return;
    }
    if (!o.isMesh || !o.geometry) return;
    if (isLitter(o)) return;
    const bx = boxOf(o);
    if (!bx || !Number.isFinite(bx.lo[0])) return;
    const h = bx.hi[1] - bx.lo[1];
    if (h < SOLID_MIN_H || bx.lo[1] > SOLID_MAX_Y) return;
    if (bx.hi[0] - bx.lo[0] > 40 || bx.hi[2] - bx.lo[2] > 60) return;
    solidCount++;
  });
  return { groups, solidCount };
}, [SOLID_MIN_H, SOLID_MAX_Y]);

// ── 1. POPULATION FLOORS ────────────────────────────────────────────────────
//
// GOTCHAS 79's whole family: a check that examines zero objects reports success
// in green. Three separate populations can go empty independently, so all three
// are named — and a miss here is exit 2, "I could not measure", never exit 1.
if (world.groups.length === 0 || world.solidCount === 0) {
  console.error(`CANNOT MEASURE: ${world.groups.length} litter groups, ${world.solidCount} world solids.`);
  console.error('  Zero of either makes every assertion below vacuous. This is not a pass.');
  await b.close();
  process.exit(2);
}
const noAuthor = world.groups.filter((g) => g.authoredX == null || g.placedX == null);
if (noAuthor.length) {
  console.error(`CANNOT MEASURE: ${noAuthor.length} of ${world.groups.length} groups carry no authored/placed`);
  console.error('  coordinate. ct/props.ts `drop()` records them (userData.authoredX / placedX);');
  console.error('  a build without them cannot answer this question at all.');
  await b.close();
  process.exit(2);
}

const selfPushable = world.groups.filter((g) => g.selfSolids > 0);
check('the world places its litter, and enough of it to test',
  world.groups.length >= MIN_GROUPS && world.solidCount > 100
    && selfPushable.length >= MIN_SELF_PUSHABLE,
  `${world.groups.length} litter groups (floor ${MIN_GROUPS}), ${world.solidCount} world solids, `
  + `${selfPushable.length} of them able to push themselves (floor ${MIN_SELF_PUSHABLE}): `
  + `${[...new Set(selfPushable.map((g) => g.kind))].join(', ')}`);

// --selftest: shove one self-pushable prop off its placed coordinate by the exact
// distance item 219 measured, which is what reverting `ct/props.ts:1298`'s
// ancestry walk does to it. Leg 2 MUST go red.
//
// THE TARGET IS CHOSEN AT RUNTIME from the props that have NOT moved, so the
// mutation cannot be laundered by landing on a piece that was already displaced,
// and a build with nothing to displace exits 2 rather than reporting a pass.
let mutated = null;
if (F.selftest) {
  const target = selfPushable.find((g) => Math.abs(g.landedX - g.placedX) < EPS
    && Math.abs(g.landedZ - g.placedZ) < EPS);
  if (!target) {
    console.error('selftest: no self-pushable prop is standing where it was placed — NOTHING WAS');
    console.error('  MUTATED, so this proves nothing. (If leg 2 is already red, that is the finding.)');
    await b.close(); process.exit(2);
  }
  const PUSH = 0.561;             // the exact shove item 219 measured on the first crate
  target.landedX += PUSH;
  mutated = { kind: target.kind, z: f3(target.landedZ) };
  console.log(`selftest: shoved the ${target.kind} at z ${f3(target.landedZ)} east by ${PUSH} m —`);
  console.log('  the item-219 displacement exactly. Leg 2 MUST now go red.\n');
}

// ── the table, for a human ──────────────────────────────────────────────────
console.log(`\n${world.groups.length} dropped props\n`);
console.log('kind                     authored              placed               landed          moved  self');
const rows = [...world.groups].sort((a, c) => a.kind.localeCompare(c.kind) || a.landedZ - c.landedZ);
for (const g of rows) {
  const d = Math.hypot(g.landedX - g.placedX, g.landedZ - g.placedZ);
  console.log(`${g.kind.padEnd(22)} `
    + `(${String(f3(g.authoredX)).padStart(8)},${String(f3(g.authoredZ)).padStart(8)}) `
    + `(${String(f3(g.placedX)).padStart(8)},${String(f3(g.placedZ)).padStart(8)}) `
    + `(${String(f3(g.landedX)).padStart(8)},${String(f3(g.landedZ)).padStart(8)}) `
    + `${String(f3(d)).padStart(6)}  ${g.selfSolids}`);
}

// ── 2. THE GUARD: A PROP MAY NOT BE MOVED BY ITSELF ─────────────────────────
const selfMoved = selfPushable.filter((g) =>
  Math.abs(g.landedX - g.placedX) > EPS || Math.abs(g.landedZ - g.placedZ) > EPS);
check('every prop that could push ITSELF stands exactly where drop() placed it',
  selfMoved.length === 0,
  selfMoved.length === 0
    ? `${selfPushable.length} props carry geometry over ${SOLID_MIN_H} m and all ${selfPushable.length} moved 0.000 m`
    : selfMoved.map((g) => `${g.kind} placed (${f3(g.placedX)}, ${f3(g.placedZ)}) stands at `
        + `(${f3(g.landedX)}, ${f3(g.landedZ)}) — ${f3(Math.hypot(g.landedX - g.placedX, g.landedZ - g.placedZ))} m`
        + ` off, with ${g.selfSolids} of its own meshes in the obstacle set`).join('; '));

// ── 3. AND NOTHING ELSE HAS STARTED MOVING EITHER ───────────────────────────
//
// Leg 2 only watches the props that can self-push. This watches the rest: the
// displacement set as a whole must be the recorded baseline. A new mover is red
// even when it is flat and the move is small, because "a prop started moving and
// nobody noticed" is the whole shape of item 219.
const movers = world.groups
  .filter((g) => Math.abs(g.landedX - g.placedX) > EPS || Math.abs(g.landedZ - g.placedZ) > EPS)
  .map((g) => ({ g, base: BASELINE.find((q) => Math.abs(q.at[0] - g.placedX) < 0.002 && Math.abs(q.at[1] - g.placedZ) < 0.002) }));
const offBaseline = movers.filter(({ g, base }) => !base
  || Math.abs(base.to[0] - g.landedX) > 0.002 || Math.abs(base.to[1] - g.landedZ) > 0.002);
const baselineMissing = BASELINE.filter((q) => !movers.some(({ base }) => base === q));
check('the set of props the push-out pass moves is the recorded baseline',
  offBaseline.length === 0 && baselineMissing.length === 0,
  offBaseline.length === 0 && baselineMissing.length === 0
    ? `${movers.length} movers, all matching BASELINE to 2 mm`
    : [...offBaseline.map(({ g, base }) => base
        ? `${g.kind} at (${f3(g.placedX)}, ${f3(g.placedZ)}) now lands (${f3(g.landedX)}, ${f3(g.landedZ)}), baseline (${base.to.join(', ')})`
        : `NEW MOVER: ${g.kind} placed (${f3(g.placedX)}, ${f3(g.placedZ)}) lands (${f3(g.landedX)}, ${f3(g.landedZ)})`),
      ...baselineMissing.map((q) => `baseline entry at (${q.at.join(', ')}) no longer moves — re-baseline it`),
      ].join('; '));

// ── 4. NOTHING WAS LEFT IN THE AIR ──────────────────────────────────────────
//
// The push-out re-resolves the ground under a street piece when it slides it in
// x (`ct/props.ts:1339`), and gets no chance to for an alley piece. A prop that
// moved and did not follow the ground is a prop hanging over a kerb, which is
// the visible half of the same defect.
const floating = world.groups.filter((g) => g.groundY != null && Math.abs(g.landedY - g.groundY) > 0.30);
check('no prop is left floating above the ground it was seated on',
  floating.length === 0,
  floating.length === 0 ? `${world.groups.length} props, all within 0.30 m of their seated ground`
    : floating.map((g) => `${g.kind} at (${f3(g.landedX)}, ${f3(g.landedZ)}) sits ${f3(g.landedY - g.groundY)} m off its ground`).join('; '));

// ── 5. THE TWO APPROVED ALLEY CRATES ────────────────────────────────────────
const crateMisses = [];
for (const want of APPROVED_CRATES) {
  const hit = world.groups.find((g) => g.kind === 'milk crate'
    && Math.abs(g.landedX - want.x) < 0.005 && Math.abs(g.landedZ - want.z) < 0.005);
  if (!hit) {
    const nearest = world.groups.filter((g) => g.kind === 'milk crate')
      .map((g) => ({ g, d: Math.hypot(g.landedX - want.x, g.landedZ - want.z) }))
      .sort((a, c) => a.d - c.d)[0];
    crateMisses.push(`(${want.x}, ${want.z}) — nearest crate is `
      + (nearest ? `${f3(nearest.d)} m away at (${f3(nearest.g.landedX)}, ${f3(nearest.g.landedZ)})` : 'no crate at all'));
  }
}
check('both user-approved alley crates stand on their stated coordinates',
  crateMisses.length === 0,
  crateMisses.length === 0
    ? `(${APPROVED_CRATES.map((c) => `${c.x}, ${c.z}`).join(') and (')}) — ct/props.ts:3614-3615`
    : crateMisses.join('; '));

console.log('');
for (const [ok, name, detail] of results) {
  console.log(`${ok ? ' ok  ' : 'FAIL '} ${name}`);
  console.log(`        ${detail}`);
}
const passed = results.filter(([ok]) => ok).length;
console.log(`\n${passed}/${results.length} passed`);
await b.close();

if (results.length === 0) { console.error('no assertions ran'); process.exit(2); }
if (F.selftest) {
  // The selftest INVERTS, and it names the leg the mutation targets so a
  // mutation that misses cannot be laundered into a pass by some other row
  // happening to be red.
  const red = results.filter(([ok]) => !ok).map(([, n]) => n);
  const must = 'every prop that could push ITSELF stands exactly where drop() placed it';
  const caught = red.includes(must);
  console.log(caught
    ? `SELFTEST PASSED — the planted ${mutated.kind} shove was caught by the leg it targets`
    : `SELFTEST FAILED — the targeted leg stayed GREEN; red legs were: ${red.join('; ') || 'none'}`);
  process.exit(caught ? 0 : 1);
}
process.exit(passed === results.length ? 0 : 1);
