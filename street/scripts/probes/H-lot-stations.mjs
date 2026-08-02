// H (verifier): I's own published stations for the cards and the jack.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 960, height: 600 } });
page.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.warp, null, { timeout: 60000 });
const at = async (x, z, tx, tz, pitch, tag) => {
  const yaw = Math.atan2(tx - x, -(tz - z));
  await page.evaluate(([px, pz, y, p]) =>
    window.__ct.warp(px, pz, y, window.__ct.groundAt(px, pz), p), [x, z, yaw, pitch]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `shots/H-I-${tag}.png` });
  console.log(`  ${tag}: (${x}, ${z}) -> (${tx}, ${tz}) pitch ${pitch}`);
};
await at(16.9, 5.9, 15.65, 8.6, -0.58, 'card-above');
await at(14.0, 2.6, 15.65, 8.6, -0.06, 'card-aisle');
// the jacked corner, from three ranges - a 0.12 m post is easy to frame out
await at(23.4, 3.6, 26.18, 6.28, -0.12, 'jack-back');
await at(24.6, 5.0, 26.18, 6.28, -0.30, 'jack-mid');
await at(24.9, 4.6, 26.18, 6.28, -0.45, 'jack-down');
// the leaning wheel itself, close, to read the hub
await at(24.6, 4.3, 26.02, 5.9, -0.22, 'leanwheel');
await b.close();
