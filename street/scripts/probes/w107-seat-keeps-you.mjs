// CLOSING A PANEL FROM A CHAIR MUST LEAVE YOU IN THE CHAIR. Item 206.
//
// *"you sit and its the loan process as an integrated overlay."* Sitting down,
// reading the form, closing it and finding yourself standing up is not that.
//
// WALKED AND SAT, not warped-and-asserted: this is a seat, and CLAUDE.md says
// movement, collision, floors and seats are verified by doing them.
//
// ⚠ THE FRAME AFTER MATTERS AS MUCH AS THE FRAME OF. `fp.ts:251` sets a private
// `forceUp` from a CAPTURE-phase Escape listener, and `update()`'s seated branch
// consumes it on the NEXT frame. So a fix that merely skips `rig.stand()` inside
// `leave()` stands the player up one frame later instead of immediately — the
// same bug wearing a delay, and invisible to any check that reads `seated`
// once. Every assertion below re-reads it after several painted frames.
//
// It must also NOT regress item 188: 29 seats released by [E], 0 trapped.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4188/');
let fails = 0, checks = 0;
const ok = (c, w) => { checks++; if (!c) { fails++; console.log(`  FAIL  ${w}`); } else console.log(`  ok    ${w}`); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const seated = () => p.evaluate(() => window.__ct.seated());
/**
 * TURN THE SITTER'S HEAD toward a spot, without moving him.
 *
 * ⚠ WHY THIS IS HERE AND WHY THE ITEM'S STAGE NEEDED IT. From the bank's client
 * chair the loan application sits at 0.95 m and **43 degrees off the seat's own
 * yaw**, while `fp.ts:880`'s `lookTolerance` caps the cone at 15 degrees. So a
 * sitter who never turns his head is offered `stand up` and nothing else — which
 * is not a bug, it is `pickSpot`'s seated rule doing exactly what item 188 built
 * it to do (*"seated: you can look, and that is all"*). A player turns to the
 * form; a probe has to be told to.
 *
 * `warp` to the SAME x and z with a new yaw: while seated `update()` draws the
 * camera from `this.pos`, which this does not move.
 */
const faceSpot = async (rx) => p.evaluate((rx) => {
  const [px, , pz] = window.__ct.pos();
  const s = (window.__ct.spots() || [])
    .filter((q) => q.ok && new RegExp(rx, 'i').test(q.label || ''))
    .sort((a, c) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(c.x - px, c.z - pz))[0];
  if (!s) return null;
  window.__ct.warp(px, pz, Math.atan2(s.x - px, -(s.z - pz)));
  return s.label;
}, rx);
const panelId = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const settle = async (n = 6) => waitPainted(p, { frames: n });
// HELD, never tapped: the [E] dispatch is an edge read once per rendered frame
// and a press that opens and closes inside one frame is never observed
// (BUILDER-BRIEF §5).
const hold = async (key) => {
  await p.keyboard.down(key); await p.waitForTimeout(120); await p.keyboard.up(key);
  await settle();
};

// the chair that carries the loan application — found by asking, not by typing
// its coordinates, so the check follows the room if the room moves
// `crosstown.ts:399` — SEATS entries are { pose:{x,z,yaw,h}, at:{x,z}, r, label }
// with `label` a plain STRING. The first cut of this called it, got
// "q.label is not a function", and that is the cheap version of the mistake
// this project keeps paying for: I guessed a shape instead of reading it.
// ⚠ NOT THE BANK'S CLIENT CHAIR, which is where this item's report points and
// where I started. That chair CANNOT open a panel today and the reason is
// measured in `scripts/probes/w107-seated-landing.mjs`: sitting in it moves the
// player 1.13 m, `crosstown.ts:2290` latches `landing` above 1.0 m, and
// `crosstown.ts:2188` then makes `canSee` false for EVERY spot until you WALK
// 1.2 m away — which a seated player cannot do. Exactly 2 of the world's 219
// seats are in that trap and that is one of them, so item 188's own contract
// (`[E] read the loan application`) is dead there by 13 cm. Reported, not fixed:
// it is a different item.
//
// The library computer is the stage that works: `ct/library-pc.ts` opens its
// diegetic terminal from `SEAT_LABEL = 'sit at the computer'`, and that seat
// does not move you far enough to latch.
const chair = await p.evaluate(() => {
  const s = (window.__ct.seats() || []).find((q) => /sit at the computer/i.test(q.label || ''));
  if (!s) return null;
  return { x: s.pose.x, z: s.pose.z, yaw: s.pose.yaw, ax: s.at.x, az: s.at.z,
    hop: Math.hypot(s.pose.x - s.at.x, s.pose.z - s.at.z) };
});
if (!chair) {
  console.log('COULD NOT FIND THE COMPUTER SEAT in __ct.seats() — not measuring');
  await b.close(); process.exit(3);
}
console.log(`computer seat at (${chair.x.toFixed(2)}, ${chair.z.toFixed(2)}), approach (${chair.ax.toFixed(2)}, ${chair.az.toFixed(2)}), the sit moves you ${chair.hop.toFixed(2)} m`);

// THE BANK KEEPS HOURS: `shut()` swaps the loan prompts for "the applications
// are put away until nine" outside nine-to-four. 10:00 measured open.
await p.evaluate(() => window.__ct.clock(10, 0));
await waitPainted(p, { frames: 6 });

// ── walk to it and sit ────────────────────────────────────────────────────
console.log('\n=== SIT DOWN ===');
await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0),
  [chair.ax, chair.az, Math.atan2(chair.x - chair.ax, -(chair.z - chair.az))]);
await settle(8);
await hold('e');
ok(!!(await seated()), 'sat down in the client chair');

// ── open the panel from the chair ─────────────────────────────────────────
console.log('\n=== THE TERMINAL OPENS FROM THE CHAIR ===');
// `ct/library-pc.ts` opens the terminal the moment you are on that seat, so
// there is nothing to press — which is the cleanest possible stage for this
// item: nothing about HOW the panel opened can be blamed for the exit.
await settle(12);
const openId = await panelId();
console.log(`  panel: ${openId}`);
ok(!!openId, `a diegetic panel is up, opened from the chair (${openId})`);
ok(!!(await seated()), 'still seated with the panel up');

// ── ESCAPE: the panel goes, the chair stays ───────────────────────────────
console.log('\n=== ESCAPE — the panel goes, the chair stays ===');
await p.keyboard.press('Escape');
await settle(10);
ok(!(await panelId()), 'Escape closed the panel');
const stillA = await seated();
console.log(`  seated immediately after: ${!!stillA}`);
ok(!!stillA, 'STILL IN THE CHAIR one frame after Escape');
await settle(30);
const stillB = await seated();
console.log(`  seated 30 painted frames later: ${!!stillB}`);
ok(!!stillB, 'STILL IN THE CHAIR 30 frames later — forceUp did not eject us late');

// ── and the second Escape stands you up ───────────────────────────────────
console.log('\n=== AND ESCAPE IS NOT AMBIGUOUS — a second one stands you up ===');
await p.keyboard.press('Escape');
await settle(12);
ok(!(await seated()), 'a second Escape stands you up out of the chair');

// ── [E] must still stand you up from a chair with no panel ────────────────
console.log('\n=== [E] STILL STANDS YOU UP (item 188s contract) ===');
await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0),
  [chair.ax, chair.az, Math.atan2(chair.x - chair.ax, -(chair.z - chair.az))]);
await settle(8);
await hold('e');
ok(!!(await seated()), 're-sat in the chair');
await settle(12);          // the terminal opens itself again
await hold('e');           // [E] closes it — the framework's own exit
ok(!(await panelId()), '[E] closed the panel');
const afterE = await seated();
console.log(`  seated after [E] closed the panel: ${!!afterE}`);
ok(!!afterE, '[E] out of the panel ALSO leaves you in the chair');
// ⚠ AND [E] DOES *NOT* STAND YOU UP HERE, which is correct and is item 188's
// own contract rather than a regression. `ct/library-pc.ts:896` registers a
// `use the computer` spot aimed from this very seat — added, its comment says,
// precisely so that "the day 206 lands a dismissed machine has no way back at
// all". So once you are left in the chair, `[E]` is spent on the machine in
// front of you and **[ESC] is the stand-up**, which is exactly what the seated
// prompt advertises. A check that demanded `[E]` stand you up here would be
// demanding the bug back.
const seatedPrompt = await p.evaluate(() => document.querySelector('#ct-prompt')?.textContent ?? '');
console.log(`  seated prompt with the panel closed: "${seatedPrompt.trim()}"`);
ok(/\[E\]/.test(seatedPrompt) && /\[ESC\]/.test(seatedPrompt),
  `the prompt names BOTH exits, so ESC is never ambiguous ("${seatedPrompt.trim()}")`);
await p.keyboard.press('Escape');
await settle(12);
ok(!(await seated()), 'and [ESC] from the seated state stands you up');

// ── the walk-up-standing case must be untouched ───────────────────────────
//
// The whole risk of this change is that a screen opened while STANDING now
// leaves the player stuck in the focus seat. `chair` is null there, so the old
// behaviour should be exact — but "should be" is how the regressions get in.
console.log('\n=== A SCREEN OPENED STANDING STILL RELEASES YOU ===');
const atm = await p.evaluate(() => {
  const s = (window.__ct.spots() || []).find((q) => /atm|cash/i.test(q.label ?? ''));
  return s ? { x: s.x, z: s.z } : null;
});
if (!atm) console.log('  (no ATM spot offered right now — skipped, and NOT counted as a pass)');
else {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [atm.x, atm.z]);
  await settle(8);
  await hold('e');
  const id = await panelId();
  console.log(`  panel: ${id}`);
  if (!id) console.log('  (nothing opened — skipped, and NOT counted as a pass)');
  else {
    ok(!!(await seated()), 'the focus lock seats the player while the screen is up');
    await p.keyboard.press('Escape');
    await settle(12);
    ok(!(await seated()), 'Escape from a STANDING screen releases the lock as it always did');
  }
}

console.log(`\nconsole errors: ${errs.length}${errs.length ? '\n  ' + errs.join('\n  ') : ''}`);
ok(errs.length === 0, 'no page errors');
console.log(`\n${checks - fails}/${checks} passed`);
await b.close();
if (!checks) process.exit(3);
process.exit(fails ? 1 : 0);
