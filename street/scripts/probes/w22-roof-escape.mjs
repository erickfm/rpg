// CAN YOU ALWAYS GET OFF THE CAB ROOF? All four directions, under CPU load.
//
// Item 46. A player was seen STUCK on the cab roof once, under load, and it did
// not reproduce in three further runs. Being unable to get off something is the
// worst bug this project ships — the user has been trapped twice, and his words
// were "no im telling you i cant get up anything i do once i sit down".
//
// `scripts/w21-roof-climb.mjs` walks the route and proves every surface holds
// you at its own height. What it does NOT do is leave the roof any way but
// FORWARD over the hood, and it runs at whatever speed the machine offers. Both
// gaps matter here: the report was about being stuck, and it was under load.
//
// So this asks the narrower question 20+ times with the CPU throttled:
//
//   1. climb to the roof by the real route (no warping up — a warp cannot
//      reproduce a bug in how you ARRIVE)
//   2. walk off it in ONE named direction
//   3. and then prove you are not wedged where you landed, by walking
//
// Step 3 is the point. "Off the roof" is not "free": the truck is parked in the
// road against a kerb, so the two sideways exits drop you 1.5 m into a
// gap between a vehicle collider and a raised walk, which is exactly the shape
// of every trap this project has shipped. A drop that lands you somewhere you
// cannot walk out of is the same bug wearing a different hat.
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w22-roof-escape.mjs [dir] [runs] [rate]
//     dir   fwd | back | left | right | all      (default all)
//     runs  repeats per direction                (default 1)
//     rate  CDP CPU throttling multiplier        (default 4)
import { chromium } from 'playwright';

const EYE = 1.62;
const TOL = 0.06;
const DIR = process.argv[2] ?? 'all';
const RUNS = Number(process.argv[3] ?? 1);
const RATE = Number(process.argv[4] ?? 4);
const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL to your own port'); process.exit(3); }

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

// SUSTAINED LOAD, the way the report described it. CDP's CPU throttle slows
// every frame rather than stalling one, which is what "under load" means for a
// player on a busy machine — and it is the same instrument that caught a 220 ms
// space bar vanishing into a 300 ms frame (see w21-roof-climb's note on
// holding the key).
const cdp = await p.context().newCDPSession(p);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
console.log(`CPU throttled ${RATE}x at ${URL}\n`);

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));
const need = ['pickup-bed-floor', 'pickup-rail-left', 'pickup-rail-right',
  'pickup-cab-roof', 'pickup-hood'];
const missing = need.filter((t) => !byTag[t]);
if (missing.length) { console.log('ABORTED: no such standable surface:', missing.join(', ')); process.exit(3); }

const bed = byTag['pickup-bed-floor'], roof = byTag['pickup-cab-roof'], hood = byTag['pickup-hood'];
const bedMidZ = (bed.minZ + bed.maxZ) / 2, roofMidZ = (roof.minZ + roof.maxZ) / 2;
const tailIsPlusZ = bedMidZ > roofMidZ;
const fwd = tailIsPlusZ ? -1 : 1;
const tailZ = tailIsPlusZ ? bed.maxZ : bed.minZ;
const midX = (bed.minX + bed.maxX) / 2;
const yawFwd = fwd < 0 ? 0 : Math.PI;
const rail = byTag['pickup-rail-right'].minX > midX ? byTag['pickup-rail-right'] : byTag['pickup-rail-left'];
const strafe = ((rail.minX + rail.maxX) / 2 > midX) === (yawFwd === 0) ? 'd' : 'a';

// WHICH RUNG the climb falls off, so a flaky approach can be told from a
// broken one. All three are hops, and a hop is where a throttled frame eats
// the input — not a fault in any surface.
const stage = { bed: 0, rail: 0, roof: 0 };
const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const feet = async () => (await camY()) - EYE;
const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
const hopInto = async (k, riseMs, pushMs) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(k); await p.waitForTimeout(pushMs);
  await p.keyboard.up(k); await p.keyboard.up(' ');
  await p.waitForTimeout(500);
};
const hopOnto = async (k, riseMs, box, axis, maxMs = 900) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(k);
  const lo = axis === 'x' ? box.minX : box.minZ, hi = axis === 'x' ? box.maxX : box.maxZ;
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
  await p.keyboard.up(k); await p.keyboard.up(' ');
  await p.waitForTimeout(500);
};
const settle = () => p.evaluate(() => new Promise((done) => {
  let last = NaN, still = 0, frames = 0;
  const tick = () => {
    const y = window.__ct.camY();
    still = Math.abs(y - last) < 1e-4 ? still + 1 : 0;
    last = y;
    if (still >= 5 || ++frames > 300) return done(y);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));

/** Climb pavement -> bed -> rail -> roof. Returns true if the feet ended on the
 *  roof's own maxY, inside its own footprint. Same route as w21-roof-climb; a
 *  warp to the roof would test a place the player can never arrive from. */
const climbToRoof = async () => {
  const kerbX = await p.evaluate(([x0, z, dir]) => {
    for (let d = 1.0; d < 6.0; d += 0.1) {
      const x = x0 + dir * d;
      if (window.__ct.groundAt(x, z) > 0.01) return x + dir * 0.6;
    }
    return null;
  }, [midX, tailZ - fwd * 1.6, midX > 0 ? 1 : -1]);
  if (kerbX === null) return false;
  await warp(kerbX, tailZ - fwd * 1.6, midX > 0 ? -Math.PI / 2 : Math.PI / 2);
  await settle();
  await hold('w', 1000);
  await p.waitForTimeout(300);
  const q0 = await pos();
  await warp(midX, q0[2], yawFwd);
  await p.waitForTimeout(300);
  await hold('w', 800);
  await p.waitForTimeout(250);
  await hopInto('w', 240, 950);
  if (Math.abs(await feet() - bed.maxY) > TOL) { stage.bed++; return false; }
  await hold(strafe, 450);
  await p.waitForTimeout(250);
  await hopOnto(strafe, 220, rail, 'x');
  if (Math.abs(await feet() - rail.maxY) > TOL) { stage.rail++; return false; }
  await hold('w', 550);
  await p.waitForTimeout(250);
  await hopOnto('w', 220, roof, 'z');
  const f = await feet(); const P = await pos();
  const ok = Math.abs(f - roof.maxY) < TOL
    && P[0] > roof.minX && P[0] < roof.maxX && P[2] > roof.minZ && P[2] < roof.maxZ;
  if (!ok) stage.roof++;
  return ok;
};


/** WEDGED? Not "did you move" but "can you move AT ALL". Push in each of the
 *  four directions in turn from where you stand and take the best displacement.
 *  A player who can go one way is not stuck; a player who can go no way is, and
 *  that is the only definition that matches the report. */
const canMove = async () => {
  const start = await pos();
  let best = 0, bestK = null;
  for (const k of ['w', 's', 'a', 'd']) {
    await hold(k, 500);
    await p.waitForTimeout(150);
    const q = await pos();
    const d = Math.hypot(q[0] - start[0], q[2] - start[2]);
    if (d > best) { best = d; bestK = k; }
    if (d > 0.5) break;                       // clearly free, no need to try the rest
  }
  return { free: best > 0.35, best: +best.toFixed(2), key: bestK };
};

// Which key leaves the roof which way. `w` is toward the hood by construction
// (yawFwd faces along +fwd), so the other three follow from it.
// NAMED FOR THE KEY AND THE WORLD AXIS, not for "left" and "right", which are
// relative to a yaw this probe computes and would be a coin flip for a reader.
// With yawFwd facing along +fwd, `a` and `d` strafe across the truck; which one
// lands on the kerb is derived below from where the raised walk actually is,
// and reported, rather than assumed.
const kerbIsMinusX = midX > 0 ? false : true;   // same test climbToRoof uses
const DIRS = {
  fwd:  { key: 'w', what: 'forward, over the hood' },
  back: { key: 's', what: 'backward, onto the bed rail' },
  aStr: { key: 'a', what: `strafe a, off the ${kerbIsMinusX ? '+x (road)' : '-x (kerb)'} flank` },
  dStr: { key: 'd', what: `strafe d, off the ${kerbIsMinusX ? '-x (kerb)' : '+x (road)'} flank` },
};
const order = DIR === 'all' ? Object.keys(DIRS) : [DIR];
if (order.some((d) => !DIRS[d])) { console.error(`unknown direction: ${DIR} (use ${Object.keys(DIRS).join('|')}|all)`); process.exit(2); }

const rows = [];
const climbTries = [];
for (let r = 0; r < RUNS; r++) {
  for (const d of order) {
    const { key, what } = DIRS[d];
    // MORE ATTEMPTS THAN A PLAYER WOULD NEED, deliberately. Throttled 4x, a
    // mistimed hop is common — w21 measured the first hop alone at 7/8 with no
    // throttle at all — and a failed CLIMB is not a finding about getting OFF
    // the roof. Retrying the approach does not weaken the escape assertion,
    // which is only ever evaluated from a player standing on the roof; it just
    // stops a flaky hop from spending the run. NO-CLIMB is still reported, and
    // still fails, so this can never quietly measure nothing.
    let onRoof = false, tries = 0;
    for (; tries < 8 && !onRoof; tries++) onRoof = await climbToRoof();
    climbTries.push(onRoof ? tries : null);
    if (!onRoof) { rows.push([d, r, 'NO-CLIMB', 'never reached the roof in 8 attempts', null]); continue; }

    // walk off, and keep walking long enough to be clear of the truck
    await hold(key, 1600);
    await p.waitForTimeout(600);
    const f = await feet(); const P = await pos();
    const left = f < roof.maxY - 0.1;
    const mv = await canMove();
    const verdict = !left ? 'STILL ON THE ROOF' : mv.free ? 'escaped' : 'STUCK WHERE IT LANDED';
    rows.push([d, r, verdict, `feet ${f.toFixed(2)} at ${P[0].toFixed(2)},${P[2].toFixed(2)}`,
               `moved ${mv.best} m (best of 4)`]);
    console.log(`  ${verdict === 'escaped' ? 'ok  ' : 'FAIL'} run ${r + 1} ${d.padEnd(6)} ${what.padEnd(34)} `
      + `feet ${f.toFixed(2)}  then moved ${mv.best} m  ${verdict}`);
  }
}

const bad = rows.filter((x) => x[2] !== 'escaped');
const got = climbTries.filter((t) => t !== null);
console.log(`\nclimb: ${got.length}/${climbTries.length} reached the roof, ${got.length ? (got.reduce((a,b)=>a+b,0)/got.length).toFixed(1) : '-'} attempts each on average`);
console.log(`  failed hops: onto the bed ${stage.bed}, onto the rail ${stage.rail}, onto the roof ${stage.roof}`);
console.log(`${rows.length - bad.length}/${rows.length} roof exits escaped cleanly, throttled ${RATE}x`);
for (const [d, r, v, a, b] of bad) console.log(`  FAIL ${d} run ${r + 1}: ${v} — ${a}${b ? `, ${b}` : ''}`);
if (errs.length) console.log(`page errors: ${errs.length}\n  ${errs.slice(0, 3).join('\n  ')}`);
await browser.close();
process.exit(bad.length ? 1 : 0);
