// Why is the frame from flat 301's documented SPAWN black, when the two
// stations closer to the window render the room fine? Sweep the yaw at eye
// level and report the mean luminance of each frame, so the answer is a
// number rather than an impression.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 260 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const SPAWN = { x: 200 - 1.4, z: -20 + 3.7, gy: 2 * 2.7 };
const lum = async () => {
  const buf = await p.screenshot();
  // mean of the raw PNG bytes is not luminance; decode via the page instead
  return buf;
};
void lum;

for (const [tag, hold] of [['cold', 0], ['warm', 2500]]) {
  await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, -Math.PI / 2, gy, -0.39),
    [SPAWN.x, SPAWN.z, SPAWN.gy]);
  await p.waitForTimeout(600 + hold);
  const mean = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const g = document.createElement('canvas');
    g.width = 200; g.height = 130;
    const cx = g.getContext('2d');
    cx.drawImage(c, 0, 0, 200, 130);
    const d = cx.getImageData(0, 0, 200, 130).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    return s / (d.length / 4) / 3;
  });
  console.log(`  spawn, ${tag} (waited ${600 + hold} ms): mean pixel ${mean.toFixed(1)} / 255`);
}
await b.close();
