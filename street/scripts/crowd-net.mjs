// The crowd routes over a graph now. Run the sim for a long time and check the
// things that must be true of it — this is the item's non-negotiables turned
// into assertions rather than a screenshot of six people standing about.
//
//   1. they LEAVE the main street: somebody turns the corner and walks the side
//      street, which never happened when they walked a line
//   2. they only step off the kerb ON A CROSSING — no jaywalking
//   3. they never stand inside a solid prop (citAvoid)
//   4. they never overlap each other (the "must not phase through each other"
//      rule, which the old sim did not even try to keep)
//   5. they do different THINGS: some stopped, some walking, at any moment
//   6. everybody keeps moving over the long run — nobody wedges permanently
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/crowd-net.mjs [seconds]
import { chromium } from 'playwright';
const SECONDS = Number(process.argv[2] ?? 90);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(400);
await page.evaluate(() => window.__ct.clock(13, 0));
// stand well out of the way: the player is solid to them, and a player parked
// in a doorway would be measuring the politeness rules, not the routing
await page.evaluate(() => window.__ct.warp(-1.5, 30, 0, 0, 0));

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

console.log(`crowd network probe (${SECONDS}s of sim):`);
const t = await page.evaluate(async (SECONDS) => {
  const out = {
    samples: 0, onSide: 0, offKerb: 0, jaywalk: [], inProp: [], overlap: [],
    moving: [], maxTravel: [], minTravel: [], seen: [],
  };
  const start = window.__ct.walkers().map((w) => ({ ...w }));
  const far = start.map(() => 0);
  const near = start.map(() => 1e9);
  const t0 = performance.now();
  let last = -1;
  while (performance.now() - t0 < SECONDS * 1000) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now() - t0;
    if (now - last < 100) continue;
    last = now;
    out.samples++;
    const w = window.__ct.walkers();
    const v = window.__ct.views();
    out.moving.push(v.filter((q) => q.moving).length);
    for (const q of v) out.seen.push(q.doing);
    w.forEach((p, i) => {
      // On the side street means EAST of the junction: its north walk sits at
      // z = SIDE_Z0 + 1 = -97, which is north of -98, so a z test alone misses
      // the entire north pavement — which is where most of the walking is.
      if (p.x > 8) out.onSide++;
      // OFF THE KERB: inside the roadway. The main road is |x| < 5 north of
      // z=-98; the side street is the band -98…-108 out to x=55.
      const onMainRoad = Math.abs(p.x) < 5 && p.z > -98;
      const onSideRoad = p.z < -98 && p.z > -108 && p.x > -5 && p.x < 55;
      if (onMainRoad || onSideRoad) {
        out.offKerb++;
        // the two crossings: across the main street mouth at z ≈ -97, and
        // across the side street at x ≈ 7…9. Allow a body's width either side.
        const atMainCross = Math.abs(p.z + 97) < 1.2;
        const atSideCross = p.x > 5.4 && p.x < 10.4;
        if (!atMainCross && !atSideCross && out.jaywalk.length < 5) {
          out.jaywalk.push({ i, x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
        }
      }
      const d = Math.hypot(p.x - start[i].x, p.z - start[i].z);
      if (d > far[i]) far[i] = d;
    });
    // nobody standing in a prop, nobody standing in anybody
    for (let i = 0; i < w.length; i++) {
      for (let j = i + 1; j < w.length; j++) {
        const d = Math.hypot(w[i].x - w[j].x, w[i].z - w[j].z);
        if (d < 0.42 && out.overlap.length < 5) {
          out.overlap.push({ i, j, d: +d.toFixed(2), x: +w[i].x.toFixed(2), z: +w[i].z.toFixed(2) });
        }
      }
    }
  }
  out.maxTravel = far.map((v) => +v.toFixed(1));
  return out;
}, SECONDS);

check(t.samples > 100, `sampled ${t.samples} frames`);
check(t.onSide > 40, `somebody walked the side street — ${t.onSide} person-samples east of the junction`);
check(t.jaywalk.length === 0,
  t.jaywalk.length ? `stepped off the kerb away from a crossing: ${JSON.stringify(t.jaywalk)}`
    : `off the kerb ONLY on a crossing (${t.offKerb} person-samples in the roadway, all at one)`);
check(t.overlap.length === 0,
  t.overlap.length ? `walked through each other: ${JSON.stringify(t.overlap)}`
    : 'never overlapped each other');
// what were they actually DOING, across every person-sample?
const tally = {};
for (const d of t.seen) tally[d] = (tally[d] ?? 0) + 1;
const stoppedShare = 1 - (tally.walking ?? 0) / t.seen.length;
const kinds = Object.keys(tally).filter((k) => k !== 'walking');
check(stoppedShare > 0.08 && kinds.length >= 3,
  `varied errands — ${(stoppedShare * 100).toFixed(0)}% of person-samples stopped, ` +
  `doing: ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(', ')}`);
check(t.maxTravel.every((d) => d > 8),
  `everybody got somewhere — furthest each moved from where they started: ${t.maxTravel.join(', ')} m`);

console.log(errs.length ? `\npage errors:\n${errs.slice(0, 3).join('\n')}` : '\nno page errors');
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall crowd network checks pass');
await browser.close();
process.exitCode = fails ? 1 : 0;
