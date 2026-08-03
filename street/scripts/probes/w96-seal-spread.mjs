// DOES A STOPPED CITIZEN SEAL THE WALK — AND HOW MUCH DOES THAT NUMBER MOVE
// BETWEEN RUNS OF THE SAME CODE?
//
// crowd-walk.mjs's last two legs went from "294 samples, 0 sealed, tightest
// 1.92 m" to "483 samples, 53 sealed, tightest 0 m" across a change to
// ct/crowd.ts. That looks like a regression and it may not be one: the crowd
// picks its errands with `rnd()` at RUNTIME, so where anybody happens to be
// standing during a 25 s window is different every run. **One run of each build
// cannot tell a regression from the weather**, which is the whole reason this
// exists.
//
// So: the same measurement crowd-walk.mjs makes (lifted, not reinvented — same
// RAD 0.36, same STEP 0.02, same 4.2 m start, same |x| < 4 exclusion), run N
// times, reporting the spread rather than a single number.
//
//   SHOT_URL=http://localhost:4520/ RUNS=5 node scripts/probes/w96-seal-spread.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const RUNS = Number(process.env.RUNS ?? 5);
const WINDOW = Number(process.env.WINDOW ?? 25000);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const rows = [];
for (let r = 0; r < RUNS; r++) {
  const lane = await p.evaluate(async (ms) => {
    const RAD = 0.36, STEP = 0.02;
    let samples = 0, sealed = 0, tight = 99, where = null, last = null;
    const spots = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      await new Promise((r2) => requestAnimationFrame(r2));
      const w = window.__ct.walkers(), cols = window.__ct.colliders();
      if (last && w.length === last.length) {
        for (let i = 0; i < w.length; i++) {
          if (Math.hypot(w[i].x - last[i].x, w[i].z - last[i].z) > 0.004) continue;
          const z = w[i].z;
          if (Math.abs(w[i].x) < 4) continue;
          samples++;
          let best = 0, run = 0;
          for (let x = Math.sign(w[i].x) * 4.2, n = 0; n < 190; n++, x += Math.sign(w[i].x) * STEP) {
            const blocked = cols.some((c) => x > c.minX - RAD && x < c.maxX + RAD
              && z > c.minZ - RAD && z < c.maxZ + RAD);
            if (blocked) run = 0; else { run += STEP; if (run > best) best = run; }
          }
          const gap = best > 0 ? best + 2 * RAD : 0;
          if (best <= 0) { sealed++; spots.push([+w[i].x.toFixed(1), +z.toFixed(1)]); }
          if (gap < tight) { tight = gap; where = [+w[i].x.toFixed(2), +z.toFixed(2)]; }
        }
      }
      last = w.map((q) => ({ x: q.x, z: q.z }));
    }
    return { samples, sealed, tight: +tight.toFixed(2), where, spots: spots.slice(0, 6) };
  }, WINDOW);
  rows.push(lane);
  console.log(`run ${r + 1}: ${String(lane.samples).padStart(4)} stopped-samples, `
    + `${String(lane.sealed).padStart(3)} sealed, tightest ${lane.tight} m at (${lane.where})`
    + (lane.spots.length ? `   seals near ${lane.spots.map((s) => s.join(',')).join(' ')}` : ''));
}

const seals = rows.map((r) => r.sealed);
const tights = rows.map((r) => r.tight);
console.log(`\nsealed:   min ${Math.min(...seals)}  max ${Math.max(...seals)}  `
  + `runs-with-any-seal ${seals.filter((s) => s > 0).length}/${RUNS}`);
console.log(`tightest: min ${Math.min(...tights).toFixed(2)} m  max ${Math.max(...tights).toFixed(2)} m`);
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
await b.close();
