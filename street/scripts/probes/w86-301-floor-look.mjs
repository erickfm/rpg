// LOOK AT THE FLOOR THE USER WAS LOOKING AT. Item 169.
// Shoots straight down at the boards from the spawn and from a few points
// around the room, so the pale sliver can be SEEN before anything is deleted.
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-301-floor-look.mjs
import { chromium } from 'playwright';
import { waitPainted, blackFraction } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p, { quiet: true });

const pr = await p.evaluate(() => window.__ct.pos());
console.log('spawn:', JSON.stringify(pr));
await p.evaluate(() => window.__ct.clock(12, 0));   // full daylight, so colour reads true
await p.waitForTimeout(800);

let n = 0;
for (const [dx, dz, yaw] of [[0, 0, 0], [0, 0, Math.PI / 2], [0, 0, Math.PI], [0, 0, -Math.PI / 2],
                             [1.5, 0, 0], [-1.5, 0, 0], [0, 1.5, 0], [0, -1.5, 0]]) {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, -1.2),
    [pr[0] + dx, pr[2] + dz, yaw]);
  await waitPainted(p, { quiet: true });
  const buf = await p.screenshot({ path: `shots/w86-301-floor-${n}.png` });
  console.log(`  shot ${n}  at ${(pr[0] + dx).toFixed(2)},${(pr[2] + dz).toFixed(2)} yaw ${yaw.toFixed(2)}`
    + `  black ${(await blackFraction(p, buf) * 100).toFixed(1)}%`);
  n++;
}
await b.close();
