// STAND IN THE FIELD AND LOOK AT THE GRASS. The desk: "code presence is NOT
// the test". Same station, four times of day, plus a readout of what the two
// mown greens and the desire-line dirt actually resolve to on screen.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
for (const [tag, h] of [['noon', 12], ['afternoon', 15], ['dusk', 19]]) {
  await page.evaluate(([h]) => window.__ct.clock(h, 30), [h]);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__ct.warp(-16.0, -80.0, -Math.PI / 2, 0.14, -0.10));
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `shots/E-field/${tag}.png` });
}
await b.close();
