// WHY DO crowd-walk.mjs's SEAL LEGS RETURN 0 / 62 / 317 / 0 / 0? — item 262.
//
// The row's house cure says "key on identity rather than index or ordinal
// position". THAT IS NOT THE BUG HERE and this probe is how I found out:
// `ct/crowd.ts:269` builds `citizens` once and `:400` only ever pushes into it —
// no splice, no sort, no pop — so `walkers()[i]` IS the same person every frame
// and the index match at crowd-walk.mjs:251 is sound.
//
// What this measures instead, over three identical runs:
//   1. is the walkers array index-stable and constant-length  (the theory)
//   2. how many frames actually elapse in a fixed wall-clock window (the load
//      dependence GOTCHAS 30/43 warn about)
//   3. how many "stopped on the sidewalk" samples that yields — the population
//      the seal legs need and do not require
//
//   SHOT_URL=http://localhost:4620/ node scripts/probes/w106-why-seal-legs-are-flaky.mjs
//
// GOTCHAS 79b: warp out of apartment 301 before reading the world, or the region
// culler hides every citizen. The seal legs do NOT filter on `visible`, which is
// right (GOTCHAS 79) — but the crowd itself only runs outdoors.
// GOTCHAS 73/74: this deliberately uses the UNFILTERED colliders(), exactly as
// crowd-walk does. A stopped citizen IS the subject here; filtering would delete
// the thing being measured.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4620/');
const RUNS = +(process.argv[2] ?? 3);
const WINDOW_MS = 12000;

const b = await chromium.launch();
const rows = [];
for (let run = 0; run < RUNS; run++) {
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
  if (run === 0) await reportWorld(p, URL);
  // out of 301 and onto the street, or the crowd is culled and idle
  await p.evaluate(async () => {
    const gy = await window.__ct.groundAt(6, -50);
    window.__ct.warp(6, -50, 0, gy, 0);
  });
  await waitPainted(p, { frames: 3 });

  const r = await p.evaluate(async (winMs) => {
    const RAD = 0.36, STEP = 0.02;
    let frames = 0, samples = 0, sealed = 0, lenChanges = 0, tight = 99;
    let last = null, len0 = window.__ct.walkers().length;
    const t0 = performance.now();
    while (performance.now() - t0 < winMs) {
      await new Promise((res) => requestAnimationFrame(res));
      frames++;
      const w = window.__ct.walkers(), cols = window.__ct.colliders();
      if (w.length !== len0) lenChanges++;
      if (last && w.length === last.length) {
        for (let i = 0; i < w.length; i++) {
          if (Math.hypot(w[i].x - last[i].x, w[i].z - last[i].z) > 0.004) continue;
          if (Math.abs(w[i].x) < 4) continue;
          samples++;
          const z = w[i].z;
          let best = 0, run2 = 0;
          for (let x = Math.sign(w[i].x) * 4.2, n = 0; n < 190; n++, x += Math.sign(w[i].x) * STEP) {
            const blocked = cols.some((c) => x > c.minX - RAD && x < c.maxX + RAD
              && z > c.minZ - RAD && z < c.maxZ + RAD);
            if (blocked) run2 = 0; else { run2 += STEP; if (run2 > best) best = run2; }
          }
          const gap = best > 0 ? best + 2 * RAD : 0;
          if (best <= 0) sealed++;
          if (gap < tight) tight = gap;
        }
      }
      last = w.map((q) => ({ x: q.x, z: q.z }));
    }
    return { frames, samples, sealed, lenChanges, pop: len0, tight: +tight.toFixed(2) };
  }, WINDOW_MS);
  rows.push(r);
  console.log(`run ${run + 1}: pop=${r.pop} frames=${r.frames} samples=${r.samples}`
    + ` sealed=${r.sealed} tight=${r.tight} arrayLengthChanges=${r.lenChanges}`);
  await p.close();
}
await b.close();

const s = rows.map((r) => r.samples);
const f = rows.map((r) => r.frames);
console.log(`\nsamples across ${RUNS} identical runs: ${s.join(' / ')}`
  + `   spread ${Math.min(...s)}..${Math.max(...s)}`);
console.log(`frames  across ${RUNS} identical runs: ${f.join(' / ')}`);
console.log(`array length ever changed: ${rows.some((r) => r.lenChanges > 0) ? 'YES' : 'NO'}`
  + '   <- if NO, the index match is sound and identity is NOT the bug');
console.log(`sealed:  ${rows.map((r) => r.sealed).join(' / ')}`);
