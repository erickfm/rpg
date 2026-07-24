// The alley: both side walls, the rear wall, the dumpster and the cat.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(600);
const shot = async (name, fn, wait = 350) => {
  await page.evaluate(fn); await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/al-${name}.png` });
};
// standing in the alley mouth looking in
await shot('in', () => window.__ct.warp(-8.2, -40.2, Math.atan2(-3, 0.2), 0, 0.05));
// square at each side wall
await shot('wall-north', () => window.__ct.warp(-10.5, -40.5, 0, 0, 0.1));
await shot('wall-south', () => window.__ct.warp(-10.5, -40.5, Math.PI, 0, 0.1));
// the rear wall the user likes
await shot('wall-rear', () => window.__ct.warp(-10.0, -40.2, -Math.PI / 2, 0, 0.1));
// the REZO tag wall
await shot('graffiti', () => window.__ct.warp(-9.6, -38.6, Math.atan2(-2, 0.2), 0, 0.12));
// dumpster + cat
await shot('dumpster', () => window.__ct.warp(-9.0, -40.2, Math.atan2(-2.2, -2.0), 0, 0));
await shot('cat', () => window.__ct.warp(-9.2, -41.4, Math.atan2(-1.3, 1.2), 0, -0.25));
await shot('cat-close', () => window.__ct.warp(-9.6, -41.9, Math.atan2(-0.8, 0.9), 0, -0.35));
// ── playtest reply shots (fixed names the user looks at) ──────────────────
const named = async (file, fn, wait = 400) => {
  await page.evaluate(fn); await page.waitForTimeout(wait);
  await page.screenshot({ path: `shots/${file}.png` });
};
// the cat, at the distance you actually meet her from
await named('user-cat', () => window.__ct.warp(-9.55, -41.5, Math.atan2(-1.0, 1.4), 0, -0.18));
// the six-cat comparison row, all of them at once
await named('user-cats', () => window.__ct.warp(-10.75, -39.4, 0, 0, -0.3));
// where the plywood sheet and the trash bags used to be
await named('user-alley-junk', () => window.__ct.warp(-8.6, -38.7, Math.atan2(-3.2, -0.7), 0, -0.14));
// the wall behind the REZO tag — must be plain, continuous brick
await named('user-alley-panel', () => window.__ct.warp(-9.6, -39.7, Math.PI, 0, 0.06));
// the bodega's canted corner bay, straight across the intersection
await named('user-bodega-corner', () => window.__ct.warp(2.6, -100.6, Math.atan2(5.4, -5.6), 0, 0.22));
await browser.close();
console.log('alley shots done');
