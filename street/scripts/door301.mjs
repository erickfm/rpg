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
const PIV = [AX(-0.09), Z0 + 0.02];
const SPOT = [PIV[0] - 0.55, PIV[1] + 1.45];
const at = (dx, dz) => Math.atan2(dx, -dz);

// --selftest: jam a collider across the doorway in the LIVE list, so the
// doorway reads blocked while the door is open. Pushed onto __ct.colliders(),
// the same array the movement code tests.
const ARGS = flags(['--selftest']);   // unknown flags exit 2, not silently ignored
const SELFTEST = ARGS.selftest;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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

const shot = (n) => page.screenshot({ path: `${outDir}/${n}.png` });

// Install a one-number signature of the leaf's pose, so the swing can be
// waited on rather than slept through.
await page.evaluate(([px, pz, fy]) => {
  window.__leafSig = () => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true); let best = null;
    s.traverse((o) => {
      if (!o.isMesh) return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== 'walkup') return;
      const g = o.geometry?.parameters; if (!g || Math.abs((g.depth ?? 0) - 0.045) > 0.005) return;
      const e = o.matrixWorld.elements;
      if (Math.abs(e[13] - (fy + 1.05)) > 0.3) return;
      const d = Math.hypot(e[12] - px, e[14] - pz);
      if (!best || d < best.d) best = { d, e };
    });
    return best ? best.e.reduce((a, v) => a + v * v, 0) : NaN;
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
  await page.keyboard.press('e');
  const r = await page.evaluate(() => new Promise((res) => {
    const t0 = performance.now(), START_CAP = 1500, RUN_CAP = 8000;
    const sig0 = window.__leafSig();
    let last = sig0, still = 0, f = 0, moved = false;
    const tick = () => {
      const v = window.__leafSig(); f++;
      if (!moved) {
        if (Number.isFinite(v) && Math.abs(v - sig0) > 1e-9) moved = true;
        else if (performance.now() - t0 > START_CAP)
          return res({ ms: +(performance.now() - t0).toFixed(0), frames: f, moved: false, capped: false });
      } else {
        still = (Number.isFinite(v) && Math.abs(v - last) < 1e-9) ? still + 1 : 0;
        if (still >= 4)
          return res({ ms: +(performance.now() - t0).toFixed(0), frames: f, moved: true, capped: false });
        if (performance.now() - t0 > RUN_CAP)
          return res({ ms: +(performance.now() - t0).toFixed(0), frames: f, moved: true, capped: true });
      }
      last = v;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  if (r.capped) console.warn(`  [press] the leaf was still moving after ${r.ms} ms (${r.frames} frames) — not settled`);
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
  + ` and ${Math.hypot(IN[0] - PIV[0], IN[1] - PIV[1]).toFixed(2)} m from the pivot (leaf 0.91)`);
await warp(IN[0], IN[1], at(PIV[0] - IN[0], PIV[1] - IN[1]), 0.0);
await page.waitForTimeout(400);
expect('standing in the swing, prompt refuses', await prompt(), '[E] step clear of the door');
await shot('08-in-the-swing');
await press();
expect('E from inside the swing does nothing', await shut(), false);

// back at the spot: outside the arc, must work
await warp(SPOT[0], SPOT[1], at(PIV[0] - SPOT[0], PIV[1] - SPOT[1]), 0.02);
await page.waitForTimeout(400);
expect('a pace back, prompt offers close', await prompt(), '[E] close the door');
await press();
expect('E from a pace back shuts it', await shut(), true);
await shot('09-shut-from-back');

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
console.log('all seven behaviours hold: opens, shuts, blocks, refuses to shut on you.');
