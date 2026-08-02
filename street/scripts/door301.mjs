// 301's door: does it open, does it shut, does it block, and does it refuse
// to shut ON you.
//
// The collider list is the proof, not the screenshots. `__ct.colliders()` is
// the live array, so `doorShutCap` sitting at 999 or sitting across the
// doorway is a yes/no answer to "is the door actually closed" that no picture
// of a door can give.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/door301.mjs [outdir]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';
import { mkdirSync } from 'node:fs';
import { flags } from './lib/args.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
// argv[2] is NOT the output directory — argv is a mix of flags and paths, and
// `--selftest` landed here as a folder name and got a directory called
// `--selftest/` full of screenshots. Take the first argument that is not a
// flag.
const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'shots/door301';
mkdirSync(outDir, { recursive: true });

// These MIRROR ct/apartment.ts. That is a copy, and a copy goes stale silently:
// change DOOR_GAP or move the building and this script keeps running, testing
// coordinates where nothing is, reporting "not blocked" for a doorway it is
// not looking at. Every assertion below would still pass. So the constants are
// checked against the world before any of them are used — see confirmPivot().
const APT_X = 200, APT_Z = -20, ST = 2.7, GAP = 0.95;
const AX = (l) => APT_X + l, AZI = (l) => APT_Z + l;
const FLOOR = 2 * ST;
const Z0 = AZI(3.5 - GAP / 2), Z1 = AZI(3.5 + GAP / 2);
// WHICH JAMB 301 HANGS ON is derived, not remembered. ct/apartment.ts declares
// `hingeSide(num) = num.endsWith('01') ? 1 : -1` for the whole building, so a
// door numbered 01 hangs on the +z jamb. This script had Z0 + 0.02 — the -z
// jamb — baked in, and went red the moment 301 was brought into line with 101,
// 201 and 401. Correctly red: it refused to measure rather than measure the
// wrong leaf. Deriving it the same way the world does means the next hand
// change moves both together.
const HAND = 1;                       // hingeSide('301')
const PIV = [AX(-0.09), HAND > 0 ? Z1 + 0.02 : Z0 - 0.02];
const SPOT = [PIV[0] - 0.55, PIV[1] - HAND * 1.45];
const at = (dx, dz) => Math.atan2(dx, -dz);

// --selftest: jam a collider across the doorway in the LIVE list, so the
// doorway reads blocked while the door is open. Pushed onto __ct.colliders(),
// the same array the movement code tests.
const ARGS = flags(['--selftest']);   // unknown flags exit 2, not silently ignored
const SELFTEST = ARGS.selftest;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// DOOR301_CPU=8 throttles the renderer to an eighth of this machine's speed,
// through the same CDP knob `scripts/probes/w21-apex.mjs` uses. It exists
// because this script's failures were all FRAME-COUNT failures wearing a
// wall-clock disguise, and the only honest way to find those is to make frames
// expensive on purpose rather than wait for a loaded machine to do it for you.
if (process.env.DOOR301_CPU) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.DOOR301_CPU) });
  console.log(`  [CPU THROTTLED x${process.env.DOOR301_CPU}]`);
}
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
// WHERE THE RIG ACTUALLY STARTS, read before this script warps anywhere. This
// is the entry point's spawn as the player meets it, and it is the only way to
// see it from outside crosstown.ts without that file publishing anything.
const START = await page.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });
await setClock(page, 13, 0);                          // the frame that applies the grade
// This click was commented "take pointer lock so keys land". Nothing in
// src/proto requests pointer lock at all — keys are read from `input.keys`,
// fed by a plain listener — so the click gives the page focus and the 600 ms
// beside it was waiting for something that does not happen. Kept as a focus
// click, described as what it is.
await page.mouse.click(640, 360);                     // focus, so keydown lands
await page.waitForTimeout(120);

/** Prove the mirrored constants still describe this world: 301's leaf is a
 *  0.045-thick box hung at the pivot, so if it is not within a few cm of where
 *  the arithmetic says, the arithmetic is stale and every result after this is
 *  about empty air. */
const confirmPivot = async () => {
  const near = await page.evaluate(([px, pz, fy]) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true); let best = null;
    s.traverse((o) => {
      if (!o.isMesh) return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== 'walkup') return;
      const g = o.geometry?.parameters; if (!g || Math.abs((g.depth ?? 0) - 0.045) > 0.005) return;
      const e = o.matrixWorld.elements;
      if (Math.abs(e[13] - (fy + 1.05)) > 0.3) return;
      const d = Math.hypot(e[12] - px, e[14] - pz);
      if (!best || d < best.d) best = { d, at: [+e[12].toFixed(2), +e[13].toFixed(2), +e[14].toFixed(2)] };
    });
    return best;
  }, [PIV[0], PIV[1], FLOOR]);
  if (!near || near.d > 0.25) {
    console.error(`\nTHE CONSTANTS IN THIS SCRIPT NO LONGER DESCRIBE THE WORLD.`);
    console.error(`  expected 301's leaf near (${PIV[0].toFixed(2)}, ${PIV[1].toFixed(2)})`);
    console.error(near ? `  nearest leaf-shaped mesh is ${near.d.toFixed(2)} m away at ${near.at.join(', ')}`
                       : `  no leaf-shaped mesh stamped 'walkup' on that floor at all`);
    console.error(`  Re-read APT_X / ST / DOOR_GAP from ct/apartment.ts.\n`);
    await browser.close();
    process.exit(1);
  }
  console.log(`301's leaf found ${near.d.toFixed(2)} m from the computed pivot — constants still hold`);
};
await confirmPivot();
if (SELFTEST) {
  await page.evaluate(([z0, z1]) => window.__ct.colliders()
    .push({ minX: 199.84, maxX: 200.06, minZ: z0, maxZ: z1 }), [Z0, Z1]);
  console.log('selftest: jammed the doorway shut — this MUST now go red');
}

const warp = (x, z, yaw, pitch = 0) =>
  page.evaluate(([a, b, c, d, e]) => window.__ct.warp(a, b, c, d, e), [x, z, yaw, FLOOR, pitch]);

/** is the doorway blocked right now? */
const shut = () => page.evaluate(([z0, z1]) => window.__ct.colliders().some((c) =>
  c.minX < 250 && c.minX > 199.5 && c.maxX < 200.5
  && Math.abs(c.minZ - z0) < 0.05 && Math.abs(c.maxZ - z1) < 0.05), [Z0, Z1]);

// The prompt has to be read from a VISIBLE node. The HUD keeps its last text
// in the element after hiding it, so a plain textContent search happily
// reports "close the door" while nothing is on screen — which is how the
// first run of this script produced a label that contradicted the collider.
const prompt = () => page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => {
    if (e.children.length || !/\[E\]/.test(e.textContent || '')) return false;
    const st = getComputedStyle(e);
    return st.display !== 'none' && st.visibility !== 'hidden' && +st.opacity > 0.05;
  });
  return el ? el.textContent.trim() : null;
});

// The screenshot timeout scales with the throttle. This is INSTRUMENT PLUMBING,
// not an assertion: at x8 a 1280x720 capture of this scene simply takes longer
// than Playwright's 30 s default and the script died mid-run with a TimeoutError
// that says nothing about the door. None of the `expect()` tolerances below move
// — widening one of those to make an intermittent failure stop showing is the
// thing this item exists to forbid.
const SHOT_MS = 30000 * Math.max(1, Number(process.env.DOOR301_CPU ?? 1));
// DOOR301_NOSHOTS=1 runs every assertion and writes no PNGs. It is for SOAKING
// — ten runs at CPU x8 — and it takes nothing away from the verdict, because no
// verdict in this file is a screenshot: CLAUDE.md, "screenshots are for LOOKING,
// never for PROVING". At x8 the headless software renderer dies capturing a
// 1280x720 WebGL frame ("Creation of StagingBuffer's SharedImage failed") and
// takes the browser with it, so without this the soak measures Chromium's GPU
// emulation instead of the door.
const NOSHOTS = process.env.DOOR301_NOSHOTS === '1';
const shot = (n) => (NOSHOTS ? Promise.resolve()
  : page.screenshot({ path: `${outDir}/${n}.png`, timeout: SHOT_MS }));

// Install a one-number signature of the leaf's pose, so the swing can be
// waited on rather than slept through.
//
// ── THE SIGNATURE WAS INVARIANT TO THE ONLY MOTION IT HAD TO SEE (item 56) ──
//
// It used to return `e.reduce((a, v) => a + v*v, 0)` — the sum of squares of the
// world matrix. That is the matrix's Frobenius norm, and for a door swinging on
// its hinge it is A CONSTANT: the leaf rotates about its own origin, so the
// translation terms never move, and the rotation block's norm is 3 whatever the
// angle. The signature is mathematically incapable of changing while the door
// swings, and `press()` reported `moved=false` on every press at every speed —
// on runs that PASSED.
//
// So the "wait for the leaf to move, then wait for it to stop" machinery below
// never armed, and `press()` silently degraded to a fixed 1500 ms wall-clock
// wait (its START_CAP). That is the flake, and it is the very thing the comment
// on `press()` says was fixed: at x1 those 1500 ms are ~36 frames and the door
// finishes by luck; at CPU x4 they are ~6 frames and the collider is read on a
// door that is still opening. Byte-identical build, green then red, exactly as
// w26 saw.
//
// The replacement transforms a fixed LOCAL point (1, 0, 0) into world space, so
// it carries the rotation basis (e[0], e[2]) as well as the translation and
// changes the moment the hinge does. Measured: `moved=true` in 2–3 frames.

await page.evaluate(([px, pz, fy]) => {
  // FIND THE LEAF ONCE. This used to `updateMatrixWorld(true)` on the whole
  // scene and `traverse()` every mesh in it — on EVERY rAF of the settle loop.
  // On an idle machine that is invisible; at CPU x4 it was costing 2.25 SECONDS
  // per frame, so the instrument was dominating the thing it measured and the
  // settle loop could not collect its four still frames before RUN_CAP. Caching
  // the mesh and updating only its own branch takes the same reading for a
  // fraction of the cost.
  let leaf = null;
  window.__leafSig = () => {
    if (leaf && leaf.parent) {
      leaf.updateWorldMatrix(true, false);
      const e = leaf.matrixWorld.elements;
      return (e[12] + e[0]) * 1e3 + (e[14] + e[2]);
    }
    const s = window.__ct.scene(); s.updateMatrixWorld(true); let best = null;
    s.traverse((o) => {
      if (!o.isMesh) return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== 'walkup') return;
      const g = o.geometry?.parameters; if (!g || Math.abs((g.depth ?? 0) - 0.045) > 0.005) return;
      const e = o.matrixWorld.elements;
      if (Math.abs(e[13] - (fy + 1.05)) > 0.3) return;
      const d = Math.hypot(e[12] - px, e[14] - pz);
      if (!best || d < best.d) best = { d, o };
    });
    if (!best) return NaN;
    leaf = best.o;                       // …and every later call takes the cheap path
    const e = leaf.matrixWorld.elements;
    // world position of the leaf's local (1, 0, 0) — rotation AND translation
    return (e[12] + e[0]) * 1e3 + (e[14] + e[2]);
  };
}, [PIV[0], PIV[1], FLOOR]);

// The swing is driven by the RENDER LOOP, so its duration is FRAMES, not
// milliseconds. `waitForTimeout(950)` was a guess against that, and it is the
// guess that made this script flaky: on a cold first run — shader compile,
// texture upload — the leaf had not finished travelling when the collider was
// read, and "after E, doorway blocked" came back false on a door that was
// working perfectly. It failed 1 run in 3 that way, which is the worst
// possible rate: often enough to be real, rare enough to be dismissed.
//
// So wait for the leaf to STOP MOVING. Same rule as lib/clock.mjs — wait for
// the event, not for a duration — and it is faster too, because a settled
// door returns immediately instead of always paying the full 950 ms.
// Waiting for it to STOP is not enough on its own, and getting that wrong took
// this script from flaky to 0/10: at the moment E is pressed the leaf has not
// begun to travel, so a stillness test is satisfied instantly by the door
// standing exactly where it was, and press() returned in ~70 ms every time.
// You have to wait for the motion to START before waiting for it to STOP.
//
// The refusal case — E inside the swing, where nothing may move — is the same
// code path: no motion inside START_CAP is the ANSWER there, not a timeout.
const press = async () => {
  // HOLD E ACROSS RENDERED FRAMES. THIS IS THE FLAKE (item 56).
  //
  // `keyboard.press('e')` puts the keydown and the keyup in the same tick of
  // wall-clock time, and the world's `[E]` dispatch is an EDGE read taken once
  // per RENDERED FRAME. On a warm, idle machine a frame is 16 ms and the tap is
  // seen; when a frame runs long — a cold shader compile, a loaded box, another
  // builder's suite on the same machine — the whole press begins and ends
  // inside one frame and is never observed at all. The door then does not move,
  // `press()`'s own start-detector correctly reports "no motion", and the run
  // reports `after E, doorway blocked: false` on a door that is working
  // perfectly. Re-run on a quiet machine and it is green on the identical
  // bytes, which is exactly what w26 saw.
  //
  // This is BUILDER-BRIEF §5, the single most documented instrument bug in this
  // project, and it was still here. Reproduced deliberately at CPU x4, where it
  // fails every run; the fix is to hold the key until the page has actually
  // PAINTED twice, which is frames rather than milliseconds and so cannot be
  // outrun by a slow one.
  // …and press it only once the world is OFFERING something, which is the other
  // half of the same mistake. Every caller below warps and then sleeps a fixed
  // 400–500 ms before pressing. On an idle machine that is thirty frames; at
  // CPU x4 it can be two, and the spot under the cursor has not been picked
  // yet, so E arrives before there is anything to press. Waiting for the PROMPT
  // is waiting for the event (GOTCHAS §30) and is instant when it is already up.
  const offered = await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('*')].find((e) => !e.children.length
      && /\[E\]/.test(e.textContent || '') && getComputedStyle(e).display !== 'none');
    return !!el;
  }, { timeout: 10000 }).then(() => true).catch(() => false);
  if (!offered) console.warn('  [press] nothing was offering an [E] when the key was sent');

  await page.keyboard.down('e');
  await page.evaluate(() => new Promise((res) => {
    let n = 0;
    const tick = () => (++n >= 3 ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }));
  await page.keyboard.up('e');
  const r = await page.evaluate(() => new Promise((res) => {
    // CAPS IN FRAMES, NOT MILLISECONDS. The swing is driven by the render loop,
    // which this file's own comment says — and then both caps were wall-clock
    // anyway. At CPU x4 the 1500 ms START_CAP was SIX frames and the 8000 ms
    // RUN_CAP was four, so a perfectly good door "failed to start" and a
    // perfectly good swing "never settled". Counting frames makes the caps mean
    // the same thing at every speed, which is the entire lesson of this item.
    const t0 = performance.now(), START_FRAMES = 90, RUN_FRAMES = 600;
    const sig0 = window.__leafSig();
    let last = sig0, still = 0, f = 0, moved = false;
    const tick = () => {
      const v = window.__leafSig(); f++;
      if (!moved) {
        if (Number.isFinite(v) && Math.abs(v - sig0) > 1e-9) moved = true;
        else if (f > START_FRAMES)
          return res({ ms: +(performance.now() - t0).toFixed(0), frames: f, moved: false, capped: false });
      } else {
        still = (Number.isFinite(v) && Math.abs(v - last) < 1e-9) ? still + 1 : 0;
        if (still >= 4)
          return res({ ms: +(performance.now() - t0).toFixed(0), frames: f, moved: true, capped: false });
        if (f > RUN_FRAMES)
          return res({ ms: +(performance.now() - t0).toFixed(0), frames: f, moved: true, capped: true });
      }
      last = v;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  if (r.capped) console.warn(`  [press] the leaf was still moving after ${r.ms} ms (${r.frames} frames) — not settled`);
  // Always say what the press DID. A flaky check that prints only its verdict
  // makes the next person reproduce the flake before they can even see it;
  // `moved:false` versus `capped:true` is the whole diagnosis and it costs one
  // line.
  console.log(`  [press] moved=${r.moved} frames=${r.frames} ms=${r.ms}${r.capped ? ' CAPPED' : ''}`);
  return r;
};

// ── assertions, because printing "must be true" is not checking it ────────
// This script used to print its five results with `<- must be true` beside
// them and exit 0 whatever they said. That made the READER the assertion: all
// five behaviours could break and it stayed green. Same fault as lotwalk's,
// and in the file that tests the most.
const FAIL = [];
const expect = (label, got, want) => {
  const ok = got === want;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}: ${got}${ok ? '' : `  (expected ${want})`}`);
  if (!ok) FAIL.push(`${label}: got ${got}, expected ${want}`);
};
const log = [];
const say = (s) => { log.push(s); console.log(s); };

// ── 1. stand at the spot, door open ────────────────────────────────────────
await warp(SPOT[0], SPOT[1], at(PIV[0] - SPOT[0], PIV[1] - SPOT[1]), 0.02);
await page.waitForTimeout(500);
expect('open at rest, doorway clear', await shut(), false);
await shot('01-open');

// ── 2. shut it ─────────────────────────────────────────────────────────────
await press();
expect('after E, doorway blocked', await shut(), true);
await shot('02-shut');

// close-ups of both jambs, to see whether the leaf clips either end
await warp(AX(-0.85), Z1 - 0.12, at(0.7, -0.35), -0.05); await page.waitForTimeout(350);
await shot('03-shut-strike');
await warp(AX(-0.85), Z0 + 0.30, at(0.7, -0.30), -0.05); await page.waitForTimeout(350);
await shot('04-shut-hinge');
await warp(AX(-1.9), AZI(3.5), at(1.8, 0), 0.0); await page.waitForTimeout(350);
await shot('05-shut-square');

// ── 3. open it again ───────────────────────────────────────────────────────
await warp(SPOT[0], SPOT[1], at(PIV[0] - SPOT[0], PIV[1] - SPOT[1]), 0.02);
await page.waitForTimeout(400);
await press();
expect('re-opened, doorway clear', await shut(), false);
await shot('06-open-again');
await warp(AX(-1.9), AZI(3.5), at(1.8, 0), 0.0); await page.waitForTimeout(350);
await shot('07-open-square');

// ── 4. the swept volume: stand where the leaf would hit you ────────────────
// This has to be a point that is BOTH inside the arc and inside the spot's
// own radius, or the test proves nothing: the first version stood 1.45 m from
// the spot, E did not reach it at all, and "the door refused to close" was
// really "there was no interaction there". Walk in from the spot toward the
// pivot until 0.9 of the way and you are 0.65 m off the hinge, squarely in
// the swing, and still in range.
const ux = (PIV[0] - SPOT[0]) / Math.hypot(PIV[0] - SPOT[0], PIV[1] - SPOT[1]);
const uz = (PIV[1] - SPOT[1]) / Math.hypot(PIV[0] - SPOT[0], PIV[1] - SPOT[1]);
const IN = [SPOT[0] + ux * 0.9, SPOT[1] + uz * 0.9];
say(`  test point is ${Math.hypot(IN[0] - SPOT[0], IN[1] - SPOT[1]).toFixed(2)} m from the spot (r 0.95)`
  + ` and ${Math.hypot(IN[0] - PIV[0], IN[1] - PIV[1]).toFixed(2)} m from the pivot (leaf 0.99)`);
await warp(IN[0], IN[1], at(PIV[0] - IN[0], PIV[1] - IN[1]), 0.0);
await page.waitForTimeout(400);
// THE CONTRACT CHANGED, AND THIS IS THE NEW ONE. It used to assert that the
// door REFUSED here — 'step clear of the door', and E doing nothing. The user:
// *"it should always be able to open/close ... the interaction should never
// refuse — that is the whole point of the request."* Refusing is the safe
// answer and it makes the door feel broken.
//
// So the assertion inverts: standing squarely in the swing, it must offer to
// close and it must actually close. What keeps that safe is a layer down —
// F's unstick() eases the player out of anything they end up inside — so the
// property worth checking is no longer "did it refuse" but "did it shut AND
// did it leave you somewhere legal".
expect('standing in the swing, it still offers', await prompt(), '[E] close the door');
await shot('08-in-the-swing');
const before = await page.evaluate(() => window.__ct.pos());
await press();
expect('E from inside the swing DOES shut it', await shut(), true);
// give unstick its few frames — it eases out at 3 m/s rather than teleporting
await page.waitForTimeout(900);
const after = await page.evaluate(() => window.__ct.pos());
const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
const inside = await page.evaluate(() => {
  const p = window.__ct.pos();
  return window.__ct.colliders().some((c) => c && isFinite(c.minX) && c.minX < 500
    && p[0] > c.minX - 0.36 && p[0] < c.maxX + 0.36
    && p[2] > c.minZ - 0.36 && p[2] < c.maxZ + 0.36);
});
say(`  the closing leaf pushed the player ${moved.toFixed(2)} m clear`);
expect('and left them somewhere legal, not inside the shut leaf', inside, false);
await shot('09-pushed-clear');

// and from a pace back it still works, which is the ordinary case
await warp(SPOT[0], SPOT[1], at(PIV[0] - SPOT[0], PIV[1] - SPOT[1]), 0.02);
await page.waitForTimeout(400);
expect('a pace back, prompt offers open', await prompt(), '[E] open the door');
await press();
expect('E from a pace back opens it again', await shut(), false);
await shot('09b-open-from-back');

// ── 5. the poster ──────────────────────────────────────────────────────────
await page.evaluate(() => window.__ct.warp(200 - 1.05, -20 + 3.55, 0.03, 5.4, 0.0));
await page.waitForTimeout(350);
await shot('10-poster-across');
await page.evaluate(() => window.__ct.warp(200 - 1.05, -20 + 2.75, 0.03, 5.4, 0.0));
await page.waitForTimeout(350);
await shot('11-poster-close');

// ── 6. the SPAWN this room declares is still a place you can stand ────────
// ct/apartment.ts exports SPAWN for crosstown.ts to start the rig on, and
// publishes it at scene.userData.spawn. A declared coordinate that nothing
// checks is the "quiet remembered coordinate" 4a7c2f60 and 4dae9afe spent this
// week digging out of other people's scripts — and this one has the extra edge
// that it is consumed by ANOTHER builder's file, so if it rots, it rots in F's
// entry point rather than in mine.
const spawn = await page.evaluate(() => {
  const sp = window.__ct.scene().userData.spawn;
  if (!sp) return null;
  const R = 0.36;
  const blocked = window.__ct.colliders()
    .filter((c) => sp.x > c.minX - R && sp.x < c.maxX + R && sp.z > c.minZ - R && sp.z < c.maxZ + R).length;
  return { ...sp, ground: +window.__ct.groundAt(sp.x, sp.z).toFixed(2), blocked };
});
if (!spawn) expect('the room publishes its spawn', false, true);
else {
  expect('the spawn sits on floor 3', Math.abs(spawn.ground - spawn.gy) < 0.05, true);
  expect('nothing is standing on the spawn', spawn.blocked, 0);
  say(`  spawn (${spawn.x.toFixed(2)}, ${spawn.z.toFixed(2)}) gy ${spawn.gy}, ground reads ${spawn.ground}`);

  // ── THE SEAM: does the ENTRY POINT agree with this declaration? ──────────
  //
  // ct/apartment.ts declares SPAWN; crosstown.ts starts the rig. Those are two
  // files with two owners, and the number crosses between them — which is the
  // shape that has bitten this project all week (bus.mjs remembering the stop,
  // park's legs remembering two x values, and my own first SPAWN, which copied
  // APT_X instead of deriving from it).
  //
  // So assert the relationship rather than either end. Where the rig actually
  // starts must be one of exactly two things:
  //
  //   · at SPAWN            — F has wired it, and it still matches
  //   · outside the walk-up — F has not wired it yet, which is today
  //
  // Anything else means the entry point starts you INSIDE this building at a
  // position this room did not declare: retyped, or drifted after a move. That
  // is the failure this exists for, and it is the one nobody would see, because
  // a spawn 40 cm into a wall still looks like a room.
  //
  // Evaluates today rather than waiting for F. A guard that sleeps until
  // someone else lands something is the empty-set pass of GOTCHAS 34 wearing a
  // schedule.
  const inBuilding = START.x > 195 && START.x < 205 && START.z > -25 && START.z < -10;
  const atSpawn = Math.hypot(START.x - spawn.x, START.z - spawn.z) < 0.05;
  expect('the entry point agrees with this room, or is not in it', !inBuilding || atSpawn, true);
  say(`  the rig starts at (${START.x.toFixed(2)}, ${START.z.toFixed(2)}) — `
    + `${atSpawn ? 'AT the declared spawn' : inBuilding ? 'INSIDE the walk-up but NOT at the declared spawn' : 'outside the walk-up, so not wired yet'}`);
}

await browser.close();
console.log(`door301 -> ${outDir}`);
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); FAIL.push('page errors'); }
if (FAIL.length) {
  console.error(`\nFAILED (${FAIL.length}):`);
  for (const f of FAIL) console.error(`  ${f}`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the jammed door was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — the doorway was blocked and this did not notice.'); process.exit(2); }
console.log('the door holds: opens, shuts, blocks the doorway, never refuses, and pushes you clear.');
