import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
const shot = async (name, fn, wait=380) => { await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `shots/fx-${name}.png` }); };
await page.evaluate(() => window.__ct.clock(13,0));
// SE wrapped kerb — from the side road looking north at the corner
await shot('se-kerb', () => window.__ct.warp(6, -101, Math.atan2(4,3.5), 0.14, -0.35));
// SE corner from intersection
await shot('se-corner', () => window.__ct.warp(2.5, -100.5, Math.atan2(4.5,3.5), 0.14, -0.4));
// SW corner (overlap gone)
await shot('sw-corner', () => window.__ct.warp(-2.5, -100.5, Math.atan2(-4.5,-4.5), 0.14, -0.45));
await shot('sw-down', () => window.__ct.warp(-6.6, -107, 0, 0.14, -1.0));
// exit-the-bodega landing: warp to landing spot, look around (should be open)
await shot('exit-fwd', () => window.__ct.warp(11, -97.3, Math.PI, 0.14, 0));
await shot('exit-look-back', () => window.__ct.warp(11, -97.3, 0, 0.14, 0.05));
await browser.close();
console.log('verify-fixes done');
