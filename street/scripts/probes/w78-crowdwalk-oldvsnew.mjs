// Item 218, the acceptance question: "trial 47's class is judged correctly".
//
// w72 pinned one trial where `scripts/crowd-walk.mjs:76` produced a WRONG
// VERDICT rather than a wobble — sorted order `0,4,2,3,1,5 -> 0,4,2,3,5,1`,
// truth 2/6 and 3/6 across two runs, counted 4/6 against the leg's own
// `moved >= 4` bar. RED by the truth, GREEN as counted.
//
// A probe that goes looking for that one trial number is a route-based check
// and would only find the hole its author imagined. So this is a PROPERTY
// sweep instead: over a long horizon — past the ~60 s in which the crowd holds
// its six fixed home lanes and nothing reorders — take crowd-walk's own two
// samples and compute all three counts on every trial:
//
//   truth   pair by cast index                      (what is actually true)
//   OLD     pair by position in the sorted array    (what shipped)
//   NEW     pair on `k` through the intersection    (what this item lands)
//
// The property that must hold on EVERY trial is `NEW === truth`, and the
// interesting population is the trials where OLD !== truth — a run that never
// reorders has established nothing and says so.
//
// Usage: SHOT_URL=http://localhost:4340/ node scripts/probes/w78-crowdwalk-oldvsnew.mjs 90
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4340/');
const TRIALS = +(process.argv[2] ?? 90);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(400);
await p.evaluate(() => window.__ct.clock(13, 0));

// crowd-walk's own read, with `k` carried above the sort exactly as the fixed
// walkers() helper does it
const snap = () => p.evaluate(() => window.__ct.walkers()
  .map((c, k) => ({ k, x: +c.x.toFixed(3), z: +c.z.toFixed(3) }))
  .sort((a, c) => a.x - c.x || a.z - c.z));

// the NEW judgement, the shape crowd-walk.mjs now uses
const asNew = (a, c) => {
  const then = new Map(c.map((q) => [q.k, q]));
  const judged = a.filter((q) => then.has(q.k));
  return judged.filter((q) => Math.abs(q.z - then.get(q.k).z) > 0.2).length;
};
// the OLD judgement, verbatim from what shipped at :76
const asOld = (a, c) => a.filter((q, i) => Math.abs(q.z - (c[i]?.z ?? q.z)) > 0.2).length;
// the truth, independent of both: pair by cast index
const asTruth = (a, c) => {
  const then = new Map(c.map((q) => [q.k, q]));
  return a.filter((q) => Math.abs(q.z - then.get(q.k).z) > 0.2).length;
};

let reordered = 0, oldWrong = 0, newWrong = 0, flips = 0, n = 0;
const bad = [];
console.log('\ntrial  sorted order                        truth  OLD  NEW');
for (let t = 0; t < TRIALS; t++) {
  const s0 = await snap();
  await p.waitForTimeout(1500);              // crowd-walk's own gap
  const s1 = await snap();
  n = s0.length;
  const truth = asTruth(s0, s1), o = asOld(s0, s1), nw = asNew(s0, s1);
  const same = s0.map((q) => q.k).join() === s1.map((q) => q.k).join();
  if (!same) reordered++;
  if (o !== truth) oldWrong++;
  if (nw !== truth) { newWrong++; bad.push({ t: t + 1, truth, nw }); }
  // a VERDICT flip, not just a count wobble: red by the truth, green as counted
  const flip = truth < 4 && o >= 4;
  if (flip) flips++;
  if (!same || o !== truth || flip) {
    console.log(`  ${String(t + 1).padStart(3)}  ${s0.map((q) => q.k).join(',')} -> ${s1.map((q) => q.k).join(',')}`
      + `   ${truth}/${n}    ${o}/${n}  ${nw}/${n}`
      + `${o !== truth ? '   OLD DISAGREES' : ''}${flip ? '   <<< OLD FLIPS THE VERDICT GREEN' : ''}`);
  }
}
await b.close();

// GOTCHAS 34: a probe that measured nothing must FAIL, loudly, not pass quietly.
if (!n) { console.log('\nMEASURED NOTHING — no walkers — exit 3'); process.exit(3); }
console.log(`\n${TRIALS} trials, ${n} walkers:`);
console.log(`  sorted order reordered              ${reordered}/${TRIALS}`);
console.log(`  OLD count disagreed with the truth  ${oldWrong}/${TRIALS}`);
console.log(`  OLD flipped a RED verdict to GREEN  ${flips}/${TRIALS}`);
console.log(`  NEW count disagreed with the truth  ${newWrong}/${TRIALS}`);
// THE POPULATION FLOOR ON THIS PROBE'S OWN CLAIM. "NEW always agreed" is
// worthless over a stream that never reordered — that is the trap w72 named,
// where a 12-trial run reported 0/12 on a bug that fires ~19% of the time.
if (reordered < 3) {
  console.log(`\n  NOTHING TO PROVE AGAINST — only ${reordered} trial(s) reordered in ${TRIALS}.`);
  console.log('  The crowd holds fixed home lanes for ~60 s; sample longer. exit 3');
  process.exit(3);
}
if (newWrong) {
  console.log(`\n  NEW IS WRONG on ${newWrong} trial(s): `
    + bad.slice(0, 5).map((r) => `#${r.t} truth ${r.truth} got ${r.nw}`).join(', '));
  process.exit(1);
}
console.log(`\n  identity pairing agreed with the truth on all ${TRIALS} trials,`);
console.log(`  including the ${reordered} that reordered and the ${oldWrong} the old line got wrong.`);
