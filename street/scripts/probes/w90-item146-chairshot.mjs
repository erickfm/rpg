// w90 / item 146 — stand INSIDE 301 and look at the chair.
//
// The chair is scenery at world (199.28, -14.88) with its back at z -14.71, so
// it faces -z and the room is toward MORE NEGATIVE z. Third floor: gy must come
// from `groundAt` at a point known to be inside (A-verify-301-door.mjs:62-64),
// or the warp puts you in the ground-floor corridor — which is what my first
// two attempts photographed.
//
// Usage: SHOT_URL=http://localhost:4460/ node scripts/probes/w90-item146-chairshot.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
await goto(page, aim('http://localhost:4177/'));
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(1200);

const CX = 199.28, CZ = -14.88;                 // the seat pan's centre
const gy = await page.evaluate(() => window.__ct.groundAt(199.36, -15.545));
console.log(`floor of 301 = ${gy}`);

const shots = [
  ['front', 199.28, -16.30, 1.05, -0.16],   // straight on from the room
  ['front-low', 199.28, -16.10, 0.75, -0.05],
  ['side', 200.35, -15.40, 1.15, -0.18],    // from the side: the gap, if any, shows here
  ['close', 199.28, -15.70, 1.00, -0.20],
  // tight, at roughly the height the chair is seen from standing
  ['tight', 199.28, -15.95, 0.95, -0.13],
  ['tight-low', 199.28, -15.95, 0.60, -0.02],
  // from the west, where the seat/back junction is edge-on and a gap would be
  // unmistakable. 200.36 hit the wall; the room runs the other way.
  ['edge', 198.55, -15.55, 0.95, -0.14],
];
for (const [tag, px, pz, eye, pitch] of shots) {
  await page.evaluate(([px, pz, cx, cz, gy, eye, pitch]) =>
    window.__ct.warp(px, pz, Math.atan2(cx - px, -(cz - pz)), gy + eye, pitch),
    [px, pz, CX, CZ, gy, eye, pitch]);
  await waitPainted(page, { quiet: true });
  const at = await page.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  console.log(`  ${tag}: standing (${at[0]}, ${at[2]}) floor ${at[3]}`);
  await page.screenshot({ path: `shots/w90-chair-${tag}.png` });
}
console.log('shots -> shots/w90-chair-*.png');
await browser.close();
