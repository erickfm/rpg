// Builder E: the park. Site is x -14…-7, z -98…-68; gate opening z -87.2…-78.8.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('shots/E-park', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 950, height: 700 } });
p.on('pageerror', (e) => console.error('PAGEERR', e.message));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4188/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 20));
const W = -Math.PI / 2;
for (const [n, x, z, yaw, gy, pitch] of [
  ['from-the-road', -3.0, -83.0, W, 0.0, 0.02],
  ['at-the-gate', -6.4, -83.0, W, 0.14, -0.04],
  ['inside-looking-back', -11.5, -83.0, Math.PI / 2, 0.14, 0.0],
  ['inside-north', -11.8, -90.0, Math.PI, 0.14, -0.02],
  ['inside-south', -11.8, -76.0, 0.0, 0.14, -0.02],
  ['the-paths', -9.5, -83.0, W - 0.5, 0.14, -0.45],
  ['along-the-walk', -6.1, -66.0, 0.02, 0.14, -0.02],
  ['fence-oblique', -5.8, -92.0, Math.PI - 0.5, 0.14, 0.0],
  ['night', -10.5, -83.0, W, 0.14, 0.0],
]) {
  if (n === 'night') await p.evaluate(() => window.__ct.clock(21, 40));
  await p.evaluate(([x, z, yaw, gy, pitch]) => window.__ct.warp(x, z, yaw, gy, pitch), [x, z, yaw, gy, pitch]);
  await p.waitForTimeout(n === 'night' ? 700 : 280);
  await p.screenshot({ path: `shots/E-park/${n}.png` });
}
await b.close();
console.log('shots -> shots/E-park');

// SAY SO. This script takes pictures and asserts NOTHING, and three times
// today I read a silent run of one as a pass — that is how a shelter roof
// floated 0.20 m over its posts through two rebuilds and how the mowing sat
// at 11.4% contrast after being reported fixed. GOTCHAS 24: name a script
// for what it ASSERTS. This one asserts nothing, so it says so out loud.
console.log('LOOKS ONLY — asserts nothing. Open the shots in shots/ and judge them.');
