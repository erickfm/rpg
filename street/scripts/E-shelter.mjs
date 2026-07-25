// The shelter at the far end of the park: the roof, and the bench under it.
//
// Both were findings in `notes/E-civic-report.md` and both are about the same
// mistake — a thing built by hand instead of through the helper every other
// one goes through. The roof was pitched and drawn under a slab; the bench was
// a bench that never called `ctx.seat`.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));
const shot = async (n, x, z, yaw, pitch = 0.0) => {
  await page.evaluate(([x, z, yaw, p]) => window.__ct.warp(x, z, yaw, 0.14, p), [x, z, yaw, pitch]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/E-shelter/${n}.png` });
};
// the view that matters: down the park's axis from the gate, 26 m away
await shot('a-from-the-gate', -8.6, -83.0, -Math.PI / 2, 0.02);
await shot('b-half-way', -22.0, -83.0, -Math.PI / 2, 0.03);
await shot('c-standing-under-it', -35.9, -83.0, Math.PI / 2, 0.55);
// three-quarter, off the back leg: yaw = atan2(dx, -dz) in this world's
// convention, which is worth writing down — the first attempt at this shot
// guessed it and put the camera inside the boundary hedge.
await shot('d-three-quarter', -33.0, -79.4, Math.atan2(-2.9, 3.6), 0.05);
await b.close();
