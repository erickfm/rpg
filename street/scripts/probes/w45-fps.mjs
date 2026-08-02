// w45 / item 95 — what the per-fragment pool costs.
//
// The injected loop runs once per lamp per fragment, and the world has 27
// heads. Worst case on a driver that will not early-out of a uniform-bounded
// loop is POOL_MAX (64) iterations of a distance and a couple of multiplies.
// This measures frame time at night, standing in the busiest pool on the
// street, so the number is taken where the cost actually lands.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-fps.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { setNight, setClock } from '../lib/clock.mjs';

const URL = aim('http://localhost:4189/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const measure = async (label) => {
  await page.evaluate(() => window.__ct.warp(2.6, -23, Math.PI / 2, 0, -0.15));
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => new Promise((res) => {
    const t = []; let last = performance.now(), n = 0;
    const tick = () => {
      const now = performance.now();
      t.push(now - last); last = now;
      if (++n < 120) requestAnimationFrame(tick);
      else {
        t.sort((a, b) => a - b);
        res({ median: +t[Math.floor(t.length / 2)].toFixed(2),
              p95: +t[Math.floor(t.length * 0.95)].toFixed(2) });
      }
    };
    requestAnimationFrame(tick);
  }));
  console.log(`  ${label.padEnd(14)} median frame ${r.median} ms   p95 ${r.p95} ms`);
  return r;
};

await setClock(page, 13, 0);
await page.waitForTimeout(500);
console.log('standing at (2.6, -23), the pool under the main street lamp:');
await measure('day 13:00');
await setNight(page, 23, 0);
await measure('night 23:00');
await browser.close();
