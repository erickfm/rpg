// w45 / item 95 — night frames from the player's own standing position.
//
// The user's complaint is visual, so the proof has to be too: stand on the
// sidewalk beside a lit lamp, and look at the sidewalk, the road and a parked
// car in the same frame. That is his screenshot, reproduced from inside.
//
//   SHOT_URL=http://localhost:4189/ node scripts/probes/w45-nightframes.mjs before
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { setNight } from '../lib/clock.mjs';

const TAG = process.argv[2] || 'before';
const URL = aim('http://localhost:4189/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await setNight(page, 23, 0);

// The lamp the audit used, found the same way rather than retyped.
const lamp = await page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData && o.userData.lampPart === 'lens') {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      out.push({ x: +e[12].toFixed(2), z: +e[14].toFixed(2) });
    }
  });
  return out.filter((l) => Math.abs(l.x) < 12)
    .sort((a, b) => Math.abs(a.z + 20) - Math.abs(b.z + 20))[0];
});
console.log(`lamp (${lamp.x}, ${lamp.z})`);

const shot = async (name, x, z, yaw, pitch = -0.25) => {
  await page.evaluate(([a, b, c, d]) => window.__ct.warp(a, b, c, 0, d), [x, z, yaw, pitch]);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `shots/w45-${name}-${TAG}.png` });
  console.log(`  shots/w45-${name}-${TAG}.png`);
};

// Standing on the sidewalk just short of the lamp, looking along it: the pool
// on the road is on the left, the sidewalk underfoot, the kerb between them.
await shot('walk-along', lamp.x - 0.6, lamp.z + 5.0, Math.atan2(0, -1) + Math.PI, -0.35);
// Square across the kerb: sidewalk in the near half, road in the far half,
// with the lamp head directly overhead. This is the frame that shows the seam.
await shot('kerb-across', lamp.x - 1.2, lamp.z, -Math.PI / 2, -0.30);
// Standing IN the pool looking down at the ground the lamp is supposed to light.
await shot('underfoot', lamp.x - 1.0, lamp.z, Math.PI, -0.75);
// Back off and take the whole stretch, two lamps and the gap between them.
await shot('stretch', lamp.x - 2.0, lamp.z + 12.0, Math.atan2(0, -1) + Math.PI, -0.18);

await browser.close();
