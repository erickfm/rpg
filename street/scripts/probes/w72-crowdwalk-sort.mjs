// w72 / item 209, "does the pattern appear anywhere else" —
// `scripts/crowd-walk.mjs:76` IS THE PATTERN, over a subject that moves by
// definition, and it is a REGISTERED check (`scripts/checks.mjs:777`).
//
//   const moved = w0.filter((p, i) => Math.abs(p.z - (w1[i]?.z ?? p.z)) > 0.2).length;
//   check(moved >= 4, `they are walking — ${moved}/6 moved >0.2 m in 1.5 s`);
//
// `ct/crowd.ts:751` maps the `citizens` array in its own stable order, so the
// RAW index already is identity. `crowd-walk.mjs:64` then sorts the copy by
// `a.x - b.x || a.z - b.z` — by the coordinate that changes — and index N stops
// being the same person. The assertion is `moved >= 4`, so a mispair INFLATES
// the count: this fails GREEN, and a frozen crowd can certify as walking.
//
// This measures the reorder rate directly, by taking crowd-walk's own two
// samples 1500 ms apart and asking how many of the six people are at a
// different position in the sorted array the second time.
//
// Usage: SHOT_URL=http://localhost:4280/ node scripts/probes/w72-crowdwalk-sort.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4280/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(600);
await p.evaluate(() => window.__ct.clock(13, 0));

// crowd-walk's own two reads: the RAW cast order (stable identity) alongside the
// SORTED order the check actually compares.
const snap = () => p.evaluate(() => window.__ct.walkers().map((c, k) => ({ k, x: +c.x.toFixed(3), z: +c.z.toFixed(3) })));
const sortOf = (raw) => [...raw].sort((a, b2) => a.x - b2.x || a.z - b2.z).map((c) => c.k);

const TRIALS = +(process.argv[2] ?? 12);
let reordered = 0, honestTotal = 0, sortedTotal = 0, n = 0;
console.log('\ntrial  sorted order (cast index)     reordered?  moved BY CAST INDEX  moved AS crowd-walk COUNTS IT');
for (let t = 0; t < TRIALS; t++) {
  const r0 = await snap();
  const s0 = sortOf(r0);
  await p.waitForTimeout(1500);          // crowd-walk's own gap
  const r1 = await snap();
  const s1 = sortOf(r1);
  n = r0.length;
  // truth: pair by cast index, which IS the same person
  const honest = r0.filter((c) => Math.abs(c.z - r1[c.k].z) > 0.2).length;
  // what crowd-walk computes: pair by position in the sorted array
  const a0 = s0.map((k) => r0[k]), a1 = s1.map((k) => r1[k]);
  const asCounted = a0.filter((c, i) => Math.abs(c.z - (a1[i]?.z ?? c.z)) > 0.2).length;
  const same = s0.every((k, i) => k === s1[i]);
  if (!same) reordered++;
  honestTotal += honest; sortedTotal += asCounted;
  console.log(`  ${String(t + 1).padStart(2)}   ${s0.join(',')} -> ${s1.join(',')}`
    + `      ${same ? 'no ' : 'YES'}          ${honest}/${n}                    ${asCounted}/${n}`);
}
console.log(`\n${reordered}/${TRIALS} trials had the sorted order change under crowd-walk's own 1500 ms gap`);
console.log(`moved, summed over ${TRIALS} trials: ${honestTotal} by cast index (the truth),`
  + ` ${sortedTotal} as crowd-walk counts it`);
console.log(`crowd-walk asserts moved >= 4 of ${n}; a mispair can only ADD to that count.`);
// GOTCHAS 34: a probe that saw no people has established nothing.
if (!n) { console.log('MEASURED NOTHING — no walkers in __ct.walkers() — exit 3'); await b.close(); process.exit(3); }
await b.close();
