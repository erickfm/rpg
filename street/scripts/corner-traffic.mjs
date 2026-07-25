// Do cars actually TURN THE CORNER? Not something a still can show, so sample
// the run and check the motion.
//
//   1. a southbound car reaches the junction and comes out heading EAST,
//      in the eastbound lane, having driven a continuous path (no snap)
//   2. it SLOWS into the turn, and the body and wheels agree with the arc
//   3. the reverse movement (west up the side street, out north) works too
//   4. both movements at once never conflict — the routes are disjoint
//   5. it stops rather than driving through somebody on the crossing
//   6. the parked cars are not traffic and never move
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/corner-traffic.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(400);
await page.evaluate(() => window.__ct.clock(13, 0));

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const D = (r) => (r * 180 / Math.PI).toFixed(1);

// Drive one movement and record the whole run. Stand the player well away so
// nothing yields to them and nothing turns around early.
const run = async (route, seconds, park = [-6.2, 40]) => page.evaluate(async ([route, seconds, px, pz]) => {
  window.__ct.warp(px, pz, 0, 0.14, 0);
  window.__ct.drive(route, 'car');
  const out = [];
  const t0 = performance.now();
  let last = -1;
  while (performance.now() - t0 < seconds * 1000) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now() - t0;
    if (now - last < 40) continue;
    last = now;
    const v = window.__ct.traffic()[0];
    if (v) out.push([now / 1000, v.x, v.z, v.yaw, v.spd, v.lean, v.steer, v.s]);
  }
  return out;
}, [route, seconds, park[0], park[1]]);

// ── 1 & 2. southbound, round the corner, away east ────────────────────────
console.log('corner probe:');
const ne = await run('NE', 22);
check(ne.length > 100, `the run was sampled (${ne.length} frames)`);

// the arc lives between the last southbound sample and the first eastbound one
const head = (yaw) => {
  // yaw 0 faces -z; forward = (-sin yaw, -cos yaw)
  const hx = -Math.sin(yaw), hz = -Math.cos(yaw);
  return Math.abs(hz) > Math.abs(hx) ? (hz < 0 ? 'S' : 'N') : (hx > 0 ? 'E' : 'W');
};
const dirs = ne.map((s) => head(s[3]));
const startedS = dirs[0] === 'S';
const endedE = dirs[dirs.length - 1] === 'E';
check(startedS && endedE, `entered heading ${dirs[0]}, left heading ${dirs[dirs.length - 1]}`);

// it must END in the eastbound lane. z = SIDE_Z0 - (ROAD_HALF - laneX) = -101.5
const finalZ = ne[ne.length - 1][2];
check(Math.abs(finalZ + 101.5) < 0.12, `settled in the eastbound lane — z=${finalZ.toFixed(2)} (want -101.50)`);
const finalX = ne[ne.length - 1][1];
check(finalX > 20, `carried on east down the side street to x=${finalX.toFixed(1)}`);

// CONTINUITY: no jump. At 8.5 m/s and ~40 ms samples a step is ~0.34 m; a
// snapped heading or a seam between segments would show as a big one.
let maxStep = 0, maxYawStep = 0;
for (let i = 1; i < ne.length; i++) {
  const dt = ne[i][0] - ne[i - 1][0];
  if (dt > 0.15) continue;                       // a dropped frame, not a jump
  maxStep = Math.max(maxStep, Math.hypot(ne[i][1] - ne[i - 1][1], ne[i][2] - ne[i - 1][2]));
  let dy = Math.abs(ne[i][3] - ne[i - 1][3]) % (2 * Math.PI);
  if (dy > Math.PI) dy = 2 * Math.PI - dy;
  maxYawStep = Math.max(maxYawStep, dy);
}
check(maxStep < 0.75, `path is continuous — biggest step ${maxStep.toFixed(2)} m`);
check(maxYawStep < 0.12, `heading never snaps — biggest turn ${D(maxYawStep)}° in one frame`);

// SLOWING: it must be materially slower through the arc than on the straight.
// The arc is r = ROAD_HALF - laneX = 3.5 m, so A_LAT 3.0 caps it at 3.24 m/s.
const inTurn = ne.filter((s) => s[6] !== 0);      // steering => on an arc
const straight = ne.filter((s) => s[6] === 0 && s[2] > -90);
const vTurn = Math.max(...inTurn.map((s) => s[4]));
const vStr = Math.max(...straight.map((s) => s[4]));
check(inTurn.length > 8, `it spent ${(inTurn.length * 0.04).toFixed(1)} s actually turning`);
check(vTurn < vStr * 0.6, `slowed into the turn — ${vTurn.toFixed(2)} m/s in the arc vs ${vStr.toFixed(2)} on the straight`);

// WHEELS AND BODY AGREE: on the arc the wheels are steered and the body leans,
// and both point the same way round the corner. tan d = wheelbase/r.
const steerPeak = inTurn.reduce((m, s) => Math.abs(s[6]) > Math.abs(m) ? s[6] : m, 0);
const leanPeak = inTurn.reduce((m, s) => Math.abs(s[5]) > Math.abs(m) ? s[5] : m, 0);
check(Math.abs(steerPeak) > 0.3, `front wheels steer into it — ${D(steerPeak)}°`);
check(Math.abs(leanPeak) > 0.005, `body leans — ${D(leanPeak)}°`);
// a right turn (south -> east) must steer right and lean LEFT, i.e. opposite signs
check(Math.sign(steerPeak) !== Math.sign(leanPeak),
  `leans away from the turn, not into it (steer ${D(steerPeak)}°, roll ${D(leanPeak)}°)`);
// straights are straight: no residual lean or steer
const junk = ne.filter((s) => s[6] === 0 && Math.abs(s[5]) > 1e-9).length;
check(junk === 0, 'no lean or steer left over on the straights');

// ── 3. the reverse movement: west up the side street, out north ────────────
const en = await run('EN', 26);
const dirs2 = en.map((s) => head(s[3]));
check(dirs2[0] === 'W' && dirs2[dirs2.length - 1] === 'N',
  `reverse movement: entered heading ${dirs2[0]}, left heading ${dirs2[dirs2.length - 1]}`);
const finalX2 = en[en.length - 1][1];
check(Math.abs(finalX2 + 1.5) < 0.12, `settled in the northbound lane — x=${finalX2.toFixed(2)} (want -1.50)`);
// the wide arc is r = ROAD_HALF + laneX = 6.5 m: a left turn, so it steers LEFT
const inTurn2 = en.filter((s) => s[6] !== 0);
const steerPeak2 = inTurn2.reduce((m, s) => Math.abs(s[6]) > Math.abs(m) ? s[6] : m, 0);
check(Math.sign(steerPeak2) === -Math.sign(steerPeak),
  `the wide turn steers the other way (${D(steerPeak2)}° vs ${D(steerPeak)}°)`);

// ── 4. both movements at once — the routes must not conflict ───────────────
// The two arms are different lengths — the NE route runs 106 m of main street
// before its arc, the EN route only 47 m of side street — so spawning both at
// s=0 has the taxi through the junction long before the car arrives. Start the
// car 59 m in so both are 47 m from their arc and they meet in the middle.
const both = await page.evaluate(async () => {
  window.__ct.warp(-6.2, 40, 0, 0.14, 0);
  window.__ct.drive('NE', 'car', 59);
  window.__ct.drive('EN', 'taxi', 0);
  const out = [];
  const t0 = performance.now();
  let last = -1;
  while (performance.now() - t0 < 20000) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now() - t0;
    if (now - last < 60) continue;
    last = now;
    const vs = window.__ct.traffic();
    if (vs.length === 2) {
      out.push([Math.hypot(vs[0].x - vs[1].x, vs[0].z - vs[1].z),
        Math.min(vs[0].spd, vs[1].spd), vs[0].z, vs[1].x]);
    }
  }
  return out;
});
const closest = Math.min(...both.map((s) => s[0]));
// both in the junction at once: one is on the tight arc, one on the wide, and
// the radii differ by 2 x laneX = 3 m
const nearJunction = both.filter((s) => s[2] < -94 && s[3] < 8);
const minSpdThere = nearJunction.length ? Math.min(...nearJunction.map((s) => s[1])) : -1;
check(both.length > 50, `two vehicles ran together (${both.length} samples)`);
check(closest > 2.6, `they never came closer than ${closest.toFixed(2)} m`);
check(minSpdThere > 0.5, `neither had to stop at the junction — slowest ${minSpdThere.toFixed(2)} m/s`);

// ── 5. it stops for somebody on the crossing ──────────────────────────────
// stand in the mouth of the junction, on the tight arc's path, and let a
// southbound car come at it
const yielded = await page.evaluate(async () => {
  window.__ct.drive('NE', 'car');
  // on the arc, a third of the way round: (ROAD_HALF - 3.5cos45, -98 - 3.5sin45)
  window.__ct.warp(2.53, -100.47, 0, 0.14, 0);
  const out = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 16000) {
    await new Promise((r) => requestAnimationFrame(r));
    const v = window.__ct.traffic()[0];
    if (v) out.push([v.z, v.spd, Math.hypot(v.x - 2.53, v.z + 100.47)]);
  }
  return out;
});
const stoppedFor = yielded.filter((s) => s[1] < 0.2).length;
const nearestApproach = Math.min(...yielded.map((s) => s[2]));
check(stoppedFor > 30, `it stopped for the person on the crossing (${stoppedFor} frames at rest)`);
// it has to stop SHORT of them but not half a block short — a car that halts
// 19 m away reads as stopping for nothing (which is what the first cut did)
check(nearestApproach > 1.2 && nearestApproach < 6.5,
  `and came up to them before stopping — closest ${nearestApproach.toFixed(2)} m`);

// ── 6. the parked cars are not traffic ────────────────────────────────────
const parkedMoved = await page.evaluate(async () => {
  const snap = () => {
    const out = [];
    window.__ct.scene().traverse((o) => {
      // every vehicle carries a steer() — only the bus carries halfLen, which
      // is what made the first version of this check find nothing at all
      if (o.type === 'Group' && o.userData.steer !== undefined && o.visible) {
        out.push([+o.position.x.toFixed(3), +o.position.z.toFixed(3)]);
      }
    });
    return out;
  };
  const a = snap();
  window.__ct.drive('NE', 'car');
  await new Promise((r) => setTimeout(r, 4000));
  const b = snap();
  // the parked three are the ones that appear in both, unmoved
  return { a: a.length, b: b.length, same: a.filter((p) => b.some((q) => q[0] === p[0] && q[1] === p[1])).length };
});
check(parkedMoved.same >= 3, `the three parked cars never moved (${parkedMoved.same} unmoved of ${parkedMoved.a})`);

console.log(errs.length ? `\npage errors:\n${errs.slice(0, 3).join('\n')}` : '\nno page errors');
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall corner checks pass');
await browser.close();
process.exitCode = fails ? 1 : 0;
