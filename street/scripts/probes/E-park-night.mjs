// The park at 22:30, after today's three changes. The relief, the mowing and
// the shelter all went in at 13:20 and none of them had been seen dark.
//
// §22 is why this exists as a routine rather than a look: `alphaTest` +
// `transparent` is skipped by `dimWorld`, and six of my materials had it once.
// `nightgrade.mjs` measures that; this shows what it looks like.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const URL = aim('http://localhost:4182/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 620 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(22, 30));
const shot = async (n, x, z, yaw, pitch = 0.0) => {
  await page.evaluate(([x, z, yaw, p]) => window.__ct.warp(x, z, yaw, 0.14, p), [x, z, yaw, pitch]);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `shots/E-park-night/${n}.png` });
};
await shot('a-gate', -8.6, -83.0, -Math.PI / 2, 0.02);
await shot('b-over-the-field', -14.0, -84.6, -Math.PI / 2, -0.03);
await shot('c-the-mound', -19.0, -84.6, -Math.PI / 2, -0.03);
await shot('d-the-shelter', -32.0, -83.0, -Math.PI / 2, 0.04);
console.log(errs.length ? `PAGE ERRORS: ${JSON.stringify(errs)}` : 'no page errors');
await b.close();

// SAY SO. This script takes pictures and asserts NOTHING, and three times
// today I read a silent run of one as a pass — that is how a shelter roof
// floated 0.20 m over its posts through two rebuilds and how the mowing sat
// at 11.4% contrast after being reported fixed. GOTCHAS 24: name a script
// for what it ASSERTS. This one asserts nothing, so it says so out loud.
console.log('LOOKS ONLY — asserts nothing. Open the shots in shots/ and judge them.');
