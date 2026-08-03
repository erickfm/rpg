// DOES `ghosts.mjs` MEASURE THE STREET, OR MEASURE IT FROM INSIDE A FLAT?
//
// GOTCHAS 79b: the player spawns in apartment 301 at x = 198, which is 98 m past
// the region-cull boundary, so every probe that reads the world without warping
// first reads it with the whole exterior hidden. `masonry.mjs` and
// `side-walk.mjs` both shipped that bug; the second one reported "3 parked cars,
// 0 found" with all three in plain view.
//
// Item 258 asks for `ghosts.mjs` to be put in a tier. Registering a check that
// measures nothing is worse than leaving it unregistered, so this asks the
// question BEFORE the registration rather than after: does its collider census
// give the same answer from the spawn point and from the middle of the street?
//
// It should, because `__ct.colliders()` is an AUTHORING read and the cull is a
// RENDERING fact — but that is the reasoning that was wrong twice already, so it
// is measured instead. The census below is ghosts.mjs's own snapshot filter,
// quoted from ghosts.mjs:129-131 rather than reinvented.
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/probes/w104-ghosts-sees-the-street.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage();
const URL = aim('http://localhost:4187/');
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
console.log(`measuring ${URL}`);
await p.waitForTimeout(800);

// ⚠ THE FIRST VERSION OF THIS PROBE WAS THE LIAR, AND THE CONTROL IS WHAT
// CAUGHT IT — kept here because it is the finding, not a mistake to hide.
//
// It compared raw `colliders()` counts and reported the cull, loudly:
//
//     at spawn      257 · on the street 258 · back at spawn 259
//     FAIL the census MOVES with the player
//
// That is not the cull. It is MONOTONIC — the third reading is 259, not the 257
// it would have to be if position were the cause — so it is traffic and citizens
// registering as they spawn in, which is GOTCHAS 73 (a collider that walks is
// not furniture) arriving in a new place. A probe with only two samples would
// have shipped "ghosts.mjs is culled" as a finding.
//
// So the question is asked of the STATIC set, which is the authoring fact both
// this probe and ghosts.mjs actually care about, and the raw count is printed
// alongside it purely so the drift stays visible.
// …AND THE SECOND VERSION WAS STILL TOO BROAD, WHICH IS THE OTHER HALF OF THE
// LESSON. Asked of the whole `|x| < 500` static set it reported a stable ±1,
// 5 round trips out of 5 — 253 in the flat, 252 on the street — and called that
// the cull. It is not. `w104-which-collider-moves.mjs` names the three boxes:
//
//     only in the flat    1.20 × 3.60 m at (200.60, -8.60)   ← apartment 301's own
//     only in the flat    0.27 × 0.35 m at (202.14, -17.31)  ┐ one 0.27 m box
//     only on the street  0.27 × 0.34 m at (200.25, -15.69)  ┘ that MOVED
//
// All three are at x ≈ 200, inside the apartment block. NONE is in either
// corridor band. So the honest question is not "does any collider anywhere
// differ" — the interiors register on entry and always will — it is **does
// anything ghosts.mjs MEASURES differ**, and that is asked of the two pavement
// lanes it actually sweeps. A guard aimed wider than its subject is the park
// lantern measured against asphalt.
const CORRIDOR = 'x within -6.7…-5.0 or 5.0…6.7, z -94…12';
const census = () => p.evaluate(() => {
  const keep = (c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500;   // ghosts.mjs:130
  // ghosts.mjs:156 — the two pavement lanes the corridor sweep walks.
  const inCorridor = (c) => ((c.minX < -5.0 && c.maxX > -6.7) || (c.minX < 6.7 && c.maxX > 5.0))
    && c.minZ < 12 && c.maxZ > -94;
  const stat = window.__ct.staticColliders().filter(keep);
  const [x, , z] = window.__ct.pos();
  return {
    all: window.__ct.colliders().filter(keep).length,
    statics: stat.length,
    corridor: stat.filter(inCorridor)
      .map((c) => `${c.minX.toFixed(2)},${c.maxX.toFixed(2)},${c.minZ.toFixed(2)},${c.maxZ.toFixed(2)}`)
      .sort().join('|'),
    nCorridor: stat.filter(inCorridor).length,
    at: [+x.toFixed(2), +z.toFixed(2)],
  };
});

const line = (label, c) => console.log(`  ${label.padEnd(15)} (${String(c.at).padEnd(12)})  `
  + `${String(c.nCorridor).padStart(3)} in the corridor   ${String(c.statics).padStart(3)} static   ${String(c.all).padStart(3)} incl. actors`);

// FIVE ROUND TRIPS, and the spread reported rather than one reading believed.
const runs = [];
for (let i = 0; i < 5; i++) {
  await p.evaluate(() => window.__ct.warp(198, 0, 0, 8, 0));       // apartment 301, past the cull
  await p.waitForTimeout(900);
  const spawn = await census();
  await p.evaluate(() => window.__ct.warp(0, -40, 0, 0, 0));       // mid-street, inside REGION_X
  await p.waitForTimeout(900);
  const street = await census();
  runs.push({ spawn, street });
  if (i === 0) { line('in apt 301', spawn); line('on the street', street); }
}
await b.close();

const spread = (xs) => (Math.min(...xs) === Math.max(...xs) ? `${xs[0]}` : `${Math.min(...xs)}–${Math.max(...xs)}`);
const corridorFlat = runs.map((r) => r.spawn.nCorridor), corridorStreet = runs.map((r) => r.street.nCorridor);
console.log(`\n  5 round trips — IN THE CORRIDOR (${CORRIDOR}):`);
console.log(`                  from the flat ${spread(corridorFlat)}, from the street ${spread(corridorStreet)}`);
console.log(`                  whole static set: ${spread(runs.map((r) => r.spawn.statics))} / ${spread(runs.map((r) => r.street.statics))}`
  + `   — the ±1 is apartment 301's own furniture, see w104-which-collider-moves.mjs`);
console.log(`                  incl. actors:     ${spread(runs.map((r) => r.spawn.all))} / ${spread(runs.map((r) => r.street.all))}`
  + '   — this one drifts, and should');

const bad = [];
// THE ACTUAL QUESTION: are the corridor boxes the SAME BOXES, not merely the
// same number of them. A count can agree while the set has swapped a kerb for a
// bench, which is exactly the kind of agreement that reads as proof and is not.
const disagreed = runs.filter((r) => r.spawn.corridor !== r.street.corridor).length;
if (disagreed) {
  bad.push(`the corridor's static set differs between the flat and the street on ${disagreed} of 5 round trips.`
    + ' ghosts.mjs never warps, so it would be measuring the street from inside apartment 301 (GOTCHAS 79b).');
}
// POPULATION FLOOR, BOTH SIDES. "0 === 0" is the shape of every vacuous pass in
// this repo, and an agreement between two empty censuses is the loudest one.
if (Math.min(...corridorStreet) < 10) bad.push(`only ${Math.min(...corridorStreet)} static colliders in the corridor from the street — the census is empty, so agreement proves nothing`);
if (Math.min(...corridorFlat) < 10) bad.push(`only ${Math.min(...corridorFlat)} static colliders in the corridor from the flat — the census is empty, so agreement proves nothing`);

console.log(bad.length ? '' : '\nthe corridor ghosts.mjs measures is IDENTICAL from both positions, box for box.'
  + '\ncolliders() is an authoring read and the region cull is a rendering fact, so'
  + '\nghosts.mjs reads the same street from the spawn point. Safe to register.');
for (const m of bad) console.log(`  FAIL  ${m}`);
process.exit(bad.length ? 1 : 0);
