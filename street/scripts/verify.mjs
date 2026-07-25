// Verification sweep: apartment interior, watch, hermit, alley sides, atlases.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
console.error(`[measuring ${process.env.SHOT_URL ?? 'http://localhost:4177/'}]`);   // say WHICH world — 24163f69
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(600);

const shot = async (name, fn) => {
  await page.evaluate(fn);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `shots/v-${name}.png` });
};
// street entrance
await shot('entrance', () => window.__ct.warp(-4.2, -28.5, Math.atan2(-2.4, -2.5)));
// lobby looking at stairs
await shot('lobby', () => window.__ct.warp(201.2, -18.5, Math.PI, 0));
// mid-stairs looking up
await shot('stairs', () => window.__ct.warp(200.6, -10, Math.PI, 1.0, 0.35));
// floor 3 hall with hermit forced present
await shot('hall3', () => { window.__ct.hermit(true); window.__ct.warp(200.6, -18.2, Math.PI * 0.9, 5.4, 0); });
// hermit closeup
await shot('hermit', () => window.__ct.warp(201.0, -16.0, Math.atan2(1.3, 0.1), 5.4));
// room 301
await shot('room301', () => window.__ct.warp(199.6, -16.5, Math.atan2(-2.5, 1.2), 5.4));
// watch while looking down on the street
await shot('watch', () => { window.__ct.clock(16, 12); window.__ct.warp(-1.4, 5, 0, 0, -1.2); });
// alley sides
await shot('alley-sides', () => window.__ct.warp(-9.5, -40.2, Math.atan2(-3, 0.5), 0, 0.25));
// night
await shot('night', () => { window.__ct.clock(23, 0); window.__ct.warp(-1.4, 6, 0, 0, 0); });
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/v-night.png' });
// citizen atlases tiled onto a blank page
const urls = await page.evaluate(() => window.__ct.atlases());
await page.setContent(`<body style="margin:0;background:#556;display:flex;flex-wrap:wrap;gap:8px;padding:8px">` +
  urls.map((u) => `<img src="${u}" style="width:480px;image-rendering:pixelated;background:#889">`).join('') + `</body>`);
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/v-atlas.png', fullPage: true });
await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('verify done');
