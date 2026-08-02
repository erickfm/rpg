// ITEM 69: SETTLE THE RAIL -> ROOF HOP, BY COUNTING FRAMES RATHER THAN ARGUING.
//
// Three builders measured this and got three answers. w21 walked it and it
// worked; w22 climbed it 27 times throttled and it worked; w29 says 0.53 m of
// rise is on the wrong side of a cliff and only wins by float luck.
//
// They are arguing about a quantity nobody has measured directly: HOW MANY
// RENDERED FRAMES the player spends above `roof.maxY - TOP_EPS`. That number is
// what decides the hop, because it is the number of frames in which `blocked()`
// stops padding the roof by RADIUS and the player is allowed to travel over it:
//
//   fp.ts:289   if (c.maxY !== undefined && atY >= c.maxY - TOP_EPS) continue;
//   fp.ts:469   const atY = this.lastWorldY;      <- LAST frame's foot height
//   fp.ts:491   if (!this.blocked(nx, this.pos.z, atY)) this.pos.x = nx;
//
// So height alone is not the test. You must clear RADIUS (0.36 m) of ground
// while the threshold is beaten, and at the dt clamp a walk covers 0.165 m per
// frame — three frames of travel or you are still outside the footprint when
// you drop back under.
//
// This prints, per rep: the frame-by-frame trace, the count of frames above the
// threshold, the horizontal distance covered across the frames that count, and
// whether the player actually ended up on the roof. Nothing here is inferred
// from where the player finished.
//
// Usage: SHOT_URL=http://localhost:4185/ node scripts/probes/w33-roof-frames.mjs [reps] [throttle]
import { chromium } from 'playwright';

const EYE = 1.62;
const TOP_EPS = 0.08;          // fp.ts:98 — cited, and re-derived below from the world
const REPS = Number(process.argv[2] ?? 5);
const THROTTLE = Number(process.argv[3] ?? 1);

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

if (THROTTLE > 1) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
}

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));
const bed = byTag['pickup-bed-floor'], roof = byTag['pickup-cab-roof'];
const midX = (bed.minX + bed.maxX) / 2;
const bedMidZ = (bed.minZ + bed.maxZ) / 2, roofMidZ = (roof.minZ + roof.maxZ) / 2;
const tailIsPlusZ = bedMidZ > roofMidZ;
const fwd = tailIsPlusZ ? -1 : 1;
const tailZ = tailIsPlusZ ? bed.maxZ : bed.minZ;
const yawFwd = fwd < 0 ? 0 : Math.PI;
const rail = byTag['pickup-rail-right'].minX > midX ? byTag['pickup-rail-right'] : byTag['pickup-rail-left'];
const strafe = ((rail.minX + rail.maxX) / 2 > midX) === (yawFwd === 0) ? 'd' : 'a';
// the roof face the player has to get past, and how far past it is "landed"
const roofFace = fwd > 0 ? roof.minZ : roof.maxZ;
const NEED = roof.maxY - TOP_EPS;         // feet height that stops the roof being a wall

console.log(`rail top ${rail.maxY}  roof top ${roof.maxY}  rise ${(roof.maxY - rail.maxY).toFixed(4)}`);
console.log(`threshold: feet >= ${NEED.toFixed(4)}   (rise - TOP_EPS = ${(roof.maxY - TOP_EPS - rail.maxY).toFixed(17)} of airY)`);
console.log(`roof face at z ${roofFace.toFixed(3)}, forward ${fwd > 0 ? '+z' : '-z'}, throttle x${THROTTLE}\n`);

const camY = () => p.evaluate(() => window.__ct.camY());
const pos = () => p.evaluate(() => window.__ct.pos());
const feet = async () => (await camY()) - EYE;
const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);
const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };

/** Wait for N RENDERED FRAMES, never a wall-clock duration. dt is clamped at
 *  0.05 s (main.ts:107), so under throttle the sim advances at most 50 ms per
 *  frame however long the frame took — a fixed ms wait therefore measures
 *  fewer sim steps the more loaded the machine is, which is exactly the trap
 *  that produced this item's three disagreeing accounts. */
const frames = (n) => p.evaluate((n) => new Promise((done) => {
  let i = 0;
  const tick = () => (++i >= n ? done(i) : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

/** A hop that keeps SPACE down the whole time (BUILDER-BRIEF §5) and pushes
 *  after `riseFrames` rendered frames, while a recorder installed on the page
 *  samples every frame independently of the key timing. */
const startRec = () => p.evaluate(() => {
  window.__w33 = [];
  window.__w33on = true;
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const P = window.__ct.pos();
    window.__w33.push([+(now - last).toFixed(1), +window.__ct.camY().toFixed(5), +P[0].toFixed(5), +P[2].toFixed(5)]);
    last = now;
    if (window.__w33on) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const stopRec = () => p.evaluate(() => { window.__w33on = false; return window.__w33; });

/** Climb street -> bed floor -> rail -> flush against the cab. Returns false if
 *  any leg missed, so a bad rep is reported as a miss on THAT leg rather than
 *  being scored as a failed roof hop. */
const toRail = async () => {
  await warp(midX, tailZ - fwd * 1.4, yawFwd);
  await frames(12);
  await hold('w', 700);                        // flush against the tailgate
  await frames(6);
  // street -> bed floor
  await p.keyboard.down(' '); await frames(3);
  await p.keyboard.down('w'); await frames(14);
  await p.keyboard.up('w'); await p.keyboard.up(' ');
  await frames(20);
  if (Math.abs((await feet()) - bed.maxY) > 0.06) return 'bed';
  // bed floor -> rail
  await hold(strafe, 400); await frames(6);
  await p.keyboard.down(' '); await frames(3);
  await p.keyboard.down(strafe);
  await p.evaluate(([lo, hi]) => new Promise((done) => {
    const t = () => { const x = window.__ct.pos()[0]; if (x > lo && x < hi) return done(x); requestAnimationFrame(t); };
    requestAnimationFrame(t);
  }), [rail.minX, rail.maxX]).catch(() => {});
  await p.keyboard.up(strafe); await p.keyboard.up(' ');
  await frames(20);
  if (Math.abs((await feet()) - rail.maxY) > 0.06) return 'rail';
  // forward along the rail until flush against the cab
  await hold('w', 500); await frames(6);
  if (Math.abs((await feet()) - rail.maxY) > 0.06) return 'flush';
  return null;
};

// ── HOW MANY FRAMES ARE ON OFFER, as opposed to how many get used ─────────
//
// The per-rep count below stops the moment the player is over the roof, which
// is correct for "did he make it" and useless for "by how much". Once he lands,
// `standTop` holds him above the threshold forever, and counting those frames
// turns any hop into a 40-frame one.
//
// So measure the vertical window on its own: hop straight up off the rail with
// NO forward push, so the player never arrives anywhere, and count the frames
// his feet clear `roof.maxY - TOP_EPS`. That is the budget the horizontal
// crossing gets to spend, and it is the number that says whether the hop
// survives a dropped frame.
const headroom = async () => {
  let miss = null;
  for (let t = 0; t < 3; t++) { miss = await toRail(); if (!miss) break; }
  if (miss) return null;
  await startRec();
  await p.keyboard.down(' ');
  await frames(18);
  await p.keyboard.up(' ');
  await frames(6);
  const trace = await stopRec();
  let n = 0, peak = -Infinity;
  for (const [, cy] of trace) { const ft = cy - EYE; peak = Math.max(peak, ft); if (ft >= NEED) n++; }
  return { n, peak };
};
const hr = await headroom();
if (hr) {
  console.log(`VERTICAL HEADROOM off the rail (no push): ${hr.n} frames clear ${NEED.toFixed(3)}, peak feet ${hr.peak.toFixed(4)}`);
  console.log(`crossing RADIUS 0.36 at 0.165 m/frame needs 3 of them — spare frames: ${hr.n - 3}\n`);
}

let ok = 0, tried = 0, legMiss = 0;
const counts = [];
for (let r = 1; r <= REPS; r++) {
  // RETRY THE APPROACH, NOT THE HOP. The street -> bed-floor hop is item 1's
  // and is independently flaky (~7/8, scripts/probes/w21-entry-flake.mjs) — a
  // rep lost there is not a roof-hop sample and must not be scored as one, in
  // either direction.
  let miss = null;
  for (let t = 0; t < 3; t++) { miss = await toRail(); if (!miss) break; }
  if (miss) { legMiss++; console.log(`rep ${r}: missed the ${miss} leg in 3 tries — not a roof-hop sample`); continue; }
  tried++;
  const z0 = (await pos())[2];
  await startRec();
  await p.keyboard.down(' '); await frames(3);
  await p.keyboard.down('w');
  // STOP PUSHING THE MOMENT YOU ARE OVER THE ROOF, exactly as w21's `hopOnto`
  // does. Holding `w` for a fixed number of frames walks straight across the
  // roof and down onto the hood, and the end-state check then reports "missed"
  // for a hop that landed perfectly — which is how a 3-frame clearance first
  // looked like a 0/6 failure here.
  await p.evaluate(([x0, x1, z0, z1]) => new Promise((done) => {
    let n = 0;
    const t = () => {
      const P = window.__ct.pos();
      if ((P[0] > x0 && P[0] < x1 && P[2] > z0 && P[2] < z1) || ++n > 40) return done(n);
      requestAnimationFrame(t);
    };
    requestAnimationFrame(t);
  }), [roof.minX, roof.maxX, roof.minZ, roof.maxZ]);
  await p.keyboard.up('w'); await p.keyboard.up(' ');
  await frames(20);
  const trace = await stopRec();
  const f = await feet(); const P = await pos();
  const landed = Math.abs(f - roof.maxY) < 0.06 &&
    P[0] > roof.minX && P[0] < roof.maxX && P[2] > roof.minZ && P[2] < roof.maxZ;
  if (landed) ok++;

  // ── the measurement: frames above the threshold, and travel across them ──
  //
  // `blocked()` reads LAST frame's height, so the frames in which the player is
  // actually allowed to move over the roof are the ones AFTER each high frame.
  // Travel is therefore summed over frame i+1 for every high frame i, which is
  // the quantity that has to beat RADIUS.
  // ONLY THE FRAMES SPENT OUTSIDE THE ROOF'S FOOTPRINT COUNT. Once the player
  // is over the roof, `standTop` puts him on it and every later frame reads
  // "high" forever — counting those turns a 5-frame hop into a 41-frame one and
  // hides the very margin this item exists to measure.
  const inside = (x, z) => x > roof.minX && x < roof.maxX && z > roof.minZ && z < roof.maxZ;
  let high = 0, travel = 0, peak = -Infinity;
  for (let i = 0; i < trace.length; i++) {
    const [, cy, x, z] = trace[i];
    if (inside(x, z)) break;                   // arrived — stop measuring the approach
    const ft = cy - EYE;
    peak = Math.max(peak, ft);
    if (ft >= NEED) {
      high++;
      if (i + 1 < trace.length) travel += Math.hypot(trace[i + 1][2] - x, trace[i + 1][3] - z);
    }
  }
  counts.push({ high, travel: +travel.toFixed(3), peak: +peak.toFixed(4), landed });
  const dts = trace.map((t) => t[0]).sort((a, b) => a - b);
  console.log(`rep ${r}: ${landed ? 'ON THE ROOF' : 'MISSED     '}  frames above ${NEED.toFixed(3)}: ${high}` +
    `   travel while high ${travel.toFixed(3)} m (needs > ${(0.36).toFixed(2)})` +
    `   peak feet ${peak.toFixed(4)}   median dt ${dts[Math.floor(dts.length / 2)]} ms`);
  if (r === 1) {
    console.log('   frame trace (dt ms, feet, z, high?):');
    for (const [dt, cy, , z] of trace.slice(0, 26)) {
      const ft = cy - EYE;
      console.log(`     ${String(dt).padStart(6)}  ${ft.toFixed(4)}  ${z.toFixed(4)}  ${ft >= NEED ? 'HIGH' : ''}`);
    }
  }
}

const hi = counts.map((c) => c.high);
console.log(`\n=== throttle x${THROTTLE}: ${ok}/${tried} landed (${legMiss} reps lost on an earlier leg) ===`);
if (hi.length) {
  console.log(`frames above threshold: min ${Math.min(...hi)}  max ${Math.max(...hi)}  ` +
    `all ${JSON.stringify(hi)}`);
  console.log(`travel while above:     min ${Math.min(...counts.map((c) => c.travel)).toFixed(3)} m  ` +
    `max ${Math.max(...counts.map((c) => c.travel)).toFixed(3)} m   (RADIUS = 0.36)`);
}
if (errs.length) console.log('page errors:', errs.slice(0, 3).join(' | '));
await browser.close();
