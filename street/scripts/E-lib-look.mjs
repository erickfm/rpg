// Looking at the room I just delivered, from inside, the way a player does.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));
// roomDims() returns EVERY room, not the one you name — it takes no argument.
// Passing 'library' to it and reading .cx off the array gave undefined, and the
// warp that followed took NaN and put the camera nowhere.
const r = (await page.evaluate(() => window.__ct.roomDims()))
  .find((q) => q.id === 'library');
console.log('room:', JSON.stringify(r));
const shot = async (n, x, z, yaw, pitch = 0) => {
  await page.evaluate(([x, z, yaw, p]) => window.__ct.warp(x, z, yaw, 0, p), [x, z, yaw, pitch]);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `shots/E-library/${n}.png` });
};
// stand at the back and look BACK at the front wall — where a window would be
await shot('e-front-wall-from-inside', r.cx, r.cz - r.d / 2 + 1.6, Math.PI, 0.04);
await shot('f-the-desk-and-catalogue', r.cx + 2.0, r.cz + r.d / 2 - 4.2, Math.PI, 0.02);
await b.close();
