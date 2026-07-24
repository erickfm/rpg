import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);
const shot = async (name, fn, wait=380) => { await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `shots/cn-${name}.png` }); };
await page.evaluate(() => window.__ct.clock(13,0));
// the SE inside corner (bodega side) — where you walk from main onto the side street
await shot('se-look-down', () => window.__ct.warp(6.2, -95, Math.atan2(3,-3), 0.14, -0.7));
await shot('se-ped', () => window.__ct.warp(4.5, -92, Math.atan2(4,-6), 0.14, -0.25));
// the exit landing spot — what you see stepping out of the bodega
await shot('exit-view', () => window.__ct.warp(11, -97.3, Math.PI, 0.14, 0));
// SW corner (west walk wraps) — suspected z-fight overlap
await shot('sw-look-down', () => window.__ct.warp(-5.5, -104, Math.atan2(-2,-4), 0.14, -0.75));
await shot('sw-ped', () => window.__ct.warp(-4.5, -100, Math.atan2(-3,-5), 0.14, -0.3));
// overview of the whole corner from above
await shot('overhead', () => window.__ct.warp(0, -96, Math.PI, 6, -1.3));
await browser.close();
console.log('corner done');
