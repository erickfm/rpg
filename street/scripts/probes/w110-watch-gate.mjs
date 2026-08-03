// THE WATCH MUST NEED YOU TO LOOK STRAIGHT DOWN — a couple of degrees of it.
//
// *"i want you to need to look straight down, it is confused. im asking for
// that. it isnt that way"* (2026-08-03). So the pass condition is a NARROW
// window backed against the pitch clamp, and this measures it by HOLDING
// ArrowDown from level and watching the wrist come up — not by reading the
// gate out of the source, which would only tell me what I typed.
//
// WHAT MAKES THIS NOT A CERTIFICATE:
//
//   · THE FLOOR IS DERIVED, NOT PREDICTED. `PITCH_LIMIT` and the tolerance are
//     not retyped here. The clamp is measured (hold the key until pitch stops
//     moving) and the tolerance is read out of the shipped bundle by BISECTING
//     the gate with `__ct.warp(…, pitch)`, to 0.01°. The assertion is then
//     "the window is TOL_MAX deg or narrower, and it ends at the clamp" —
//     both sides of which come from the world.
//   · BOTH SIGNS ARE SELF-TESTED. A gate is only a gate if it can be shut:
//     the run asserts the watch is UP just inside the window and DOWN just
//     outside it, at +/- 0.5 deg either side of the measured edge.
//   · NEGATIVE CASE, RUN AT THE SOURCE. Set `WATCH_TOLERANCE` in crosstown.ts
//     back to the shipped-until-today `degToRad(20.1)`, rebuild, run this:
//
//         gate edge    54.384, 54.384  -> 54.384 deg (spread 0.000)
//         TOLERANCE    20.10 deg   [must be 1..5]
//         FAIL: tolerance 20.10 deg outside 1..5
//         exit 1
//
//     AND NOTE WHICH ASSERTION DID **NOT** MOVE: the +/-0.5 pair stayed green,
//     because it is taken either side of the MEASURED edge and so tracks the
//     gate wherever it goes. That pair proves the gate is a gate; it can never
//     prove the gate is in the right PLACE, and reading it as if it could is
//     how a check ends up certifying a world it never constrained. The
//     tolerance line is the one carrying the item.
//
//     The bisected edge landing on 54.384 deg is the other half of the
//     evidence: that is -0.95 rad to three decimals, the exact threshold this
//     item replaced, so the probe is reading the shipped gate and not its own
//     arithmetic. An in-page version of
//     this was tried first — monkey-patching the wrapper's transform on a rAF
//     loop — and it is NOT in this file on purpose: it raced the world's own
//     per-frame write, threw, and the run went red on a console error while
//     the gate it was supposed to be testing never moved. **A mutation that
//     fails for the wrong reason is worse than none**, so the negative case is
//     a real rebuild of a real constant.
//   · FIVE RUNS, and the spread is printed.
//
//   SHOT_URL=http://localhost:4661/ node scripts/probes/w110-watch-gate.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4661/');
const RUNS = Number(process.env.RUNS ?? 5);
// HIS WORDS ARE THE SPEC: "couple deg of tolerance". A couple is two, and
// nobody means it to the decimal, so the band this accepts is 1..5 deg — wide
// enough not to fail on a tuning nudge, narrow enough that the 20.1 deg the
// world shipped before today is comfortably red.
const TOL_MIN = 1.0, TOL_MAX = 5.0;
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 958 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.camera !== undefined, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(14, 37));

const state = () => p.evaluate(() => {
  const cam = window.__ct.camera();
  const v = cam.getWorldDirection(cam.position.clone());
  const w = document.getElementById('ct-watch');
  return { deg: -Math.asin(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI,
    ty: new DOMMatrix(getComputedStyle(w).transform).f };
});

const setPitch = async (deg) => {
  await p.evaluate((d) => window.__ct.warp(1.5, -70, 0, 0, -d * Math.PI / 180), deg);
  await p.waitForTimeout(280);              // the CSS transition is .18s ease-out
  return state();
};

// ── the stowed translate, so "up" is read rather than assumed ──────────────
await p.evaluate(() => window.__ct.warp(1.5, -70, 0, 0, 0));
await p.waitForTimeout(600);
const STOWED = (await state()).ty;
const isUp = (ty) => Math.abs(ty - STOWED) > 4;

// ── 1. the clamp, MEASURED: hold the key until pitch stops moving ─────────
const clamps = [];
for (let r = 0; r < RUNS; r++) {
  await p.evaluate(() => window.__ct.warp(1.5, -70, 0, 0, 0));
  await p.waitForTimeout(350);
  await p.keyboard.down('ArrowDown');
  const t0 = Date.now();
  let last = 0, still = 0, moved = false;
  // "SETTLED" MUST MEAN "STOPPED AFTER MOVING". The first cut counted the
  // frames before the keydown reached the rig as settled and reported the
  // clamp at 2.296 deg on run 0 — a floor read off a world that had not begun
  // to move yet. `moved` is the guard, and 5 deg is well past the 0.001
  // sampling noise and well short of the 74 it is looking for.
  while (Date.now() - t0 < 5000 && still < 6) {
    const s = await state();
    if (s.deg > 5) moved = true;
    if (moved && Math.abs(s.deg - last) < 0.001) still++; else still = 0;
    last = s.deg;
  }
  await p.keyboard.up('ArrowDown');
  await p.waitForTimeout(200);
  clamps.push(+(await state()).deg.toFixed(3));
}
const CLAMP = Math.max(...clamps);

// ── 2. the gate edge, BISECTED off the shipped bundle to 0.01 deg ─────────
const edges = [];
for (let r = 0; r < RUNS; r++) {
  let lo = 0, hi = CLAMP;                   // lo: known down, hi: known up
  if (!isUp((await setPitch(hi)).ty)) { edges.push(null); continue; }
  if (isUp((await setPitch(lo)).ty)) { edges.push(0); continue; }
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (isUp((await setPitch(mid)).ty)) hi = mid; else lo = mid;
  }
  edges.push(+((lo + hi) / 2).toFixed(3));
}
const EDGE = edges.reduce((a, c) => a + c, 0) / edges.length;
const TOL = CLAMP - EDGE;

// ── 3. BOTH SIGNS, half a degree either side of the measured edge ─────────
const justInside = await setPitch(Math.min(CLAMP, EDGE + 0.5));
const justOutside = await setPitch(Math.max(0, EDGE - 0.5));
await setPitch(CLAMP);
await p.screenshot({ path: 'shots/w110-after-clamp.png' });
await setPitch(EDGE - 3);
await p.screenshot({ path: 'shots/w110-after-3deg-short.png' });

// ── 4. it must still come DOWN again ─────────────────────────────────────
const backUp = await setPitch(0);

const fail = [];
if (!(TOL >= TOL_MIN && TOL <= TOL_MAX)) fail.push(`tolerance ${TOL.toFixed(2)} deg outside ${TOL_MIN}..${TOL_MAX}`);
if (!isUp(justInside.ty)) fail.push(`NOT up at ${justInside.deg.toFixed(2)} deg (inside the window)`);
if (isUp(justOutside.ty)) fail.push(`up at ${justOutside.deg.toFixed(2)} deg (outside the window)`);
if (isUp(backUp.ty)) fail.push('still up back at level — the gate never shuts');
if (edges.some((e) => e === null)) fail.push('never came up at all, even at the clamp');
if (errs.length) fail.push(`${errs.length} console errors`);

console.log(`clamp        ${clamps.join(', ')}  -> ${CLAMP.toFixed(3)} deg (spread ${(Math.max(...clamps) - Math.min(...clamps)).toFixed(3)})`);
console.log(`gate edge    ${edges.join(', ')}  -> ${EDGE.toFixed(3)} deg (spread ${(Math.max(...edges) - Math.min(...edges)).toFixed(3)})`);
console.log(`TOLERANCE    ${TOL.toFixed(2)} deg   [must be ${TOL_MIN}..${TOL_MAX}]`);
console.log(`+0.5 inside  ${justInside.deg.toFixed(2)} deg  ty ${justInside.ty.toFixed(1)}  ${isUp(justInside.ty) ? 'UP ok' : 'DOWN — BAD'}`);
console.log(`-0.5 outside ${justOutside.deg.toFixed(2)} deg  ty ${justOutside.ty.toFixed(1)}  ${isUp(justOutside.ty) ? 'UP — BAD' : 'DOWN ok'}`);
console.log(`back to level ty ${backUp.ty.toFixed(1)} (stowed ${STOWED.toFixed(1)})  ${isUp(backUp.ty) ? 'UP — BAD' : 'STOWED ok'}`);
console.log(fail.length ? `FAIL: ${fail.join('; ')}` : 'PASS');
await b.close();
process.exit(fail.length ? 1 : 0);
