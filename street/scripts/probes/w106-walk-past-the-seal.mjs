// WALK PAST (6, -50.45), BOTH DIRECTIONS — item 262 demands it, and a screenshot
// cannot prove you are not wedged.
//
// The row says a citizen SEALS the east walk there with a 0 m gap. The scan says
// 1.34 m clean, and the scan is proven able to report 0 m on a planted wall
// (w106-seal-negative-case.mjs). This is the third instrument on the same claim,
// and the only one a player would recognise: hold W through the coordinate and
// see whether anything holds you.
//
// MEASURE THE LONGEST STALL, NOT THE DISTANCE — crowd-walk.mjs:200 learned this
// the hard way ("it was > 14, then > 9, and it failed at 8.6 m on a sound
// world"). A stopped citizen is solid for 1.4 s before it gives way, so three
// legitimate encounters eat most of any window. Being held 1.4 s is the give-way
// working; being held four seconds is being stuck.
//
//   SHOT_URL=http://localhost:4620/ node scripts/probes/w106-walk-past-the-seal.mjs [runs]
//
// GOTCHAS 79b: warp first — the player spawns inside apartment 301 at x = 198.
//
// ⚠ FACING: **yaw = 0 walks -z (south) and yaw = PI walks +z (north)** — the
// OPPOSITE of the (sin yaw, cos yaw) reading I started from. Measured, not
// assumed: the first cut sent both legs the wrong way and neither ever reached
// z = -50.45. It reported that rather than passing, which is the only reason the
// mistake was cheap — a walk probe that does not check it COVERED the coordinate
// it was aimed at will happily certify ground it never touched.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4620/');
const RUNS = +(process.argv[2] ?? 5);
const STALL_LIMIT = 2.5;    // seconds; 1.4 s is one give-way

const b = await chromium.launch();
const results = [];
for (let run = 0; run < RUNS; run++) {
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.warp !== undefined, { timeout: 30000 });
  if (run === 0) await reportWorld(p, URL);
  await waitPainted(p, { frames: 2 });
  const pos = () => p.evaluate(() => window.__ct.pos());

  const legs = [
    ['southbound', 6, -40, 0],
    ['northbound', 6, -62, Math.PI],
  ];
  const out = {};
  for (const [tag, x, z, yaw] of legs) {
    await p.evaluate(async ([x2, z2, y2]) => {
      const gy = await window.__ct.groundAt(x2, z2);     // ASYNC — GOTCHAS 90
      window.__ct.warp(x2, z2, y2, gy, 0);
    }, [x, z, yaw]);
    await p.waitForTimeout(250);
    const d = await pos();
    await p.keyboard.down('w');
    const track = [d];
    for (let i = 0; i < 14; i++) { await p.waitForTimeout(500); track.push(await pos()); }
    await p.keyboard.up('w');
    await p.waitForTimeout(40);
    let stall = 0, worst = 0;
    for (let i = 1; i < track.length; i++) {
      const step = Math.hypot(track[i][0] - track[i - 1][0], track[i][2] - track[i - 1][2]);
      if (step < 0.15) { stall += 0.5; if (stall > worst) worst = stall; } else stall = 0;
    }
    const e = track[track.length - 1];
    // did we actually pass through the coordinate in question?
    const zs = track.map((t) => t[2]);
    const crossed = Math.min(...zs) <= -50.45 && Math.max(...zs) >= -50.45;
    out[tag] = { worst, dist: +Math.hypot(e[0] - d[0], e[2] - d[2]).toFixed(1), crossed,
      endX: +e[0].toFixed(2) };
    console.log(`run ${run + 1} ${tag}: longest stall ${worst.toFixed(1)} s, ${out[tag].dist} m,`
      + ` crossed z=-50.45: ${crossed}, ended x=${out[tag].endX}`);
  }
  results.push(out);
  await p.close();
}
await b.close();

let bad = 0;
for (const tag of ['southbound', 'northbound']) {
  const w = results.map((r) => r[tag].worst);
  const crossed = results.filter((r) => r[tag].crossed).length;
  const ok = w.every((v) => v <= STALL_LIMIT);
  console.log(`\n${tag}: stalls ${w.map((v) => v.toFixed(1)).join(' / ')} s`
    + `  max ${Math.max(...w).toFixed(1)} s (limit ${STALL_LIMIT})  crossed the coordinate ${crossed}/${RUNS}`);
  if (!ok) { console.log(`  ${tag}: WEDGED`); bad++; }
  if (crossed < RUNS) { console.log(`  ${tag}: DID NOT REACH the coordinate in every run — that is not a pass`); bad++; }
}
console.log(bad ? '\nWALK FAILED' : '\nWALK PASSED — nothing held the player at (6, -50.45), both directions');
process.exit(bad ? 1 : 0);
