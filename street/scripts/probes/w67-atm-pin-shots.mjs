// LOOK at the PIN screen in its four states. Item 184.
//
// Screenshots are for LOOKING, never for proving a change did not move the
// world — but three of this item's changes are TEXT ON A TUBE (CHOOSE A PIN vs
// ENTER YOUR PIN, INCORRECT PIN, CLR CANCELS), and looking is the only way to
// find out whether they fit the 236 px CRT or run off its edge.
//
//   SHOT_URL=http://localhost:4230/ node scripts/probes/w67-atm-pin-shots.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4230/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z }))[0]);
await page.evaluate(([x, z]) => window.__ct.warp(
  x + 1.2, z, Math.atan2(-1.2, 0), window.__ct.groundAt(x + 1.2, z), 0), [spot.x, spot.z]);
await page.waitForTimeout(400);
await page.keyboard.down('e');
await page.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 8000 });
await page.keyboard.up('e');

// GOTCHAS 80: rAF ticking is not the renderer having painted. Wait for a frame
// that is not black before believing any of these, and say so if none comes.
const painted = await page.waitForFunction(() => {
  const c = document.querySelector('canvas');
  const g = document.createElement('canvas');
  g.width = 40; g.height = 40;
  const x = g.getContext('2d');
  x.drawImage(c, c.width / 2 - 20, c.height / 2 - 20, 40, 40, 0, 0, 40, 40);
  const d = x.getImageData(0, 0, 40, 40).data;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) return true;
  return false;
}, null, { timeout: 15000 }).then(() => true).catch(() => false);
console.log(painted ? 'the world painted before any shot was taken' : 'WARNING: never saw a non-black frame');

const shot = async (name) => {
  await page.waitForTimeout(350);
  const path = `shots/w67-atm-${name}.png`;
  await page.screenshot({ path });
  console.log(`  ${path}  screen=${await page.evaluate(() => window.__atm.screen())}`);
};

await page.keyboard.press('1');                       // INSERT CARD
await shot('1-choose-a-pin');                         // first visit: CHOOSE A PIN
await page.keyboard.press('1');
await page.keyboard.press('2');
await shot('2-two-digits');
await page.keyboard.press('3');
await page.keyboard.press('4');                       // auto-submits
await page.waitForTimeout(600);
await shot('3-menu-pin-set');                         // menu, with PIN SET

await page.keyboard.press('8');                       // TAKE CARD
await page.waitForFunction(() => !window.__hud.panel(), null, { timeout: 8000 });
await page.waitForTimeout(900);
await page.keyboard.down('e');
await page.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 8000 });
await page.keyboard.up('e');
await page.waitForTimeout(500);
await page.keyboard.press('1');                       // INSERT CARD
await shot('4-enter-your-pin');                       // later visit: ENTER YOUR PIN + CLR CANCELS
for (const d of ['9', '9', '9', '9']) await page.keyboard.press(d);
await page.waitForTimeout(600);
await shot('5-incorrect-pin');                        // rejected, retry

await browser.close();
