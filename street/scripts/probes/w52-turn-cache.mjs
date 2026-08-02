// ITEM 128, THE ONE THING THE SIGHT CACHE COULD BREAK: turning on the spot.
//
// The cache added in crosstown.ts memoises `canSee` against the POSITION it was
// taken at and deliberately NOT against yaw, on the reasoning that `canSee`
// reads only the eye and the spot. If that reasoning is wrong the symptom is
// precise: standing still in flat 301 and turning between the bed and the door
// would stop changing the prompt.
//
// EVERY EXISTING CHECK TURNS BY WARPING (D-look-selects.mjs:145) and `__ct.warp`
// clears the cache, so they all exercise the FRESH path and none of them can see
// this. This turns two ways at the same station and compares:
//
//   A. drag-look, no warp   -> the cache is live across the whole sweep
//   B. warp to each yaw     -> the cache is cleared at every step
//
// TWO WAYS TO PASS VACUOUSLY, AND BOTH ARE REFUSED HERE:
//   - a station standing ON a spot: tier 1 (`onIt`, fp.ts) makes it unbeatable
//     at every yaw, so the prompt never changes and the run settles nothing.
//     The spawn point IS such a station — 0.24 m from the bed spot — so the
//     station is SEARCHED FOR rather than assumed.
//   - a drag that does not actually turn the player, which would make both
//     columns the constant sequence. Yaw is read back and asserted to move.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w52-turn-cache.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const STEPS = 24;                                   // 15° apart
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.waitForTimeout(2500);

const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '(nothing)';
});
const yawOf = () => page.evaluate(() => window.__ct.yaw());
const home = await page.evaluate(() => window.__ct.pos());
const gy = home[3];

// `settle` must match the drag sweep's own settle. The drag sweep warps ONCE and
// then lets `unstick` finish; the warp sweep re-warps every step and re-drifts
// every step, so if it reads the prompt before the nudge has finished the two
// columns are sampling different POSES and would differ for a reason that has
// nothing to do with the cache.
const sweepByWarp = async (x, z, settle) => {
  const out = [];
  for (let i = 0; i < STEPS; i++) {
    const yaw = (i / STEPS) * Math.PI * 2;
    await page.evaluate(([a, b, y, g]) => window.__ct.warp(a, b, y, g, 0), [x, z, yaw, gy]);
    await page.waitForTimeout(settle);
    out.push(await prompt());
  }
  return out;
};

// ── find a station in 301 where turning CHANGES the prompt ────────────────
console.log(`flat 301 spawn (${home[0].toFixed(2)}, ${home[2].toFixed(2)}) gy ${gy.toFixed(2)}`);
console.log('searching for a station where turning changes the prompt…\n');
let station = null, byWarp = null;
for (let dx = -0.9; dx <= 0.9 && !station; dx += 0.3) {
  for (let dz = -0.9; dz <= 0.9 && !station; dz += 0.3) {
    const x = home[0] + dx, z = home[2] + dz;
    const s = await sweepByWarp(x, z, 150);         // cheap pass, just to site it
    const n = new Set(s).size;
    if (n >= 2) { station = { x, z }; console.log(`  station (${x.toFixed(2)}, ${z.toFixed(2)}) -> ${n} distinct prompts\n`); }
  }
}
if (!station) {
  console.log('MEASURED NOTHING — no station in 301 where turning changes the prompt; cannot settle this.');
  await browser.close(); process.exit(3);
}
// the control column, re-taken at the settle the drag sweep will use
byWarp = await sweepByWarp(station.x, station.z, 500);

// ── A: turn by DRAGGING — no warp, so the cache stays live the whole sweep ──
// main.ts:49 — drag-look feeds `input.mouseDX += e.movementX` without pointer
// lock; fp.ts:459 turns 0.0022 rad per pixel. The constant is CITED, not
// invented, and the yaw readback below means a wrong constant shows up as a
// failed turn rather than as a pass.
//
// PLAYWRIGHT'S OWN MOUSE CANNOT DRIVE THIS. `page.mouse.move` dispatches through
// CDP and arrives with `movementX === 0`, so the handler adds nothing and the
// player never turns — the first run of this probe swept 0.00 rad and would have
// "passed" on two columns of `(nothing)` had it not asserted the turn. So the
// events are constructed with `movementX` set explicitly, which is the same
// handler and the same field a real mouse delivers.
const RAD_PER_PX = 0.0022;
await page.evaluate(([a, b, g]) => window.__ct.warp(a, b, 0, g, 0), [station.x, station.z, gy]);
await page.waitForTimeout(500);
// where he SETTLED, not where he was warped: `unstick` nudges the rig out of
// geometry, and drift must be measured from the pose the sweep actually starts
// from or it reports the nudge as a failure.
const settled = await page.evaluate(() => window.__ct.pos());
const pxPerStep = Math.round((Math.PI * 2 / STEPS) / RAD_PER_PX);
await page.evaluate(() => {
  const c = document.querySelector('canvas');
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
});
const byDrag = [await prompt()];
const yaws = [await yawOf()];
for (let i = 1; i < STEPS; i++) {
  await page.evaluate((px) => {
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: px, movementY: 0, bubbles: true }));
  }, pxPerStep);
  await page.waitForTimeout(150);
  byDrag.push(await prompt());
  yaws.push(await yawOf());
}
await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));
// Summed per-step turn, each delta wrapped into (-PI, PI]. Reading
// `last - first` instead would report ~0 for a full circle if the rig ever wraps
// yaw, which is a way to fail this assertion for the wrong reason.
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
let turned = 0;
for (let i = 1; i < yaws.length; i++) turned += Math.abs(wrap(yaws[i] - yaws[i - 1]));
const drifted = await page.evaluate(() => window.__ct.pos());
const drift = Math.hypot(drifted[0] - settled[0], drifted[2] - settled[2]);

// ── compare ───────────────────────────────────────────────────────────────
let same = 0, diff = 0;
console.log(`  ${'deg'.padStart(4)}  ${'DRAG (cache live)'.padEnd(34)} ${'WARP (cache cleared)'.padEnd(34)}`);
for (let i = 0; i < STEPS; i++) {
  const a = byDrag[i], b = byWarp[i];
  const ok = a === b;
  if (ok) same++; else diff++;
  console.log(`  ${String(Math.round((i / STEPS) * 360)).padStart(4)}  ${a.slice(0, 33).padEnd(34)} ${b.slice(0, 33).padEnd(34)}${ok ? '' : '  <-- DIFFERS'}`);
}
console.log(`\n  yaw swept by drag: ${turned.toFixed(2)} rad   player drifted: ${drift.toFixed(3)} m`);
console.log(`  ${same} of ${STEPS} headings agree, ${diff} differ`);
console.log(`  ${new Set(byWarp).size} distinct prompts around the turn`);

let bad = 0;
if (turned < 3.0) { console.log('\nMEASURED NOTHING — the drag did not actually turn the player.'); bad = 3; }
else if (drift > 0.2) { console.log('\nMEASURED NOTHING — the drag moved the player, so this is not turning on the spot.'); bad = 3; }
else if (diff > 0) { console.log('\nMEASURED WRONG — the sight cache changed what turning selects.'); bad = 1; }
if (bad) { await browser.close(); process.exit(bad); }
console.log('\nturning on the spot selects the same thing with the cache live as with it cleared');
await browser.close();
