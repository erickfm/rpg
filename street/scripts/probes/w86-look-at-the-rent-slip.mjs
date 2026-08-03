// LOOK AT THE THING THE USER CALLED GRASS. Item 169.
//
// It is `ct/tenancy.ts:1120-1141` — the landlord's rent slip, pushed under the
// door of 301. It is `visible = false` until the rent is actually LATE, so it
// cannot be photographed without advancing the clock past a due day. This does
// that, stands in 301 on floor 3, and shoots it from the height a player's eye
// is actually at.
//
//   SHOT_URL=http://localhost:4420/ node scripts/probes/w86-look-at-the-rent-slip.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4420/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(600);

const slipVisible = () => p.evaluate(() => {
  let v = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements;
    if (Math.hypot(e[12] - 199.85, e[14] + 16.5) < 0.3 && Math.abs(e[13] - 5.412) < 0.1) v = o.visible;
  });
  return v;
});

console.log('\nrent at start:', JSON.stringify(await p.evaluate(() => ({
  day: window.__rent.day(), owed: window.__rent.owed(), paid: window.__rent.paidPeriods(),
}))));
console.log('slip visible at start:', await slipVisible());

// push forward whole days until the slip is down (a game day is 1440 min)
for (let d = 0; d < 30; d++) {
  await p.evaluate(() => window.__ct.advanceClock(1440, 0));
  await p.waitForTimeout(120);
  if (await slipVisible()) break;
}
const st = await p.evaluate(() => ({ day: window.__rent.day(), owed: window.__rent.owed() }));
console.log(`after advancing: day ${st.day}, owed ${st.owed}, slip visible ${await slipVisible()}`);

await p.evaluate(() => window.__ct.clock(12, 0));   // daylight to read the art
// clock() resets totalMin, so re-advance to keep the rent late
for (let d = 0; d < 30; d++) {
  await p.evaluate(() => window.__ct.advanceClock(1440, 0));
  await p.waitForTimeout(120);
  if (await slipVisible()) break;
}
console.log('slip visible after daylight reset:', await slipVisible());

// floor 3 of the walk-up: gy is the storey, not the eye
for (const [tag, x, z, yaw, pitch] of [
  ['standing', 198.9, -16.4, Math.atan2(199.85 - 198.9, -(-16.5 + 16.4)), -0.95],
  ['close', 199.5, -16.5, Math.atan2(199.85 - 199.5, 0.001), -1.15],
  ['overhead', 199.85, -16.42, 0, -1.45],
]) {
  await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, 5.4, pi), [x, z, yaw, pitch]);
  await p.waitForTimeout(1800);            // storey change settles, GOTCHAS 51
  await waitPainted(p, { quiet: true });
  await p.screenshot({ path: `shots/w86-rentslip-${tag}.png` });
  const pr = await p.evaluate(() => window.__ct.pos());
  console.log(`  ${tag}: stood ${JSON.stringify(pr)}  slip visible ${await slipVisible()}`);
}

// and what does the world OFFER there? the slip carries a spot.
const prompt = await p.evaluate(() => window.__ct.prompt && window.__ct.prompt());
console.log('\nprompt while standing on it:', JSON.stringify(prompt));
await b.close();
