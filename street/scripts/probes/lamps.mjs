import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
const shot = async (name, fn, wait=400) => { await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `shots/lamp-${name}.png` }); };
// day: lamps should be dark iron, no glow
await shot('day', () => { window.__ct.clock(13,0); window.__ct.warp(-1,-14, Math.PI, 0, 0.02); });
await shot('day-close', () => { window.__ct.clock(13,0); window.__ct.warp(-3.5,-6, Math.atan2(-2,-3), 0, 0.15); });
// dusk
await shot('dusk', () => { window.__ct.clock(19,30); window.__ct.warp(-1,-30, Math.PI, 0, 0.05); });
// deep night: full glow + pools
await shot('night', () => { window.__ct.clock(23,0); window.__ct.warp(-1,-30, Math.PI, 0, 0.05); });
await shot('night-look', () => { window.__ct.clock(23,0); window.__ct.warp(-1,-45, Math.PI, 0, 0.1); });
await shot('night-close', () => { window.__ct.clock(23,0); window.__ct.warp(-3.2,-20, Math.atan2(-2,-3), 0, 0.25); });
await shot('night-corner', () => { window.__ct.clock(23,0); window.__ct.warp(-1,-88, Math.PI, 0, 0.02); });
await browser.close();
console.log('lamps done');
