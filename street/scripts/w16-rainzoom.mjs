// ZOOM. The eight-heading probe says 13% of the frame facing yaw 0 is rain
// paint, and at 960x640 viewed shrunk I could not see a single streak. One of
// those two readings is wrong and a 3x native-pixel crop settles it — a 1 px
// wide streak survives being looked at, it does not survive being downscaled.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4195/');
const TAG = process.argv[2] ?? 'now';
const OUT = `shots/w16-zoom-${TAG}`;
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 3 });
await goto(p, URL);
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await settle(p);
const hour = await p.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  for (let h = 24; h < 4000; h++) { const d = ((h % 24) + 24) % 24; if (d >= 11 && d <= 15 && f(h)) return h; }
  return null;
});
await p.evaluate(() => window.__ct.warp(-6, -34, 0, 0.14, 0));
await p.evaluate(([h]) => window.__ct.clock(h, 10), [hour]);
let lvl = 0;
for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); lvl = await p.evaluate(() => window.__ct.scene().userData.rainLevel); if (lvl > 0.99) break; }
console.log(`rainLevel ${lvl.toFixed(3)} at hour ${hour} (${hour % 24}:10)`);

for (const [name, yaw, clip] of [
  ['yaw000-sky', 0, { x: 430, y: 20, width: 320, height: 213 }],
  ['yaw000-road', 0, { x: 600, y: 300, width: 320, height: 213 }],
  ['yaw090-wall', Math.PI / 2, { x: 320, y: 60, width: 320, height: 213 }],
]) {
  await p.evaluate(([y]) => window.__ct.warp(-6, -34, y, 0.14, 0), [yaw]);
  await p.waitForTimeout(400);
  writeFileSync(`${OUT}/${name}.png`, await p.screenshot({ clip }));
}
console.log(`crops (3x native) in ${OUT}/`);
await b.close();
