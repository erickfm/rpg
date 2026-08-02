// LOOK at the roulette pit after the ring moved to the avenue side.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const TAG = process.argv[2] ?? 'now';
const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));
// WARM UP BEFORE THE FIRST SHOT. The first view after load came back solid
// black twice — the room's own [E] prompt was drawn over it, so the page was
// alive and the camera was where it was asked to be; the frame simply had not
// been composed yet. A first screenshot that is black is an artefact of the
// harness, and a reader cannot tell it from a room with no lights in it.
await p.evaluate(() => window.__ct.warp(680.2, -3.2, 0, 1.55, 0));
await p.waitForTimeout(1400);
const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));
// the wheel is at world (676.9, 0.2); the avenue runs x 678.5…681.5
const views = [
  ['avenue',  680.2, -3.2, 676.9,  0.2, 1.55],   // coming up the avenue toward the pit
  ['pit',     679.6,  0.2, 676.9,  0.2, 1.55],   // square on, from the avenue
  ['wheel',   677.6, -2.2, 676.9,  0.2, 1.35],   // low, at the wheel head's side
];
for (const [n, x, z, tx, tz, eye] of views) {
  await p.evaluate(([x, z, y, e]) => window.__ct.warp(x, z, y, e, 0), [x, z, yawTo(x, z, tx, tz), eye]);
  await p.waitForTimeout(650);
  await p.screenshot({ path: `shots/w15-roulette-${n}-${TAG}.png` });
}
console.log(`saved shots/w15-roulette-{${views.map(v => v[0]).join(',')}}-${TAG}.png`);
await b.close();
