import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errs=[]; page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text()); });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
const pos = () => page.evaluate(() => window.__ct.pos());
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(40); };
await page.evaluate(() => window.__ct.clock(13,0));
// hydrant is at x~5.35,z=-6. Look at it from the walk.
await page.evaluate(() => window.__ct.warp(6.1, -2, Math.PI, 0.14, -0.1)); await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/hy-view.png' });
// walk past it on the building side
await page.evaluate(() => window.__ct.warp(6.1, 2, 0, 0.14, 0)); await page.waitForTimeout(120);
const a = await pos(); await hold('w', 1400); const b = await pos();
console.log('walk past hydrant: z', a[2].toFixed(1), '->', b[2].toFixed(1), 'moved', (a[2]-b[2]).toFixed(1), 'm; final x', b[0].toFixed(2));
console.log('errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
