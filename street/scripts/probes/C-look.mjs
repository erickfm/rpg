// C's two areas, walked the way a player meets them: the car lot from the
// street, in through the gate, down the aisle to the office and back; then
// No. 227's entrance and room 301.
//
// This is the pass I had been redoing by hand every round with a throwaway
// script, which is how scripts/ got to 170 files. One named for its owner
// (GOTCHAS §24) and kept.
//
// It takes PICTURES and asserts nothing. The assertions live in lotwalk,
// lot-frontage and door301, which are in `npm run checks`. This is for the
// question those cannot answer — does it look right — and GOTCHAS §20 applies:
// an unread screenshot is not an observation.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/C-look.mjs [outdir]
import { chromium } from 'playwright';
import { setClock } from '../lib/clock.mjs';
import { mkdirSync } from 'node:fs';
import { reportWorld } from '../lib/which-world.mjs';
const OUT = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'shots/look';
mkdirSync(OUT, { recursive: true });
const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const at = (dx, dz) => Math.atan2(dx, -dz);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await setClock(p, 13, 0);   // waits for the frame that applies it, not a guess
for (const [n, x, z, yaw, pitch, gy] of [
  ['01-lot-from-street', -2.0,  2.6, at(9.0, 0.0),  0.06, 0.14],
  ['02-in-the-gate',      8.0,  2.6, at(14.0, 0.0), 0.00, 0.14],
  ['03-half-way',        16.0,  2.6, at(10.0, 0.0), 0.00, 0.14],
  ['04-at-the-office',   23.0,  2.6, at(4.0, 0.0),  0.04, 0.14],
  ['05-turn-around',     23.0,  2.6, at(-16.0, 0.0),0.02, 0.14],
  ['06-227-street',       4.6, -44.0, at(2.6, 0.0), 0.10, 0.14],
  ['07-301-room',       198.6, -16.4, at(-1.6, -0.8), 0.02, 5.4],
  ['08-price-front',    13.0,  4.4, at(1.3, 3.3),  0.02, 0.14],
  ['09-price-front2',   21.0, -1.4, at(1.1,-2.9),  0.02, 0.14],
]) {
  await p.evaluate(([a, b2, c, d, e]) => window.__ct.warp(a, b2, c, d, e), [x, z, yaw, gy, pitch]);
  await p.waitForTimeout(360);
  await p.screenshot({ path: `${OUT}/${n}.png` });
}
await b.close();
console.log(`C-look -> ${OUT} (9 stops)`);
