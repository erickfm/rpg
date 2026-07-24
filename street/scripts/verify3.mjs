// Corner-round verification: corner, bodega in+out, cat, plaque, rain, bags, pickup.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto('http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(600);
const shot = async (name, fn, wait = 350) => {
  await page.evaluate(fn);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/x-${name}.png` });
};
// approaching the corner from up the street
await shot('corner-approach', () => window.__ct.warp(-1, -80, Math.PI + 0.2, 0));
// standing at the corner looking east down the side street
await shot('corner-east', () => window.__ct.warp(1.5, -101, Math.PI / 2, 0));
// the bodega corner with awning and crates
await shot('bodega-out', () => window.__ct.warp(4.5, -102.5, Math.atan2(4.2, 5.5), 0));
// inside the bodega
await shot('bodega-in', () => window.__ct.warp(241.3, -17, Math.PI / 2, 0));
await shot('bodega-counter', () => window.__ct.warp(244.5, -14.5, Math.atan2(-2.3, 3.5), 0));
// alley: cat + bags + brick behind dumpster
await shot('alley-cat', () => window.__ct.warp(-9.2, -41.5, Math.atan2(-1.3, 1.2), 0, -0.15));
await shot('alley-dumpster', () => window.__ct.warp(-9.0, -40.2, Math.atan2(-2.2, -2.0), 0));
// pickup recessed bed
await shot('pickup-bed', () => window.__ct.warp(-1.8, -36.8, Math.atan2(-2.1, -2.8), 0, -0.1));
// whitmore plaque
await shot('whitmore', () => window.__ct.warp(4.6, -42.6, Math.atan2(2.3, 1.4), 0.14));
// rain: find a rainy hour
await page.evaluate(() => { window.__ct.clock(14, 0); });
for (let h = 14; h < 60; h++) { /* client-side clock advances by our set */ }
await page.evaluate(() => window.__ct.warp(-1.4, -20, Math.PI, 0));
// force-scan rainy hour by setting successive clocks
const rainy = await page.evaluate(() => {
  for (let h = 0; h < 200; h++) {
    if (((Math.imul(h, 2246822519) >>> 0) % 100) < 22) return h;
  }
  return -1;
});
await page.evaluate((h) => window.__ct.clock(h, 30), rainy);
await page.waitForTimeout(3500);
await page.screenshot({ path: 'shots/x-rain.png' });
await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('verify3 done, rainy hour', rainy);
