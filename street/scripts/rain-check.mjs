// Prove rain is world-locked, not camera-locked.
//
// Sample a raindrop's WORLD position, teleport the player a long way, sample
// again. If rain follows the camera the drop moves with you. If it's
// world-locked the drop either hasn't moved horizontally at all, or has
// wrapped by an exact multiple of RAIN_BOX (30 m) — a full period, which is
// invisible because the distribution is uniform.
//
// ── THIS FILE PASSED FOR WEEKS WITHOUT LOOKING AT THE RAIN ──────────────────
//
// Three faults, each of which alone was enough to make the pass meaningless.
// w16 found the first two (`notes/w16-rain-heavy.md`); all three are fixed here
// and every one of them now has a condition that goes red.
//
// 1. IT MEASURED THE WRONG OBJECT. It traversed for `o.type === 'Points'` and
//    kept the LAST match. There are three Points sets: the rain (2600, and the
//    only one with a `map`), and two star sets of 77 and 13 under `starDome`.
//    So it asserted "12/12 drops world-locked" about 13 stars. The rain is
//    selected by its `map` now, and the count is printed so a reader can see
//    which object was actually measured.
//
// 2. IT HAND-COPIED THE WEATHER. It picked its rainy hour with
//    `((Math.imul(h, 2246822519) >>> 0) % 100) < 22` — a copy of a formula
//    `ct/props.ts` has since replaced with a murmur3 finalizer at 30% plus the
//    opening hour. `rainlive.mjs`'s own header names this exact failure: "two
//    scripts once carried hand-copies of rainAt() and drifted". The world
//    PUBLISHES `scene.userData.rainAt`; this asks it.
//
// 3. IT NEVER WAITED FOR RAIN. The wrap only runs while the drops are live, so
//    sampling immediately gives every delta as exactly 0.000 — and 0 is a legal
//    "world-locked" answer, so an inert run read as a perfect pass. That is the
//    tell w16 spotted: a wrap can only produce 0 OR a multiple of 30, and
//    twelve of twelve reading 0.000 means nothing ever moved. This waits for
//    `rainLevel`, and FAILS if no drop moved at all.
//
// A note on the hour: `crosstown.ts:805` sets `totalMin = h * 60 + m` and
// `hourAbs` is `Math.floor(totalMin / 60)`, so `clock(h)` sets the ABSOLUTE
// hour to exactly `h`. `rainAt` hashes that absolute hour and is NOT periodic
// in 24, so the hour must be passed through unchanged — never `h % 24`.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const URL = aim('http://localhost:4177/');
await page.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(page, URL);   // GOTCHAS 26 — before the try/catch below judges the world
try {
  await page.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 20000 });
} catch {
  console.error('__ct.scene never appeared. Page errors:\n' + (errs.join('\n') || '(none captured)'));
  await browser.close(); process.exit(1);
}

const BOX = 30;
const res = await page.evaluate(async (BOX) => {
  const scene = window.__ct.scene();
  // THE RAIN IS THE MAPPED ONE. Selecting on type alone picked a star set.
  let rain = null;
  scene.traverse((o) => { if (o.type === 'Points' && o.material?.map) rain = o; });
  if (!rain) return { err: 'no MAPPED Points object — the rain is not in the scene' };

  // Ask the world which hours rain; do not re-derive it.
  const rainAt = scene.userData.rainAt;
  if (typeof rainAt !== 'function') return { err: 'scene.userData.rainAt is not published — cannot ask the world' };
  // An ABSOLUTE hour past the first day, in daylight, so the drops are lit and
  // a human re-running this by hand sees what the check saw.
  let hr = -1;
  for (let h = 24; h < 4000; h++) { const d = h % 24; if (d >= 11 && d <= 15 && rainAt(h)) { hr = h; break; } }
  if (hr < 0) return { err: 'no rainy daylight hour found in 4000' };

  window.__ct.warp(-1, -20, Math.PI, 0.14, 0.05);   // OUTDOORS: rain is cut above x 100
  window.__ct.clock(hr, 30);                        // absolute, NOT hr % 24
  // Wait for the level to come up. Sampling before this is what made every
  // delta 0.000 and turned an inert run into a pass.
  let lvl = 0;
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 200));
    lvl = scene.userData.rainLevel ?? 0;
    if (lvl > 0.9) break;
  }

  const sample = (n) => {
    const a = rain.geometry.getAttribute('position');
    const out = [];
    for (let i = 0; i < n; i++) out.push([a.getX(i), a.getZ(i)]);
    return { pts: out, objX: rain.position.x, objZ: rain.position.z };
  };

  const before = sample(16);
  // teleport a long way down the block — 45 m, not a multiple of the box
  window.__ct.warp(-1, -65, Math.PI, 0.14, 0.05);
  await new Promise((r) => setTimeout(r, 900));
  const after = sample(16);

  // classify each drop's horizontal movement
  const isPeriodic = (d) => Math.abs(d - BOX * Math.round(d / BOX)) < 0.01;
  const verdicts = before.pts.map(([x0, z0], i) => {
    const [x1, z1] = after.pts[i];
    const dx = x1 - x0, dz = z1 - z0;
    return { dx: +dx.toFixed(3), dz: +dz.toFixed(3), ok: isPeriodic(dx) && isPeriodic(dz) };
  });
  return { hr, lvl, n: rain.geometry.getAttribute('position').count,
           moved: verdicts.filter((v) => v.dx || v.dz).length,
           objMoved: { x: after.objX - before.objX, z: after.objZ - before.objZ }, verdicts };
}, BOX);

await browser.close();
if (res.err) { console.error(res.err); process.exit(1); }

const bad = res.verdicts.filter((v) => !v.ok);
console.log(`measured the ${res.n}-point MAPPED Points set (the rain), not a star field`);
console.log(`rainy ABSOLUTE hour ${res.hr} (${res.hr % 24}:30), rainLevel ${res.lvl.toFixed(3)}; player teleported 45 m`);
console.log(`rain object itself moved: x=${res.objMoved.x} z=${res.objMoved.z}  (must be 0 — nonzero means it is pinned to the camera)`);
for (const v of res.verdicts.slice(0, 6)) {
  console.log(`  drop dx=${String(v.dx).padStart(8)} dz=${String(v.dz).padStart(8)}  ${v.ok ? 'world-locked' : 'FOLLOWS CAMERA'}`);
}
console.log(`\n${res.verdicts.length - bad.length}/${res.verdicts.length} drops world-locked; ${res.moved} of them actually wrapped`);
if (errs.length) console.log(`page errors: ${errs.join('\n')}`);
if (bad.length || res.objMoved.x || res.objMoved.z) { console.error('FAIL: rain is not world-locked'); process.exit(1); }
// AN INERT RUN IS NOT A PASS. Every delta reading 0 means the wrap never ran,
// so nothing was observed — which is the state this file shipped in.
if (!res.moved) {
  console.error('FAIL: no drop moved at all — the wrap never ran, so nothing was tested.');
  console.error('      A wrap can only produce 0 or a multiple of 30; all-zero is an inert run.');
  process.exit(1);
}
console.log('PASS: rain is locked to the world');
