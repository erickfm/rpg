// ITEM 130 — WHAT IS ACTUALLY DROPPING, AND BY HOW MUCH?
//
// The user: *"i think just make all drops falls then we can work back from
// there."* Today `fp.ts:640` gates the step-off-fall on `heldByTop`, which is
// true only on a collider carrying a `maxY` — the pickup's five tops and the
// sedan's two, and nothing else in the world (`probes/w50-tops.mjs`). So EVERY
// terrain drop is still instant: kerbs, stoops, stairs, storey changes.
//
// Before removing that gate I want the shape of what it lets in. The desk's own
// note on the ruling flags the risk by name: *"a staircase is a sequence of
// small drops and could become a bouncing descent."* That is a question about
// the DISTRIBUTION of `groundPick` steps, not about any one kerb.
//
// This walks a grid over the whole world through `__ct.groundAt` — the same
// picker `fp.ts` calls every frame — and reports every adjacent-sample drop,
// bucketed. It is a CENSUS, not a walk: it says what a walker could meet, and
// `w101-descend-walk.mjs` is what actually walks the interesting ones.
//
// ⚠ `groundAt` NEVER RETURNS NULL (lib/floors.mjs's header): it names a height
// for every point in R², void included. So a "drop" here can be the edge of the
// world rather than a step in a floor. That is fine for a census — the walk is
// the instrument that can tell them apart — but it is why nothing below is
// phrased as a defect.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w101-drop-census.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4191/');
const STEP = Number(process.env.STEP ?? 0.25);

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.groundAt, null, { timeout: 60000 });

// The regions worth sampling, named. Interiors live on the slab strip at
// x = 400 + idx*80 (ct/interior.ts:44) so they are nowhere near the street and a
// single grid over both would be almost entirely empty.
const REGIONS = [
  ['street + side street', -40, 60, -110, 20],
  ['civic + park', 60, 200, -60, 40],
  ['walk-up + lot', 90, 220, -40, 40],
  ['interiors (slab strip)', 395, 1000, -20, 20],
];

const rows = [];
for (const [name, x0, x1, z0, z1] of REGIONS) {
  const r = await p.evaluate(([x0, x1, z0, z1, s]) => {
    const out = [];
    const G = (x, z) => window.__ct.groundAt(x, z);
    for (let z = z0; z <= z1; z += s) {
      let prev = G(x0, z);
      for (let x = x0 + s; x <= x1; x += s) {
        const h = G(x, z);
        if (prev - h > 0.02) out.push([+x.toFixed(2), +z.toFixed(2), +(prev - h).toFixed(3)]);
        prev = h;
      }
    }
    for (let x = x0; x <= x1; x += s) {
      let prev = G(x, z0);
      for (let z = z0 + s; z <= z1; z += s) {
        const h = G(x, z);
        if (prev - h > 0.02) out.push([+x.toFixed(2), +z.toFixed(2), +(prev - h).toFixed(3)]);
        prev = h;
      }
    }
    return out;
  }, [x0, x1, z0, z1, STEP]);
  rows.push([name, r]);
}

// Buckets chosen against the two numbers that matter: a kerb is 0.14 m
// (KERB_H) and a stair riser in this world is on the order of 0.15-0.20 m, so
// they are NOT separable by size. Anything that falls for one falls for both —
// which is the whole of the desk's stairs risk, and it is decided here rather
// than discovered later.
const BUCKETS = [0.02, 0.06, 0.10, 0.13, 0.15, 0.25, 0.40, 0.80, 1.6, Infinity];
const label = (i) => i === BUCKETS.length - 1 ? `>= ${BUCKETS[i - 1]}`
  : `${i ? BUCKETS[i - 1] : 0.02}..${BUCKETS[i]}`;

console.log(`grid ${STEP} m, drops > 0.02 m, sampled through __ct.groundAt\n`);
let grand = 0;
for (const [name, r] of rows) {
  const hist = new Array(BUCKETS.length).fill(0);
  for (const [, , d] of r) hist[BUCKETS.findIndex((b) => d < b)]++;
  grand += r.length;
  console.log(`${name}: ${r.length} drops`);
  for (let i = 0; i < BUCKETS.length; i++) {
    if (hist[i]) console.log(`   ${label(i).padStart(12)} m  ${String(hist[i]).padStart(6)}`);
  }
  const big = r.filter((e) => e[2] >= 0.40).sort((a, c) => c[2] - a[2]).slice(0, 6);
  for (const [x, z, d] of big) console.log(`      biggest: ${d} m at (${x}, ${z})`);
}
console.log(`\ntotal ${grand} adjacent-sample drops`);

// The two heights the ruling actually turns on, read out of the world rather
// than quoted from a comment.
const kerb = await p.evaluate(() => {
  const G = (x, z) => window.__ct.groundAt(x, z);
  const hs = new Set();
  for (let z = -40; z <= 0; z += 1) for (let x = -14; x <= 14; x += 0.25) hs.add(+G(x, z).toFixed(3));
  return [...hs].sort((a, b) => a - b);
});
console.log(`distinct street ground heights: ${kerb.join(' ')}`);
await b.close();
