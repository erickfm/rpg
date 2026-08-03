// DOES EVERY PARK BENCH STAND CLEAR OF THE PATH?
//
// The user, TWICE, and the second time plural:
//
//   *"bench is a lil too close to the path. also the path looks awful."*
//   *"benches need space away from the path."*
//
// Nudging the one he photographed is what earned the second report, so item 170
// asked for a rule and something that FAILS if a future bench crowds the path.
// This is that. It is a property over every bench and every walked surface in
// the park, not a list of the placements that exist today: add a bench anywhere,
// or re-cut a leg of the loop, and this still holds.
//
// ── WHAT IT MEASURES, AND WHY THAT AND NOT THE GEOMETRY ─────────────────────
//
// The COLLIDER, not the woodwork. `ct/park.ts` registers a bench solid `SEAT_D`
// deep either side of its centre while the bench's own timber is 0.20 m
// shallower, and it is the collider that decides whether walking past a bench is
// brushing it. Both boxes are banked on the world by the module that made them
// (`userData.parkBench`, `userData.parkGround`/`parkRect`) so nothing here is a
// second copy of the layout — a check that rebuilt the loop from its corner
// coordinates would go stale the first time somebody moved a leg.
//
// ── THE FIGURE IS DERIVED FROM THE PLAYER ───────────────────────────────────
//
// A walker is entitled to the WHOLE path: his centre may reach its very edge,
// and his body then overhangs that edge by his own collision radius. `RADIUS`
// is therefore the distance at which a bench becomes something he collides with
// while still legitimately on the path, and the clearance is RADIUS plus the
// world's smallest meaningful gap so that passing is not brushing:
//
//     BENCH_CLEAR = RADIUS (0.36) + TOUCH_MARGIN (0.15) = 0.51 m
//
// Both come off the running world — `__ct.playerRadius()` and
// `__ct.touchMargin()` — so re-tuning either moves this check and the placements
// in `ct/park.ts` together, in the same direction, automatically.
//
// Usage:  SHOT_URL=http://localhost:4360/ node scripts/bench-clearance.mjs [--selftest]
// Exit:   0 every bench is clear of every walked surface
//         1 one or more is not
//         2 the world could not be measured, or no assertion ran — never a pass
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { flags } from './lib/flags.mjs';
import { reportWorld } from './lib/which-world.mjs';

const F = flags(['--selftest']);
const URL = aim('http://localhost:4360/');

// POPULATION FLOORS. The park lays 9 benches and a dozen walked rectangles; a
// run that finds none of either has measured nothing, and GOTCHAS 79's whole
// family is checks that report that in green.
const MIN_BENCHES = 6, MIN_PATHS = 3;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

const results = [];
const check = (name, ok, detail) => { results.push([ok, name, detail]); };
const f2 = (n) => n.toFixed(2);

const world = await p.evaluate(() => {
  const benches = [], paths = [], loops = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.parkBench) benches.push({ ...o.userData.parkBench });
    if (o.userData?.parkGround !== 'path') return;
    if (o.userData.parkRect) paths.push({ ...o.userData.parkRect });
    // THE CIRCUIT IS NOT A RECTANGLE. Reading only `parkRect` found 2 walked
    // surfaces in a park with a 110 m loop, and every bench on the loop then
    // measured 7-9 m "clear" of the nearest path — a check that would have
    // passed the user's own screenshot. The loop banks its centreline and half
    // width instead.
    if (o.userData.parkLoop) loops.push({ ...o.userData.parkLoop });
  });
  return {
    benches, paths, loops,
    radius: window.__ct.playerRadius ? window.__ct.playerRadius() : null,
    touch: window.__ct.touchMargin ? window.__ct.touchMargin() : null,
  };
});

// THE CONSTANTS MUST HAVE ARRIVED. Defaulting them would make this check assert
// against a number of its own invention while reporting it as the world's —
// which is the hand-typed-copy failure (BUILDER-BRIEF §8) with a green tick on
// it. Exit 2: could not measure, not "it is fine".
if (world.radius == null || world.touch == null) {
  console.error('CANNOT MEASURE: __ct does not publish playerRadius() and/or touchMargin().');
  console.error(`  playerRadius ${world.radius}  touchMargin ${world.touch}`);
  console.error('  The clearance is DERIVED from those two; inventing them here would make this');
  console.error('  check assert against a number the world never agreed to.');
  await b.close();
  process.exit(2);
}
const CLEAR = world.radius + world.touch;

if (world.benches.length === 0 || world.paths.length === 0) {
  console.error(`CANNOT MEASURE: ${world.benches.length} benches, ${world.paths.length} walked rectangles.`);
  console.error('  ct/park.ts banks these on userData.parkBench / userData.parkGround.');
  console.error('  Zero of either makes every assertion below vacuous. This is not a pass.');
  await b.close();
  process.exit(2);
}

// --selftest: put ONE bench back where the item found it. The old east-leg
// offset was `PATH_W / 2 + 0.42`, which puts the collider 0.04 m INSIDE the
// path — the defect verbatim, and the smallest of the two the item measured, so
// the mutation is the hardest case rather than the easiest.
let mutated = null;
if (F.selftest) {
  // the bench nearest a path edge, shoved toward it until it overhangs by 0.04
  let best = null;
  for (const bn of world.benches) {
    for (const pa of world.paths) {
      const gapX = Math.max(pa.minX - bn.maxX, bn.minX - pa.maxX);
      const gapZ = Math.max(pa.minZ - bn.maxZ, bn.minZ - pa.maxZ);
      const overlapOther = gapX > gapZ ? gapZ < 0 : gapX < 0;
      const gap = Math.max(gapX, gapZ);
      if (!overlapOther || gap < 0) continue;
      if (!best || gap < best.gap) best = { bn, pa, gap, axis: gapX > gapZ ? 'x' : 'z' };
    }
  }
  if (!best) {
    console.error('selftest: no bench sits beside a path at all — NOTHING WAS MUTATED, so this proves nothing');
    await b.close(); process.exit(2);
  }
  const push = best.gap + 0.04;                   // 0.04 m INSIDE, the measured defect
  const dir = best.axis === 'x' ? (best.bn.minX > best.pa.maxX ? -1 : 1)
                                : (best.bn.minZ > best.pa.maxZ ? -1 : 1);
  if (best.axis === 'x') { best.bn.minX += dir * push; best.bn.maxX += dir * push; }
  else { best.bn.minZ += dir * push; best.bn.maxZ += dir * push; }
  mutated = { axis: best.axis, was: best.gap, now: -0.04 };
  console.log(`selftest: shoved the closest bench ${f2(push)} m along ${best.axis} so its collider`);
  console.log('  overhangs the path by 0.04 m — the east leg\'s pre-item-170 placement exactly.\n');
}

// gap between two axis-aligned rectangles in plan: positive = clear,
// negative = overlapping, on whichever axis actually separates them
const planGap = (a, c) => {
  const gx = Math.max(c.minX - a.maxX, a.minX - c.maxX);
  const gz = Math.max(c.minZ - a.maxZ, a.minZ - c.maxZ);
  // separated on either axis -> they do not overlap, and the gap is the larger
  return Math.max(gx, gz);
};
// distance from a point to a rectangle in plan; 0 inside
const pointGap = (x, z, r) => Math.hypot(Math.max(0, r.minX - x, x - r.maxX),
  Math.max(0, r.minZ - z, z - r.maxZ));
// Distance from a bench box to the WALKED SURFACE of the loop: walk the banked
// centreline at STEP metres, take the closest point to the box, and subtract
// the half width. STEP is stated rather than hidden — the answer is exact to
// STEP/2 in the worst case, and 0.05 m against a 0.51 m threshold is a tenth of
// the margin. Sampling rather than a closed-form segment/rect distance because
// the loop is an OCTAGON: two of its eight edges are diagonal chamfers, and an
// axis-aligned shortcut would be silently wrong on exactly those.
const LOOP_STEP = 0.05;
const loopGap = (bn, loop) => {
  const c = loop.centreline;
  let best = Infinity;
  for (let i = 0; i < c.length; i++) {
    const [ax, az] = c[i], [bx, bz] = c[(i + 1) % c.length];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / LOOP_STEP));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const g = pointGap(ax + (bx - ax) * t, az + (bz - az) * t, bn);
      if (g < best) best = g;
    }
  }
  return best - loop.halfWidth;
};

const rows = world.benches.map((bn, i) => {
  let worst = { gap: Infinity, what: null };
  for (const pa of world.paths) {
    const g = planGap(bn, pa);
    if (g < worst.gap) worst = { gap: g, what: `laid x ${f2(pa.minX)}…${f2(pa.maxX)} z ${f2(pa.minZ)}…${f2(pa.maxZ)}` };
  }
  for (const lp of world.loops) {
    const g = loopGap(bn, lp);
    if (g < worst.gap) worst = { gap: g, what: `the loop (half width ${f2(lp.halfWidth)} m)` };
  }
  return { i, bn, ...worst,
    cx: (bn.minX + bn.maxX) / 2, cz: (bn.minZ + bn.maxZ) / 2 };
});
rows.sort((a, c) => a.gap - c.gap);

console.log(`\n${world.benches.length} park benches against ${world.paths.length} laid rectangles`
  + ` and ${world.loops.length} loop circuit(s)`);
console.log(`clearance required: RADIUS ${world.radius} + TOUCH_MARGIN ${world.touch} = ${f2(CLEAR)} m`
  + '  (both read off the world)\n');
console.log('bench centre              nearest walked surface                     clearance');
for (const r of rows) {
  console.log(`(${f2(r.cx).padStart(8)}, ${f2(r.cz).padStart(8)})       `
    + `${r.what ?? '—'}`.padEnd(42)
    + `${f2(r.gap).padStart(7)} m${r.gap < CLEAR - 1e-3 ? '   <-- TOO CLOSE' : ''}`);
}

check('the park lays benches and walked surfaces for this to be about',
  world.benches.length >= MIN_BENCHES && world.paths.length + world.loops.length >= MIN_PATHS
    && world.loops.length >= 1,
  `${world.benches.length} benches (floor ${MIN_BENCHES}), ${world.paths.length} laid rectangles`
  + ` + ${world.loops.length} loop circuit(s) (floor ${MIN_PATHS} total, and the loop is mandatory)`);

// FLOAT SLACK, 1 MM, AND IT IS NOT A LOOSENING. `ct/park.ts` places every
// bench at exactly `PATH_W / 2 + RADIUS + TOUCH_MARGIN + SEAT_D`, and this
// re-derives the same sum from the same two published constants by a different
// route — so the two land on the last bit of a double and three of eight benches
// came out at 0.50999999999999995 against a required 0.51. The rule is a
// MINIMUM and a bench sitting exactly on it satisfies it; 1 mm against 510 is
// below the precision of anything in this world, and it is nowhere near the
// 40 mm the actual defect was.
const SLACK = 1e-3;
const tight = rows.filter((r) => r.gap < CLEAR - SLACK);
check('every bench stands the full clearance off every walked surface',
  tight.length === 0,
  tight.length === 0
    ? `worst is ${f2(rows[0].gap)} m against a required ${f2(CLEAR)} m`
    : tight.map((r) => `bench at (${f2(r.cx)}, ${f2(r.cz)}) is ${f2(r.gap)} m off the path`
        + `${r.gap < 0 ? ' — it OVERHANGS it' : ''}`).join('; '));

// AND THE BENCHES ARE STILL ON THE CIRCUIT. A clearance check with no other
// side is satisfiable by putting every bench in the next field, which is not
// what the user asked for — he wants to sit down beside the path, just not on
// it. So: most benches must still be WITHIN reach of a walked surface.
//
// PHRASED AS A FLOOR ON THE NEAR ONES, NOT A CEILING ON THE FAR ONES, and the
// first cut had it the wrong way round. A ceiling accused the mound bench, which
// `ct/park.ts` puts 6.19 m off the loop ON PURPOSE — *"the mound gets the one
// thing worth walking off the path for: a tree, and a bench under it turned to
// face back down the slope"* — so the check was right about the number and wrong
// about what it meant. A deliberately-remote bench is not a runaway fix.
const ON_CIRCUIT = 1.0;
const near = rows.filter((r) => r.gap <= ON_CIRCUIT);
check('…and the benches are still ON the circuit, not exiled to make the number go green',
  near.length >= world.benches.length - 2,
  `${near.length} of ${world.benches.length} are within ${f2(ON_CIRCUIT)} m of a walked surface`
  + ` (furthest is ${f2(rows[rows.length - 1].gap)} m — the mound bench is off the loop by design)`);

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
  const red = results.filter(([ok]) => !ok).map(([, n]) => n);
  const must = 'every bench stands the full clearance off every walked surface';
  const caught = red.includes(must);
  console.log(caught
    ? `SELFTEST PASSED — the bench pushed ${f2(mutated.was)} m -> ${f2(mutated.now)} m was caught by the leg it targets`
    : `SELFTEST FAILED — the targeted leg stayed GREEN; red legs were: ${red.join('; ') || 'none'}`);
  process.exit(caught ? 0 : 1);
}
process.exit(passed === results.length ? 0 : 1);
