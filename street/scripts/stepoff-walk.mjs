// ITEM 112'S ACCEPTANCE TEST: leaving a raised surface must be a FALL.
//
// The user: *"when i jump off of stuff i teleport straight down. please fix this."*
//
// `fp.ts` keeps `airY` as height ABOVE THE GROUND and computes world Y as
// `groundY(x, z) + airY`. Before the fix, clearing the edge of a car roof took
// `groundY` from 1.415 to 0.000 in ONE frame and the camera went with it: the
// player was never falling, the floor moved out from under him. This file walks
// off three surfaces and proves the descent is bounded by gravity instead.
//
// THIS IS A WALK, NOT A WARP. You cannot warp onto a tier — `warp` writes x and
// z but not your height, so it drops you inside the car's box at street level
// and `unstick()` shoves you out sideways. Every surface here is reached by
// climbing, the same way scripts/w21-roof-climb.mjs and w29-sedan-climb.mjs do,
// and for the same reason: a check that never got up there would be asserting
// "did you come down" about a player who was always on the ground, and would
// pass on any world at all.
//
// ── HOW IT CAN FAIL ────────────────────────────────────────────────────────
//
// THE BOUND IS DERIVED PER FRAME, NEVER TYPED. A body falling from rest off a
// surface of height h can never be moving faster than `sqrt(2*g*h)` on the way
// down, so in a frame lasting `dt` it can lose at most `sqrt(2*g*h)*dt +
// g*dt^2/2`. The frame durations are recorded alongside the heights, so the
// bound is computed against the frames that actually happened rather than
// against an assumed frame rate — the mistake that produced a "0.1632 m apex"
// below a floor the physics cannot go under (GOTCHAS §30).
//
// Against the pre-fix world this fails loudly and does not have to be tuned to:
// walking off the 0.50 m bed floor lost 0.514 m in a single frame, where the
// bound for that frame is about 0.19 m.
//
// THE KERB CASE USED TO ASSERT THE OPPOSITE, ON PURPOSE — AND IT HAS NOW BEEN
// FLIPPED, WHICH IS THE OUTCOME IT WAS BUILT FOR.
//
// Item 112 required the kerb to feel exactly as it did, so this case pinned the
// CURRENT behaviour (a single-frame snap down the 0.14 m kerb) rather than an
// ideal one, and its author wrote down why: *"a change detector, not an
// endorsement: if someone later decides terrain drops should fall too, this case
// fails and makes them say so out loud instead of changing the feel of every
// pavement in the world silently."*
//
// SO, OUT LOUD. The user, 2026-08-02, item 130: *"i think just make all drops
// falls then we can work back from there."* (`FEATURE-REQUESTS.md:2715`; the
// desk's ruling on it is *"no threshold: every drop becomes a fall, kerbs
// included"*.) The detector fired on the first build of that change, exactly as
// designed, and this is the answer to it rather than a suppression of it.
//
// It is still a detector, now pointed the other way: the kerb must be EASED, and
// if anyone sets `FALL_MIN_DROP` above a kerb's height this goes red and makes
// them say so in turn.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/stepoff-walk.mjs
import { chromium } from 'playwright';

const EYE = 1.62;          // fp.ts's standing eye height
const G = 14;              // fp.ts's gravity
const TOL = 0.06;          // how close to a surface's own maxY counts as on it
// src/main.ts:107 — `Math.min(clock.getDelta(), 0.05)`. The physics NEVER
// integrates a step longer than this however long the wall clock says the frame
// took, so a gravity bound computed on raw wall-clock dt is too generous on a
// slow frame. Case 6 measured a 57.1 ms frame on this machine, where the
// difference is a 0.136 m bound against a 0.113 m one — and it is the second
// that is true. Cases 1-5 predate this and still use raw dt; they pass by a
// wide enough margin that it has never mattered, but it is the same latent
// hole and it is written down here rather than left for someone to rediscover.
const DT_CLAMP = 0.05;

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4187/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));
const need = ['pickup-bed-floor', 'pickup-rail-left', 'pickup-rail-right',
  'pickup-cab-roof', 'sedan-trailer-deck', 'sedan-boot-lid'];
const missing = need.filter((t) => !byTag[t]);
if (missing.length) {
  console.log(`FAIL: no such standable surface: ${missing.join(', ')}`);
  await browser.close();
  process.exit(1);
}

const fails = [];
const notes = [];

const pos = () => p.evaluate(() => window.__ct.pos());
const camY = () => p.evaluate(() => window.__ct.camY());
const feet = async () => (await camY()) - EYE;
const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);
const face = async (yaw) => {
  const q = await pos();
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, 0), [q[0], q[2], yaw]);
  await p.waitForTimeout(200);
};
const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };
// SPACE STAYS DOWN THROUGH THE WHOLE HOP — BUILDER-BRIEF §5. `fp.ts` reads the
// key set once per rendered frame, so a short press can vanish whole under load;
// `jumpHeld` refuses to re-jump until release, so holding costs nothing.
const hopOnto = async (key, riseMs, box, axis, maxMs = 900) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(key);
  const lo = axis === 'x' ? box.minX : box.minZ, hi = axis === 'x' ? box.maxX : box.maxZ;
  // Watch from INSIDE the page, one animation frame at a time: an evaluate
  // round trip costs most of a frame here, and a rail's standable band is
  // crossed in about 90 ms (w21-roof-climb's hopOnto makes the same argument).
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
const hopInto = async (key, riseMs, pushMs) => {
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(key); await p.waitForTimeout(pushMs);
  await p.keyboard.up(key); await p.keyboard.up(' ');
  await p.waitForTimeout(450);
};

/** Walk (and optionally jump) off an edge, sampling camera Y AND the frame
 *  duration every animation frame, until settled. */
const leave = async (key, { jump = false, budget = 3000 } = {}) => {
  if (jump) { await p.keyboard.down(' '); }
  await p.keyboard.down(key);
  const trace = await p.evaluate((ms) => new Promise((done) => {
    const out = [];
    const t0 = performance.now();
    let prev = t0, still = 0, last = null;
    const tick = () => {
      const now = performance.now();
      const y = window.__ct.camY();
      out.push([+y.toFixed(5), (now - prev) / 1000]);
      prev = now;
      still = last !== null && Math.abs(y - last) < 1e-5 ? still + 1 : 0;
      last = y;
      if (still >= 6 || now - t0 > ms) return done(out);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), budget);
  await p.keyboard.up(key);
  if (jump) await p.keyboard.up(' ');
  await p.waitForTimeout(250);
  return trace;
};

/** Assert every frame of a descent is inside the gravity bound for a fall from
 *  `h`. Returns true when the surface was left like a falling body. */
const mustFall = (label, trace, h) => {
  const vMax = Math.sqrt(2 * G * h);
  let worst = 0, worstBound = 0, worstDt = 0, bad = 0;
  for (let i = 1; i < trace.length; i++) {
    const drop = trace[i - 1][0] - trace[i][0];
    const dt = trace[i][1];
    // the most a body falling from rest off THIS surface could lose in a frame
    // of THIS duration, plus a frame of slack for sampling jitter
    const bound = vMax * dt + 0.5 * G * dt * dt + 0.02;
    if (drop > bound) {
      bad++;
      if (drop - bound > worst - worstBound) { worst = drop; worstBound = bound; worstDt = dt; }
    }
  }
  const total = Math.max(...trace.map((t) => t[0])) - Math.min(...trace.map((t) => t[0]));
  if (bad) {
    fails.push(`${label}: ${bad} frame(s) fell faster than gravity allows —`
      + ` worst lost ${worst.toFixed(3)} m in a ${(worstDt * 1000).toFixed(0)} ms frame,`
      + ` bound ${worstBound.toFixed(3)} m. The floor moved; the player did not fall.`);
    return false;
  }
  notes.push(`  OK   ${label} — descended ${total.toFixed(3)} m over`
    + ` ${trace.length} frames, every frame inside its gravity bound`);
  return true;
};

// ── truck geometry, derived from the colliders, never typed ────────────────
const bed = byTag['pickup-bed-floor'], roof = byTag['pickup-cab-roof'];
const bedMidZ = (bed.minZ + bed.maxZ) / 2, roofMidZ = (roof.minZ + roof.maxZ) / 2;
const tailIsPlusZ = bedMidZ > roofMidZ;
const fwd = tailIsPlusZ ? -1 : 1;
const tailZ = tailIsPlusZ ? bed.maxZ : bed.minZ;
const midX = (bed.minX + bed.maxX) / 2;
const yawFwd = fwd < 0 ? 0 : Math.PI;      // towards the cab
const yawBack = fwd < 0 ? Math.PI : 0;     // out over the tailgate
const rail = byTag['pickup-rail-left'];
// Which strafe key walks TOWARDS that rail depends on which way you are facing,
// not only on which side of the truck it is — the formula is w21-roof-climb.mjs:159.
// Getting this wrong strafes off the far side and the climb silently measures nothing.
const strafe = (((rail.minX + rail.maxX) / 2 > midX) === (yawFwd === 0)) ? 'd' : 'a';

console.log(`truck: tail z=${tailZ.toFixed(2)}, forward ${fwd > 0 ? '+z' : '-z'}, x=${midX.toFixed(2)}`);
console.log(`surfaces: bed ${bed.maxY}, rail ${rail.maxY}, cab roof ${roof.maxY},`
  + ` sedan boot ${byTag['sedan-boot-lid'].maxY.toFixed(2)}\n`);

// THREE ATTEMPTS, like w21-roof-climb's own route loop. The hop in over the
// tailgate is genuinely flaky — it depends on where in the frame the jump lands
// — and a climb that missed must not be reported as a step-off that failed.
// Those are opposite findings, and conflating them cost this file two false
// FAILs on its first run.
const climbBed = async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await warp(midX, tailZ - fwd * 1.6, yawFwd);
    await p.waitForTimeout(300);
    await hold('w', 700);
    await p.waitForTimeout(200);
    await hopInto('w', 220, 900);
    if (Math.abs((await feet()) - bed.maxY) <= TOL) return true;
  }
  return false;
};

// ── 1. walk off the pickup bed floor ───────────────────────────────────────
if (!await climbBed()) {
  fails.push('never climbed onto the pickup bed floor — case 1 measured nothing');
} else {
  await face(yawBack);
  mustFall('1. walked off the pickup BED FLOOR', await leave('w'), bed.maxY);
}

// ── 2. JUMP off the pickup bed floor (the user's own verb) ─────────────────
if (!await climbBed()) {
  fails.push('never climbed onto the pickup bed floor — case 2 measured nothing');
} else {
  await face(yawBack);
  mustFall('2. JUMPED off the pickup BED FLOOR', await leave('w', { jump: true }), bed.maxY);
}

// ── 3. no second jump in mid-air (fp.ts's jump gate, same root) ────────────
if (!await climbBed()) {
  fails.push('never climbed onto the pickup bed floor — case 3 measured nothing');
} else {
  await face(yawBack);
  await p.keyboard.down('w');
  const air = await p.evaluate((edge) => new Promise((done) => {
    const out = []; let jumped = false, n = 0;
    const tick = () => {
      const y = window.__ct.camY();
      out.push({ y: +y.toFixed(4), jumped });
      if (!jumped && y < edge) {         // feet have left the surface — jump NOW
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
  await p.waitForTimeout(200);
  const after = air.filter((s) => s.jumped).map((s) => s.y);
  const rise = after.length ? Math.max(...after) - after[0] : 0;
  if (rise > 0.10) {
    fails.push(`3. a fresh jump was granted IN MID-AIR after stepping off:`
      + ` the camera rose ${rise.toFixed(3)} m. fp.ts's jump gate is`
      + ` airY === 0 && vy === 0, which a step-off used to leave true.`);
  } else {
    notes.push(`  OK   3. no second jump in mid-air — camera rose ${rise.toFixed(3)} m after pressing it`);
  }
}

// ── 4. walk off the pickup CAB ROOF, the tallest surface in the world ──────
if (!await climbBed()) {
  fails.push('never climbed onto the pickup bed floor — case 4 measured nothing');
} else {
  await hold(strafe, 400);
  await p.waitForTimeout(200);
  await hopOnto(strafe, 200, rail, 'x');
  if (Math.abs((await feet()) - rail.maxY) > TOL) {
    fails.push('never reached the bed rail — case 4 (cab roof) measured nothing');
  } else {
    await hold('w', 500);
    await p.waitForTimeout(200);
    await hopOnto('w', 200, roof, 'z');
    if (Math.abs((await feet()) - roof.maxY) > TOL) {
      fails.push('never reached the cab roof — case 4 measured nothing');
    } else {
      // step off sideways, straight down to the street: the biggest drop there is
      await face(strafe === 'a' ? yawFwd - Math.PI / 2 : yawFwd + Math.PI / 2);
      mustFall('4. walked off the pickup CAB ROOF', await leave('w'), roof.maxY);
    }
  }
}

// ── 5. walk off the SEDAN BOOT LID ─────────────────────────────────────────
const deck = byTag['sedan-trailer-deck'], boot = byTag['sedan-boot-lid'];
const sMid = (b) => (b.minZ + b.maxZ) / 2;
const sFwd = sMid(boot) > sMid(deck) ? 1 : -1;
const sTail = sFwd > 0 ? deck.minZ : deck.maxZ;
const sMidX = (deck.minX + deck.maxX) / 2;
const sYawFwd = sFwd < 0 ? 0 : Math.PI;
const sYawBack = sFwd < 0 ? Math.PI : 0;
// Three attempts, for the same reason climbBed has them: road -> deck -> boot is
// two chained hops, and it misses often enough that the built bundle failed this
// case on a world where the fix was working. "Never got up there" and "got up
// there and fell wrong" are opposite findings.
const climbBoot = async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await warp(sMidX, sTail - sFwd * 1.4, sYawFwd);
    await p.waitForTimeout(300);
    await hold('w', 600);
    await p.waitForTimeout(200);
    await hopOnto('w', 220, deck, 'z');
    if (Math.abs((await feet()) - deck.maxY) > TOL) continue;
    await hold('w', 420);
    await p.waitForTimeout(200);
    await hopOnto('w', 200, boot, 'z');
    if (Math.abs((await feet()) - boot.maxY) <= TOL) return true;
  }
  return false;
};
if (!await climbBoot()) {
  fails.push('never reached the sedan boot lid in three attempts — case 5 measured nothing');
} else {
  await face(sYawBack);
  mustFall('5. walked off the SEDAN BOOT LID', await leave('w'), boot.maxY);
}

// ── 6. THE KERB FALLS TOO — flipped for item 130 (see the header) ──────────
//
// A kerb is `groundY` terrain. It used to be exempt because the step-off block
// was gated on `heldByTop`; item 130 removed that gate, so the 0.14 m pavement
// step is now eased by gravity like every other drop in the world.
// FIND A REAL KERB FIRST, and measure against the KERB'S OWN HEIGHT — never
// against the total descent. The first version of this case asked only for "a
// drop over 0.05 m in some direction" and was answered by the HEAD BOB: `bob`
// is 0.035 (fp.ts:207), so walking swings the camera 0.07 peak to peak, which
// cleared that bar without a kerb anywhere in sight. It reported the kerb had
// changed, on a code path that provably cannot run for terrain. Half of all
// "defects" here are the instrument (BUILDER-BRIEF §7) and this was one.
const kerb = await p.evaluate(() => {
  // walk +x along a few streets looking for the pavement -> road step
  for (const z of [-40, -38, -36, -20, -18]) {
    for (let x = -12; x <= 12; x += 0.25) {
      const a = window.__ct.groundAt(x, z), b = window.__ct.groundAt(x + 0.5, z);
      if (a - b > 0.10 && b < 0.02) return { x, z, hi: +a.toFixed(3), lo: +b.toFixed(3) };
    }
  }
  return null;
});
if (!kerb) {
  notes.push('  --   6. kerb control skipped: found no pavement->road step to walk off');
} else {
  // stand back from the edge on the pavement, facing +x (fwd = (sin y, -cos y))
  await warp(kerb.x - 1.2, kerb.z, Math.PI / 2);
  await p.waitForTimeout(400);
  const standing = await feet();
  if (Math.abs(standing - kerb.hi) > TOL) {
    notes.push(`  --   6. kerb control skipped: stood at ${standing.toFixed(3)},`
      + ` expected the pavement at ${kerb.hi}`);
  } else {
    const t = await leave('w', { budget: 2000 });
    let biggest = 0, worstDt = 0;
    for (let i = 1; i < t.length; i++) {
      const d = t[i - 1][0] - t[i][0];
      if (d > biggest) { biggest = d; worstDt = t[i][1]; }
    }
    const height = kerb.hi - kerb.lo;
    // JUDGED THE SAME WAY CASES 1-5 ARE: against the gravity budget for the
    // frame that actually happened, never against a nominal 16 ms. A body
    // leaving a step of height h cannot lose more than sqrt(2gh)*dt + g*dt^2/2
    // in one frame. Reusing the existing bound rather than inventing a second
    // rule for the kerb is the point — it is not a special case any more.
    const dtP = Math.min(worstDt, DT_CLAMP);
    const bound = Math.sqrt(2 * G * height) * dtP + (G / 2) * dtP * dtP;
    if (biggest > bound + 1e-6) {
      fails.push(`6. THE KERB IS STILL A SNAP. The ${height.toFixed(3)} m kerb at`
        + ` (${kerb.x}, ${kerb.z}) lost ${biggest.toFixed(3)} m in one`
        + ` ${(worstDt * 1000).toFixed(1)} ms frame, against a gravity bound of`
        + ` ${bound.toFixed(3)} m. Item 130 requires every drop to fall — check`
        + ` FALL_MIN_DROP in fp.ts, which must be below a kerb's height.`);
    } else {
      notes.push(`  OK   6. the kerb FALLS — the ${height.toFixed(3)} m kerb at`
        + ` (${kerb.x}, ${kerb.z}) came down at ${biggest.toFixed(3)} m in its`
        + ` biggest frame, inside a ${bound.toFixed(3)} m gravity bound`);
    }
  }
}

// ── report ────────────────────────────────────────────────────────────────
console.log(notes.join('\n'));
if (errs.length) {
  console.log(`\nconsole errors during the walk (${errs.length}):`);
  console.log(errs.slice(0, 6).map((e) => `  ${e}`).join('\n'));
}
if (fails.length) {
  console.log(`\n${fails.length} FAIL:`);
  for (const f of fails) console.log(`  FAIL ${f}`);
  await browser.close();
  process.exit(1);
}
console.log('\nok — every drop is left as a fall, the kerb included (item 130)');
await browser.close();
process.exit(0);
