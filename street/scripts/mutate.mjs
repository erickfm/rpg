// MUTATION-TEST MY OWN NEGATIVE RESULTS.
//
// 31865213 mutation-tested three checks and found two of them were not fine.
// That is the one form of validation this audit had not applied to itself, and
// it matters most for my NEGATIVE results — "0 stretches under 1.00 m", "0
// lightened", "no door ever blocked". A negative from a detector that cannot see
// the thing is indistinguishable from a negative from a clean world.
//
// Circularity was the first way I found a check could be vacuous; insensitivity
// is the second. This tests the second, by planting a defect in the LIVE SCENE
// and re-running the same arithmetic. Nothing under src/ is touched — the plant
// is an extra entry in the array the probe reads, which is exactly what a real
// obstruction would look like to it.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const run = await p.evaluate(async () => {
  const RAD = 0.36, S = 0.05;
  const key = (c) => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const snap = () => window.__ct.colliders()
    .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));
  const a = snap();
  await new Promise((r) => setTimeout(r, 1500));
  const seen = new Set(snap().map(key));
  const statics = a.filter((c) => seen.has(key(c)));

  // corridor.mjs's arithmetic, verbatim in shape
  const measure = (cols) => {
    const free = (x, z) => !cols.some((c) => x > c.minX - RAD && x < c.maxX + RAD && z > c.minZ - RAD && z < c.maxZ + RAD);
    const BANDS = [{ lo: -6.7, hi: -5.0, id: 'west' }, { lo: 5.0, hi: 6.7, id: 'east' }];
    let tight = 0, worst = 99, at = null;
    for (const W of BANDS) for (let v = 12; v >= -94; v -= 0.25) {
      let best = 0, run = 0;
      for (let c = W.lo; c <= W.hi; c += S) { run = free(c, v) ? run + S : 0; if (run > best) best = run; }
      const clear = +(best + 2 * RAD).toFixed(2);
      if (clear < worst) { worst = clear; at = `${W.id} z ${v.toFixed(2)}`; }
      if (clear < 1.0) tight++;
    }
    return { tight, worst, at };
  };

  const clean = measure(statics);
  // PLANT: a 0.50 x 0.50 post in the middle of the west walk — the exact shape I
  // once mistook a stopped citizen for. If the detector cannot see this, its
  // "0 stretches" means nothing.
  const post = { minX: -6.10, maxX: -5.60, minZ: -28.25, maxZ: -27.75 };
  const planted = measure([...statics, post]);
  // a second plant, deliberately harmless: off the walk, in the road
  const inRoad = { minX: -1.0, maxX: -0.5, minZ: -28.25, maxZ: -27.75 };
  const control = measure([...statics, inRoad]);
  return { nStatic: statics.length, clean, planted, control };
});
await b.close();

const f = (r) => `${String(r.tight).padStart(3)} tight · narrowest ${r.worst.toFixed(2)} m at ${r.at}`;
console.log(`${run.nStatic} static colliders\n`);
console.log(`  clean world                       ${f(run.clean)}`);
console.log(`  + 0.50×0.50 post mid-west-walk    ${f(run.planted)}`);
console.log(`  + 0.50×0.50 box out in the road   ${f(run.control)}`);

const caught = run.planted.tight > run.clean.tight || run.planted.worst < run.clean.worst;
const quiet = run.control.tight === run.clean.tight && run.control.worst === run.clean.worst;
console.log(`\n  detector SEES a mid-walk post:      ${caught ? 'YES' : '** NO — the negative result is worthless **'}`);
console.log(`  detector IGNORES a box in the road: ${quiet ? 'YES' : '** NO — it flags things off the walk **'}`);
console.log(`\n  ${caught && quiet ? 'PASS — "0 stretches under 1.00 m" is a measurement, not a blind spot.'
  : 'FAIL — do not trust the corridor result until this passes.'}`);
