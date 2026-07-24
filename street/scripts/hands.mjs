import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);
// WATCH: look down
await page.evaluate(() => { window.__ct.clock(16,12); window.__ct.warp(-1.4, 5, 0, 0, -1.25); });
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/h-watch.png' });
// WALLET: level view, right-click to open
await page.evaluate(() => window.__ct.warp(-1.4, -20, Math.PI, 0, 0));
await page.waitForTimeout(200);
await page.mouse.move(640, 360);
await page.mouse.down({ button: 'right' });
await page.waitForTimeout(150);
await page.mouse.up({ button: 'right' });
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/h-wallet.png' });
await browser.close();
console.log('hands done');
