// Builder E: look at the library courtyard from the angles that matter.
// Shots are for LOOKING (GOTCHAS §1) — walking is proved by E-walk.mjs.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4182/');
const OUT = process.env.OUT ?? 'shots/E-court';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

await reportWorld(page, URL);   // GOTCHAS 26
await page.evaluate(() => window.__ct.clock(13, 20));
await page.waitForTimeout(400);

// x, z, yaw, gy, pitch  — the library runs z -21…-5, facade now at x = -10.2
const SHOTS = [
  ['from-street', -5.6, -13.0, -Math.PI / 2, 0.14, -0.06],
  ['street-north', -5.9, 1.0, 0.06, 0.14, -0.03],
  ['street-south', -5.9, -26.0, Math.PI, 0.14, -0.03],
  ['road-wide', -3.2, -13.0, -Math.PI / 2, 0.0, 0.06],
  ['mouth', -6.6, -13.0, -Math.PI / 2, 0.14, 0.05],
  ['mouth-down', -7.1, -13.0, -Math.PI / 2, 0.14, -0.5],
  ['steps-profile', -8.1, -9.2, -Math.PI * 0.30, 0.14, -0.12],
  ['steps-profile2', -8.1, -16.8, -Math.PI * 0.70, 0.14, -0.12],
  ['inside-corner', -7.6, -6.4, -Math.PI * 0.75, 0.14, 0.0],
  ['bench-north', -8.6, -8.2, -Math.PI * 0.22, 0.14, -0.08],
  ['bench-south', -8.6, -17.8, Math.PI * 0.22, 0.14, -0.08],
  ['flank-up', -8.9, -19.0, Math.PI * 0.96, 0.14, 0.6],
  ['from-steps-out', -9.4, -13.0, Math.PI / 2, 0.99, -0.06],
  ['walk-lane', -6.2, -6.0, 0.0, 0.14, -0.02],
  ['paving', -8.4, -13.0, -Math.PI * 0.4, 0.14, -0.44],
  ['climb-foot', -8.2, -13.0, -Math.PI / 2, 0.19, -0.22],
  ['climb-mid', -9.3, -13.0, -Math.PI / 2, 0.63, -0.16],
  ['climb-top', -10.6, -13.0, -Math.PI / 2, 0.99, 0.04],
  ['climb-back', -10.9, -13.0, Math.PI / 2, 0.99, -0.14],
  ['night', -6.4, -13.0, -Math.PI / 2, 0.14, 0.02],
];
for (const [name, x, z, yaw, gy, pitch] of SHOTS) {
  await page.evaluate(([x, z, yaw, gy, pitch]) => window.__ct.warp(x, z, yaw, gy, pitch), [x, z, yaw, gy, pitch]);
  await page.waitForTimeout(260);
  if (name === 'night') await page.evaluate(() => window.__ct.clock(21, 40));
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
