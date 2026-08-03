// LOOK AT ONE UMBRELLA, BIG, IN THE RAIN — the item's pass condition is his
// eye, so the job of this file is to produce a frame worth looking at.
//
// WHY NOT w96-umbrella-closeup.mjs: it stands on a fixed spot and waits for a
// walker to come within 4.2 m, and the frame it produced today has the walker
// ~12 m off behind a street tree — the canopy is nine pixels tall and nothing
// about it can be judged. This one goes TO the walker: camera 2.2 m out along
// the sidewalk from a raised umbrella, aimed at it, pitched up so the canopy is
// centred rather than at the top of the frame.
//
// Citizens hold a step short of you at 1.05 m and go `ghost` at 1.4 m
// (ct/crowd.ts), so 2.2 m is outside both — standing here does not change what
// is being photographed.
//
//   SHOT_URL=http://localhost:4661/ TAG=before node scripts/probes/w110-umbrella-look.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4661/');
const TAG = process.env.TAG ?? 'now';
const N = Number(process.env.N ?? 4);
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 760, height: 760 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });

// OUT OF THE FLAT FIRST — `updateRain` gates on `px < 100` and the player
// spawns inside apartment 301, parked far out along +x with the other
// interiors, so indoors it never rains at any hour (GOTCHAS 79b).
await p.evaluate(() => window.__ct.warp(6.3, -60, Math.PI));
await p.waitForTimeout(1600);

let hour = -1;
for (let h = 6; h < 40 && hour < 0; h++) {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.waitForTimeout(2400);
  if (await p.evaluate(() => window.__ct.walkers().some((q) => q.umb > 0.95))) hour = h;
}
if (hour < 0) { console.log('REFUSING TO REPORT: never found a wet hour'); await b.close(); process.exit(3); }
console.log(`wet hour ${hour}`);

// A DISTANCE SWEEP, because the item's pass condition is "reads as an umbrella
// from a NORMAL WALKING DISTANCE" and the diagnosis needs a close frame. 1.6 m
// is a diagnostic (the canopy spans ~40 deg of an 88 deg frame); 4 m and 8 m
// are what he actually walks past. 1.6 is outside the 1.4 m `ghost` radius, so
// even the close one is not changing the thing it photographs.
const DISTS = (process.env.DISTS ?? '1.6,4,8').split(',').map(Number);
const shots = [];
for (let n = 0; n < N; n++) {
  for (const D of DISTS) {
    const aimed = await p.evaluate((d) => {
      const ws = window.__ct.walkers().filter((q) => q.umb > 0.95);
      if (!ws.length) return null;
      const w = ws[0];
      // stand out toward the ROAD, so the shopfront is the backdrop rather
      // than the camera being inside the wall
      const sx = w.x > 0 ? w.x - d : w.x + d;
      // pitch up so the canopy is centred: it sits ~2 m off the ground and the
      // eye is at 1.62, so the lift is atan((2.05 - 1.62) / d) — DERIVED from
      // the distance rather than one angle reused at every range
      window.__ct.warp(sx, w.z, w.x > 0 ? Math.PI / 2 : -Math.PI / 2, 0,
        Math.atan2(0.43, d));
      return { x: +w.x.toFixed(2), z: +w.z.toFixed(2), camX: +sx.toFixed(2) };
    }, D);
    if (!aimed) continue;
    await p.waitForTimeout(650);
    const f = `shots/w110-umb-${TAG}-${n}-${String(D).replace('.', 'p')}m.png`;
    await p.screenshot({ path: f });
    shots.push({ ...aimed, f });
    console.log(`  ${f}  walker (${aimed.x}, ${aimed.z}) at ${D} m`);
  }
}
console.log('errors', errs.length, errs.slice(0, 3));
await b.close();
