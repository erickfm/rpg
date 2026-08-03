// Item 218. `scripts/crowd-walk.mjs:76` pairs two crowd samples BY ARRAY INDEX
// after sorting them by a coordinate that moves. w72 measured the reorder rate
// at ~19% by sampling the SAME page over 60–90 consecutive trials.
//
// THAT IS NOT THE WINDOW THE CHECK ACTUALLY RUNS IN, and the difference decides
// how the fix must be shaped. crowd-walk takes `w0` about 2.4 s after the page
// loads and `w1` 1500 ms later — once, on a freshly loaded world. So the
// questions that matter are, over N INDEPENDENT PAGE LOADS in that first window:
//
//   (a) how often does the sorted order reorder (the false-GREEN exposure)?
//   (b) what is the honest `moved` count (the false-RED exposure against the
//       check's own `moved >= 4` bar)?
//
// Both are needed. A pairing fix that leaves the threshold alone is worthless if
// the threshold itself reddens on a healthy world, and loosening the threshold
// without measuring it is exactly what BUILDER-BRIEF §7 forbids.
//
// Usage: SHOT_URL=http://localhost:4340/ node scripts/probes/w78-crowdwalk-firstwindow.mjs 40
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4340/');
const LOADS = +(process.argv[2] ?? 20);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });

// exactly crowd-walk's shape, with the cast index kept alongside so the honest
// pairing and the sorted pairing can be computed from one read
const snap = () => p.evaluate(() => window.__ct.walkers()
  .map((c, k) => ({ k, x: +c.x.toFixed(3), z: +c.z.toFixed(3) })));
const sortOf = (raw) => [...raw].sort((a, c) => a.x - c.x || a.z - c.z).map((q) => q.k);

const rows = [];
for (let t = 0; t < LOADS; t++) {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
  await p.waitForTimeout(400);                       // crowd-walk.mjs:30
  await p.evaluate(() => window.__ct.clock(13, 0));  // crowd-walk.mjs:31
  const r0 = await snap();
  const s0 = sortOf(r0);
  await p.waitForTimeout(1500);                      // crowd-walk.mjs:73
  const r1 = await snap();
  const s1 = sortOf(r1);
  const honest = r0.filter((c) => Math.abs(c.z - r1[c.k].z) > 0.2).length;
  const a0 = s0.map((k) => r0[k]), a1 = s1.map((k) => r1[k]);
  const counted = a0.filter((c, i) => Math.abs(c.z - (a1[i]?.z ?? c.z)) > 0.2).length;
  const same = s0.every((k, i) => k === s1[i]);
  // how far each person actually got, so a threshold can be set against the
  // distribution rather than against a remembered number
  const dz = r0.map((c) => +Math.abs(c.z - r1[c.k].z).toFixed(3)).sort((a, c) => a - c);
  rows.push({ n: r0.length, honest, counted, same, dz });
  console.log(`  load ${String(t + 1).padStart(3)}   ${s0.join(',')} -> ${s1.join(',')}`
    + `   ${same ? 'stable ' : 'REORDER'}   honest ${honest}/${r0.length}`
    + `   counted ${counted}/${r0.length}   |dz| ${dz.join(' ')}`);
}

await b.close();

// GOTCHAS 34: a probe that saw no people has established nothing.
const n = rows[0]?.n ?? 0;
if (!rows.length || !n) { console.log('\nMEASURED NOTHING — exit 3'); process.exit(3); }

const reord = rows.filter((r) => !r.same).length;
const disagree = rows.filter((r) => r.honest !== r.counted).length;
const falseGreen = rows.filter((r) => r.honest < 4 && r.counted >= 4).length;
const redHonest = rows.filter((r) => r.honest < 4).length;
const redCounted = rows.filter((r) => r.counted < 4).length;
const hist = {};
for (const r of rows) hist[r.honest] = (hist[r.honest] ?? 0) + 1;
const all = rows.flatMap((r) => r.dz).sort((a, c) => a - c);
const q = (f) => all[Math.min(all.length - 1, Math.floor(f * all.length))];

console.log(`\n${LOADS} independent page loads, crowd-walk's own first window (${n} walkers each):`);
console.log(`  sorted order reordered inside the window   ${reord}/${LOADS}`);
console.log(`  honest and counted DISAGREE                ${disagree}/${LOADS}`);
console.log(`  FALSE GREEN (honest <4, counted >=4)       ${falseGreen}/${LOADS}`);
console.log(`  honest count below the check's bar of 4    ${redHonest}/${LOADS}   <-- false-RED exposure`);
console.log(`  counted below the bar (what ships today)   ${redCounted}/${LOADS}`);
console.log('  honest `moved` distribution: '
  + Object.keys(hist).sort((a, c) => a - c).map((k) => `${k}/${n}:${hist[k]}`).join('  '));
console.log(`  per-person |dz| over 1.5 s, ${all.length} samples:`
  + ` min ${q(0)}  p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}  max ${all[all.length - 1]}`);
