import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(800);
// straight side view
await page.evaluate(() => window.__ct.warp(-0.6, -34, -Math.PI / 2));
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/pu-side.png' });
// rear three-quarter
await page.evaluate(() => window.__ct.warp(-1.2, -37.5, Math.atan2(-2.7, -3.5)));
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/pu-rear.png' });
await browser.close();
console.log('done');
