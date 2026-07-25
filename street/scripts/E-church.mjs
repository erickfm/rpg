// Builder E: the church west front — buttresses, lancets, rose.
//
// D moved the church onto the main block, so it now stands on the EAST side
// with its facade on x = 7.0 looking west, the nave running z -86…-73 and the
// tower z -73…-68. Local x -> world z + (-86), so:
//   local 1.80 (south lancet) -> z -84.20
//   local 6.50 (the doorway)  -> z -79.50
//   local 11.20 (north lancet)-> z -74.80
// Buttress centre lines land at z -85.54, -82.86, -76.14, -73.46.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const OUT = process.env.OUT ?? 'shots/E-church';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.evaluate(() => window.__ct.clock(13, 20));
await page.waitForTimeout(400);

const E = Math.PI / 2;   // yaw for facing east, at the church front
const SHOTS = [
  // the angle the user reported it from: at the foot of it, looking up
  ['user-angle', 2.2, -79.5, E, 0.0, 0.55],
  ['user-angle-off', 2.2, -83.0, E - 0.22, 0.0, 0.52],
  // …and straight on, where a symmetric fault hides
  ['head-on', -4.6, -79.5, E, 0.0, 0.16],
  ['head-on-up', -4.6, -79.5, E, 0.0, 0.34],
  // the two lancets, each with the buttresses that used to cross it
  ['lancet-south', -1.0, -84.2, E, 0.0, 0.44],
  ['lancet-north', -1.0, -74.8, E, 0.0, 0.44],
  ['lancets-both', -3.0, -79.5, E, 0.0, 0.40],
  // the rose, which used to be an oval
  ['rose', -3.0, -79.5, E, 0.0, 0.58],
  // the stages, raked along the front from both ends
  ['stages-rake-n', 1.0, -71.0, 0.62, 0.0, 0.30],
  ['stages-rake-s', 1.0, -88.0, Math.PI - 0.62, 0.0, 0.30],
  ['stages-rake-close', 3.4, -75.0, 0.75, 0.0, 0.42],
  ['stages-top', 1.0, -73.0, 0.55, 0.0, 0.72],
  // the whole thing, from across the street and from down the block
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
