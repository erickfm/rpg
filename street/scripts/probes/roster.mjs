// The re-cast block: the two civic buildings, the far end of the side street,
// and the shopfront scale. Writes the fixed user-* names the desk shows the
// user, so re-running updates them in place.
//   SHOT_URL=http://localhost:4185/ node scripts/roster.mjs
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(600);
const shot = async (name, fn, wait = 420) => {
  await page.evaluate(fn); await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/${name}.png` });
};

// the library: recessed entrance, steps inside it, BURGER BARN alongside
await shot('user-library', () => window.__ct.warp(2.6, -18.0, Math.atan2(-9.6, 0), 0, 0.2));
await shot('user-library-far', () => window.__ct.warp(4.0, -4.0, Math.atan2(-11.0, 14.0), 0, 0.16));
// the parish church, across the side street from the corner
await shot('user-church', () => window.__ct.warp(2.0, -100.0, Math.atan2(0, 10.0), 0, 0.42));
await shot('user-church-far', () => window.__ct.warp(9.0, -97.5, Math.atan2(-7.0, 12.5), 0, 0.34));
// the casino and the hotel, out at the far end in the haze
await shot('user-farend', () => window.__ct.warp(8.5, -102.5, Math.atan2(30.0, 0.5), 0, 0.1));
// the hotel blade sign, from the side that used to render mirrored
await shot('user-hotelsign', () => window.__ct.warp(37.95, -96.72, Math.PI / 2, 0, 0.72));
// shopfront scale — glazing against a car and a person for reference
await shot('user-shopscale', () => window.__ct.warp(2.2, -30.0, Math.atan2(-9.2, -1.0), 0, 0.1));
// the three characters: BURGER BARN, A-1 TAX, PAWN
await shot('user-burger', () => window.__ct.warp(2.0, -32.0, Math.atan2(-9.0, -1.0), 0, 0.06));
await shot('user-tax', () => window.__ct.warp(-2.0, -15.5, Math.atan2(9.0, -0.5), 0, 0.06));
await shot('user-pawn', () => window.__ct.warp(-2.0, -59.0, Math.atan2(9.0, 0), 0, 0.06));
await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('roster shots done');
