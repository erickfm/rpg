import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(p, process.env.SHOT_URL);   // GOTCHAS 26: prove it, do not just name it
for (const [n, h] of [['dusk', 19.5], ['night', 23]]) {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.evaluate(() => window.__ct.warp(-1, -30, Math.PI, 0, 0.05));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `shots/night-${n}.png` });
}
await b.close(); console.log('night shots done');
