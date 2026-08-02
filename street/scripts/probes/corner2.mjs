import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
const shot = async (name, fn, wait=380) => { await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `shots/c2-${name}.png` }); };
await page.evaluate(() => window.__ct.clock(13,0));
// stand in the intersection, look at the SE inside corner where walks meet
await shot('se-corner', () => window.__ct.warp(2.5, -100.5, Math.atan2(4.5,3.5), 0.14, -0.45));
// stand on the main walk near corner, look down at the junction tiles
await shot('se-junction', () => window.__ct.warp(6, -95.5, Math.atan2(1,-2.5), 0.14, -0.8));
// SW corner (west walk wrap vs south walk)
await shot('sw-corner', () => window.__ct.warp(-2.5, -100.5, Math.atan2(-4.5,-4.5), 0.14, -0.5));
await shot('sw-junction', () => window.__ct.warp(-6, -106, Math.atan2(-1,-2), 0.14, -0.85));
// walking the turn as a player would
await shot('turn-approach', () => window.__ct.warp(-1, -90, Math.PI, 0.14, -0.15));
await browser.close();
console.log('corner2 done');
