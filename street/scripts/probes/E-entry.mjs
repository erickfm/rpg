// The first thing a player sees, and the two objects nobody has looked at up
// close: the gate sequence, the fountain, the memorial.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = aim('http://localhost:4182/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 30));
const shot = async (n, x, z, yaw, p = 0.02) => {
  await page.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, 0.14, pi), [x, z, yaw, p]);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `shots/E-entry/${n}.png` });
};
await shot('a-approaching-the-gate', -5.2, -83.0, -Math.PI / 2, 0.04);
await shot('b-through-the-gate', -9.5, -83.0, -Math.PI / 2, 0.02);
await shot('c-the-fountain', -13.9, -87.2, Math.PI / 2, 0.0);
await shot('d-the-memorial', -13.4, -71.6, Math.PI / 2, 0.06);
await b.close();

// SAY SO. This script takes pictures and asserts NOTHING, and three times
// today I read a silent run of one as a pass — that is how a shelter roof
// floated 0.20 m over its posts through two rebuilds and how the mowing sat
// at 11.4% contrast after being reported fixed. GOTCHAS 24: name a script
// for what it ASSERTS. This one asserts nothing, so it says so out loud.
console.log('LOOKS ONLY — asserts nothing. Open the shots in shots/ and judge them.');
