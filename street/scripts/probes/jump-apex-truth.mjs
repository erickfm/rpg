// WHICH JUMP APEX READING IS TRUE — 5.260 m or ~0.57 m?
//
// scripts/jump-walk.mjs computes the rise as `apex - (pos()[3] + 1.62)`, i.e.
// it uses `apt.gy()` as the ground the player stands on. But fp.ts's camera is
//     y = height + groundY(pos.x, pos.z) + airY          (fp.ts:468)
// so the true baseline is `groundAt(x,z)`, not `apt.gy()`. The two are the same
// number only inside the apartment; outdoors they are unrelated quantities.
//
// This probe never needs a baseline constant at all: it records the camera at
// REST, then the camera at APEX, and subtracts. Whatever the ground is, it
// cancels. Sampling is done in-page on requestAnimationFrame, so it cannot miss
// the apex the way a 30 ms round-trip poll does.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

const spots = [
  ['the pavement', -6.0, -20.0, 0.14],
  ['the kerb edge', -5.1, -20.0, 0.14],
  ['the road', -2.0, -20.0, 0],
  ['the walk-up stoop', 6.2, -44.0, 0.14],
  ['inside, ground floor', 104, -16.0, 0],
  ['the apartment stairs', 112, -16.0, null],
  ['upstairs', 120, -16.0, null],
];

console.log('spot                    groundAt   apt.gy()   restCam    apex(true)  jump-walk would say');
for (const [what, x, z, gy] of spots) {
  await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [x, z, gy ?? 0]);
  await p.waitForTimeout(400);

  const rest = await p.evaluate(([x, z]) => ({
    cam: window.__ct.camY(),
    ground: window.__ct.groundAt(x, z),
    aptGy: window.__ct.pos()[3],
  }), [x, z]);

  // sample every rendered frame, in-page
  await p.evaluate(() => {
    window.__peak = -Infinity;
    window.__sampling = true;
    const f = () => {
      if (!window.__sampling) return;
      window.__peak = Math.max(window.__peak, window.__ct.camY());
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await p.keyboard.down(' '); await p.waitForTimeout(60); await p.keyboard.up(' ');
  await p.waitForTimeout(1100);
  const peak = await p.evaluate(() => { window.__sampling = false; return window.__peak; });

  const trueRise = peak - rest.cam;
  const jwRise = peak - (rest.aptGy + 1.62);
  console.log(
    `${what.padEnd(22)} ${rest.ground.toFixed(3).padStart(7)} ${rest.aptGy.toFixed(3).padStart(10)}` +
    ` ${rest.cam.toFixed(3).padStart(10)} ${trueRise.toFixed(3).padStart(11)} ${jwRise.toFixed(3).padStart(20)}`,
  );
}
console.log(`\nanalytic apex for vy=4.0, g=14:  ${(4.0 * 4.0 / (2 * 14)).toFixed(3)} m`);
await b.close();
