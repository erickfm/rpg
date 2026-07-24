import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);
const shot = async (name, fn, wait=380) => { await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `shots/c3-${name}.png` }); };
await page.evaluate(() => window.__ct.clock(13,0));
// SE outside kerb corner, viewed from the intersection road looking back NE at the corner
await shot('se-outside', () => window.__ct.warp(5.5, -100, Math.atan2(2.5,3.0), 0.14, -0.55));
// stand ON the corner junction, look straight down
await shot('se-down', () => window.__ct.warp(6.6, -96.5, Math.PI, 0.14, -1.1));
// SW outside kerb corner from the road
await shot('sw-outside', () => window.__ct.warp(-5.5, -100, Math.atan2(-2.5,3.0), 0.14, -0.55));
// SW junction down
await shot('sw-down', () => window.__ct.warp(-6.6, -107, 0, 0.14, -1.1));
// wide: south end of main street, both corners in view, from up the street
await shot('both', () => window.__ct.warp(0, -88, Math.PI, 0.14, -0.35));
await browser.close();
console.log('c3 done');
