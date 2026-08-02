// WHAT DOES A JUMP ACTUALLY GAIN YOU, ON THE WORST FRAME YOU CAN PRODUCE?
//
// fp.ts:446's comment says 0.571 m ("vy 4.0 against 14 m/s²"). That is the
// analytic apex of the continuous system; the world integrates semi-implicit
// Euler (`vy -= 14*dt` BEFORE `airY += vy*dt`, fp.ts:455-456), which loses
// about v·dt/2 of height every step and therefore gains LESS the slower the
// frame. Item 29's route is a staircase of hops, so the number that matters
// is not the comment and not the median — it is the worst frame a player can
// have.
//
// Measured, not derived: sampled with requestAnimationFrame INSIDE the page,
// so nothing is lost to a Playwright round trip, and repeated under CDP CPU
// throttling to manufacture slow frames on purpose.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w21-apex.mjs
import { chromium } from 'playwright';
const EYE = 1.62;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const cdp = await p.context().newCDPSession(p);
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// flat road beside the kerb, well clear of anything standable
await p.evaluate(() => window.__ct.warp(-2.0, -20.0, 0, 0, 0));
await p.waitForTimeout(600);

/** One jump, sampled every animation frame. Returns the apex above the
 *  settled floor and the longest frame seen while airborne — a jump is only
 *  as high as its slowest step. */
const oneJump = async () => {
  // ARM THE SAMPLER BEFORE THE KEY GOES DOWN. The first draft pressed space
  // and only then opened an `evaluate`, so the baseline `y0` was read one
  // round trip into the rise — and it reported 0.310 m for every jump at
  // every CPU throttle, a number with no variance at all, which is the tell
  // that it was measuring latency and not physics.
  await p.evaluate(() => {
    const w = (window.__w21 = { y0: window.__ct.camY(), peak: -1e9, worstDt: 0, done: false });
    let last = performance.now(); const t0 = last;
    const tick = () => {
      const now = performance.now();
      w.worstDt = Math.max(w.worstDt, now - last); last = now;
      const y = window.__ct.camY();
      if (y > w.peak) w.peak = y;
      if (now - t0 > 1600) { w.done = true; return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await p.keyboard.down(' ');
  await p.waitForTimeout(120);
  await p.keyboard.up(' ');
  await p.waitForFunction(() => window.__w21.done, { timeout: 8000 });
  const r = await p.evaluate(() => ({ rise: window.__w21.peak - window.__w21.y0, worstDt: window.__w21.worstDt }));
  await p.waitForTimeout(350);
  return r;
};

// The continuous apex, and what semi-implicit Euler actually delivers at a
// given step: `vy` is decremented BEFORE the position update (fp.ts:455-456),
// which costs about v0·dt/2 of height. main.ts:107 clamps `dt` at 0.05, so
// the WORST case is bounded — that clamp is why the measurements below barely
// move under CPU throttling, and it is what makes a worst-case margin a real
// guarantee rather than a hope.
const V0 = 4.0, G = 14, DT_CLAMP = 0.05;
const ANALYTIC = V0 * V0 / (2 * G);
const apexAt = (dt) => ANALYTIC - V0 * dt / 2;
console.log(`fp.ts:446's comment claims ${ANALYTIC.toFixed(3)} m — that is the CONTINUOUS apex.`);
console.log('semi-implicit Euler at a real step (main.ts:107 clamps dt at 0.05):');
for (const [what, dt] of [['dt 0.05 (the clamp: WORST possible)', DT_CLAMP],
  ['dt 1/60 (a 60 fps player)', 1 / 60], ['dt 1/144', 1 / 144]]) {
  console.log(`   ${what.padEnd(36)} ${apexAt(dt).toFixed(3)} m`);
}
console.log('\nnow measuring, in this world:\n');
const worstByRate = {};
for (const rate of [1, 2, 4, 8]) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await p.waitForTimeout(500);
  const runs = [];
  for (let i = 0; i < 8; i++) runs.push(await oneJump());
  const rises = runs.map((r) => r.rise).sort((a, c) => a - c);
  const dts = runs.map((r) => r.worstDt);
  worstByRate[rate] = rises[0];
  console.log(`cpu x${rate}:  apex min ${rises[0].toFixed(3)}  median ${rises[3].toFixed(3)}  max ${rises[rises.length - 1].toFixed(3)}`
    + `   (worst frame ${Math.max(...dts).toFixed(0)} ms)`);
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

// What each measured apex means for item 29's staircase. TOP_EPS (fp.ts:52)
// is 0.08: standTop credits you a surface once you are within that of it.
const EPS = 0.08;
const steps = [['pavement -> bed floor', 0.14, 0.50], ['bed floor -> bed rail', 0.50, 0.97],
  ['bed rail -> CAB ROOF', 0.97, 1.50], ['road -> bed floor', 0.0, 0.50]];
// Judge every hop against the CLAMP apex — the worst step the engine can
// ever take — not against the median and not against the comment.
const floorApex = apexAt(DT_CLAMP);
console.log(`\nmargin on each hop, against the worst-case apex ${floorApex.toFixed(3)} + TOP_EPS ${EPS} = ${(floorApex + EPS).toFixed(3)} m of reach:`);
for (const [name, from, to] of steps) {
  const m = (floorApex + EPS) - (to - from);
  console.log(`  ${name.padEnd(24)} needs ${(to - from).toFixed(3)} m   margin ${m >= 0 ? '+' : ''}${m.toFixed(3)} m${m < 0 ? '   IMPOSSIBLE' : m < 0.04 ? '   TIGHT' : ''}`);
}
console.log(`\n(void EYE ${EYE} — camY is measured against its own settled value, not against eye height)`);
await b.close();
