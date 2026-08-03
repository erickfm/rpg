// DOES ANYBODY LOOK LIKE THEY ARE HOLDING THE UMBRELLA. Item 278.
//
// The row is explicit that this is judged by LOOKING, in rain, from a normal
// walking distance — that is how both of item 271's faults were caught and
// neither was found by measurement. So this shoots, and the assertions below it
// only defend the things a frame cannot show:
//
//   · the pose follows the UMBRELLA and nothing else. `holding` and `umb > 0`
//     must agree for every walker, every sample. Two conditions that can drift
//     apart is exactly what the row said not to build.
//   · it DEFAULTS OFF. A dry street must show `holding` false for everyone, or
//     the pose has leaked into the whole crowd to fix one prop.
//   · the swapped sheet still animates. Writing the view onto the wrong texture
//     leaves a walker facing the way he faced when the rain started, which no
//     still frame from behind would reveal.
//
// ⚠ TWO THINGS THE FIRST VERSION OF THIS PROBE GOT WRONG, and it reported
// "0 walkers with umbrellas in rain" about a world that was fine — GOTCHAS §7
// exactly ("half of all defects here are the instrument"):
//
//   1. WEATHER IS THE CLOCK, not a field. Writing `scene.userData.rainHeavy`
//      is writing to the OUTPUT: `updateRain` recomputes it every frame from
//      the hour and the storm schedule, so the assignment is gone before the
//      next tick. You have to find a WET HOUR with `__ct.clock(h, 0)`.
//   2. IT NEVER RAINS INDOORS AND YOU START INDOORS. `updateRain` gates on
//      `px < 100`, and the player spawns inside apartment 301 at x = 198
//      (GOTCHAS §79b). Warp out to the street FIRST or the sky is dry at every
//      hour of the day.
//
// Both are `scripts/probes/w110-umbrella-look.mjs`'s, which had them right.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4188/');
mkdirSync('shots', { recursive: true });
let fails = 0, checks = 0;
const ok = (c, w) => { checks++; if (!c) { fails++; console.log(`  FAIL  ${w}`); } else console.log(`  ok    ${w}`); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

// `ct/crowd.ts`: `c.umb.visible = c.umbOpen > 0.02`. The pose is derived from
// that same visibility, so this is the ONE threshold this probe may use — a
// second number here is the drift the item warned against, in the check.
const UMB_FLOOR = 0.02;
const walkers = () => p.evaluate(() => window.__ct.walkers());
// OUT OF THE FLAT, once, before anything else. See the header.
await p.evaluate(() => window.__ct.warp(6.3, -60, Math.PI));
await waitPainted(p, { frames: 10 });

/** set the clock and let the crowd's 5/s umbrella lerp settle */
const atHour = async (h) => {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await waitPainted(p, { frames: 40 });
};
/** the first hour of the day at which the canopies are actually up */
const findHour = async (want) => {
  for (let h = 0; h < 48; h++) {
    await atHour(h % 24);
    if (await settled(want)) return h % 24;
  }
  return -1;
};
/**
 * WAIT FOR THE WEATHER TO ARRIVE, do not count frames at it.
 *
 * `rainHeavy = rainLevel * stormNow` and the STORM EASES — snapping the clock
 * to a dry hour does not make the street dry on the next frame. A fixed
 * `waitPainted(40)` after the clock change read six canopies still up and
 * called it a failure of the pose; the pose was correct and the sky was still
 * emptying. GOTCHAS §30, and §7 again: the instrument, not the world.
 */
const settled = async (wet, capMs = 12000) => {
  const t0 = Date.now();
  for (;;) {
    const w = await walkers();
    if (wet ? w.some((q) => q.umb > 0.95) : w.every((q) => q.umb <= UMB_FLOOR)) return true;
    if (Date.now() - t0 > capMs) return false;
    await waitPainted(p, { frames: 6 });
  }
};

/** go to the wet hour found below and wait for it to arrive */
let wetHour = -1, dryHour = -1;
const setWet = async () => { await atHour(wetHour); await settled(true); };
const setDry = async () => { await atHour(dryHour); await settled(false); };

// ── 0. dry: the pose must be OFF for everyone ─────────────────────────────
console.log('\n=== 0. DRY STREET — the pose defaults off ===');
const dryH = await findHour(false);
if (dryH < 0) { console.log('REFUSING TO REPORT: never found a dry hour'); await b.close(); process.exit(3); }
dryHour = dryH;
console.log(`  dry hour ${dryH}`);
let w = await walkers();
console.log(`  ${w.length} walkers, holding: ${w.filter((q) => q.holding).length}, umb>${UMB_FLOOR}: ${w.filter((q) => q.umb > UMB_FLOOR).length}`);
ok(w.length > 0, `there are walkers to judge (${w.length})`);
ok(w.every((q) => !q.holding), 'nobody is holding anything on a dry street');

// ── 1. rain: everybody who has a canopy up is holding it ──────────────────
console.log('\n=== 1. RAIN — the pose follows the umbrella ===');
const wetH = await findHour(true);
if (wetH < 0) { console.log('REFUSING TO REPORT: never found a wet hour'); await b.close(); process.exit(3); }
wetHour = wetH;
console.log(`  wet hour ${wetH}`);
let disagree = 0, samples = 0;
for (let i = 0; i < 5; i++) {
  w = await walkers();
  for (const q of w) { samples++; if ((q.umb > 0.02) !== q.holding) disagree++; }
  await waitPainted(p, { frames: 6 });
}
w = await walkers();
console.log(`  ${w.length} walkers, holding: ${w.filter((q) => q.holding).length}, umb>${UMB_FLOOR}: ${w.filter((q) => q.umb > UMB_FLOOR).length}`);
ok(w.filter((q) => q.holding).length === w.length, 'every walker in rain has a hand up');
ok(disagree === 0, `holding == (umb > ${UMB_FLOOR}) on all ${samples} samples across 5 ticks (${disagree} disagreements)`);

// the FRAME the row asks for, from street level at a walking distance
const shoot = async (tag) => {
  const near = (await walkers()).filter((q) => Math.abs(q.x) > 5 && Math.abs(q.x) < 9)[0]
    ?? (await walkers())[0];
  // stand 4 m off, on the walk, looking at him
  await p.evaluate(([tx, tz]) => {
    const d = 4.0;
    const x = tx > 0 ? tx - d * 0.75 : tx + d * 0.75;
    const z = tz + d * 0.66;
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), 0, 0.02);
  }, [near.x, near.z]);
  await waitPainted(p, { frames: 6 });
  const path = `shots/w107-umb-${tag}.png`;
  const buf = await p.screenshot({ path });
  console.log(`  ${path}  walker at (${near.x.toFixed(2)}, ${near.z.toFixed(2)})  black ${(await blackFraction(p, buf) * 100).toFixed(1)}%`);
};
await shoot('rain-4m');

// ── 2. the swapped sheet still animates ───────────────────────────────────
//
// The failure this catches: the per-frame view is written to `c.tex` while the
// mesh is wearing `c.texUp`, so the visible sheet keeps the column and frame it
// had when the rain started. Read the live map's own offset over several ticks
// and require it to MOVE.
console.log('\n=== 2. THE LIVE SHEET STILL ANIMATES UNDER THE UMBRELLA ===');
const offsets = [];
for (let i = 0; i < 8; i++) {
  offsets.push(await p.evaluate(() => {
    const out = [];
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh || !o.material?.map) return;
      const im = o.material.map.image;
      if (!im || im.width !== 160 || im.height !== 128) return;   // the citizen sheet
      out.push(`${o.material.map.offset.x.toFixed(3)},${o.material.map.offset.y.toFixed(3)},${o.material.map.repeat.x.toFixed(3)}`);
    });
    return out.join('|');
  }));
  await waitPainted(p, { frames: 5 });
}
const distinct = new Set(offsets).size;
console.log(`  ${distinct} distinct UV states over 8 samples`);
ok(offsets[0] !== '', 'the citizen sheets were found on the meshes at all');
ok(distinct > 1, `the live sheet's UVs move while the umbrella is up (${distinct} distinct states)`);

// ── 3. back to dry: the pose comes down again ─────────────────────────────
console.log('\n=== 3. RAIN STOPS — the hand comes down ===');
await atHour(dryH);
const dried = await settled(false);
ok(dried, 'the street actually dried out again (so the next line is about the POSE)');
w = await walkers();
console.log(`  holding: ${w.filter((q) => q.holding).length} of ${w.length}`);
ok(w.every((q) => !q.holding), 'every hand is down again when the rain stops');
await shoot('dry-4m');

// ── 4. THE PIXELS, NOT JUST THE FLAG ─────────────────────────────────────
//
// EVERY ASSERTION ABOVE WOULD PASS ON A WORLD WHERE THE POSE WAS NEVER
// PAINTED. `holding` is a boolean this file sets and reads; bake `texUp` with
// `holdUp: false` — one word — and the flag still flips, the map still swaps,
// the UVs still animate, and nobody has a hand up. That is the vacuous pass
// this project keeps paying for, and it is the one a probe author is most
// likely to ship.
//
// So count OPAQUE TEXELS ABOVE THE CROWN on the sheet the mesh is actually
// wearing. `ct/citizens.ts` puts the skull at row 8 and the hair from row 4, so
// rows 0-7 of a hanging figure hold hair and nothing else; a raised arm and its
// fist have to add texels there or the pose does not exist.
const crownTexels = async (wet) => p.evaluate((wet) => {
  const want = window.__ct.walkers().filter((q) => (wet ? q.holding : !q.holding));
  if (!want.length) return null;
  let src = null, best = 1e9;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.material?.map) return;
    const im = o.material.map.image;
    if (!im || im.width !== 160 || im.height !== 128) return;
    for (const q of want) {
      const d = Math.hypot(o.position.x - q.x, o.position.z - q.z);
      if (d < best && d < 0.35) { best = d; src = im; }
    }
  });
  if (!src) return null;
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  cv.getContext('2d').drawImage(src, 0, 0);
  // view column 0, frame 0: x 0..31, rows 0..7
  const d = cv.getContext('2d').getImageData(0, 0, 32, 8).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 127) n++;
  return n;
}, wet);

console.log('\n=== 4. THE POSE IS ACTUALLY PAINTED ===');
await setWet();
const upTexels = await crownTexels(true);
await setDry();
const downTexels = await crownTexels(false);
console.log(`  opaque texels above the crown (view 0, rows 0-7): holding ${upTexels}, hanging ${downTexels}`);
ok(upTexels !== null && downTexels !== null, 'both sheets were read off the meshes');
ok(upTexels > downTexels + 5,
  `the holding sheet paints MORE above the crown than the hanging one (${upTexels} vs ${downTexels}, want +5)`);

console.log(`\n${checks - fails}/${checks} passed`);
await b.close();
if (!checks) process.exit(3);
process.exit(fails ? 1 : 0);
