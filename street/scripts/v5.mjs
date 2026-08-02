import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(400);
const pos = () => page.evaluate(() => window.__ct.pos());
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(40); };
const shot = async (name, fn, wait=380) => { await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `shots/v5-${name}.png` }); };
// full lamp crook silhouette from across the street, framed
await shot('lamp-full', () => { window.__ct.clock(13,0); window.__ct.warp(-3.5, -23, Math.atan2(9,0.5), 0.14, 0.35); });
await shot('lamp-full-night', () => { window.__ct.clock(23,0); window.__ct.warp(-3.5, -23, Math.atan2(9,0.5), 0.14, 0.35); });
// rain: find a rainy hour, screenshot
const rainy = await page.evaluate(() => { for (let h=0;h<300;h++){ if(((Math.imul(h,2246822519)>>>0)%100)<22) return h; } return -1; });
await page.evaluate((h) => window.__ct.clock(h, 30), rainy);
await shot('rain', () => window.__ct.warp(-1.4, -20, Math.PI, 0.14, 0.15), 2500);

// CITIZEN SOFTLOCK TEST: box the player against a wall + car, then send a citizen at them.
// Put player near west wall (x -6.28 limit) between parked pickup (z-34) area.
await page.evaluate(() => { window.__ct.clock(13,0); window.__ct.warp(-6.2, -20, Math.PI, 0.14, 0); });
await page.waitForTimeout(200);
// force a citizen right on top of the player by warping player onto citizen lane repeatedly is hard;
// instead: walk the player and confirm never fully stuck. Check we can always move SOME direction.
let stuck = 0, samples = 0;
for (let step=0; step<12; step++) {
  const before = await pos();
  // try all 4 dirs briefly, see if any moves
  let moved = 0;
  for (const k of ['w','a','s','d']) { const b=await pos(); await hold(k,160); const a=await pos(); moved=Math.max(moved, Math.hypot(a[0]-b[0],a[2]-b[2])); }
  samples++;
  if (moved < 0.05) stuck++;
  // drift the player down the block into citizen territory
  await hold('s', 240);
}
console.log('softlock sweep: frames unable to move ANY direction =', stuck, '/', samples);
await browser.close();
