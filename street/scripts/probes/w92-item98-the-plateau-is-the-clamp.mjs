// Item 98 — the "two regimes" are one regime and a CLAMP.
//
// `notes/eightynine-item98-the-cap-is-not-looktolerance.md` concluded that below
// 4 m "the binding constraint is NOT lookTolerance … it is not even close to
// binding", from this comparison:
//
//     d      measured   lookTolerance(1.05, d)
//    1.50      16°           35.0°
//    2.00      15°           27.7°
//    3.00      15°           19.3°
//
// **That right-hand column is not what `lookTolerance` returns.** It is
// `atan2(r, d)` — line 781 of fp.ts, the local `raw` — retyped by hand. Line 816
// then does:
//
//     return Math.min(0.26, Math.max(0.20, raw));      // ~11.5° … ~15°
//
// 0.26 rad is **14.90°**. So the function can never return 35.0° or 27.7° for
// any r and d whatsoever, and the "plateau at ~15° where the predicate would
// allow 35" is the plateau sitting exactly ON the predicate's ceiling.
//
// BUILDER-BRIEF §8: "a second hand-typed copy of a number is the single most
// expensive habit in this codebase." This one cost the row a third release and
// inverted its premise.
//
// So this probe DERIVES the column instead of typing it: it imports fp.ts in the
// page and calls the real `lookTolerance`. That needs a DEV server — fp.ts
// cannot be imported at runtime off `vite preview` (it 404s), which is the
// standing trap in the builder brief.
//
//   SHOT_URL=http://localhost:4483/ node scripts/probes/w92-item98-the-plateau-is-the-clamp.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4483/';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

// The REAL function, out of the module the world uses. Not a copy of it.
const real = await p.evaluate(async () => {
  const m = await import('/src/proto/fp.ts');
  if (typeof m.lookTolerance !== 'function') return null;
  const deg = (x) => (x * 180) / Math.PI;
  const out = [];
  for (const d of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5]) {
    out.push({
      d,
      real: deg(m.lookTolerance(1.05, d)),
      raw: deg(Math.atan2(1.05, Math.max(0.35, d))),
    });
  }
  return { out, ceilDeg: deg(0.26), floorDeg: deg(0.20) };
});
await b.close();

if (!real) {
  console.error('fp.ts did not export lookTolerance through the page.');
  console.error('Are you pointing at a DEV server? A built preview 404s on /src/proto/fp.ts.');
  process.exit(3);
}

// eightynine's measured column, quoted from the note so the two are side by side.
// Copied WITH a citation because it is a historical measurement I cannot re-derive
// from source — which is the case §8 allows, unlike the tolerance column.
const MEASURED = { 0.5: 89, 1.0: 89, 1.5: 16, 2.0: 15, 2.5: 15, 3.0: 15, 3.5: 15, 4.0: 15, 4.5: 13, 5.0: 12, 5.5: 11 };

console.log(`fp.ts clamps lookTolerance to [${real.floorDeg.toFixed(2)}°, ${real.ceilDeg.toFixed(2)}°]  (line 816)\n`);
console.log('  d     measured   REAL lookTolerance   raw=atan2(r,d)   what the note compared against');
let clamped = 0, agree = 0;
for (const { d, real: rl, raw } of real.out) {
  const m = MEASURED[d];
  const isClamped = Math.abs(rl - real.ceilDeg) < 0.01 || Math.abs(rl - real.floorDeg) < 0.01;
  if (isClamped) clamped++;
  // "agrees" = the measured integer edge is within 1 degree of the real function
  if (Math.abs(m - rl) <= 1.0) agree++;
  console.log(`  ${d.toFixed(2)}   ${String(m).padStart(4)}°      ${rl.toFixed(2).padStart(6)}°${isClamped ? ' (CLAMPED)' : '         '}   ${raw.toFixed(2).padStart(6)}°          ${raw.toFixed(1)}°`);
}

// Tier 1 owns d = 0.5 and 1.0 (touching = d < r + TOUCH_MARGIN = 1.20), so the
// 89° rows are not the cone's business and are excluded.
const cone = real.out.filter(({ d }) => d >= 1.5);

// A THRESHOLD I PICK IS A NUMBER I INVENTED. Comparing the TWO CANDIDATE MODELS
// against the same measurements is not — whichever explains them is the one that
// binds, and no bar of mine decides it. The sweep reports the largest INTEGER
// degree still offered, so a residual under ~1 deg is the instrument's own
// resolution and cannot separate models; 19 deg is not.
const resid = (pick) => cone.map(({ d, ...r }) => Math.abs(MEASURED[d] - r[pick]));
const maxReal = Math.max(...resid('real'));
const maxRaw = Math.max(...resid('raw'));
const meanReal = resid('real').reduce((a, x) => a + x, 0) / cone.length;
const meanRaw = resid('raw').reduce((a, x) => a + x, 0) / cone.length;

console.log(`\n${clamped} of ${real.out.length} distances are CLAMPED — the function is pinned at its own ceiling.`);
console.log(`(d = 0.5 and 1.0 are tier 1: touching = d < r + TOUCH_MARGIN = 1.20 m, aim not consulted.)`);
console.log(`\nWHICH MODEL EXPLAINS THE MEASUREMENTS? Residual vs the ${cone.length} cone distances:`);
console.log(`  REAL lookTolerance (with the clamp)   mean ${meanReal.toFixed(2)}°   worst ${maxReal.toFixed(2)}°`);
console.log(`  raw = atan2(r, d)  (what the note used)  mean ${meanRaw.toFixed(2)}°   worst ${maxRaw.toFixed(2)}°`);

// The sweep's resolution is 1 deg, so anything at or under ~1.5 deg is a tie
// with the instrument. The two models are 15x apart, which is not a tie.
if (maxReal <= 1.5 && maxRaw > 5) {
  console.log('\nVERDICT: the "~15 deg plateau" IS lookTolerance, at its 14.90 deg ceiling.');
  console.log('  There are not two regimes. There is one predicate with a clamp on it, and');
  console.log('  the note\'s comparison column was `raw` from line 781 without line 816.');
  console.log('  lookTolerance IS the binding constraint below 4 m — the OPPOSITE of the');
  console.log('  note\'s conclusion, and the row was right about this all along.');
  console.log('  NOTE: this says what BOUNDS the cone. It does NOT endorse "cap the reach".');
} else {
  console.log('\nVERDICT: the real function does NOT explain the plateau. eightynine stands.');
}
// A population floor: an empty table would print "0 of 0" and read as agreement.
if (cone.length < 9) { console.log(`ONLY ${cone.length} CONE DISTANCES — expected 9. Nothing was measured.`); process.exit(3); }
process.exit(maxReal <= 1.5 && maxRaw > 5 ? 0 : 1);
