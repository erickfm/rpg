// Item 284 — THE OTHER SIGN: adding `.catch()` must not break the case that WORKS.
//
// The sandbox leg proves the rejection is handled. This proves the fix did not
// buy that by breaking the ordinary top-level page, where the lock IS granted
// and the player expects mouselook rather than drag-look. A `.catch()` on a
// promise cannot swallow a fulfilment — but "cannot" is an argument, and this
// project settles arguments by measuring (BUILDER-BRIEF §7).
//
// ⚠ MOUSELOOK-WHILE-LOCKED IS NOT MEASURABLE THROUGH A SYNTHETIC MOUSE, AND
// THIS PROBE DELIBERATELY DOES NOT CLAIM TO MEASURE IT. Two cuts of this file
// tried and both failed on a world that is fine — first as net yaw, then as a
// sampled Σ|Δyaw| — each reading exactly 0.0000. The cause is the instrument,
// not the world (BUILDER-BRIEF §7). Once Chromium holds the lock it pins the
// cursor, and Playwright's `mouse.move` carries no real delta with it. Measured
// on this bundle, sweeping 400 -> 760 px in 10 steps while locked:
//
//     93 locked mousemove events
//     SIGNED  Σ movementX = -400   ← one warp to centre, and nothing after it
//     ABSOLUTE Σ|movementX| = 12360 ← ± pairs inside single frames, net zero
//     first deltas: [-400, 0, 0, 0, 0, 0, 0, 0, 0, 0, …]
//
// `main.ts` zeroes `input.mouseDX` at the end of every frame, so deltas that
// cancel within one frame can never reach the camera. LOOSENING THE THRESHOLD
// UNTIL IT WENT GREEN WOULD HAVE BEEN A CHECK THAT CANNOT FAIL (§7), so the leg
// is gone instead. Nothing in item 284 touches mousemove handling; what the fix
// could plausibly have broken is the lock being GRANTED, and leg 3 measures
// exactly that. Drag-look — the path the sandboxed artifact actually runs on —
// is covered by leg 4 of `w116-canvas-click-uncaught.mjs`, where it does move
// the camera (yaw 1.571 -> 0.999) because no lock is held to pin the cursor.
//
// Leg 5a survives as a CONTROL: it proves the camera is not drifting on its own,
// which is what makes that sandbox measurement mean anything.
//
// Usage: SHOT_URL=http://localhost:4720/ node scripts/probes/w116-plain-page-locks.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4720/';
const fails = [];
const notes = [];
const ok = (c, m) => { (c ? notes : fails).push(`${c ? 'PASS' : 'FAIL'}  ${m}`); return c; };

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const yaw = () => page.evaluate(() => window.__ct.camera().rotation.y);
/** sum of |Δyaw| across a no-button sweep — survives pointer-lock re-centring. */
async function sweptYaw(from, to) {
  await page.mouse.move(from, 400);
  await page.waitForTimeout(150);
  let prev = await yaw(), total = 0;
  const STEPS = 10;
  for (let i = 1; i <= STEPS; i++) {
    await page.mouse.move(from + ((to - from) * i) / STEPS, 400);
    await page.waitForTimeout(70);
    const y = await yaw();
    total += Math.abs(y - prev);
    prev = y;
  }
  return total;
}

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => {
  const p = window.__ct?.painted?.();
  return !!p && p.frames > 0 && p.triangles > 0;
}, { timeout: 30000 });
ok(true, '0. FLOOR: the world paints on a plain top-level page');

await page.evaluate(() => {
  window.__lockCalls = 0;
  const proto = Object.getPrototypeOf(document.querySelector('canvas'));
  const orig = proto.requestPointerLock;
  proto.requestPointerLock = function (...a) { window.__lockCalls++; return orig.apply(this, a); };
});
ok(await page.evaluate(() => document.pointerLockElement === null),
  '1. FLOOR: nothing is locked before the click');

// 5a CONTROL, and it must run BEFORE the click: with no lock and no button
// held, a sweep must move the camera by nothing at all.
const idle = await sweptYaw(400, 760);
ok(idle < 0.01, `5a. CONTROL: a no-button sweep moves nothing while UNLOCKED (Σ|Δyaw| ${idle.toFixed(4)})`);

const before = pageErrors.length;
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(900);

const calls = await page.evaluate(() => window.__lockCalls);
ok(calls >= 1, `2. FLOOR: the click asked for the lock (${calls} call(s))`);
const locked = await page.evaluate(() => document.pointerLockElement === document.querySelector('canvas'));
ok(locked, `3. the lock is GRANTED on a plain page — the fix did not break the working case (locked=${locked})`);
ok(pageErrors.length === before,
  `4. no uncaught errors on the happy path (${pageErrors.length - before})`);

console.log('');
for (const n of notes) console.log('  ', n);
for (const f of fails) console.log('  ', f);
for (const e of pageErrors.slice(0, 5)) console.log('    PAGEERROR:', e.slice(0, 140));
console.log(fails.length === 0 ? 'PLAIN PAGE OK' : `PLAIN PAGE BAD — ${fails.length} failed`);
await b.close();
process.exit(fails.length === 0 ? 0 : 1);
