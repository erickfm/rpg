// The user's review frame, re-shot as they saw it: from the memorial end
// looking down the park, IN THE RAIN, which is when the paths collapsed onto
// the road. Plus a dry midday pass, because a tone that only works wet is not
// fixed.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1100, height: 640 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
const wetHour = await page.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  for (let h = 12; h < 200; h++) if (f(h) && (h % 24) > 11 && (h % 24) < 16) return h % 24;
  return 14;
});
const shot = async (n, h, x, z, yaw, pitch = 0.02) => {
  await page.evaluate(([h]) => window.__ct.clock(h, 30), [h]);
  await page.waitForTimeout(900);
  await page.evaluate(([x, z, yaw, p]) => window.__ct.warp(x, z, yaw, 0.14, p), [x, z, yaw, pitch]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/E-parkreview/${n}.png` });
};
// the user's viewpoint: near the memorial, looking south down the loop
await shot('a-down-the-park-wet', wetHour, -15.0, -71.5, -2.0, 0.03);
await shot('b-down-the-park-dry', 13, -15.0, -71.5, -2.0, 0.03);
await shot('c-path-against-the-road', 13, -8.6, -78.0, -1.9, 0.05);
await shot('d-the-wall-foot', 13, -22.0, -76.5, -1.3, 0.08);
await shot('e-the-loop-underfoot', 13, -13.3, -84.0, Math.PI, -0.25);
// what is grey and what is grass, across the whole floor
await shot('f-band-vs-field', 13, -17.0, -73.0, -1.6, -0.18);
await shot('g-band-at-the-back', 13, -34.0, -80.0, 1.4, -0.15);
// straight at the flank walls, where the user was looking
await shot('h-north-flank-base', 13, -22.0, -73.5, Math.PI, 0.03);
await shot('i-south-flank-base', 13, -22.0, -92.5, 0, 0.03);
console.log(`shot wet at ${wetHour}:30 and dry at 13:30`);
await b.close();
