// The alley: both side walls, the rear wall, the dumpster and the cat.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
// SETTLE: 600 ms, and it is safe HERE because this pins a DAY hour. Measured,
// after 159b9c1c listed this script as a settle-ramp candidate.
//
// The world boots at 13:20 (crosstown.ts:190, fixed — not the real clock), so
// pinning 13:00 asks for the state it is already in and nothing has to travel.
// The 108 shell materials read mean channel 2.027835 identically at 600, 1000,
// 1500, 2000, 3000 and 4000 ms.
//
// Pin a NIGHT hour and the same 600 ms is a coin flip. Eight cold runs at
// clock(23,0), sampled at exactly 600 ms:
//
//     DAY 2.0278 · night 0.0919 x7
//
// One run in eight read the completely UNGRADED world — not a mid-ramp shade,
// the day value to four decimal places at a night hour, a 22x error. The
// transition landed between 400-600 ms in one run and 600-1000 ms in another,
// so 600 sits exactly on the edge. No intermediate value appeared at any of
// 200/400/600/700/800/900/1000/1200 ms, so it is a step, or a lerp faster than
// that sampling.
//
// The rule for the 90-script list is therefore the HOUR, not the wait: a script
// pinning a day hour is unaffected at any settle; one pinning a night hour and
// sampling under ~1000 ms is flaky rather than merely imprecise.
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
