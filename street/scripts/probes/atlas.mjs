import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
const urls = await page.evaluate(() => window.__ct.atlases());
await page.setContent(`<body style="margin:0;background:#556;display:flex;flex-wrap:wrap;gap:10px;padding:10px">` +
  urls.map((u,i)=>`<div style="background:#889"><div style="font:11px monospace;color:#fff;padding:2px">citizen ${i}</div><img src="${u}" style="width:560px;image-rendering:pixelated"></div>`).join('') + `</body>`);
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/atlas-all.png', fullPage: true });
await browser.close();
console.log('atlas done', urls.length);
