import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
// look down to raise the watch
await page.evaluate(() => { window.__ct.clock(16,12); window.__ct.warp(-1.4, 5, 0, 0, -1.25); });
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/watch-arm.png' });
await browser.close();
console.log('watch done');
