// Builder E: the church west front — buttresses, lancets, rose.
//
// The church is INLAID 2.6 m now, so the facade is at x = 9.6 and the
// churchyard is the notch between it and the street line at x = 7.0.
//
// D moved the church onto the main block, so it now stands on the EAST side
// with its facade on x = 7.0 looking west, the nave running z -86…-73 and the
// tower z -73…-68. Local x -> world z + (-86), so:
//   local 1.80 (south lancet) -> z -84.20
//   local 6.50 (the doorway)  -> z -79.50
//   local 11.20 (north lancet)-> z -74.80
// Buttress centre lines land at z -85.54, -82.86, -76.14, -73.46.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const OUT = process.env.OUT ?? 'shots/E-church';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

await reportWorld(page, URL);   // GOTCHAS 26
await page.evaluate(() => window.__ct.clock(13, 20));
await page.waitForTimeout(400);

const E = Math.PI / 2;   // yaw for facing east, at the church front
const SHOTS = [
  // the churchyard, which has to read as a churchyard and not as the library
  ['yard-from-street', 2.0, -79.5, E, 0.0, 0.12],
  ['yard-gate', 6.2, -79.5, E, 0.14, 0.06],
  ['yard-inside', 8.2, -79.5, E, 0.14, 0.10],
  ['yard-corner', 8.4, -84.0, E - 0.6, 0.14, -0.06],
  ['yard-back-out', 9.0, -79.5, -E, 0.55, -0.10],
  ['yard-flags', 8.2, -76.0, E - 0.4, 0.14, -0.5],
  ['yard-along', 7.6, -70.0, Math.PI - 0.12, 0.14, 0.04],
  ['depth-oblique', 1.0, -71.0, 0.62, 0.0, 0.20],
  // the facade, which must be UNCHANGED apart from standing further back
  ['user-angle', 4.8, -79.5, E, 0.0, 0.55],
  ['head-on', -4.6, -79.5, E, 0.0, 0.16],
  ['head-on-up', -4.6, -79.5, E, 0.0, 0.34],
  ['lancets-both', -3.0, -79.5, E, 0.0, 0.40],
  ['stages-rake-n', 1.0, -71.0, 0.62, 0.0, 0.30],
  ['from-across', -4.9, -79.5, E, 0.14, 0.30],
  ['down-the-block', -3.2, -58.0, Math.PI - 0.20, 0.0, 0.18],
  ['night', -4.6, -79.5, E, 0.0, 0.22],
];
for (const [name, x, z, yaw, gy, pitch] of SHOTS) {
  if (name === 'night') await page.evaluate(() => window.__ct.clock(21, 40));
  await page.evaluate(([x, z, yaw, gy, pitch]) => window.__ct.warp(x, z, yaw, gy, pitch), [x, z, yaw, gy, pitch]);
  await page.waitForTimeout(name === 'night' ? 700 : 260);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
console.log('shots ->', OUT);
await browser.close();

// SAY SO. This script takes pictures and asserts NOTHING, and three times
// today I read a silent run of one as a pass — that is how a shelter roof
// floated 0.20 m over its posts through two rebuilds and how the mowing sat
// at 11.4% contrast after being reported fixed. GOTCHAS 24: name a script
// for what it ASSERTS. This one asserts nothing, so it says so out loud.
console.log('LOOKS ONLY — asserts nothing. Open the shots in shots/ and judge them.');
