// H: the bunching complaint, measured — "tons of people always get stuck at
// this cross walk. the walk logic should allow people to walk around things".
//
// `jam` is the sim's own progress-based stall counter (crowd.ts): it counts
// time a walker has failed to make headway, NOT time spent near somebody, which
// is the mistake that produced my withdrawn "29.8 s stall" figure.
//
// This is the BEFORE for moving the graph's crossing arms onto B's junction
// paint. Same probe re-run after will be the evidence for both rows.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const SECS = +(process.env.SECS ?? 180);
// the bodega-corner junction: both existing crossing arms and the kerbs either side
const BOX = { x0: -9, x1: 13, z0: -111, z1: -94 };
const inBox = (x, z) => x >= BOX.x0 && x <= BOX.x1 && z >= BOX.z0 && z <= BOX.z1;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers, null, { timeout: 60000 });
console.log(`measuring ${URL}  build ${await p.evaluate(() => document.body.innerText.match(/[0-9a-f]{9}/)?.[0] ?? '?')}`);
let ticks = 0, sampJ = 0, sampBox = 0, worstJam = 0, peak = 0, worstAt = null;
let sampW = 0, sampQ = 0, worstWait = 0, peakW = 0;
const byDoing = new Map();
const waitBins = new Map();
const stallBins = new Map();
const t0 = Date.now();
while (Date.now() - t0 < SECS * 1000) {
  const ws = await p.evaluate(() => window.__ct.walkers().map((q) => [q.x, q.z, q.jam, q.wait, q.doing]));
  ticks++;
  let here = 0, hereW = 0;
  for (const [x, z, jam, wait, doing] of ws) {
    if (!inBox(x, z)) continue;
    here++; sampBox++;
    // DO NOT skip wait>0 here. My first version did, as "parked on purpose",
    // and that excluded the exact population the user is describing: people
    // QUEUEING AT A KERB to cross look like people standing still. Counting
    // only jam reported 0 stalls in a junction he has complained about twice.
    if (wait > 0) {
      sampW++; hereW++;
      byDoing.set(doing, (byDoing.get(doing) ?? 0) + 1);
      // A WINDOW or DOOR pause is somebody shopping, not somebody stuck. Only
      // a pause with no activity attached is a walker held up by the crossing.
      if (doing === 'none' || doing == null) {
        sampQ++;
        const kw = `${Math.round(x / 2) * 2},${Math.round(z / 2) * 2}`;
        waitBins.set(kw, (waitBins.get(kw) ?? 0) + 1);
        if (wait > worstWait) worstWait = wait;
      }
    }
    if (jam > worstJam) { worstJam = jam; worstAt = [+x.toFixed(1), +z.toFixed(1)]; }
    if (jam >= 0.5) {
      sampJ++;
      const k = `${Math.round(x / 2) * 2},${Math.round(z / 2) * 2}`;
      stallBins.set(k, (stallBins.get(k) ?? 0) + 1);
    }
  }
  if (here > peak) peak = here;
  if (hereW > peakW) peakW = hereW;
  await p.waitForTimeout(150);
}
console.log(`\n  ${ticks} ticks over ${SECS} s, junction box x ${BOX.x0}..${BOX.x1}, z ${BOX.z0}..${BOX.z1}`);
console.log(`  walker-samples inside the junction:      ${sampBox}`);
console.log(`  of those, STALLED (jam >= 0.5 s):        ${sampJ}   (${(100 * sampJ / Math.max(sampBox, 1)).toFixed(1)}%)`);
console.log(`  worst single jam:                        ${worstJam.toFixed(2)} s${worstAt ? ` at (${worstAt})` : ''}`);
console.log(`  peak walkers in the junction at once:    ${peak}`);
console.log(`\n  STANDING (wait > 0) inside the junction: ${sampW}   (${(100 * sampW / Math.max(sampBox, 1)).toFixed(1)}%)`);
console.log(`   by activity: ${JSON.stringify(Object.fromEntries(byDoing))}`);
console.log(`  standing with NO activity (a real queue): ${sampQ}   (${(100 * sampQ / Math.max(sampBox, 1)).toFixed(1)}%)`);
console.log(`  longest such wait:                       ${worstWait.toFixed(2)} s`);
console.log(`  peak STANDING at once:                   ${peakW}`);
if (waitBins.size) {
  console.log('\n  where they stand (2 m bins, worst first):');
  for (const [k, n] of [...waitBins].sort((a, c) => c[1] - a[1]).slice(0, 8)) console.log(`     (${k})  ${n}`);
}
if (stallBins.size) {
  console.log('\n  where they stall (2 m bins, worst first):');
  for (const [k, n] of [...stallBins].sort((a, c) => c[1] - a[1]).slice(0, 8)) console.log(`     (${k})  ${n}`);
} else console.log('\n  nobody stalled in the junction.');
await b.close();
