// IS "HAS EVER MOVED" REALLY THE SAME SET AS "IS A VEHICLE"?
//
// ct/crowd.ts gates giving ground on `movers` — boxes it has seen at two
// different positions. The whole safety argument for the backwards step rests on
// that set containing vehicles and nothing else: if a static box ever entered it
// a walker could start reversing away from a TREE, which is the failure mode the
// item names.
//
// crowd.ts cannot ask "is this a vehicle" — `citAvoid` is one flat list of AABBs
// and since item 198 it is most of the world's static geometry. But `crosstown.ts`
// tags actor boxes, and `__ct.citAvoid()` publishes that flag. So this checks the
// heuristic against the ground truth it deliberately does not use.
//
// BOTH SIGNS, because a set that is empty would also report "no static box ever
// moved":
//   · every box that moved MUST be actor-tagged           (no false positives)
//   · at least one actor box MUST actually move           (the set is not empty)
//
//   SHOT_URL=http://localhost:4520/ SECONDS=45 node scripts/probes/w96-movers-are-vehicles.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const SECONDS = Number(process.env.SECONDS ?? 45);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.citAvoid !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(600);

// keep traffic flowing so vehicles actually drive during the window
await p.evaluate(() => window.__ct.drive('NE', 'car', 0));

let prev = await p.evaluate(() => window.__ct.citAvoid());
const movedIdx = new Set();
const t0 = Date.now();
let samples = 0;
while (Date.now() - t0 < SECONDS * 1000) {
  await p.waitForTimeout(100);
  const now = await p.evaluate(() => window.__ct.citAvoid());
  samples++;
  const n = Math.min(prev.length, now.length);
  for (let i = 0; i < n; i++) {
    if (prev[i].minX !== now[i].minX || prev[i].minZ !== now[i].minZ) movedIdx.add(i);
  }
  prev = now;
}

const total = prev.length;
const actors = prev.filter((b) => b.actor).length;
const moved = [...movedIdx];
const falsePos = moved.filter((i) => !prev[i].actor);
console.log(`${total} boxes in citAvoid (${actors} actor-tagged), ${samples} samples over ${SECONDS}s`);
console.log(`boxes that MOVED at least once: ${moved.length}`);
console.log(`  of those, NOT actor-tagged (would be a false positive): ${falsePos.length}`);
if (falsePos.length) {
  for (const i of falsePos.slice(0, 8)) {
    console.log(`    idx ${i}  x ${prev[i].minX.toFixed(2)}..${prev[i].maxX.toFixed(2)}  `
      + `z ${prev[i].minZ.toFixed(2)}..${prev[i].maxZ.toFixed(2)}`);
  }
}
const ok = falsePos.length === 0 && moved.length > 0;
console.log(ok
  ? `\nPASS — "has ever moved" selected ${moved.length} box(es), all of them vehicles.`
  : falsePos.length
    ? '\nFAIL — a STATIC box moved; the gate would let a walker back away from scenery.'
    : '\nFAIL (vacuous) — nothing moved at all, so this run proved nothing.');
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
await b.close();
process.exit(ok ? 0 : 1);
