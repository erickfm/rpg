// WHY NOTHING IS EVER OFFERED FROM A CHAIR YOU HAD TO WALK TO. Item 206's
// stage would not assemble, and this is why.
//
// `crosstown.ts:2290` latches `landing` whenever an act moves the player more
// than 1.0 m — the anti-yo-yo rule for doors and teleports, and correct for
// them. `crosstown.ts:2188` then makes `canSee` return FALSE for EVERY spot
// while `landing` is set, and `crosstown.ts:2155` clears it only by WALKING
// 1.2 m away.
//
// A SEAT IS AN ACT THAT MOVES YOU AND THEN TAKES YOUR LEGS. So any seat whose
// approach is more than 1.0 m from its pose latches `landing` at the moment you
// sit, and nothing can clear it until you stand up again — the seated pick is
// blind for as long as you are in the chair.
//
// Prints two things: which of the world's seats are in that trap, and what
// `__ct.landing()` reads immediately after sitting in one.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage();
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const seats = await p.evaluate(() => (window.__ct.seats() || []).map((s) => ({
  label: s.label,
  hop: Math.hypot(s.pose.x - s.at.x, s.pose.z - s.at.z),
  x: s.pose.x, z: s.pose.z, ax: s.at.x, az: s.at.z, yaw: s.pose.yaw,
})));
const LATCH = 1.0;                       // crosstown.ts's own "moved you" test
const trapped = seats.filter((s) => s.hop > LATCH);
console.log(`${seats.length} seats registered`);
console.log(`${trapped.length} of them move the player MORE than ${LATCH} m when you sit`);
console.log('  -> those latch `landing`, and `canSee` is false for every spot until you stand');
const byLabel = new Map();
for (const s of trapped) byLabel.set(s.label, (byLabel.get(s.label) ?? 0) + 1);
for (const [l, n] of [...byLabel].sort((a, c) => c[1] - a[1]).slice(0, 14)) {
  console.log(`   ${String(n).padStart(3)}x  ${l}`);
}
const near = seats.filter((s) => s.hop <= LATCH);
console.log(`\n${near.length} seats move you ${LATCH} m or LESS — these are the ones where a seated [E] can see anything`);
const nearBy = new Map();
for (const s of near) nearBy.set(s.label, (nearBy.get(s.label) ?? 0) + 1);
for (const [l, n] of [...nearBy].sort((a, c) => c[1] - a[1]).slice(0, 14)) {
  console.log(`   ${String(n).padStart(3)}x  ${l}`);
}

// and the live reading, in the bank's client chair
const chair = seats.find((s) => /client chair/i.test(s.label));
if (chair) {
  await p.evaluate(() => window.__ct.clock(10, 0));
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0),
    [chair.ax, chair.az, Math.atan2(chair.x - chair.ax, -(chair.z - chair.az))]);
  await waitPainted(p, { frames: 8 });
  const before = await p.evaluate(() => window.__ct.landing());
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await waitPainted(p, { frames: 10 });
  const after = await p.evaluate(() => ({
    landing: window.__ct.landing(), seated: !!window.__ct.seated(),
    prompt: document.querySelector('#ct-prompt')?.textContent ?? '',
  }));
  console.log(`\nthe bank's client chair — the seat item 188 built its contract on`);
  console.log(`  the sit moves you ${chair.hop.toFixed(2)} m (latch is ${LATCH})`);
  console.log(`  landing before sitting: ${JSON.stringify(before)}`);
  console.log(`  landing after sitting:  ${JSON.stringify(after.landing)}`);
  console.log(`  seated ${after.seated}, prompt "${after.prompt.trim()}"`);
  console.log(`  clearIn is how far you must WALK to clear it. You are sitting down.`);
}
await b.close();
