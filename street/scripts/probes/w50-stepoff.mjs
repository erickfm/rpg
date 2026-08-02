// ITEM 112: "when i jump off of stuff i teleport straight down."
//
// THE MEASUREMENT: climb onto a raised standable surface by WALKING (you cannot
// warp onto a tier — `warp` writes x/z but not height, so you land inside the
// truck's box at street level and `unstick()` shoves you out), then walk off the
// edge while sampling camera Y on EVERY animation frame from inside the page.
//
// The signature of the bug is a single frame in which world Y falls by the whole
// height of the surface. `fp.ts` keeps `airY` as height ABOVE THE GROUND and
// computes world Y as `groundY(x,z) + airY`; step off and `groundY` returns the
// street in that same frame, so the floor moves and takes the player with it.
// There is no fall to have.
//
// A real fall is bounded by gravity: with g = 14 m/s^2 and main.ts's dt clamp of
// 0.05 s, the FIRST frame of a fall can only lose 14*0.05^2 = 0.035 m, and no
// later frame can lose more than v*dt where v grows by 0.7 m per clamped step.
// Falling 0.50 m from the bed floor takes ~0.27 s — several frames, never one.
//
// Sampling is in-page per frame, not by polling from node: a p.evaluate round
// trip costs 10-20 ms, which is most of a frame here, and the whole event being
// measured lasts a handful of frames (the same argument as w21-roof-climb's
// hopOnto).
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w50-stepoff.mjs
import { chromium } from 'playwright';

const EYE = 1.62;          // fp.ts's standing eye height
const G = 14;              // fp.ts:552
const DT_CLAMP = 0.05;     // main.ts:107

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4187/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));

const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const feet = async () => (await camY()) - EYE;
const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);
const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };
const hopInto = async (key, riseMs, pushMs) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(key); await p.waitForTimeout(pushMs);
  await p.keyboard.up(key); await p.keyboard.up(' ');
  await p.waitForTimeout(450);
};

/** Walk in `key` while recording camY every frame, until the player has been
 *  still for 6 frames or the budget runs out. Returns the whole trace. */
const walkOffRecording = async (key, ms) => {
  await p.keyboard.down(key);
  const trace = await p.evaluate((budget) => new Promise((done) => {
    const out = [];
    const t0 = performance.now();
    let still = 0, last = null;
    const tick = () => {
      const y = window.__ct.camY();
      out.push(+y.toFixed(5));
      still = last !== null && Math.abs(y - last) < 1e-5 ? still + 1 : 0;
      last = y;
      if (still >= 6 || performance.now() - t0 > budget) return done(out);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), ms);
  await p.keyboard.up(key);
  await p.waitForTimeout(200);
  return trace;
};

/** The verdict on one trace. A drop is "instant" if any single frame loses more
 *  than a generous gravity bound: even at a very long 0.10 s frame, a fall that
 *  started this frame loses g*dt^2 = 0.14 m, and one already at terminal speed
 *  for a 0.5-1.5 m surface (v <= 5.4 m/s) loses 0.54 m only over a whole
 *  0.1 s frame. We flag the unmistakable case: a frame that loses more than
 *  0.20 m while the fall has barely begun. */
const verdict = (label, trace, height) => {
  let worst = 0, worstAt = -1;
  for (let i = 1; i < trace.length; i++) {
    const d = trace[i - 1] - trace[i];
    if (d > worst) { worst = d; worstAt = i; }
  }
  const total = Math.max(...trace) - Math.min(...trace);
  // how many frames did the descent take, from first fall to settled?
  const top = Math.max(...trace), bot = Math.min(...trace);
  const startI = trace.findIndex((v) => v < top - 0.01);
  const endI = trace.findIndex((v, i) => i >= startI && v < bot + 0.01);
  const frames = startI < 0 ? 0 : endI - startI + 1;
  const instant = worst > 0.20;
  console.log(`\n  ${label}`);
  console.log(`    surface height        ${height.toFixed(3)} m`);
  console.log(`    total descent         ${total.toFixed(3)} m`);
  console.log(`    biggest single frame  ${worst.toFixed(3)} m  (frame ${worstAt} of ${trace.length})`);
  console.log(`    frames to descend     ${frames}`);
  console.log(`    ${instant ? 'TELEPORT' : 'fall    '}              ${instant
    ? `one frame swallowed ${(100 * worst / Math.max(total, 1e-9)).toFixed(0)}% of the drop`
    : 'descent is spread over several frames, as gravity requires'}`);
  return { instant, worst, total, frames };
};

console.log(`gravity bound: a fall's first clamped frame can lose at most`
  + ` ${(G * DT_CLAMP * DT_CLAMP).toFixed(3)} m; anything above 0.20 m in one frame is a teleport\n`);

const results = {};

// ── the pickup bed floor ───────────────────────────────────────────────────
const bed = byTag['pickup-bed-floor'];
if (!bed) { console.log('FAIL: no pickup-bed-floor collider'); await browser.close(); process.exit(1); }
const bedMidZ = (bed.minZ + bed.maxZ) / 2;
const roof = byTag['pickup-cab-roof'];
const roofMidZ = (roof.minZ + roof.maxZ) / 2;
const tailIsPlusZ = bedMidZ > roofMidZ;
const fwd = tailIsPlusZ ? -1 : 1;
const tailZ = tailIsPlusZ ? bed.maxZ : bed.minZ;
const midX = (bed.minX + bed.maxX) / 2;
const yawFwd = fwd < 0 ? 0 : Math.PI;
const yawBack = fwd < 0 ? Math.PI : 0;

console.log(`truck: tail z=${tailZ.toFixed(2)}, forward ${fwd > 0 ? '+z' : '-z'}, x=${midX.toFixed(2)}`);
console.log(`bed floor top ${bed.maxY}, cab roof top ${roof.maxY}`);

// climb: street -> bed floor, in over the open tailgate
await warp(midX, tailZ - fwd * 1.6, yawFwd);
await p.waitForTimeout(300);
await hold('w', 700);
await p.waitForTimeout(200);
await hopInto('w', 220, 900);
const onBed = await feet();
console.log(`\nclimbed: feet at ${onBed.toFixed(3)} (bed floor is ${bed.maxY})`);
if (Math.abs(onBed - bed.maxY) > 0.06) {
  console.log('FAIL: never got onto the bed floor — cannot measure a step-off from it');
} else {
  // turn around and walk back out over the tailgate
  const q = await pos();
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, 0), [q[0], q[2], yawBack]);
  await p.waitForTimeout(250);
  const trace = await walkOffRecording('w', 2500);
  results.bed = verdict('STEP OFF THE PICKUP BED FLOOR (walked out over the tailgate)', trace, bed.maxY);
  console.log(`    trace: ${trace.slice(0, 26).map((v) => v.toFixed(2)).join(' ')}`);
}

// ── can you jump again in mid-air? (fp.ts:549's second effect) ─────────────
//
// Climb back on, walk off, and press jump WHILE the drop is happening. If the
// gate is `airY === 0 && vy === 0` then stepping off leaves both at zero and a
// fresh 4.0 m/s jump is granted in mid-air — which shows up as the camera
// RISING after it has left the surface.
await warp(midX, tailZ - fwd * 1.6, yawFwd);
await p.waitForTimeout(300);
await hold('w', 700);
await p.waitForTimeout(200);
await hopInto('w', 220, 900);
const onBed2 = await feet();
if (Math.abs(onBed2 - bed.maxY) > 0.06) {
  console.log('\n(skipped the mid-air jump test: did not regain the bed floor)');
} else {
  const q = await pos();
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, 0), [q[0], q[2], yawBack]);
  await p.waitForTimeout(250);
  await p.keyboard.down('w');
  const air = await p.evaluate((edge) => new Promise((done) => {
    const out = []; let jumped = false, n = 0;
    const tick = () => {
      const y = window.__ct.camY();
      out.push({ y: +y.toFixed(4), jumped });
      // the moment the feet leave the surface, press jump
      if (!jumped && y < edge) {
        jumped = true;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
        setTimeout(() => window.dispatchEvent(
          new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true })), 200);
      }
      if (++n > 150) return done(out);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), EYE + bed.maxY - 0.05);
  await p.keyboard.up('w');
  const after = air.filter((s) => s.jumped).map((s) => s.y);
  const rise = after.length ? Math.max(...after) - after[0] : 0;
  console.log(`\n  MID-AIR JUMP after stepping off`);
  console.log(`    camY rose ${rise.toFixed(3)} m after the jump was pressed in the air`);
  console.log(`    ${rise > 0.10 ? 'BUG: a fresh jump was granted in mid-air' : 'ok: no second jump in the air'}`);
  results.midair = { rise, bug: rise > 0.10 };
}

// ── control: walking off the kerb must still feel the same ────────────────
//
// The kerb is 0.14 m and is NOT a collider top — it is terrain, via groundY.
// It is the thing that must not change, so it is measured the same way.
await warp(midX, tailZ - fwd * 5.0, yawFwd);
await p.waitForTimeout(400);
console.log(`\n  (kerb control measured separately by scripts/probes/w50-kerb.mjs)`);

console.log(`\nconsole errors: ${errs.length}`);
if (errs.length) console.log(errs.slice(0, 5).join('\n'));
await browser.close();
