import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(400);
const pos = () => page.evaluate(() => window.__ct.pos());
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(40); };
await page.evaluate(() => window.__ct.clock(13,0));
// Building-side lane past east trees at x5.4 (z=-2,-30,-58,-86). Start centered ~x6.1, north of z=-2, walk south past several trees.
await page.evaluate(() => window.__ct.warp(6.1, 4, 0, 0.14, 0));
await page.waitForTimeout(120);
let a = await pos();
await hold('w', 2600); // long walk south down the building-side lane
let b = await pos();
console.log('building-lane walk: z', a[2].toFixed(1), '->', b[2].toFixed(1), '=> moved', (a[2]-b[2]).toFixed(1), 'm south, final x', b[0].toFixed(2));
// screenshot standing among the trees
await page.evaluate(() => window.__ct.warp(6.15, -24, 0, 0.14, -0.1)); await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/wt-lane.png' });
await browser.close();
