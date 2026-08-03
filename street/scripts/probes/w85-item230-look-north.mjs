// Item 230 — LOOK at the ground north of the car lot, because two predicates
// disagree about whether it exists and w75's cited photograph does not.
//
// `w75-site-contained.mjs`'s header says "there is real pavement out to z 16.75
// … I walked out there and photographed it (shots/w75-escape-z17.png)". **That
// file is not in this tree, nor in the main one.** So the disagreement between
// its AABB predicate (floor out to z 16.5) and this item's raycast (floor stops
// at z 14.0) cannot be settled from the record and has to be re-photographed.
//
// Screenshots are for LOOKING, never for proving — which is exactly the job
// here: is there pavement under the player at z 16, or is he standing on
// nothing?
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { waitPainted, blackFraction } from './../lib/painted.mjs';
import { reportWorld } from './../lib/which-world.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4410/');
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 640 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));
await waitPainted(page);

// pitch down hard: the question is what is UNDER the player, not the skyline
for (const [nm, x, z, yaw, pitch] of [
  ['w85-north-z12-down', 20, 12, 0, -1.1],
  ['w85-north-z16-down', 20, 16, 0, -1.1],
  ['w85-north-z12-fwd', 20, 12, 0, -0.25],
  ['w85-north-z16-fwd', 20, 16, 0, -0.25],
  ['w85-party-880-down', 880, -9, Math.PI / 2, -1.1],
]) {
  await page.evaluate(([x, z, yaw, pitch]) => {
    window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, pitch);
  }, [x, z, yaw, pitch]);
  await waitPainted(page);
  await page.waitForTimeout(220);
  const buf = await page.screenshot({ path: `shots/${nm}.png` });
  const blk = await blackFraction(page, buf);
  const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
  console.log(`${nm.padEnd(24)} at (${x}, ${z})  groundAt=${gy.toFixed(3)}  black=${(blk * 100).toFixed(1)}%`);
}
await b.close();
