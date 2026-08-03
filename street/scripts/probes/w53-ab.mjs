// ITEM 141, THE EQUIVALENCE PROOF: does the region cull remove anything the
// player could actually SEE?
//
// The item's risk, in its own words: "a room whose window goes black is worse
// than a slow one". So the cull is not proved by being fast. It is proved by
// the picture being the same.
//
// HOW, and why not two builds. `__ct.cullRegions(on)` toggles it at runtime, so
// this compares frames of ONE world rather than two builds — no rebuild, no
// reseeded RNG, none of the `fp` texture-stream problem (GOTCHAS 75). The
// renderer is constructed with `preserveDrawingBuffer: true` (main.ts:7), so
// the canvas reads back with `toDataURL` and is compared in page.
//
// ── WHAT IT COMPARES, AND THE TWO WRONG ANSWERS IT WENT THROUGH FIRST ────
//
// v1 counted differing pixels. It failed the casino at 2,623 changed pixels
// against a 2,572-pixel control — both of which were the marquee bulbs
// blinking (`scripts/probes/w53-ab-mask.mjs` painted the masks; they are the
// same row of bulbs in different phases). A COUNT CANNOT TELL A LOST WALL FROM
// A BULB.
//
// v2 asked whether the cull moved pixels the world does not move on its own,
// using three untouched frames as the control. Better, and it cleared twelve
// rooms — but the casino marquee CHASES, so three consecutive frames catch
// only part of its cycle and a bulb that happens to be lit in all three and
// dark in the fourth reads as a change.
//
// v3, this one, models the noise properly instead of thresholding it. It takes
// N untouched frames and records, per pixel and per channel, the RANGE of
// values the world produces there by itself. A pixel fails only if the
// cull-on frame falls OUTSIDE the range that pixel was already observed to
// take. A chasing bulb spans bright and dark across N frames, so any phase of
// it is inside its own range. A wall that stopped being drawn cannot be: no
// untouched frame ever showed anything but that wall there.
//
// This is a model, not a loosened threshold, and the difference matters —
// BUILDER-BRIEF §7 is explicit that a check tuned until it passes is worse
// than one that is wrong. So it carries its own proof that it can still fail:
//
//     node scripts/probes/w53-ab.mjs --mutate
//
// hides, in addition to the real cull, the ONE unculled top-level child
// nearest the camera — something indisputably in view — and the run must go
// red. A green `--mutate` run means this check has stopped checking.
//
// VACUITY GUARD: a station whose observed range already covers most of the
// frame could swallow any finding, so >20% wide-range coverage fails as
// INCONCLUSIVE rather than passing.
//
// STOREY IS PASSED EXPLICITLY AT EVERY STATION. v1 left it `undefined` and let
// `__ct.warp` keep whatever floor the previous room set, which stood the
// player in the walk-up at the belt's floor height and produced a 358-pixel
// "failure" that vanished when the room was visited alone. GOTCHAS 7, and
// w52's note about `warp` needing `gy`, paid for a second time.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w53-ab.mjs [--mutate]
// Exits non-zero if any station renders differently with the cull on.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4183/');
const MUTATE = process.argv.includes('--mutate');
const N = 8;                    // untouched frames per station
const GAP = 180;                // ms between them: 1.4 s spans the marquee chase
const TOL = 6;                  // channel tolerance either side of the observed range
const FLOOR = 40;               // absolute px floor for silhouette rounding

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));

const info = await p.evaluate(() => window.__ct.cullInfo());
console.log(`cull: on=${info.on}  classified ${info.classified} of ${info.topLevel} top-level children`);
if (MUTATE) console.log('MUTATION RUN — also hiding the nearest visible object; this run MUST fail\n');
else console.log('');

await p.evaluate(([tol]) => {
  const cv = document.querySelector('canvas');
  window.__shot = () => cv.toDataURL('image/png');
  const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
  const px = async (u) => {
    const im = await load(u);
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    return { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
  };
  // urls: N untouched frames, then one with the cull on.
  window.__judge = async (urls) => {
    const im = await Promise.all(urls.map(px));
    const w = im[0].w, h = im[0].h, n = im.length - 1;
    const len = im[0].d.length;
    const lo = new Uint8Array(len), hi = new Uint8Array(len);
    lo.fill(255);
    for (let f = 0; f < n; f++) {
      const d = im[f].d;
      for (let i = 0; i < len; i++) { if (d[i] < lo[i]) lo[i] = d[i]; if (d[i] > hi[i]) hi[i] = d[i]; }
    }
    const t = im[n].d;
    let outside = 0, moving = 0;
    for (let i = 0; i < len; i += 4) {
      let wide = false, out = false;
      for (let c = 0; c < 3; c++) {
        if (hi[i + c] - lo[i + c] > tol) wide = true;
        if (t[i + c] < lo[i + c] - tol || t[i + c] > hi[i + c] + tol) out = true;
      }
      if (wide) moving++;
      if (out) outside++;
    }
    return { outside, moving, total: w * h };
  };
  // MUTATION: hide the nearest top-level child that the real cull did NOT
  // hide — by construction something in the room you are standing in.
  window.__mutate = () => {
    const s = window.__ct.scene(), cam = window.__ct.camera();
    s.updateMatrixWorld(true);
    let best = null, bd = Infinity;
    for (const ch of s.children) {
      if (!ch.visible) continue;
      let d = Infinity;
      ch.traverse((o) => {
        const g = o.geometry; if (!g) return;
        if (!g.boundingSphere) g.computeBoundingSphere();
        const bs = g.boundingSphere; if (!bs) return;
        const c = bs.center.clone().applyMatrix4(o.matrixWorld);
        d = Math.min(d, c.distanceTo(cam.position));
      });
      if (d < bd) { bd = d; best = ch; }
    }
    if (best) { best.visible = false; window.__muted = best; }
    return bd;
  };
  window.__unmutate = () => { if (window.__muted) { window.__muted.visible = true; window.__muted = null; } };
}, [TOL]);

const spawn = await p.evaluate(() => window.__ct.pos());
const rooms = await p.evaluate(() => window.__ct.roomDims());
const STATIONS = [{ id: 'flat301', x: spawn[0], z: spawn[2], gy: spawn[3] }];
for (const r of rooms) STATIONS.push({ id: r.id, x: r.cx, z: r.cz, gy: r.cx >= 400 ? 0 : spawn[3] });

const YAWS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i * Math.PI) / 4);
const PITCHES = [0, 0.4];
let fails = 0, samples = 0, worst = 0, worstAt = '';

for (const st of STATIONS) {
  let roomWorst = 0, roomFail = 0, inc = 0;
  for (const yaw of YAWS) for (const pitch of PITCHES) {
    await p.evaluate(([x, z, y, g, pi]) => window.__ct.warp(x, z, y, g, pi), [st.x, st.z, yaw, st.gy, pitch]);
    await p.evaluate(() => window.__ct.cullRegions(false));
    const shots = [];
    for (let i = 0; i < N; i++) { await p.waitForTimeout(GAP); shots.push(await p.evaluate(() => window.__shot())); }
    await p.evaluate(() => window.__ct.cullRegions(true));
    if (MUTATE) { await p.waitForTimeout(GAP); await p.evaluate(() => window.__mutate()); }
    await p.waitForTimeout(GAP);
    shots.push(await p.evaluate(() => window.__shot()));
    if (MUTATE) await p.evaluate(() => window.__unmutate());
    const r = await p.evaluate((u) => window.__judge(u), shots);
    samples++;
    roomWorst = Math.max(roomWorst, r.outside);
    if (r.outside > worst) { worst = r.outside; worstAt = `${st.id} yaw ${yaw.toFixed(2)} pitch ${pitch}`; }
    if (r.moving > 0.20 * r.total) {
      inc++; roomFail++; fails++;
      console.log(`  INCONCLUSIVE ${st.id} yaw ${yaw.toFixed(2)} pitch ${pitch}: ${(100 * r.moving / r.total).toFixed(0)}% of the frame moves on its own`);
    } else if (r.outside > FLOOR) {
      roomFail++; fails++;
      console.log(`  FAIL ${st.id} yaw ${yaw.toFixed(2)} pitch ${pitch}: ${r.outside} px outside the range the world produces by itself (${r.moving} px move on their own)`);
    }
  }
  console.log(`${roomFail ? 'FAIL' : ' ok '}  ${st.id.padEnd(12)}  worst out-of-range ${String(roomWorst).padStart(5)} px${inc ? `   ${inc} inconclusive` : ''}`);
}

console.log(`\n${samples} samples over ${STATIONS.length} rooms; worst ${worst} px at ${worstAt} (floor ${FLOOR})`);
await browser.close();
if (fails) {
  console.log(`\n${MUTATE ? 'RED, as a mutation run must be — the check can still fail.' : 'FAIL — a station renders differently with the cull on'}`);
  process.exit(MUTATE ? 0 : 1);
}
console.log(MUTATE
  ? '\nGREEN ON A MUTATION RUN — THIS CHECK HAS STOPPED CHECKING. Do not trust it.'
  : '\nPASS — the cull puts no pixel outside the range the world produces by itself');
process.exit(MUTATE ? 1 : 0);
