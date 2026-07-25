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
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(60); };

// 1) Trigger the real exit from inside the bodega, via E on the door spot
await page.evaluate(() => window.__ct.warp(240.5, -17, Math.PI/2, 0, 0));
await page.waitForTimeout(120);
await hold('e', 120);
let p = await pos();
console.log('after exit E -> pos', p.map(n=>+n.toFixed(2)));

// 2) From the landing, try to walk each direction; record net displacement
for (const k of ['w','s','a','d']) {
  const before = await pos();
  await hold(k, 500);
  const after = await pos();
  const d = Math.hypot(after[0]-before[0], after[2]-before[2]);
  console.log(`hold ${k} 0.5s -> moved ${d.toFixed(2)}m  (${after.map(n=>+n.toFixed(2))})`);
}
// screenshot final
await page.screenshot({ path: 'shots/exit-final.png' });
await browser.close();
