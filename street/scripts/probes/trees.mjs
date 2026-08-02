import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
const shot = async (name, fn, wait=380) => { await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `shots/tr-${name}.png` }); };
await page.evaluate(() => window.__ct.clock(13,0));
await shot('down-street', () => window.__ct.warp(-1, 6, Math.PI, 0.14, 0.08));   // several trees down the block
await shot('two-trees-w', () => window.__ct.warp(2, -25, -Math.PI/2, 0.14, 0.1));
await shot('two-trees-e', () => window.__ct.warp(-2, -35, Math.PI/2, 0.14, 0.1));
await shot('look-up', () => window.__ct.warp(5.0, -30, -Math.PI/2, 0.14, 0.55));
await browser.close();
console.log('trees done');
