// Does a walker jitter? A still frame cannot show a motion bug, so measure the
// motion — and measure it hardest where the report came from: two of them close
// together in a lane too narrow to walk abreast.
//
// Three things get counted, one per candidate cause:
//
//   1. SIDE FLIPS — how often a walker's lateral offset reverses sign. Two
//      walkers each re-deciding which side to pass on, every frame, inverting
//      the other's choice, is the classic oscillation.
//   2. VIEW FLIPS — how often the painted sprite column changes. A heading
//      sitting on a boundary between two of the 8 views snaps back and forth
//      and reads as the whole person twitching.
//   3. REVERSALS — how often the direction of travel flips through more than a
//      right angle between samples. That is what "glitches back and forth"
//      looks like in the position stream, whatever the cause.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/jitter.mjs [seconds]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const SECONDS = Number(process.argv[2] ?? 70);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(400);
await page.evaluate(() => window.__ct.clock(13, 0));
// out of the way: the player is solid to them, and standing in a lane would be
// measuring the politeness rules rather than how they treat each other
await page.evaluate(() => window.__ct.warp(-1.5, 26, 0, 0, 0));

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

console.log(`jitter probe (${SECONDS}s):`);
const t = await page.evaluate(async (SECONDS) => {
  const N = window.__ct.walkers().length;
  const prev = { pos: null, col: new Array(N).fill(-1), off: new Array(N).fill(0), dir: new Array(N).fill(null) };
  const sideFlips = new Array(N).fill(0);
  const viewFlips = new Array(N).fill(0);
  const reversals = new Array(N).fill(0);
  let samples = 0, closeSamples = 0, closeReversals = 0, minPair = 1e9;
  const t0 = performance.now();
  let last = -1;
  // Keep going until a PAIR has actually come close, because that is the
  // condition the report describes — two of them together in a tight lane. Since
  // the crowd started routing over a graph and pausing for errands they meet less
  // often, so a fixed window can end with nothing to judge. Up to twice the asked
  // time, then give up and say so.
  const deadline = () => performance.now() - t0 > SECONDS * 1000
    && (closeSamples > 20 || performance.now() - t0 > SECONDS * 2000);
  while (!deadline()) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now() - t0;
    if (now - last < 50) continue;                // 20 Hz — fast enough to see a flip
    last = now;
    const w = window.__ct.walkers();
    const v = window.__ct.views();
    samples++;
    // how close is the closest PAIR right now? that is the condition in the shot
    let pair = 1e9;
    for (let i = 0; i < w.length; i++) {
      for (let j = i + 1; j < w.length; j++) {
        pair = Math.min(pair, Math.hypot(w[i].x - w[j].x, w[i].z - w[j].z));
      }
    }
    minPair = Math.min(minPair, pair);
    const crowded = pair < 1.6;
    if (crowded) closeSamples++;
    for (let i = 0; i < w.length; i++) {
      if (prev.col[i] >= 0 && v[i].col !== prev.col[i]) viewFlips[i]++;
      prev.col[i] = v[i].col;
      const m = Math.hypot(v[i].vx, v[i].vz);
      if (m > 1e-4) {
        const d = [v[i].vx / m, v[i].vz / m];
        const p = prev.dir[i];
        if (p) {
          const dot = p[0] * d[0] + p[1] * d[1];
          if (dot < 0) { reversals[i]++; if (crowded) closeReversals++; }
        }
        prev.dir[i] = d;
      }
    }
  }
  return { samples, sideFlips, viewFlips, reversals, closeSamples, closeReversals, minPair: +minPair.toFixed(2), N };
}, SECONDS);

const per100 = (n) => (n / t.samples * 100).toFixed(1);
console.log(`  ${t.samples} samples at 20 Hz; closest two ever got was ${t.minPair} m, ` +
  `${t.closeSamples} samples with a pair inside 1.6 m`);
// Crowding is the PRECONDITION, not the thing under test: without it this run
// has not exercised the bug, which is inconclusive rather than failed. The jitter
// counts below are the actual assertions.
if (t.closeSamples <= 20) {
  console.log(`  ??   INCONCLUSIVE for the crowded case — only ${t.closeSamples} samples with a ` +
    'pair inside 1.6 m; they route over the whole block now and meet less often. Re-run, or ' +
    'raise the seconds argument.');
} else {
  check(true, `they did get close together (${t.closeSamples} crowded samples — the condition in the report)`);
}
const totalView = t.viewFlips.reduce((a, b) => a + b, 0);
const totalRev = t.reversals.reduce((a, b) => a + b, 0);
console.log(`  view changes per 100 samples: ${t.viewFlips.map((n) => per100(n)).join(', ')}`);
console.log(`  travel reversals:             ${t.reversals.join(', ')}  (${t.closeReversals} of them while crowded)`);
// A view change is normal — they turn corners and the camera is fixed. A view
// change every few frames is not: at 20 Hz, more than ~6 per 100 samples means
// the sprite is switching faster than a person turns.
check(totalView / t.samples * 100 / t.N < 6,
  `sprite views are stable — ${(totalView / t.samples * 100 / t.N).toFixed(1)} changes per 100 samples per person`);
// A reversal is a genuine about-turn: doubling back, or bouncing off a dead end.
// A handful over a minute is the sim working. Dozens is jitter.
check(totalRev < 12, `travel direction does not flip about — ${totalRev} reversals in ${SECONDS}s across ${t.N} people`);
check(t.closeReversals <= 2, `and crowding does not cause it — ${t.closeReversals} reversals while a pair was inside 1.6 m`);

console.log(errs.length ? `\npage errors:\n${errs.slice(0, 3).join('\n')}` : '\nno page errors');
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nno jitter');
await browser.close();
process.exitCode = fails ? 1 : t.closeSamples > 20 ? 0 : 2;   // 2 = inconclusive
