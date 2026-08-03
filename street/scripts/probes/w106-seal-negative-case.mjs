// CAN THE SEAL SCAN DETECT A SEAL AT ALL? — item 262, worker onehundredsix.
//
// w106-why-seal-legs-are-flaky.mjs reports `sealed = 0` three runs running, and
// **a zero from a check that has never been seen to go non-zero is worth
// nothing** — that is this project's most expensive recurring failure (a fence
// check that passed a world where the fence paid nothing; masonry.mjs printing
// "0 faces at the wrong density" while examining zero faces, GOTCHAS 79).
//
// So: plant a collider that spans the east walk at a stopped citizen's z, and
// require the SAME scan to report a seal. Then remove it and require the seal to
// go away. Both signs, on the real world.
//
// GOTCHAS 74: the mutation MUST be pushed onto `colliders()`, which is LIVE BY
// REFERENCE. `staticColliders()` returns a COPY and the push would land in an
// array nobody reads — the check would still pass and nothing would be tested.
// That is the exact trap this file exists to avoid falling into.
//
//   SHOT_URL=http://localhost:4620/ node scripts/probes/w106-seal-negative-case.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4620/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(async () => {
  const gy = await window.__ct.groundAt(6, -50);
  window.__ct.warp(6, -50, 0, gy, 0);
});
await waitPainted(p, { frames: 3 });

// The identical scan crowd-walk.mjs runs, factored so both legs use ONE copy of
// it — two hand-written copies is how a control ends up measuring a different
// thing from the subject.
const scan = async (plant) => p.evaluate(async (doPlant) => {
  const RAD = 0.36, STEP = 0.02;
  const cols = window.__ct.colliders();          // LIVE by reference — GOTCHAS 74
  let planted = null;
  if (doPlant) {
    // A wall right across the east walk at the z the citizen stands at.
    planted = { minX: 4.0, maxX: 8.0, minZ: -50.9, maxZ: -50.0 };
    cols.push(planted);
  }
  const gapAt = (x0, z) => {
    let best = 0, run = 0;
    const c2 = window.__ct.colliders();
    for (let x = Math.sign(x0) * 4.2, n = 0; n < 190; n++, x += Math.sign(x0) * STEP) {
      const blocked = c2.some((c) => x > c.minX - RAD && x < c.maxX + RAD
        && z > c.minZ - RAD && z < c.maxZ + RAD);
      if (blocked) run = 0; else { run += STEP; if (run > best) best = run; }
    }
    return best > 0 ? best + 2 * RAD : 0;
  };
  // Probe the exact coordinate the queue row names, plus wherever people are.
  const rowSpot = gapAt(6, -50.45);
  const w = window.__ct.walkers();
  const atPeople = w.filter((q) => Math.abs(q.x) >= 4).map((q) => +gapAt(q.x, q.z).toFixed(2));
  if (planted) {
    const i = window.__ct.colliders().indexOf(planted);
    if (i >= 0) window.__ct.colliders().splice(i, 1);
  }
  return { rowSpot: +rowSpot.toFixed(2), atPeople, pop: w.length };
}, plant);

const clean = await scan(false);
const mutated = await scan(true);
const restored = await scan(false);
await b.close();

console.log(`CLEAN     gap at the row's (6, -50.45): ${clean.rowSpot} m   at people: [${clean.atPeople}]`);
console.log(`MUTATED   gap at the row's (6, -50.45): ${mutated.rowSpot} m   at people: [${mutated.atPeople}]`);
console.log(`RESTORED  gap at the row's (6, -50.45): ${restored.rowSpot} m   at people: [${restored.atPeople}]`);

let bad = 0;
if (!(mutated.rowSpot === 0)) { console.log('SELFTEST FAILED: planted a wall across the walk and the scan still found a gap — the scan cannot see a seal, so its zeros mean nothing'); bad++; }
else console.log('selftest: caught it — a planted wall reads as a 0 m gap, so the scan CAN report a seal');
if (!(restored.rowSpot > 0.95)) { console.log('SELFTEST FAILED: the gap did not come back after removing the wall'); bad++; }
else console.log('selftest: and it recovers — removing the wall restores the gap, so the 0 was the wall and not a latch');
process.exit(bad ? 1 : 0);
