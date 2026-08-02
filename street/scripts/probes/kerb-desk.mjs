// Desk view of the kerb: close, oblique, and down the line.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(600);
const shot = async (n, fn) => { await page.evaluate(fn); await page.waitForTimeout(340);
  await page.screenshot({ path: `shots/kd-${n}.png` }); };
// standing on the walk, looking down at the kerb edge right in front of you
await shot('down', () => window.__ct.warp(5.2, -30, -Math.PI / 2, 0, -0.85));
// oblique along the kerb line
await shot('along', () => window.__ct.warp(5.4, -26, Math.PI, 0, -0.45));
// from the road looking back at the kerb face
await shot('face', () => window.__ct.warp(3.4, -30, Math.PI / 2, 0, -0.30));
// the corner, where the two kerbs meet
await shot('corner', () => window.__ct.warp(2.0, -95, Math.atan2(3.5, 3.5), 0, -0.35));
await browser.close();
console.log('kerb shots done');
