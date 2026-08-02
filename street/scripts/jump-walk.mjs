// Jump, and land on the storey you were on.
//
// The floor picker in ct/apartment.ts has hysteresis (GOTCHAS §7) — it is the
// only thing that knows which of four stacked storeys you are on, and a jump
// that carries you higher can hand it a height it reads as the floor above.
// So this is not "does the jump feel right", which is the user's call; it is
// "does the jump still put you back where you started" everywhere the ground
// changes height.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4185/');   // GOTCHAS 26: prove it, do not just name it
const pos = () => p.evaluate(() => window.__ct.pos());
const groundAt = (x, z) => p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
const warp = (x, z, gy) => p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [x, z, gy]);
const jump = async () => { await p.keyboard.down(' '); await p.waitForTimeout(60); await p.keyboard.up(' '); };

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
// So: the baseline is now MEASURED at rest rather than assumed, the settle waits
// for FRAMES rather than milliseconds, and the apex is sampled in-page on
// requestAnimationFrame so it can neither miss the peak nor catch a stale frame.
// No eye-height constant appears in this file any more — the rest camera cancels
// it, whatever it is.

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

/** Peak camera height while `act` runs, sampled every rendered frame in-page. */
const peakDuring = async (act) => {
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
  await p.waitForTimeout(1100);          // the whole hop is ~0.571 s of hang
  return p.evaluate(() => { window.__jwSampling = false; return window.__jwPeak; });
};

const fails = [];
let EYE = null;               // derived from the world at the first spot, never typed
const spots = [
  ['the pavement', -6.0, -20.0, 0.14],
  ['the kerb edge', -5.1, -20.0, 0.14],
  ['the road', -2.0, -20.0, 0],
  ['the walk-up stoop', 6.2, -44.0, 0.14],
  ['inside, ground floor', 104, -16.0, 0],
  ['the apartment stairs', 112, -16.0, null],
  ['upstairs', 120, -16.0, null],
];
for (const [what, x, z, gy] of spots) {
  await warp(x, z, gy ?? 0);
  const rest = await settleAndRest();
  const before = await pos();

  // IS THE BASELINE TRUSTWORTHY? The camera at rest must sit one eye height
  // above the ground the world reports for this spot. The eye height is not
  // typed in here — it is derived from the first spot and every later spot must
  // agree with it, so the assertion is "the camera is where the ground says",
  // not "the camera is at 1.62". This is the guard the old code lacked: a rest
  // camera of 7.02 over ground 0.14 implies a 6.88 m eye and is caught here,
  // instead of being subtracted into a 5.260 m "jump".
  const ground = await groundAt(x, z);
  const eye = rest - ground;
  if (EYE === null) EYE = eye;
  else if (Math.abs(eye - EYE) > 0.02) {
    fails.push(`${what}: camera rests ${eye.toFixed(3)} m above the ground at ${x}, ${z}, but every other spot rests ${EYE.toFixed(3)} m above it — the baseline is not the ground here`);
  }

  const apex = await peakDuring(jump);
  const after = await pos();
  const rise = apex - rest;                 // baseline measured, not assumed
  const sameFloor = Math.abs(after[3] - before[3]) < 0.001;
  console.log(`${what.padEnd(22)} gy ${before[3].toFixed(2)} -> ${after[3].toFixed(2)}  rest cam ${rest.toFixed(2)}  apex +${rise.toFixed(3)} m  ${sameFloor ? 'same floor' : 'CHANGED FLOOR'}`);
  if (!sameFloor) fails.push(`${what}: jumping changed the floor from ${before[3].toFixed(2)} to ${after[3].toFixed(2)}`);
  if (rise < 0.45 || rise > 0.8) fails.push(`${what}: apex ${rise.toFixed(3)} m is outside the intended 0.6 m hop`);
}
console.log('');
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(fails.length ? `\n${fails.length} problem(s)` : '\njump lands you on the floor you left, everywhere');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
