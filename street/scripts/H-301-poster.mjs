// H (verifier): the row's SECOND clause - "what is this poster on the wall?"
// E confirmed the door half and said plainly the poster was never looked at.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.warp, null, { timeout: 60000 });
// stand on 301's declared spawn and turn through four walls
const S = [198.60, -16.30];
for (const [tag, yaw] of [['n', 0], ['e', Math.PI/2], ['s', Math.PI], ['w', -Math.PI/2]]) {
  await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, window.__ct.groundAt(x, z), 0), [S[0], S[1], yaw]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/H-301-${tag}.png` });
}
console.log('four walls shot from 301 spawn', S.join(', '));
await b.close();
