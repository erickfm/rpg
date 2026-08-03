// Which way is W? Empirical, because guessing the yaw convention cost me five
// red walk routes that were really one wrong constant.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim('http://localhost:4240/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(1400);
for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  await p.evaluate((y) => window.__ct.warp(520, 0, y, 0, 0), yaw);
  await p.waitForTimeout(400);
  const a = await p.evaluate(() => window.__ct.pos().slice(0, 3));
  await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w');
  await p.waitForTimeout(200);
  const c = await p.evaluate(() => window.__ct.pos().slice(0, 3));
  console.log(`yaw ${yaw.toFixed(2)}: d=(${(c[0] - a[0]).toFixed(2)}, ${(c[2] - a[2]).toFixed(2)})  |d|=${Math.hypot(c[0] - a[0], c[2] - a[2]).toFixed(2)}`);
}
await b.close();
