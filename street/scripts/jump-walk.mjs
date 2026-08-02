// Jump, and land on the storey you were on.
//
// The floor picker in ct/apartment.ts has hysteresis (GOTCHAS §7) — it is the
// only thing that knows which of four stacked storeys you are on, and a jump
// that carries you higher can hand it a height it reads as the floor above.
// So this is not "does the jump feel right", which is the user's call; it is
// "does the jump still put you back where you started" everywhere the ground
// changes height.
//
// ── THIS FILE SPENT ITS WHOLE LIFE NOT TESTING ITS OWN SUBJECT ────────────
//
// Its three "storey" spots were at (104, -16), (112, -16) and (120, -16),
// labelled *inside, ground floor* / *the apartment stairs* / *upstairs*. THE
// WALK-UP IS AT x = 200. Nothing stands at x 104-120; it is open ground between
// the street and the interior slab belt, and all three sampled the SAME height,
// so three spots named for three different storeys were one storey repeated.
//
// And the two whose storey was written `null` — meaning *leave the picker
// alone, that is the case under test* — were passed through `warp(x, z, gy ?? 0)`,
// which turns `null` into `setGy(0)`. So "upstairs" was pinned to storey 0
// before the jump it was supposed to measure. The picker this file is NAMED for
// has never once been exercised.
//
// What it does now, and why it is a walk and not a warp: the ground floor, the
// ramp and floor three are REACHED BY HOLDING W FROM THE LOBBY. A storey you
// warped onto proves the warp works. The ramp position in particular cannot be
// written down at all — it is wherever the climb had got to — which is exactly
// the property that makes it a real test of the picker.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4185/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);   // GOTCHAS 26: prove it, do not just name it

// CPU_THROTTLE=8 is this file's own regression test, and the reason it exists:
// run it idle, run it throttled, and the apexes must agree. They did not before
// the fixed 1100 ms window came out — at x40 the same hop read 0.390 m. Applied
// AFTER load so the world still boots in reasonable time.
const THROTTLE = Number(process.env.CPU_THROTTLE ?? 1);
if (THROTTLE > 1) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  console.log(`CPU throttled x${THROTTLE}`);
}

const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const groundAt = (x, z) => p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
// STOREY IS OPTIONAL AND `null` MEANS LEAVE IT ALONE. `crosstown.ts`'s warp is
// `(x, z, yaw?, gy?, pitch?)` and only calls `setGy` when `gy !== undefined`,
// so the null case has to reach it as a MISSING argument. The old helper wrote
// `gy ?? 0` and collapsed every one of them onto the ground floor.
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => (
  gy === null || gy === undefined
    ? window.__ct.warp(x, z, yaw)
    : window.__ct.warp(x, z, yaw, gy, 0)
), [x, z, yaw, gy ?? null]);
/** Wait for `n` RENDERED frames. Every wait in the MEASUREMENT path goes
 *  through here or through a settle below — see the note under `peakDuring`. */
const frames = (n) => p.evaluate((n) => new Promise((resolve) => {
  let seen = 0;
  const tick = () => (++seen >= n ? resolve() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

// The `[E]`-style hazard, for space: the impulse at fp.ts:488 is an edge read
// once per rendered frame, so the hold has to span a rendered frame, not 60 ms
// of wall clock. Under load a frame is longer than the hold and the hop never
// starts. Three frames, so a frame that begins before the keydown lands still
// leaves two.
const jump = async () => { await p.keyboard.down(' '); await frames(3); await p.keyboard.up(' '); };

// ── measuring a jump without a hand-typed baseline ──────────────────────────
//
// This file used to compute the rise as `apex - (pos()[3] + 1.62)`, and that is
// how it once reported a 5.260 m hop on the pavement. Two faults, both here
// rather than in the world:
//
//  1. WRONG QUANTITY. `pos()[3]` is `apt.gy()` — the storey the apartment floor
//     picker last settled on. fp.ts builds the camera from a DIFFERENT number:
//     `y = height + groundY(pos.x, pos.z) + airY` (fp.ts:459-468), the true
//     ground under your feet plus any collider top. The two agree only when the
//     hysteretic picker (GOTCHAS 7) happens to agree with the ground, and every
//     metre they disagree by was reported as jump height.
//  2. UNSYNCHRONISED SAMPLING. `Math.max` over `camY()` polled on a 30 ms
//     wall-clock timer has no idea whether a frame was rendered. The camera
//     holds the walk-up's floor-3 spawn eye — 7.02, apartment.ts:104 — until the
//     first update overwrites it, and 7.02 - (0.14 + 1.62) is exactly 5.260.
//
//  3. A FIXED WALL-CLOCK WINDOW. The fix for (2) left `waitForTimeout(1100)`
//     around the sample, which is the same fault pointing the other way: it
//     ends the measurement early instead of starting it late. See the block
//     above `peakDuring`.
//
// So: the baseline is now MEASURED at rest rather than assumed, every wait in
// the measurement path is counted in rendered FRAMES or in world state rather
// than milliseconds, and the apex is sampled in-page on requestAnimationFrame
// so it can neither miss the peak nor catch a stale frame. No eye-height
// constant appears in this file any more — the rest camera cancels it, whatever
// it is.

/** Block until the camera is the same for 6 consecutive rendered frames, then
 *  hand back that height. Throws rather than returning a half-settled number:
 *  a baseline nobody checked is what caused the 5.260 m reading. */
const settleAndRest = () => p.evaluate(() => new Promise((resolve, reject) => {
  let last = null, stable = 0, frames = 0;
  const tick = () => {
    const y = window.__ct.camY();
    if (last !== null && Math.abs(y - last) < 1e-4) stable++; else stable = 0;
    last = y;
    if (stable >= 6) return resolve(y);
    if (++frames > 300) return reject(new Error('camera never settled'));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));

// ── why there is no wall-clock wait left here ───────────────────────────────
//
// This used to end the sample after a fixed 1100 ms, which is fine at 60 fps
// and wrong the moment the machine is loaded: `dt` is CLAMPED at 0.05 s
// (src/main.ts:107), so a slow frame advances the simulation by at most 50 ms
// however long it actually took. Twenty browsers on one box and the hop needs
// far more than 1100 ms of wall clock to finish the 0.571 s it thinks it is
// flying — the window closes mid-ascent and the peak so far gets reported as
// the apex. Measured on this world, one spot, pavement:
//
//     fixed 1100 ms   x1 0.4750   x8 0.4750   x20 0.4750   x40 0.3900   x80 0.2950
//     settled frames  x1 0.4750   x8 0.4750   x20 0.4750   x40 0.4750   x80 0.4750
//
// (scripts/probes/jump-apex-under-throttle.mjs). The 0.390 and 0.295 are not
// hops; they are frames 4 and 3 of one, and 0.390 is the same family of reading
// as w25's 0.1632 m and this file's own 5.260 m.
//
// So the sample now ends when the HOP ends: the camera has left the ground and
// come back to a height it holds for six consecutive rendered frames. That is a
// statement about the world's state, so it cannot be truncated by load, and it
// throws rather than returning a partial peak if the hop never started or never
// landed.
const APEX_SETTLE_FRAMES = 6;
// Frames, not ms — the whole point. Sized against the longest hop the physics
// can produce, not against a clock: 0.571 s of hang at a 1/60 s step is ~35
// frames, plus the 6-frame settle, so 300 is a 7x margin and still terminates.
// It was 3000 for one revision and a deliberately-missed keypress under x40
// throttle sat there for twenty minutes: a budget generous in FRAMES is
// unbounded in wall clock exactly when frames are slow, which is when this
// check matters. Matches settleAndRest's budget above.
const APEX_FRAME_BUDGET = 300;

/** Peak camera height over the whole hop, sampled every rendered frame in-page.
 *  `rest` is the settled ground-level camera height this hop starts from. */
const peakDuring = async (rest, act) => {
  await p.evaluate(() => {
    window.__jwPeak = -Infinity;
    window.__jwSampling = true;
    const f = () => {
      if (!window.__jwSampling) return;
      window.__jwPeak = Math.max(window.__jwPeak, window.__ct.camY());
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await act();
  await p.evaluate(([rest, settleFrames, budget]) => new Promise((resolve, reject) => {
    let rose = false, last = null, stable = 0, n = 0;
    const f = () => {
      const y = window.__ct.camY();
      if (y > rest + 0.02) rose = true;
      if (last !== null && Math.abs(y - last) < 1e-4) stable++; else stable = 0;
      last = y;
      // Landed: risen, then held one height for `settleFrames` frames, and that
      // height is below the peak — so this is the ground and not a frame that
      // happened to hover at the apex. Deliberately NOT "back at `rest`": a spot
      // that lands you on a different storey is a real finding this file exists
      // to report, and it must reach the CHANGED FLOOR check, not die here.
      if (rose && stable >= settleFrames && y < window.__jwPeak - 0.005) return resolve();
      if (++n > budget) return reject(new Error(rose
        ? `the hop never landed within ${budget} frames`
        : `the camera never left the ground within ${budget} frames — the jump keypress was not observed`));
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }), [rest, APEX_SETTLE_FRAMES, APEX_FRAME_BUDGET]);
  return p.evaluate(() => { window.__jwSampling = false; return window.__jwPeak; });
};

// ── the lowest apex the physics can produce ─────────────────────────────────
//
// Not a band anyone chose: run the world's own integrator at the coarsest step
// it will ever take. `dt` is clamped at DT_CLAMP, so every real frame steps by
// at most that, and a coarser step loses more to Euler — this is the floor.
// A reading below it is arithmetically impossible and is therefore the
// instrument, which is exactly the failure this file has produced twice.
//
// COPIED, not imported, with citations — none of the three is exported today
// (BUILDER-BRIEF §8). Follow-up queued in the handoff note: hoist them into a
// shared module so this derivation cannot drift from the world.
const DT_CLAMP = 0.05;   // src/main.ts:107          Math.min(clock.getDelta(), 0.05)
const JUMP_V0  = 4.0;    // src/proto/fp.ts:488      this.vy = 4.0
const GRAVITY  = 14;     // src/proto/fp.ts:491      this.vy -= 14 * dt
const APEX_FLOOR = (() => {
  let vy = JUMP_V0, airY = 0, peak = 0;
  for (let i = 0; i < 200 && (vy !== 0 || airY > 0); i++) {
    vy -= GRAVITY * DT_CLAMP;                        // fp.ts:491-492, same order
    airY = Math.max(0, airY + vy * DT_CLAMP);
    peak = Math.max(peak, airY);
    if (airY === 0 && vy < 0) vy = 0;
  }
  return peak;
})();

console.log(`apex floor ${APEX_FLOOR.toFixed(3)} m, derived from dt<=${DT_CLAMP}s, v0=${JUMP_V0}, g=${GRAVITY}`);
const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? 'OK  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };

// ── the walk-up's frame, DERIVED from what the world publishes ────────────
// `ct/apartment.ts:114-119` builds SPAWN as
// `{ x: APT_X0 - 1.4, z: APT_Z0 + 3.7, gy: 2 * ST0 }` and the module publishes
// it on `scene.userData.spawn` precisely so a check can read it from a preview.
// Reading it back is how this file learns where the building is without a
// second copy of three coordinates that have already moved once.
const spawn = await p.evaluate(() => window.__ct.scene()?.userData?.spawn ?? null);
if (!spawn || !isFinite(spawn.x) || !isFinite(spawn.gy)) {
  console.error('ABORT: the world publishes no scene.userData.spawn — the walk-up'
    + ' cannot be located, and every storey verdict below would be free.');
  await b.close(); process.exit(3);                           // GOTCHAS §32
}
const APT_X = spawn.x + 1.4, APT_Z = spawn.z - 3.7, ST = spawn.gy / 2;
const AX = (lx) => APT_X + lx, AZ = (lz) => APT_Z + lz;
console.log(`walk-up at (${APT_X}, ${APT_Z}), storey ${ST} m — derived from the published spawn\n`);

// ── the outdoor spots: the kerb, the road, the stoop ──────────────────────
// These always worked and they are the control: if the jump itself regressed,
// these go red too and the storey rows below are not the story.
const spots = [
  ['the pavement', -6.0, -20.0, 0.14],
  ['the kerb edge', -5.1, -20.0, 0.14],
  ['the road', -2.0, -20.0, 0],
  ['the walk-up stoop', 6.2, -44.0, 0.14],
];

// what a jump does from wherever the player is standing right now
const jumpHere = async (what) => {
  const before = await pos();
  // THE REST HEIGHT IS MEASURED, not reconstructed. This read `apex - (gy + 1.62)`,
  // and 1.62 was a hand-typed copy of the rig's eye height (BUILDER-BRIEF §8).
  // `camY()` at rest already IS that number plus the storey, so the subtraction
  // needs no constant and cannot drift if the eye ever moves.
  //
  // NOT `pos()[1]`, which was my first attempt and is wrong: it is the rig's
  // height WITHIN its storey and does not include `gy`, so upstairs it read the
  // 5.4 m of building as a 5.875 m hop. Caught by the check going red on two
  // rows whose jump was fine — measure the instrument too.
  //
  // SETTLED, not sampled once. A single `camY()` read can land on a frame the
  // walk or the storey pick has not finished with — the same unsynchronised
  // read that produced 5.260 m — so the baseline waits for six consecutive
  // rendered frames at one height and throws rather than hand back a
  // half-settled number.
  const rest = await settleAndRest();
  const apex = await peakDuring(rest, jump);
  const after = await pos();
  const rise = apex - rest;
  const sameFloor = Math.abs(after[3] - before[3]) < 0.001;
  console.log(`${what.padEnd(24)} gy ${before[3].toFixed(2)} -> ${after[3].toFixed(2)}  apex +${rise.toFixed(3)} m  ${sameFloor ? 'same floor' : 'CHANGED FLOOR'}`);
  if (!sameFloor) fails.push(`${what}: jumping changed the floor from ${before[3].toFixed(2)} to ${after[3].toFixed(2)}`);
  // Two separate questions, and the old single band answered neither cleanly:
  // its 0.45 floor sits BELOW the 0.475 the physics cannot go under, so a hop
  // truncated at frame 4 reads exactly 0.450 and passes as healthy.
  if (rise < APEX_FLOOR - 1e-3) fails.push(`${what}: apex ${rise.toFixed(3)} m is under ${APEX_FLOOR.toFixed(3)} m, which the physics cannot reach even at the ${DT_CLAMP} s dt clamp — this is the instrument, not the world`);
  else if (rise > 0.8) fails.push(`${what}: apex ${rise.toFixed(3)} m is outside the intended 0.6 m hop`);
  return { before, after, rise };
};

for (const [what, x, z, gy] of spots) {
  await warp(x, z, 0, gy);
  await frames(6);
  await jumpHere(what);
}

// ── THE WALK-UP, ON FOOT ──────────────────────────────────────────────────
console.log('\n── the stacked storeys, reached by walking ──');

// 1. THE LOBBY. Storey 0 is stated, because you have to tell the picker which
//    of four stacked floors you arrived on — that is the one thing a warp into
//    this building legitimately must say. Everything after it is walked.
const LOBBY = [AX(0.6), AZ(6.0)];
await warp(LOBBY[0], LOBBY[1], Math.PI, 0);     // yaw PI faces +z, up the shaft
await p.waitForTimeout(450);
{
  const q = await pos();
  ok(Math.abs(q[3]) < 0.01, `the lobby is storey 0 — gy ${q[3].toFixed(2)}`);
  const g = await groundAt(LOBBY[0], LOBBY[1]);
  ok(Math.abs(g) < 0.01, `and groundAt agrees it is the ground floor — ${g.toFixed(2)}`);
  // IN THE BUILDING, not on open ground three hundred metres away, which is the
  // whole defect this file is being repaired for. The shaft is inside the
  // walk-up's footprint; assert the distance from the building's own origin.
  ok(Math.hypot(LOBBY[0] - APT_X, LOBBY[1] - APT_Z) < 12,
    `and it is inside the walk-up, ${Math.hypot(LOBBY[0] - APT_X, LOBBY[1] - APT_Z).toFixed(1)} m from its origin`);
}
await jumpHere('inside, ground floor');

// 2. WALK UP FLIGHT A. Hold W and watch the picker carry you up the ramp. Stop
//    the moment the storey is strictly between floors — that is the position
//    that cannot be written down, and the one the ramp exists to produce.
await warp(LOBBY[0], LOBBY[1], Math.PI, 0);
await p.waitForTimeout(400);
const climb = [];
await p.keyboard.down('w');
let onRamp = null;
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(150);
  const q = await pos();
  climb.push(+q[3].toFixed(2));
  if (onRamp === null && q[3] > 0.25 && q[3] < ST - 0.2) onRamp = q;
  if (q[3] >= 1.35 - 0.01) break;
}
await p.keyboard.up('w');
await p.waitForTimeout(300);
const top = await pos();
console.log(`  climbed: gy ${climb.filter((v, i, a) => i === 0 || v !== a[i - 1]).join(' -> ')}`);
ok(climb.some((v) => v > 0), 'holding W from the lobby CLIMBS — the storey picker follows the ramp');
ok(onRamp !== null, 'and it passes through heights that are BETWEEN storeys, so the ramp is a ramp');
ok(Math.abs(top[3] - 1.35) < 0.05, `and the half landing is reached on foot — gy ${top[3].toFixed(2)}`);

// 3. THE NULL-STOREY CASE, which is the bug this file shipped. Warp to where
//    the climb actually left us, WITHOUT naming a storey. The picker must keep
//    the storey it had; `gy ?? 0` used to slam it to the ground floor, three
//    floors down, and nothing noticed because no spot here was ever on a
//    storey other than 0 to begin with.
{
  const q = await pos();
  await warp(q[0], q[2], Math.PI, null);
  await p.waitForTimeout(350);
  const after = await pos();
  ok(Math.abs(after[3] - q[3]) < 0.001,
    `warping with a NULL storey leaves the storey alone — ${q[3].toFixed(2)} stayed ${after[3].toFixed(2)}`);
  ok(after[3] > 0.01, `and it is genuinely not the ground floor — gy ${after[3].toFixed(2)}`);
}

// 4. ON THE RAMP ITSELF. Walk back down to a height between floors and jump
//    there: a jump from a sloped floor is the case the hysteresis is for.
await warp(LOBBY[0], LOBBY[1], Math.PI, 0);
await p.waitForTimeout(400);
await p.keyboard.down('w');
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(120);
  const q = await pos();
  if (q[3] > 0.3 && q[3] < ST - 0.4) break;
}
await p.keyboard.up('w');
await p.waitForTimeout(400);
{
  const q = await pos();
  ok(q[3] > 0.01 && q[3] < ST, `standing on the stairs, between storeys — gy ${q[3].toFixed(2)}`);
  const g = await groundAt(q[0], q[2]);
  ok(g > 0.01, `and groundAt is NON-ZERO there — ${g.toFixed(2)}`);
}
await jumpHere('the apartment stairs');

// 5. UPSTAIRS. The published spawn is floor 3 inside 301 — the one upper-storey
//    position the world itself vouches for, and the one `scripts/door301.mjs`
//    already asserts stays standable. Storey named, because arriving on a
//    stacked floor is the case where naming it is correct.
await warp(spawn.x, spawn.z, spawn.yaw, spawn.gy);
await p.waitForTimeout(500);
{
  const q = await pos();
  ok(Math.abs(q[3] - 2 * ST) < 0.01, `upstairs is storey ${(2 * ST).toFixed(2)} — gy ${q[3].toFixed(2)}`);
  const g = await groundAt(spawn.x, spawn.z);
  ok(g > 0.01, `and groundAt is NON-ZERO up there — ${g.toFixed(2)}, not the 0.00 the old spots read`);
}
await jumpHere('upstairs');

console.log('');
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s)` : '\njump lands you on the floor you left, everywhere');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
