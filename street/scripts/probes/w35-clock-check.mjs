// w35 — does __ct.clock() actually move the world clock? The cat frame came
// back black twice with the HUD stamp still reading 04:14.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(aim('http://localhost:4191/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
console.log('before        ', JSON.stringify(await p.evaluate(() => window.__ct.clockNow())));
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(200);
console.log('after clock(13)', JSON.stringify(await p.evaluate(() => window.__ct.clockNow())));
await p.waitForTimeout(1500);
console.log('+1.5s         ', JSON.stringify(await p.evaluate(() => window.__ct.clockNow())));
console.log('nightFactor   ', await p.evaluate(() => {
  const s = window.__ct.scene();
  return s.userData ? s.userData.nightFactor : 'none';
}));
await b.close();
