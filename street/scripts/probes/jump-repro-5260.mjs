// REPRODUCE the 5.260 m "jump" w14 reported on the pavement.
//
// Claim: it is not a jump at all. The world spawns you in the walk-up on floor
// 3 (apartment.ts SPAWN.gy = 2*ST0 = 5.4), so the camera opens at eye 7.02
// ("Eye height lands at 7.02" — apartment.ts:104). jump-walk.mjs samples
// `camY()` for its apex WITHOUT ever confirming the camera has moved off that
// spawn value, and reports
//     rise = apex - (pos()[3] + 1.62)
// On the FIRST spot in its list — the pavement, the only one whose "previous"
// camera is the spawn — a camera still reading 7.02 gives
//     7.02 - (0.14 + 1.62) = 5.260
// exactly the reported number. Every later spot inherits the previous spot's
// already-settled camera, which is why they all read a sane 0.48-0.62.
//
// This probe shows the same page producing 5.260 or 0.475 purely by how long
// the settle is, with no change to the world at all.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';

async function run(settleMs, starve = false) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

  // A CONTENDED MACHINE. `waitForTimeout` is wall-clock, not frames: if no
  // frame renders between the warp and the first apex sample, camY still holds
  // the pre-warp spawn value. w14's note is titled "server death"; ports
  // 4184-4199 were all occupied the night this was measured.
  if (starve) {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  }

  // exactly jump-walk.mjs's first spot
  await p.evaluate(() => window.__ct.warp(-6.0, -20.0, 0, 0.14, 0));
  await p.waitForTimeout(settleMs);
  const before = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down(' '); await p.waitForTimeout(60); await p.keyboard.up(' ');
  let apex = 0;
  for (let t = 0; t < 900; t += 30) {
    await p.waitForTimeout(30);
    apex = Math.max(apex, await p.evaluate(() => window.__ct.camY()));
  }
  const rise = apex - (before[3] + 1.62);
  console.log(`settle ${String(settleMs).padStart(4)} ms${starve ? ', CPU x20 starved' : '               '}`
    + ` -> apt.gy() ${before[3].toFixed(2)}`
    + `  peak camY ${apex.toFixed(3)}  jump-walk reports rise ${rise.toFixed(3)} m`);
  await b.close();
}

console.log('spawn eye height is 7.02 (apartment floor 3 = 5.4, + 1.62 eye)');
console.log('7.02 - (0.14 + 1.62) = ' + (7.02 - (0.14 + 1.62)).toFixed(3) + '  <- the reported number\n');
for (const ms of [0, 8, 30, 120, 350]) await run(ms);
console.log('');
for (const ms of [350, 350, 350]) await run(ms, true);
