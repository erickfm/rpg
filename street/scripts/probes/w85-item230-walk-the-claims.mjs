// Item 230 — WALK the three reachability claims, because a fill is a model and
// the item asks for proof on foot.
//
// The grid fill in `scripts/world-contained.mjs` says:
//   (a) (-30, 12) — the suspected hole west of the building line — is NOT in
//       any component that holds standing room. Worker eightyone's greedy walk
//       agreed but could not prove it: it was stopped at x -6.3 and said so.
//       The route it never tried is the one this checks: PARK FIRST, then north.
//   (b) (20, 16) — north of the car lot, where the ground demonstrably ends
//       (shots/w85-north-z16-down.png) — is likewise not reachable: a collider
//       band at z 14.2 seals it before the void starts.
//   (c) the park's far end IS reachable. That is the positive control, and it
//       is the whole reason this file can be believed: **a walker that cannot
//       reach anywhere would "prove" every hole in the world unreachable.**
//
// Every leg below is HELD KEYS through the real input loop. The only use of
// `warp` is (i) one jump to a legitimate street start and (ii) turning on the
// spot — passing the player's CURRENT x/z with a new yaw, which is a rotation,
// not a teleport.
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';

const URL = aim('http://localhost:4410/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };
const f = (n) => n.toFixed(2);
const pos = async () => { const p = await page.evaluate(() => window.__ct.pos()); return [p[0], p[2]]; };
// ── A JUMP THAT DID NOT LAND MUST NOT LOOK LIKE A JOURNEY THAT DID ────────
//
// The first run of this file "PASSED" the (20, 16) leg while standing in the
// PARK, 78 m away. `warp` drops the player wherever it is told — including
// inside a parked car — and `fp.ts`'s unstick then restores him to `lastGood`,
// which was the end of the previous section. The walker dutifully measured its
// closest approach from a start it had never actually occupied, and reported
// "not reachable", which was the answer I was expecting. **A check that agrees
// with you from the wrong place is worse than one that disagrees.**
//
// So every jump is now verified to have LANDED, and an unlanded jump nudges to
// a free spot nearby or gives up loudly rather than quietly measuring fiction.
// AND WAITING IT OUT IS NOT ENOUGH EITHER — the second version of this guard
// held for 260 ms, watched the player stay put, and was still measuring from
// inside a parked car. `fp.ts:426-452` tolerates an illegal position for
// PATIENCE seconds while `escapeFrom` tries to push you out, and only THEN
// restores `lastGood`. So the honest question is not "did he stay?" but "is
// this spot legal?", and that is `blocked()`, which can be asked directly.
const jumpRaw = (x, z) => page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z) ?? 0.14, 0), [x, z]);
const isBlocked = (x, z) => page.evaluate(([x, z]) => {
  const RADIUS = 0.36;                                     // fp.ts:87
  const inFrame = (c, X, Z) => {
    if (!c.rot) return { x: X, z: Z };
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const s = Math.sin(c.rot), k = Math.cos(c.rot);
    const dx = X - cx, dz = Z - cz;
    return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
  };
  return (window.__ct.colliders() ?? []).some((c) => {
    const q = inFrame(c, x, z);
    return q.x > c.minX - RADIUS && q.x < c.maxX + RADIUS && q.z > c.minZ - RADIUS && q.z < c.maxZ + RADIUS;
  });
}, [x, z]);
async function jump(x, z, tol = 1.5) {
  const ring = [[0, 0]];
  for (let r = 1; r <= 4; r++) for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) ring.push([ux * r, uz * r]);
  for (const [dx, dz] of ring) {
    const tx = x + dx, tz = z + dz;
    if (await isBlocked(tx, tz)) continue;      // never start inside anything
    await jumpRaw(tx, tz);
    await page.waitForTimeout(120);
    await hold(60);
    await page.waitForTimeout(80);
    const p = await pos();
    if (Math.hypot(p[0] - tx, p[1] - tz) < tol) return { ok: true, at: p, nudged: !!(dx || dz) };
  }
  const p = await pos();
  return { ok: false, at: p };
}
const mustJump = async (nm, x, z) => {
  const j = await jump(x, z);
  if (!j.ok) {
    console.log(`FAIL  ${nm}: could not put the player at (${x}, ${z}) — every nudge was rejected, `
      + `he is at ${JSON.stringify(j.at.map((v) => +v.toFixed(2)))}. NOTHING BELOW THIS IS MEASURED.`);
    fails++;
  } else if (j.nudged) console.log(`  (start nudged to ${JSON.stringify(j.at.map((v) => +v.toFixed(2)))} — (${x}, ${z}) is inside something)`);
  return j;
};

// ── THE YAW CONVENTION, SELF-TESTED ON BOTH SIGNS BEFORE ANY LEG ──────────
//
// `fp.ts:509` is `fwd.set(sin(yaw), 0, -cos(yaw))`, so **yaw 0 is -z, not +z**.
// A probe that got this backwards is on the standing list of instruments that
// lied this week, so it is not asserted from the source — it is measured, in
// both axes, and the run refuses to continue if either disagrees.
const faceYaw = (dx, dz) => Math.atan2(dx, -dz);
const turn = async (yaw) => {
  const [x, z] = await pos();
  await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw), [x, z, yaw]);
};
const hold = async (ms) => {
  await page.keyboard.down('w');
  await page.waitForTimeout(ms);
  await page.keyboard.up('w');
  await page.waitForTimeout(60);
};
{
  const bad = [];
  for (const [nm, dx, dz] of [['-z', 0, -1], ['+z', 0, 1], ['+x', 1, 0], ['-x', -1, 0]]) {
    await jump(0, -30);                    // open road, nothing within 3 m
    await turn(faceYaw(dx, dz));
    const a = await pos(); await hold(500); const c = await pos();
    const mx = c[0] - a[0], mz = c[1] - a[1];
    const along = mx * dx + mz * dz, across = Math.hypot(mx - along * dx, mz - along * dz);
    console.log(`  yaw selftest ${nm}: moved ${f(mx)}, ${f(mz)}  (along ${f(along)}, across ${f(across)})`);
    if (!(along > 0.6) || across > 0.35) bad.push(`facing ${nm} moved along ${f(along)} across ${f(across)}`);
  }
  if (bad.length) {
    console.log(`YAW CONVENTION SELFTEST FAILED — nothing below is measured:\n  ${bad.join('\n  ')}`);
    await b.close(); process.exit(3);
  }
}

// ── the walker: greedy, with strafing, and it reports its own failure ─────
async function walkTo(tx, tz, budgetLegs = 90) {
  let best = Infinity, bestAt = null, stuck = 0, prev = await pos(), warped = 0;
  for (let leg = 0; leg < budgetLegs; leg++) {
    const [x, z] = await pos();
    // A LEG CANNOT COVER MORE THAN THE RUN SPEED ALLOWS. `fp.ts` restores
    // `lastGood` after PATIENCE seconds wedged, which moved the player 78 m
    // mid-walk on the first run of this file and was invisible in the result.
    // 6.8 m/s is the rig's run speed and legs are at most 0.6 s, so 6 m is
    // already generous; anything past it is the world moving him, not walking.
    if (Math.hypot(x - prev[0], z - prev[1]) > 6.0) warped++;
    prev = [x, z];
    const d = Math.hypot(tx - x, tz - z);
    if (d < best - 0.05) { best = d; bestAt = [x, z]; stuck = 0; } else stuck++;
    if (d < 1.0) return { reached: true, best: d, at: [x, z], legs: leg, warped };
    // head for the target; when progress stalls, try sliding along both
    // perpendiculars before giving up on this heading
    const base = faceYaw(tx - x, tz - z);
    const yaw = stuck === 0 ? base
      : stuck % 4 === 1 ? base + Math.PI / 2
        : stuck % 4 === 2 ? base - Math.PI / 2
          : stuck % 4 === 3 ? base + Math.PI / 4 : base - Math.PI / 4;
    await turn(yaw);
    await hold(stuck === 0 ? 600 : 380);
    if (stuck > 18) break;
  }
  const [x, z] = await pos();
  return { reached: false, best, at: bestAt ?? [x, z], legs: budgetLegs, warped };
}

// ── A ROUTE FROM THE FILL, THEN WALKED ────────────────────────────────────
//
// The greedy walker above is honest but flaky: it crossed the park in 18 legs,
// then 26, then snagged on park furniture 15 m short. A control that fails one
// run in three cannot license a negative result, and "run it again" is how a
// flaky check becomes a check nobody believes.
//
// So the ROUTE comes from the same grid fill the sweep uses — BFS over cells
// `fp.ts` would let the player occupy — and the walk then FOLLOWS it with held
// keys. That is not assuming the answer: the fill only proposes a line, and if
// the player cannot actually walk it he does not arrive, which is exactly the
// failure a route-follower should report.
const pathTo = (fx, fz, tx, tz) => page.evaluate(([fx, fz, tx, tz]) => {
  const G = 0.5, RADIUS = 0.36;
  const B = window.__ct.bounds();
  const cols = window.__ct.staticColliders();
  const inFrame = (c, X, Z) => {
    if (!c.rot) return { x: X, z: Z };
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const s = Math.sin(c.rot), k = Math.cos(c.rot);
    const dx = X - cx, dz = Z - cz;
    return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
  };
  const free = (x, z) => x >= B.minX && x <= B.maxX && z >= B.minZ && z <= B.maxZ
    && !cols.some((c) => {
      const q = inFrame(c, x, z);
      return q.x > c.minX - RADIUS && q.x < c.maxX + RADIUS && q.z > c.minZ - RADIUS && q.z < c.maxZ + RADIUS;
    });
  const key = (i, j) => `${i},${j}`;
  // SNAP BOTH ENDS TO THE NEAREST FREE CELL. Rounding an arbitrary target to a
  // 0.5 m cell lands inside a bench or a tree often enough that the first
  // version of this reported "no route across the park" for a crossing the
  // greedy walker had already made twice. A router that answers "unreachable"
  // because its DESTINATION cell is furniture would condemn the whole world.
  const snap = (x, z) => {
    for (let r = 0; r <= 8; r++) {
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = Math.round(x / G) + di, j = Math.round(z / G) + dj;
        if (free(i * G, j * G)) return [i, j];
      }
    }
    return null;
  };
  // AND THE TARGET IS PICKED *AFTER* THE FILL, NOT BEFORE IT. Snapping the
  // destination to the nearest FREE cell up front reported "no route across the
  // park" for a crossing the walker had already made: the nearest free cell to
  // the target sat inside a planter ring — free, and connected to nothing. The
  // question is not "which cell is nearest" but "which cell is nearest AMONG
  // THOSE HE CAN GET TO", and only the fill knows that.
  const S = snap(fx, fz);
  if (!S) return null;
  const [si, sj] = S;
  const prev = new Map(); const seen = new Set([key(si, sj)]);
  const q = [[si, sj]]; let head = 0;
  while (head < q.length) {
    const [i, j] = q[head++];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, c = j + dj, k = key(a, c);
      if (seen.has(k)) continue;
      if (!free(a * G, c * G)) continue;
      seen.add(k); prev.set(k, key(i, j)); q.push([a, c]);
    }
  }
  // nearest REACHED cell to the target, and only if it is genuinely near it
  let bestK = null, bestD = Infinity;
  for (const k of seen) {
    const [a, c] = k.split(',').map(Number);
    const d = Math.hypot(a * G - tx, c * G - tz);
    if (d < bestD) { bestD = d; bestK = k; }
  }
  if (bestK === null || bestD > 2.5) return null;
  const out = []; let cur = bestK;
  while (cur) { const [a, c] = cur.split(',').map(Number); out.push([a * G, c * G]); cur = prev.get(cur); }
  return out.reverse();
}, [fx, fz, tx, tz]);

// Follow a route, held keys, one waypoint at a time. Reports how far it got.
async function walkRoute(route, stride = 6) {
  const marks = route.filter((_, i) => i % stride === 0 || i === route.length - 1);
  let warped = 0, prev = await pos();
  for (const [wx, wz] of marks) {
    for (let tries = 0; tries < 14; tries++) {
      const [x, z] = await pos();
      if (Math.hypot(x - prev[0], z - prev[1]) > 6.0) warped++;
      prev = [x, z];
      if (Math.hypot(wx - x, wz - z) < 0.9) break;
      await turn(faceYaw(wx - x, wz - z));
      await hold(260);
    }
  }
  const [x, z] = await pos();
  const end = route[route.length - 1];
  return { at: [x, z], gap: Math.hypot(end[0] - x, end[1] - z), warped, marks: marks.length };
}

// ── (c) POSITIVE CONTROL FIRST. An unreachable verdict from a walker that has
// not been shown to reach anything is worth nothing.
const sites = await page.evaluate(() => window.__ct.sites());
const park = sites.park;
console.log(`\npark site  x ${f(park.minX)}…${f(park.maxX)}  z ${f(park.minZ)}…${f(park.maxZ)}`);
const parkDeep = [park.minX + 3, (park.minZ + park.maxZ) / 2];
const start = [park.maxX - 1, (park.minZ + park.maxZ) / 2];
await mustJump('positive control start', start[0], start[1]);
const p0 = await pos();
const ctlRoute = await pathTo(p0[0], p0[1], parkDeep[0], parkDeep[1]);
report('the fill can propose a route across the park at all', !!ctlRoute,
  ctlRoute ? `${ctlRoute.length} cells from ${JSON.stringify(p0.map((v) => +v.toFixed(2)))} to (${f(parkDeep[0])}, ${f(parkDeep[1])})`
    : 'BFS found no route to the park\'s far end — the fill and the world disagree before any walking');
if (ctlRoute) {
  const ctl = await walkRoute(ctlRoute);
  report('POSITIVE CONTROL: the walker WALKS the route across the park to its far end',
    ctl.gap < 2.0 && ctl.warped === 0,
    `ended ${f(ctl.gap)} m from the target at ${JSON.stringify(ctl.at.map((v) => +v.toFixed(2)))}, `
    + `${ctl.marks} waypoints, ${ctl.warped} teleport(s)`);
}

// AND THE NEGATIVE CONTROL FOR THE ROUTER ITSELF: it must be ABLE to say no.
// A BFS that returns a route to everywhere would make every claim below
// vacuous, so it is asked for one to a point 60 m past the world's own south
// clamp, where there is provably nothing.
const nowhere = await pathTo(p0[0], p0[1], 0, -170);
report('NEGATIVE CONTROL: the router refuses a route to a point outside the world',
  nowhere === null, nowhere === null ? 'no route to (0, -170), 60 m past the south clamp'
    : `IT FOUND ONE, ${nowhere.length} cells — the router cannot say no and nothing below is measured`);

// ── (a) (-30, 12), FROM THE PARK — the route eightyone never tried ────────
// Start deep in the park (reached by walking, above) and head north.
console.log('\n── (-30, 12), approached from the PARK and heading north ──────');
const legs = [];
for (const [tx, tz] of [[-30, park.maxZ ?? -20], [-30, 0], [-30, 6], [-30, 12]]) {
  const r = await walkTo(tx, tz);
  const p = await pos();
  legs.push(`(${tx}, ${f(tz)}) ${r.reached ? 'reached' : `stopped ${f(r.best)} m short`} — now at ${f(p[0])}, ${f(p[1])}`);
  console.log(`  ${legs[legs.length - 1]}`);
}
const fin = await walkTo(-30, 12);
const finP = await pos();
report('the (-30, 12) walk was WALKED, not teleported by the rig', fin.warped === 0,
  `${fin.warped} leg(s) moved further than running allows — each is fp.ts restoring lastGood, not a walk`);
report('(-30, 12) is NOT reachable on foot, approached from the park',
  !fin.reached && fin.warped === 0,
  fin.reached ? `THE WALKER GOT THERE — it stands at ${JSON.stringify(finP.map((v) => +v.toFixed(2)))}, and the grid fill that said it could not is WRONG`
    : `closest approach ${f(fin.best)} m, stopped at ${JSON.stringify(fin.at.map((v) => +v.toFixed(2)))} (max z reached ${f(finP[1])})`);

// ── (b) (20, 16), north of the car lot, where the ground ENDS ─────────────
console.log('\n── (20, 16), north of the car lot ─────────────────────────────');
const nj = await mustJump('car lot start', 20, 8);
console.log(`  starting the north walk from ${JSON.stringify(nj.at.map((v) => +v.toFixed(2)))}`);
const north = await walkTo(20, 16);
const northP = await pos();
report('the (20, 16) walk was WALKED, not teleported by the rig', north.warped === 0,
  `${north.warped} leg(s) moved further than running allows — each is fp.ts restoring lastGood, not a walk`);
report('(20, 16) is NOT reachable on foot from the car lot',
  !north.reached && north.warped === 0,
  north.reached ? `THE WALKER GOT THERE and there is no floor at that point — this is a real escape`
    : `closest approach ${f(north.best)} m, stopped at ${JSON.stringify(north.at.map((v) => +v.toFixed(2)))} (max z ${f(northP[1])})`);

// How far north CAN he get, swept across the lot frontage? The clamp is at
// z 19; if nothing ever passes 14 then the clamp never binds on real ground.
let maxZ = -Infinity, maxAt = null;
let swept = 0;
for (let sx = 8; sx <= 30; sx += 2) {
  const j = await jump(sx, 9);
  if (!j.ok) { console.log(`  x ${sx}: no legal start, skipped`); continue; }
  swept++;
  await turn(faceYaw(0, 1));
  await hold(2600);
  const p = await pos();
  if (p[1] > maxZ) { maxZ = p[1]; maxAt = p; }
}
report('the north sweep actually started somewhere, on enough of the frontage', swept >= 8,
  `${swept} of 12 starting points across x 8…30 were legal`);
console.log(`\nfurthest north reached walking, swept x 8…30 by 2 m: z ${f(maxZ)} at ${JSON.stringify(maxAt.map((v) => +v.toFixed(2)))}`);
const B = await page.evaluate(() => window.__ct.bounds());
report('the world\'s north CLAMP never binds on ground the player can stand on',
  maxZ < B.maxZ - 1.0,
  `walked to z ${f(maxZ)}; the clamp is at z ${f(B.maxZ)} — a collider stops him ${f(B.maxZ - maxZ)} m short of it`);

report('no console errors during the walks', errs.length === 0, `${errs.length} page error(s)`);
console.log(fails ? `\n${fails} FAILED` : '\nall walk claims hold');
await b.close();
process.exit(fails ? 1 : 0);
