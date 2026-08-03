// Find a camera that actually SHOWS the crossing with the taxi on it, so the
// retreat can be looked at rather than only counted. Four yaws, one shot each.
//   SHOT_URL=http://localhost:4520/ node scripts/probes/w96-frame-the-crossing.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4520/');
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp !== undefined, { timeout: 30000 });
await p.waitForTimeout(700);
await p.evaluate(() => window.__ct.drive('NE', 'taxi', 98));

const tries = [
  ['a', 6.6, -90.2, -Math.PI / 2],
  ['b', 6.6, -90.2, Math.PI / 2],
  ['c', 7.0, -84.0, Math.PI],
  ['d', 6.8, -96.5, 0],
];
for (const [tag, x, z, yaw] of tries) {
  await p.evaluate(([x2, z2, y2]) => window.__ct.warp(x2, z2, y2), [x, z, yaw]);
  await p.waitForTimeout(1600);
  await p.evaluate(() => window.__ct.drive('NE', 'taxi', 98));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/w96-frame-${tag}.png` });
  const t = await p.evaluate(() => window.__ct.traffic()[0]);
  console.log(`${tag}: player (${x}, ${z}) yaw ${yaw.toFixed(2)} — taxi at (${t?.x.toFixed(2)}, ${t?.z.toFixed(2)})`);
}
await b.close();
