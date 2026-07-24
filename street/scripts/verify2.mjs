// Round-3 verification: new entrance/east apt, stairs, pickup, watch arm, wallet, hoodie, feeding.
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
  await page.screenshot({ path: `shots/w-${name}.png` });
};
await shot('entrance-east', () => window.__ct.warp(3.2, -41, Math.atan2(3.3, -3), 0.14));
await shot('street-south', () => window.__ct.warp(-1, -8, Math.PI + 0.35, 0, 0.05));
await shot('pickup', () => window.__ct.warp(-0.6, -34, -Math.PI / 2, 0));
await shot('pickup-rear', () => window.__ct.warp(-1.6, -37.6, Math.atan2(-2.3, -3.6), 0));
await shot('stairs', () => window.__ct.warp(200.6, -10.5, Math.PI, 0.6, 0.3));
await shot('watch-arm', () => window.__ct.warp(-1.4, 5, 0, 0, -1.2), 500);
// wallet: simulate right-click hold via dispatch
await page.evaluate(() => window.__ct.warp(-1.4, 5, 0, 0, 0));
await page.mouse.move(640, 360);
await page.mouse.down({ button: 'right' });
await page.waitForTimeout(120);
await page.mouse.up({ button: 'right' });
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/w-wallet.png' });
// feeding: warp near pigeons, press E, wait, screenshot
await page.evaluate(() => window.__ct.warp(-5.6, -18, Math.PI, 0.14));
await page.keyboard.press('e');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'shots/w-feeding.png' });
// atlas for hoodie check
const urls = await page.evaluate(() => window.__ct.atlases());
await page.setContent(`<body style="margin:0;background:#556;display:flex;flex-wrap:wrap;gap:8px;padding:8px">` +
  urls.map((u) => `<img src="${u}" style="width:480px;image-rendering:pixelated;background:#889">`).join('') + `</body>`);
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/w-atlas.png', fullPage: true });
await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('verify2 done');
