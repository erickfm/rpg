// LOOK at the focused ATM: idle, PIN screen, and a close crop of the real
// 12-key pad. Frames only — this proves nothing on its own, it is how I judge
// whether the physical keypad is legible enough to be the input device.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w57-atm-frames.mjs <tag>
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4185/');
const TAG = process.argv[2] ?? 'now';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z }))[0]);
await page.evaluate(([x, z]) => window.__ct.warp(
  x + 1.2, z, Math.atan2(-1.2, 0), window.__ct.groundAt(x + 1.2, z), 0), [spot.x, spot.z]);
await page.waitForTimeout(500);

// A HELD keypress — `press` can start and end inside one frame and the [E]
// edge is read once per rendered frame (BUILDER-BRIEF §5).
await page.keyboard.down('e');
await page.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 8000 });
await page.keyboard.up('e');
await page.waitForTimeout(900);
await page.screenshot({ path: `/tmp/w57-atm-idle-${TAG}.png` });

await page.keyboard.press('1');                       // INSERT CARD -> the PIN screen
await page.waitForTimeout(300);
console.log('screen:', await page.evaluate(() => window.__atm.screen()));
await page.screenshot({ path: `/tmp/w57-atm-pin-${TAG}.png` });
// and a crop of the lower half, where the physical pad is
await page.screenshot({ path: `/tmp/w57-atm-pad-${TAG}.png`, clip: { x: 380, y: 330, width: 520, height: 330 } });

console.log(`frames: /tmp/w57-atm-{idle,pin,pad}-${TAG}.png`);
await browser.close();
