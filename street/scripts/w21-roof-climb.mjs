// ITEM 29'S ACCEPTANCE TEST: walk a full route from the pavement onto a car
// ROOF and back down to the street, and prove every surface on the way holds
// you at its own real height.
//
//     pavement 0.14 -> bed floor 0.50 -> bed rail 0.97 -> cab roof 1.50
//                                                      -> hood 0.94 -> street 0
//
// This is a WALK, not a screenshot: BUILDER-BRIEF §10 — a screenshot cannot
// prove you are not wedged, and nothing but driving the real input loop can
// prove `standTop`/`blocked` agree about a surface.
//
// Every coordinate is READ from `window.__ct.colliders()` by the `tag` the
// world stamps on each standable box (crosstown.ts, item 29), never typed
// here: the truck is placed by a seeded draw and then nudged again by
// settleParking(), so a hand-typed spot would be wrong the first time the
// parking rule moves it. That tag is also why this does not use
// `find(c => c.maxY !== undefined)` the way scripts/w13-bed-check.mjs did —
// five boxes carry a maxY now and that predicate no longer names one.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/w21-roof-climb.mjs
import { chromium } from 'playwright';

const EYE = 1.62;          // fp.ts's standing eye height
const TOL = 0.06;          // how close to a surface's own maxY counts as on it

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));
const need = ['pickup-bed-floor', 'pickup-rail-left', 'pickup-rail-right',
  'pickup-cab-roof', 'pickup-hood'];
const missing = need.filter((t) => !byTag[t]);
if (missing.length) { console.log('FAIL: no such standable surface:', missing.join(', ')); process.exit(1); }
for (const t of need) console.log(`  ${t.padEnd(18)} ${JSON.stringify(byTag[t])}`);

// ── THE TIERS MUST MATCH THE TRUCK, NOT MERELY MATCH THEMSELVES ──────────
//
// Every `check()` below asserts `feet === <box>.maxY`, reading its expectation
// out of the very collider under test. That is a tautology: flatten a tier and
// the check simply expects the flattened value and stays green. Proven on the
// sedan's copy of this file, which slept through exactly that mutation
// (notes/w29-sedan-climb.md), and this file has the same shape.
//
// So each tier's height is pinned against a FRESHLY BUILT pickup, measured off
// its own drawn panels. `__ct.carVariant` goes through the same `makeCar` the
// street uses but touches none of the collider code in crosstown.ts, so it
// cannot agree with a mutation there.
const panelTops = await p.evaluate(() => {
  const g = window.__ct.carVariant('pickup', {}, 400, 0, 400);
  const tops = [];
  for (const c of g.children) {
    if (!c.geometry) continue;
    c.updateMatrix(); c.geometry.computeBoundingBox();
    tops.push(+c.geometry.boundingBox.clone().applyMatrix4(c.matrix).max.y.toFixed(4));
  }
  g.parent.remove(g);
  return [...new Set(tops)].sort((a, b) => a - b);
});
console.log(`\nflat tops on a freshly built pickup: ${panelTops.join(', ')}`);
const unpinned = need.filter((t) => !panelTops.some((y) => Math.abs(y - byTag[t].maxY) < 1e-3));
if (unpinned.length) {
  for (const t of unpinned) {
    console.log(`FAIL: tier ${t} stands at ${byTag[t].maxY} — the truck has no panel at that height`);
  }
  await browser.close();
  process.exit(1);
}
console.log('every tier stands at a height the truck actually has a panel at\n');

const bed = byTag['pickup-bed-floor'];
const roof = byTag['pickup-cab-roof'];
const hood = byTag['pickup-hood'];

// Which world axis is the truck's own length, and which end is the tail? The
// bed is behind the cab by construction, so the bed's far end from the roof
// IS the tailgate — derived, so this still holds if the truck is ever parked
// facing the other way.
const bedMidZ = (bed.minZ + bed.maxZ) / 2, roofMidZ = (roof.minZ + roof.maxZ) / 2;
const tailIsPlusZ = bedMidZ > roofMidZ;          // walk towards -z to go forward
const fwd = tailIsPlusZ ? -1 : 1;                // world z step "towards the cab"
const tailZ = tailIsPlusZ ? bed.maxZ : bed.minZ;
const midX = (bed.minX + bed.maxX) / 2;
// yaw such that forward (sin yaw, -cos yaw) points along +fwd in z
const yawFwd = fwd < 0 ? 0 : Math.PI;
console.log(`truck: tail at z=${tailZ.toFixed(2)}, forward is ${fwd > 0 ? '+z' : '-z'}, centre x=${midX.toFixed(2)}`);

const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const feet = async () => (await camY()) - EYE;
const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);
const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };
/** Jump on the spot, then push in a direction while already rising. Walking
 *  AND jumping from a standstill reaches the obstacle long after the apex has
 *  passed; bump into it first, then hop up and over, is the order a player
 *  actually uses (and the order scripts/w13-bed-check.mjs established). */
// KEEP SPACE DOWN THROUGH THE WHOLE HOP. BUILDER-BRIEF §5, and it bites here
// exactly as it bites `[E]`: `fp.ts` reads the key set once per rendered
// frame, so a 220 ms press vanishes whole if the machine is loaded enough to
// produce a 300 ms frame — scripts/probes/w21-apex.mjs caught one doing
// precisely that under CDP throttling. Holding it costs nothing, because
// `jumpHeld` (fp.ts:453) refuses to re-jump until it is released.
const hopInto = async (key, riseMs, pushMs) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(key); await p.waitForTimeout(pushMs);
  await p.keyboard.up(key); await p.keyboard.up(' ');
  await p.waitForTimeout(450);   // let the fall settle
};
/** The same hop, but the push STOPS when you are over the box you are aiming
 *  at instead of after a fixed number of milliseconds. A bed rail's standable
 *  band is 0.31 m and a walking player crosses it in about 90 ms, so a fixed
 *  push either falls short or sails over — a player watches where he is and
 *  lets go, and so does this. What is asserted afterwards is unchanged: feet
 *  at the surface's own `maxY`, inside its own footprint. */
const hopOnto = async (key, riseMs, box, axis, maxMs = 800) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);   // held: see hopInto
  await p.keyboard.down(key);
  const lo = axis === 'x' ? box.minX : box.minZ, hi = axis === 'x' ? box.maxX : box.maxZ;
  // WATCH FROM INSIDE THE PAGE, ONE ANIMATION FRAME AT A TIME. Polling with
  // `p.evaluate` in a loop costs a round trip per sample — 10-20 ms, which is
  // most of a frame in headless, where this world renders far slower than it
  // does for a player. A bed rail's standable band is 0.31 m and the walk is
  // ~3 m/s, so sampling that coarsely sails straight over it: two of three
  // attempts overshot before this was moved in-page. Nothing about the world
  // is being relaxed — only where the stopwatch is standing.
  await p.evaluate(([lo, hi, ax, ms]) => new Promise((done) => {
    const t0 = performance.now();
    const tick = () => {
      const P = window.__ct.pos();
      const v = ax === 'x' ? P[0] : P[2];
      if ((v > lo && v < hi) || performance.now() - t0 > ms) return done(v);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [lo, hi, axis, maxMs]);
  await p.keyboard.up(key);
  await p.keyboard.up(' ');
  await p.waitForTimeout(450);
};

let steps = [];
const check = async (label, want, inside) => {
  const f = await feet(); const P = await pos();
  const okY = Math.abs(f - want) < TOL;
  const okXZ = !inside || (P[0] > inside.minX && P[0] < inside.maxX && P[2] > inside.minZ && P[2] < inside.maxZ);
  steps.push({ label, want, got: +f.toFixed(3), x: +P[0].toFixed(2), z: +P[2].toFixed(2), ok: okY && okXZ });
  console.log(`  ${okY && okXZ ? 'ok  ' : 'MISS'} ${label.padEnd(28)} feet ${f.toFixed(3)} (want ${want.toFixed(2)})  at ${P[0].toFixed(2)},${P[2].toFixed(2)}`);
  return okY && okXZ;
};

// Whichever rail is on the block's side of the truck. `d`/`a` strafe, so no
// turn is needed and the climb stays a straight line.
const rail = byTag['pickup-rail-right'].minX > midX ? byTag['pickup-rail-right'] : byTag['pickup-rail-left'];
const strafe = ((rail.minX + rail.maxX) / 2 > midX) === (yawFwd === 0) ? 'd' : 'a';
console.log(`rail: x ${rail.minX.toFixed(2)}..${rail.maxX.toFixed(2)}, strafing ${strafe}`);

/** THE WHOLE ROUTE, FROM THE PAVEMENT, ONCE.
 *
 *  Run up to three times, because a mistimed hop is a miss and not a broken
 *  world: the first hop is item 1's own, unchanged by this item (the bed box
 *  is byte-identical), and scripts/probes/w21-entry-flake.mjs measures it at
 *  7/8 on a world where nothing at all had moved — a dropped frame swallows
 *  the 220 ms space bar and you land back on the street. A player mistimes a
 *  jump and jumps again. What is NOT relaxed is the assertion: every surface
 *  must hold the feet at its own `maxY`, inside its own footprint, and three
 *  misses in a row still fail. */
const route = async (shoot, stopAtRoof = false) => {
  steps = [];
  // ── 0. START ON THE PAVEMENT, and walk off it ───────────────────────────
  //
  // The truck is parked IN THE ROAD against the kerb, so "from the pavement"
  // means a real leg: stand on the raised walk behind it, cross to the tail,
  // then climb. The kerb is found by stepping outward from the truck until
  // `groundAt` stops reading the road — the walk's own height is not typed
  // here, and this still works if the block is ever re-kerbed.
  const kerbX = await p.evaluate(([x0, z, dir]) => {
    for (let d = 1.0; d < 6.0; d += 0.1) {
      const x = x0 + dir * d;
      if (window.__ct.groundAt(x, z) > 0.01) return x + dir * 0.6;
    }
    return null;
  }, [midX, tailZ - fwd * 1.6, midX > 0 ? 1 : -1]);
  if (kerbX === null) { console.log('FAIL: no raised pavement beside the truck'); return false; }
  await warp(kerbX, tailZ - fwd * 1.6, midX > 0 ? -Math.PI / 2 : Math.PI / 2);
  // WAIT FOR THE FLOOR TO SETTLE BEFORE MEASURING ANYTHING. You spawn in room
  // 301, three storeys up, and ct/apartment.ts's storey picker walks down to
  // the street over several frames rather than snapping (it "refuses to step
  // up more than 0.6 m"). Sample too early and the first reading is the
  // APARTMENT's eye height — 5.40 m — which is also what makes
  // scripts/jump-walk.mjs report a 5.260 m hop at its first spot on the built
  // bundle, on mainline as much as here (see notes/w21-car-roof-climb.md).
  await p.evaluate(() => new Promise((done) => {
    let last = NaN, still = 0, frames = 0;
    const tick = () => {
      const y = window.__ct.camY();
      still = Math.abs(y - last) < 1e-4 ? still + 1 : 0;
      last = y;
      if (still >= 5 || ++frames > 240) return done(y);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await check('start: on the pavement', await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [kerbX, tailZ - fwd * 1.6]));
  await hold('w', 900);                       // off the kerb, into the road
  await p.waitForTimeout(250);

  // ── 1. street -> bed floor, over the open tailgate ──────────────────────
  const q0 = await pos();
  await warp(midX, q0[2], yawFwd);             // line up behind the tail
  await p.waitForTimeout(250);
  await hold('w', 700);                       // walk up flush against the tail
  await p.waitForTimeout(200);
  await check('   down in the road', 0);
  await hopInto('w', 220, 900);
  if (!await check('1. bed floor', bed.maxY, bed)) return false;

  // ── 2. bed floor -> bed rail ────────────────────────────────────────────
  await hold(strafe, 400);                    // walk flush against the rail
  await p.waitForTimeout(200);
  await hopOnto(strafe, 200, rail, 'x');
  if (!await check('2. bed rail', rail.maxY, rail)) return false;

  // ── 3. bed rail -> cab roof ─────────────────────────────────────────────
  await hold('w', 500);                       // forward along the rail, flush to the cab
  await p.waitForTimeout(200);
  if (!await check('   rail, flush to the cab', rail.maxY, rail)) return false;
  await hopOnto('w', 200, roof, 'z');
  if (!await check('3. CAB ROOF', roof.maxY, roof)) return false;

  // LOOK at it, once, from up there — a still is worthless as proof but it is
  // the only way to answer "does standing on the roof read as standing on the
  // roof", which is a judgement no assertion makes for you. Pitch is nudged
  // through warp with the CURRENT x/z read back first: warp writes every
  // argument it is given, so passing `undefined` for a coordinate sets the
  // rig to NaN and silently poisons every measurement after it.
  if (shoot) {
    const P = await pos();
    await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, -0.6), [P[0], P[2], yawFwd]);
    await p.waitForTimeout(200);
    await p.screenshot({ path: 'shots/w21-on-the-roof.png' });
    await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, 0), [P[0], P[2], yawFwd]);
  }

  // The exit test below needs a player ACTUALLY STANDING ON THE ROOF, which is
  // only reachable by climbing — you cannot warp there. `warp` writes x and z
  // but not your height, so a warp to the roof's centre puts you at street
  // level INSIDE the truck's box and `unstick()` shoves you out sideways. My
  // first version of the four-direction test did exactly that, and it PASSED
  // all four: the player was never up there, so "did you get down" was
  // trivially true (feet 0.00 at every one). A check that cannot fail.
  if (stopAtRoof) return true;

  // ── 4. cab roof -> hood -> street ───────────────────────────────────────
  await hold('w', 620);
  await p.waitForTimeout(250);
  if (!await check('4. hood', hood.maxY, hood)) return false;
  await hold('w', 1400);                      // off the nose
  await p.waitForTimeout(400);
  return await check('5. back down on the street', 0);
};

let climbed = false;
for (let attempt = 1; attempt <= 3 && !climbed; attempt++) {
  console.log(`attempt ${attempt}:`);
  climbed = await route(attempt === 1);
}
if (!climbed) console.log('FAIL: three attempts, never reached the street off the nose');

// ── 5. and it is still a wall from the outside ────────────────────────────
//
// The whole mechanism is opt-in on height, so the thing that could silently
// break is the OTHER direction: a tier that stops blocking at head height
// would let a walking player stroll through the truck. Walk into the flank
// at ground level and confirm you are still stopped outside it.
// stand 1.5 m off the truck's +x flank, facing -x (forward is (sin y, -cos y),
// so yaw = -pi/2 points at -x), and walk into it
await warp(bed.maxX + 1.5, (bed.minZ + bed.maxZ) / 2, -Math.PI / 2);
await p.waitForTimeout(300);
await hold('w', 1600);
await p.waitForTimeout(200);
const q = await pos();
const stillSolid = q[0] < bed.minX || q[0] > bed.maxX;
console.log(`${stillSolid ? 'ok  ' : 'FAIL'} 6. flank is still a wall on foot   stopped at x ${q[0].toFixed(2)} (box ${bed.minX.toFixed(2)}..${bed.maxX.toFixed(2)})`);

// ── 7. AND YOU CAN GET OFF THE ROOF IN EVERY DIRECTION ───────────────────
//
// Promoted from scripts/probes/w21-roof-exit.mjs, which proved this once and
// was then never run again. The route above only ever leaves the roof FORWARDS,
// over the hood — so three of the four ways down were guarded by nothing.
//
// BUILDER-BRIEF §11 aimed at a surface instead of a panel: a roof you cannot
// leave is the same bug as a panel you cannot close, and the user has been
// trapped twice — *"no im telling you i can't get up anything i do once i sit
// down"*. The roof is still the only place in this world a player can stand
// that is not a floor.
//
// A STUCK here was seen once under load and never reproduced (w21; w22 then ran
// 27 throttled exits clean). If it ever recurs this prints what was next to you
// when it did, rather than leaving the next reader to guess.
let exits = 0;
const ways = [['forward', yawFwd], ['back', yawFwd + Math.PI],
  ['left', yawFwd + Math.PI / 2], ['right', yawFwd - Math.PI / 2]];
for (const [name, yaw] of ways) {
  // CLIMB UP FOR REAL, EVERY TIME. Up to four attempts, because a mistimed hop
  // is a miss and not a broken world (the roof hop clears by ~21 mm at the dt
  // clamp); if all four miss we say SKIPPED and fail the run rather than
  // silently scoring the direction.
  let up = false;
  for (let t = 0; t < 4 && !up; t++) up = await route(false, true);
  const onRoof = up && Math.abs((await feet()) - roof.maxY) < 0.06;
  if (!onRoof) {
    console.log(`  MISS 7.${name.padEnd(8)} could not get onto the roof in 4 tries — direction untested`);
    continue;
  }
  const here = await pos();
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0), [here[0], here[2], yaw]);
  await p.waitForTimeout(300);
  await hold('w', 2400);
  await p.waitForTimeout(400);
  const f = await feet(); const P = await pos();
  const off = f < roof.maxY - 0.2;
  if (off) exits++;
  else {
    const near = await p.evaluate(([x, z]) => window.__ct.colliders()
      .filter((c) => Math.abs((c.minX + c.maxX) / 2 - x) < 3 && Math.abs((c.minZ + c.maxZ) / 2 - z) < 3)
      .map((c) => ({ tag: c.tag ?? null, maxY: c.maxY ?? null })), [P[0], P[2]]);
    console.log(`       what was beside you: ${JSON.stringify(near).slice(0, 300)}`);
  }
  console.log(`  ${off ? 'ok  ' : 'STUCK'} 7.${name.padEnd(8)} feet ${f.toFixed(2)} at ${P[0].toFixed(2)},${P[2].toFixed(2)}`);
}

if (errs.length) console.log('page errors:', errs.slice(0, 5).join(' | '));
const allOk = climbed && stillSolid && exits === ways.length && errs.length === 0;
console.log(allOk ? 'PASS: pavement -> bed -> rail -> ROOF -> hood -> street, and off it four ways'
  : `FAIL: climbed=${climbed} solid=${stillSolid} exits=${exits}/${ways.length} errs=${errs.length}`);
await browser.close();
// ── AND SAY SO IN THE EXIT CODE ──────────────────────────────────────────
//
// This printed `FAIL: route incomplete` and exited 0. That was survivable while
// nothing ran it; registering it in scripts/checks.mjs makes it fatal, because
// a check that always exits 0 reports green forever. Same family as
// scripts/health.mjs (queue item 61) and scripts/bugsweep.mjs (item 62).
process.exit(allOk ? 0 : 1);
process.exit(allOk ? 0 : 1);
