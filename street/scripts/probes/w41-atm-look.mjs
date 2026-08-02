// LOOKING, not proving: walk to FIRST FEDERAL, press [E] as the user does, and
// photograph what he sees. Two shots — approaching, and with the machine open.
// Usage: SHOT_URL=http://localhost:4187/ node scripts/probes/w41-atm-look.mjs [tag]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4187/');
const TAG = process.argv[2] || 'before';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z, label: q.label }))[0] ?? null);
console.log('spot:', JSON.stringify(spot));
if (!spot) { await browser.close(); process.exit(3); }

// stand off the face, looking at it — the approach, before any [E]
await page.evaluate(([x, z]) => window.__ct.warp(x + 1.6, z, Math.atan2(-1.6, 0), window.__ct.groundAt(x + 1.6, z), 0), [spot.x, spot.z]);
await page.waitForTimeout(700);
await page.screenshot({ path: `/tmp/w41-atm-approach-${TAG}.png` });

// closer, where the prompt is live
await page.evaluate(([x, z]) => window.__ct.warp(x + 1.0, z, Math.atan2(-1.0, 0), window.__ct.groundAt(x + 1.0, z), 0), [spot.x, spot.z]);
await page.waitForFunction(() => {
  const e = document.getElementById('ct-prompt');
  const t = e && e.style.display !== 'none' ? e.textContent : '';
  return /FIRST FEDERAL/i.test(t || '');
}, null, { timeout: 6000 }).catch(() => {});
await page.screenshot({ path: `/tmp/w41-atm-prompt-${TAG}.png` });

await page.keyboard.down('e');
await page.waitForTimeout(120);
await page.keyboard.up('e');
await page.waitForTimeout(1200);
await page.screenshot({ path: `/tmp/w41-atm-open-${TAG}.png` });
console.log('panel:', await page.evaluate(() => window.__hud.panel()));
console.log('seated:', await page.evaluate(() => JSON.stringify(window.__ct.seated())));

await browser.close();
