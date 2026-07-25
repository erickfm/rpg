import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errs=[]; page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
const shot = async (name, fn, wait=500) => { await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `shots/ck-${name}.png` }); };
// dry street for reference
await shot('dry', () => { window.__ct.clock(13,0); window.__ct.warp(-1.4, -20, Math.PI, 0.14, 0.06); });
// watch reverted
await shot('watch', () => { window.__ct.clock(16,12); window.__ct.warp(-1.4, 5, 0, 0, -1.25); });
// trees reverted
await shot('trees', () => { window.__ct.clock(13,0); window.__ct.warp(2, -25, -Math.PI/2, 0.14, 0.1); });
// WET: find rainy hour, wait for it to build, screenshot
const rainy = await page.evaluate(() => { for (let h=0;h<300;h++){ if(((Math.imul(h,2246822519)>>>0)%100)<22) return h; } return -1; });
await page.evaluate((h)=>window.__ct.clock(h,30), rainy);
await page.evaluate(() => window.__ct.warp(-1.4, -20, Math.PI, 0.14, 0.06));
await page.waitForTimeout(3500); // let rainLevel ramp + ground wet
await page.screenshot({ path: 'shots/ck-wet.png' });
console.log('rainy hour', rainy, 'errors:', errs.length?errs.join(' | '):'none');
await browser.close();
