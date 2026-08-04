// WHY DOES `[E]` NOT STAND YOU OFF 301's BED — when a probe that seats you with
// `__ct.sit()` gets up with `[E]` perfectly well?
//
// Item 307. K-tv-off-unless-seated sits by WALKING UP AND PRESSING E, then
// presses E again and stays seated. `w132-seat-triage.mjs` seats through
// `__ct.sit(realPose)` from the same square and `[E]` frees it. The two differ
// only in HOW the player sat down, so this replays K's approach exactly and
// dumps the HUD prompt at the instant E is pressed — the prompt names which
// verb `[E]` is spent on, which is the whole question.
//
// Usage: SHOT_URL=http://127.0.0.1:4190/ node scripts/probes/w132-bed-exit.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://127.0.0.1:4190/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 520 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(1500);

const SPAWN = await p.evaluate(() => window.__ct.pos());
const ROOM_GY = SPAWN[3];
const at = (x, z, yaw = 0) => p.evaluate(([X, Z, Y, GY]) => window.__ct.warp(X, Z, Y, GY), [x, z, yaw, ROOM_GY]);
const prompt = () => p.evaluate(() => {
  const e = document.getElementById('ct-prompt');
  return e && e.style.display !== 'none' ? e.textContent : null;
});
const seated = () => p.evaluate(() => window.__ct.seated() !== null);
const settled = () => p.waitForTimeout(220);

const seat = await p.evaluate(() => window.__ct.spots().find((s) => /sit on the bed/i.test(s.label)) ?? null);
console.log(`\n  seat spot at (${seat.x.toFixed(2)}, ${seat.z.toFixed(2)})  r=${seat.r}\n`);

// K's own sweep for a square that offers the seat.
let stand = null;
for (let dx = -1.4; dx <= 1.4 && !stand; dx += 0.35) {
  for (let dz = -1.4; dz <= 1.4 && !stand; dz += 0.35) {
    await at(seat.x + dx, seat.z + dz, Math.atan2(-dx, dz));
    await settled();
    const q = await prompt();
    if (q && /sit on the bed/i.test(q)) stand = { x: seat.x + dx, z: seat.z + dz, yaw: Math.atan2(-dx, dz) };
  }
}
console.log(`  K stands at (${stand.x.toFixed(2)}, ${stand.z.toFixed(2)}) yaw ${stand.yaw.toFixed(2)}`);
console.log(`  prompt there: ${JSON.stringify(await prompt())}\n`);

await p.keyboard.down('e');
await p.waitForFunction(() => window.__ct.seated() !== null, null, { timeout: 6000 }).catch(() => {});
await p.keyboard.up('e');
await p.waitForTimeout(900);
console.log(`  after E: seated=${await seated()}`);
console.log(`  SEATED PROMPT — the verb [E] is spent on: ${JSON.stringify(await prompt())}`);
console.log(`  seated pose: ${JSON.stringify(await p.evaluate(() => window.__ct.seated()))}`);
console.log(`  tv.on: ${await p.evaluate(() => window.__ct.scene().userData?.tv?.on)}`);
console.log(`  panel: ${JSON.stringify(await p.evaluate(() => window.__hud?.panel?.() ?? null))}\n`);

// Now K's second E, one press at a time, reporting after each.
for (let i = 1; i <= 3; i++) {
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(900);
  console.log(`  E #${i}: seated=${await seated()}  prompt=${JSON.stringify(await prompt())}  `
    + `panel=${JSON.stringify(await p.evaluate(() => window.__hud?.panel?.() ?? null))}`);
  if (!(await seated())) break;
}
console.log('');
await b.close();
