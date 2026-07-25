// The bench the user photographed, and the fountain it was standing in.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 30));
const shot = async (n, x, z, yaw, p = 0.02) => {
  await page.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, 0.14, pi), [x, z, yaw, p]);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `shots/E-bench/${n}.png` });
};
await shot('a-bench-and-fountain', -14.6, -85.5, -0.9, 0.03);
await shot('b-bench-three-quarter', -14.2, -78.0, -1.1, 0.02);
await shot('c-bench-square-on', -14.6, -79.0, -Math.PI / 2, 0.01);
await b.close();
