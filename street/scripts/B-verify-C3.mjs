// VERIFYING C's THREE TV ROWS.
//
// The middle one is the fix for a bug I reproduced and reported, so checking it
// is squarely mine: I found that while seated the prompt read "[E] sit on the
// bed and watch TV" — a spot guarded by !rig.seated, therefore dead — so E
// resolved to something that refused to act and the player could not get up.
//
// C's claims:
//   STOP    prompt reads "[E] stop watching TV", does not change however you
//           look, no longer depends on spot selection, and E leaves the seat
//   BLACK   the set is black when off
//   ADS     ten FORMATS, not twenty palettes of one; predicate userData.tv.fmt
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(23, 10));
await settle(p);

const st = () => p.evaluate(() => ({
  seated: typeof window.__ct.seated === 'function' ? !!window.__ct.seated() : null,
  tv: window.__ct.scene().userData.tv,
  prompt: (() => {
    const e = [...document.querySelectorAll('*')]
      .find((q) => /\[E\]/.test(q.textContent || '') && q.children.length === 0);
    return e ? e.textContent.trim() : '';
  })(),
}));

console.log('\n════ ROW: "how do i stop watching the tv" — the fix for my repro ════');
let s = await st();
console.log(`  standing    prompt ${JSON.stringify(s.prompt)}`);
await p.keyboard.press('e');
await p.waitForTimeout(1300);
s = await st();
console.log(`  seated      prompt ${JSON.stringify(s.prompt)}   seated ${s.seated}   on ${s.tv?.on}`);
console.log(`  -> reads "stop watching": ${/stop watching/i.test(s.prompt)}`);

// THE CLAIM IS THAT IT DOES NOT DEPEND ON WHERE YOU LOOK. My original repro was
// at one facing; C says 6 of 6. Sweep more than that, and CLICK-FREE — the warp
// rotates the rig, which is the trap C itself recorded on the fade row.
const facings = [];
// RECORD `seated` AT EACH FACING. My first sweep did not, reported the prompt
// as "sit on the bed" at all eight yaws, and I was about to file that as the
// row's claim failing. But WARPING MAY END THE SIT — C recorded exactly this
// trap on the fade row ("the warp rotated me off the facing I had just set") —
// and a prompt reading "sit" is CORRECT for somebody who is no longer sitting.
// If `seated` is false here, this sweep measures the affordance, not the row.
for (const yaw of [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4, 6.0]) {
  await p.evaluate(([y]) => {
    const q = window.__ct.pos();
    window.__ct.warp(q[0], q[2], y, undefined, 0);
  }, [yaw]);
  await p.waitForTimeout(260);
  const q = await st();
  facings.push([yaw.toFixed(1), q.prompt, q.seated]);
}
const stillSeated = facings.every(([, , sd]) => sd);
console.log(`  still seated through the sweep: ${stillSeated ? 'yes' : 'NO — the warp ended the sit, so this sweep measures the affordance'}`);
const stopAll = stillSeated && facings.every(([, t]) => /stop watching/i.test(t));
console.log(`  across ${facings.length} facings: ${stopAll ? 'ALL read "stop watching TV"' : 'IT CHANGES —'}`);
if (!stopAll) for (const [y, t, sd] of facings) console.log(`      yaw ${y}  seated ${sd}  ${JSON.stringify(t)}`);

// and the thing that was actually broken: does E get you OUT?
let out = false;
for (let i = 1; i <= 3; i++) {
  await p.keyboard.press('e');
  await p.waitForTimeout(1000);
  const q = await st();
  console.log(`  E #${i}         seated ${q.seated}   prompt ${JSON.stringify(q.prompt)}`);
  if (!q.seated) { out = true; console.log(`  -> STOOD UP on press ${i}. My repro no longer reproduces.`); break; }
}
if (!out) console.log('  -> STILL SEATED after three presses — the bug I reported is LIVE');

// ── the ads: ten FORMATS, not twenty palettes of one ─────────────────────
console.log('\n════ ROW: "more diversity on the ads" ════');
await p.keyboard.press('e'); await p.waitForTimeout(1200);   // back in the seat to keep it running
const seen = new Map();
const start = Date.now();
while (Date.now() - start < 40000) {
  const t = await p.evaluate(() => window.__ct.scene().userData.tv);
  if (t?.on && t.fmt) seen.set(t.fmt, (seen.get(t.fmt) ?? 0) + 1);
  await p.waitForTimeout(160);
}
console.log(`  userData.tv.fmt published: ${seen.size > 0}`);
console.log(`  distinct FORMATS seen: ${seen.size}   (the row claims TEN)`);
console.log('  ' + [...seen.keys()].join(' · '));
await b.close();
