// LOOKING, not proving (GOTCHAS §1). Screenshots the cabinet on the bank
// facade beside the interface panel it opens, at a few of the panel's own
// screens, so the two can be judged by eye against the same build.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4197/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 750 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z, label: q.label }))[0] ?? null);
console.log('spot', spot);

await page.evaluate(([x, z]) => window.__ct.warp(x + 2.2, z, -Math.PI / 2, 0.14, -0.05), [spot.x, spot.z]);
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/K/atm-palette-cabinet.png' });

await page.evaluate(() => window.__atm.open());
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/K/atm-palette-panel-idle.png' });

await page.keyboard.press('1');
await page.waitForTimeout(200);
await page.screenshot({ path: 'shots/K/atm-palette-panel-pin.png' });
for (const d of ['1', '2', '3', '4']) { await page.keyboard.press(d); await page.waitForTimeout(60); }
await page.keyboard.press('Enter');
await page.waitForTimeout(250);
await page.screenshot({ path: 'shots/K/atm-palette-panel-menu.png' });
await page.keyboard.press('2');
await page.waitForTimeout(250);
await page.screenshot({ path: 'shots/K/atm-palette-panel-withdraw.png' });

console.log('escaping...');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const open = await page.evaluate(() => window.__hud.panel());
console.log('panel open after ESC:', open);
const moved = await page.evaluate(async () => {
  const before = window.__ct.pos ? window.__ct.pos() : null;
  return before;
});
console.log('errors:', errors);
await browser.close();
