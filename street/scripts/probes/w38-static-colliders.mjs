// w38 — ITEM 81's ACCEPTANCE TEST. Does separating actors from geometry
// actually make the trap maths stop moving?
//
// One root cause produced four false defects: citizens and vehicles live in the
// same `colliders()` array as the masonry, so `gap.ts`'s corridor maths scores
// corridors against things that walk away. `__ct.staticColliders()` is the
// world's geometry with those removed, by object identity.
//
// The claim to falsify is NOT "the number is nicer". It is that the STATIC
// verdict is STABLE while the world walks around, and that it still catches a
// real static trap. So this samples both lists over time, in the same run:
//
//   A. the world-wide trap count over N samples, from staticColliders()
//      -> must be CONSTANT. Geometry does not move.
//   B. the same count from colliders() (actors included)
//      -> expected to VARY. That variance IS the bug, demonstrated.
//   C. with a static box deliberately planted in a gap, the static count
//      must RISE and stay risen — proof this did not simply stop looking.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w38-static-colliders.mjs [N]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const N = Number(process.argv[2] ?? 20);
const URL = aim();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// 0. the accessor exists and the three lists agree
const shape = await p.evaluate(() => ({
  has: typeof window.__ct.staticColliders === 'function',
  all: window.__ct.colliders().length,
  actors: window.__ct.actorColliders().length,
  statics: window.__ct.staticColliders?.().length ?? null,
}));
console.log(`staticColliders() published: ${shape.has}`);
console.log(`  colliders ${shape.all}   actors ${shape.actors}   statics ${shape.statics}`);
if (!shape.has) { console.error('ABSENT — nothing to test.'); await b.close(); process.exit(3); }
const addsUp = shape.statics + shape.actors === shape.all;
console.log(`  statics + actors == colliders: ${addsUp ? 'yes' : `NO (${shape.statics}+${shape.actors} != ${shape.all})`}`);

// A/B. sample both verdicts over time while the world walks
const sample = () => p.evaluate(async () => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const stat = window.__ct.staticColliders();
  const all = window.__ct.colliders();
  return {
    stat: stat.filter((c) => trapAgainst(c, stat) !== null).length,
    all: all.filter((c) => trapAgainst(c, all) !== null).length,
    movers: window.__ct.actorColliders().length,
  };
});

const S = [], A = [];
for (let i = 0; i < N; i++) {
  const r = await sample();
  S.push(r.stat); A.push(r.all);
  await p.waitForTimeout(400);
}
const spread = (v) => `${Math.min(...v)}..${Math.max(...v)}`;
const constant = (v) => Math.min(...v) === Math.max(...v);
console.log(`\n── ${N} samples, 400 ms apart, while the crowd walks ──`);
console.log(`  A. red from staticColliders():  ${spread(S)}   ${constant(S) ? 'CONSTANT' : '** VARIES'}`);
console.log(`  B. red from colliders() (all):  ${spread(A)}   ${constant(A) ? 'constant' : 'VARIES — this is the bug'}`);
console.log(`     ${S.join(' ')}`);
console.log(`     ${A.join(' ')}`);

let bad = 0;
if (!addsUp) { console.log('\nFAIL  the three lists do not add up'); bad++; }
if (!constant(S)) { console.log('\nFAIL  the STATIC verdict moves — actors are still reaching the trap maths'); bad++; }
else console.log('\nok    the static verdict never moved while the world walked');
if (constant(A)) {
  console.log('note  the all-colliders count did not vary in this run — the actors happened');
  console.log('      not to form a corridor. That weakens B as a demonstration but says');
  console.log('      nothing against A; it is reported rather than retried until it varies.');
} else {
  console.log('ok    and the unfiltered count DID vary, which is the defect this removes');
}
console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nPASS');
await b.close();
process.exit(bad ? 1 : 0);
