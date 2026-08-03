// WHERE CAN A VEHICLE BOX ACTUALLY REACH? — item 207, before any steering change
//
// The pin cannot happen where a car cannot go. Citizens walk at |x| 6.05-6.39
// (ct/crowd.ts:275, lane = ±(ROAD_HALF + 1.05 + (i%3)*0.17)) and the road is
// |x| < 5. If a vehicle's box never crosses the kerb then a walker ON THE WALK
// can never be pinned by one, and the only place the user's screenshot can be
// is a CROSSING.
//
// So: sweep the taxi along its route, record the box it writes each time, and
// report the extreme |x| any vehicle box reaches. Observation only — nothing is
// mutated except the taxi's own route position, through the published
// `__ct.drive()`.
//
//   SHOT_URL=http://localhost:4520/ node scripts/probes/w96-where-can-a-car-reach.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

for (const which of ['taxi', 'car', 'bus']) {
  const rows = await p.evaluate(async (w) => {
    const out = [];
    for (let s = 0; s < 140; s += 2) {
      window.__ct.drive('NE', w, s);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const t = window.__ct.traffic()[0];
      const box = window.__ct.citAvoid().filter((b) => b.actor && b.minX < 900)[0];
      if (t && box) out.push({ s, x: +t.x.toFixed(2), z: +t.z.toFixed(2),
        minX: +box.minX.toFixed(2), maxX: +box.maxX.toFixed(2),
        minZ: +box.minZ.toFixed(2), maxZ: +box.maxZ.toFixed(2) });
    }
    return out;
  }, which);
  if (!rows.length) { console.log(`${which}: NO SAMPLES`); continue; }
  const outer = Math.max(...rows.map((r) => Math.max(Math.abs(r.minX), Math.abs(r.maxX))));
  const widest = Math.max(...rows.map((r) => r.maxX - r.minX));
  console.log(`${which.padEnd(5)} ${rows.length} route samples  `
    + `| body x from ${Math.min(...rows.map((r) => r.x)).toFixed(2)} to ${Math.max(...rows.map((r) => r.x)).toFixed(2)}  `
    + `| box reaches |x| = ${outer.toFixed(2)}  | widest box ${widest.toFixed(2)} m`);
}

const geo = await p.evaluate(() => ({
  walkers: window.__ct.walkers().map((w) => +w.x.toFixed(2)),
}));
console.log(`\nwalker x right now: ${geo.walkers.join(', ')}`);
console.log('road is |x| < 5.0 (ROAD_HALF); the walk is |x| 5.0-7.0');
console.log('\n=> a box reaching |x| < 5.0 CANNOT touch a walker on the walk.');
console.log('   The only place a vehicle can pin a citizen is IN THE ROAD — a crossing.');
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n${errs.slice(0, 4).join('\n')}`);
await b.close();
