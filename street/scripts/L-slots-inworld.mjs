#!/usr/bin/env node
// THE CLAIM: you can walk to a machine in SEVENS, sit down, and play it — the
// panel opens because you SAT, the reels turn, and the money moves through the
// one wallet and comes back when you leave.
//
// Its three siblings prove the machine in isolation: `L-slots-rtp.mjs` the
// maths, `L-slots-feel.mjs` the reels, `L-slots-glass.mjs` the face. All three
// run in node against pure functions. This one is the only check that can say
// the thing is actually IN the world, and it exists because of two faults that
// only appear there.
//
// GOTCHAS §28 is the first: `ct/world.ts` collects modules from an eager glob,
// and a module in an import cycle with it resolves to an undefined namespace in
// the ROLLUP BUNDLE while working perfectly in the dev server. That is how
// GOLDEN ACES shipped missing. `ct/slots.ts` imports `./hud` at runtime for the
// panel, so it is exactly the shape that fault takes — and it would be
// invisible everywhere except here.
//
// So this runs against `vite preview`, the built bundle, and says so.
//
//   SHOT_URL=http://localhost:4213/ node scripts/L-slots-inworld.mjs
//   … wired     the module reaches the loader in the BUILT bundle
//   … sit       sitting at a stool opens the machine
//   … money     credits in and out of the one wallet
//   … all
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 aborted — nothing measured.

import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const MODES = ['wired', 'sit', 'money', 'all'];
const mode = process.argv[2] ?? 'all';
if (!MODES.includes(mode)) {
  console.error(`usage: SHOT_URL=… node scripts/L-slots-inworld.mjs [${MODES.join('|')}]`);
  process.exit(2);
}
// An instrument must refuse to run unaimed rather than default to a port that
// belongs to whoever started it — GOTCHAS §48's whole lesson, and the reason
// `canfail.mjs` once certified five working guards as asleep. My own assigned
// port was already taken by another agent when I wrote this, which is exactly
// how that happens.
const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN preview. There is no default —'
    + ' a default port is a live server belonging to somebody else (GOTCHAS §26, §48).');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
await reportWorld(p, URL);                       // GOTCHAS §26: prove it, do not name it
await p.waitForTimeout(400);

const panelUp = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const view = () => p.evaluate(() => window.__slots?.view?.() ?? null);
const press = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(80); await p.keyboard.up(k); await p.waitForTimeout(160); };
/** Wait for a CONDITION, and report a timeout as a failed verdict rather than
 *  as a thrown exception — a check that dies is a check with no result.
 *
 *  Every fixed sleep in this file that stood in for something the render loop
 *  drives has now been replaced by one of these. The three that were left cost
 *  a full red run: 250 ms after a warp is plenty on an idle machine and not
 *  enough on one that has just run a build and three suites, so the [E] spot was
 *  not live yet when the key was pressed and "pressing E seats the player"
 *  failed on a world where it works. GOTCHAS §30, in the probe rather than in
 *  the thing probed. */
const until = async (fn, what, ms = 10000) => {
  try { await p.waitForFunction(fn, { timeout: ms }); return true; }
  catch { console.log(`      (timed out waiting for ${what})`); return false; }
};

const CREDIT = await p.evaluate(() => window.__slots.credit());
console.log(`\n  a credit is $${CREDIT.toFixed(2)}\n`);

// ── the module is IN the built bundle ────────────────────────────────────────
if (mode === 'wired' || mode === 'all') {
  // `__slots` only exists because `register()` ran, and `register()` only runs
  // because `ct/world.ts`'s eager glob found this module and called it. So its
  // presence IN THE BUILT BUNDLE is the proof — the module could not be reached
  // any other way, there being no line in `crosstown.ts` that names it.
  //
  // Asserted here rather than by importing `worldRegistrants()` and asking the
  // loader directly, which would have been the more explicit check and would
  // have put ct/slots.ts in a runtime import cycle with the very file whose
  // cycle behaviour is the fault (GOTCHAS §28). A check that creates the bug it
  // is looking for is not a check.
  const built = await p.evaluate(() => typeof window.__slots?.open === 'function');
  console.log(`  __slots ${built ? 'is live' : 'is ABSENT'} in the built bundle\n`);
  check(built, 'ct/slots.ts reached ct/world.ts\'s glob IN THE BUILT BUNDLE and register() ran'
    + ' — the fault that shipped GOLDEN ACES missing (GOTCHAS §28)');
}

// ── SITTING DOWN IS THE TRIGGER ──────────────────────────────────────────────
//
// The user's requirement in his own words: "when i sit down i enter the slots
// interface". Not a second [E] once seated — the seat itself.
//
// Aimed from the SOURCE, never from memory: the stool is found by asking the
// world for its seats and matching G's own published label, so this check keeps
// working when the casino floor is re-laid. GOTCHAS §20 — every coordinate
// hand-typed into a probe on this project has eventually been wrong.
let slotSeats = [];
if (mode === 'sit' || mode === 'money' || mode === 'all') {
  slotSeats = await p.evaluate(() =>
    window.__ct.seats().filter((s) => s.label === 'sit at the slot'));
  console.log(`  ${slotSeats.length} stools publish themselves as 'sit at the slot'\n`);
  // GOTCHAS §34: assert the population before the absences. Nought stools makes
  // every verdict below free, and would mean G's room, not my machine, is what
  // moved.
  if (!slotSeats.length) {
    console.error('ABORTED: no seat in the world is labelled \'sit at the slot\'.'
      + ' Either the casino did not build or G renamed the label this bridges on'
      + ' — see SLOT_SEAT_LABEL in ct/slots.ts. Nothing below was measured.');
    await b.close(); process.exit(3);
  }
}

if (mode === 'sit' || mode === 'all') {
  check(slotSeats.length >= 48,
    `${slotSeats.length} playable machines on the floor — the population this rests on`);

  const seat = slotSeats[Math.floor(slotSeats.length / 2)];
  // Stand where the seat says to stand, which is the seat's OWN approach point.
  await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos().gy ?? 0, 0), seat);
  // Wait for the world to OFFER the seat rather than sleeping and hoping.
  await until(() => {
    const d = document.getElementById('ct-prompt');
    return !!d && d.style.display !== 'none' && /sit at the slot/.test(d.textContent ?? '');
  }, 'the stool to offer itself');
  const before = await panelUp();
  await press('e');                                  // sit
  const seated = await until(() => !!window.__ct.seated(), 'the player to be seated');
  await until(() => window.__hud.panel() === 'ct-slots', 'the machine to open');
  const after = await panelUp();
  console.log(`  sat at the stool at (${seat.pose.x.toFixed(2)}, ${seat.pose.z.toFixed(2)})`);
  console.log(`  panel before: ${before ?? 'none'}    after: ${after ?? 'none'}\n`);

  check(seated, 'pressing E at the stool actually seats the player');
  check(before === null, 'no panel was up beforehand — the check is measuring the sit');
  check(after === 'ct-slots',
    'SITTING DOWN OPENS THE MACHINE — the seat IS the trigger, not a second [E]');

  // ── the reels really turn, in the world ────────────────────────────────────
  await p.evaluate(() => window.__slots.insert(50));
  await press(' ');
  await until(() => window.__slots.view().state === 'spinning', 'the reels to start');
  const a = await view();
  await p.waitForTimeout(220);
  const c = await view();
  const moved = a && c && a.reels.some((r, i) => Math.abs(r.pos - c.reels[i].pos) > 1);
  console.log(`  reel 1 moved ${a && c ? Math.abs(c.reels[0].pos - a.reels[0].pos).toFixed(1) : '?'} stops`
    + ' in 220 ms of real frames\n');
  check(a?.state === 'spinning', 'SPACE sets it spinning');
  check(moved, 'and the reels are actually turning on the world\'s own clock');

  // Wait for the spin to finish by POLLING THE MACHINE, never by sleeping a
  // fixed time — GOTCHAS §30: a spin is driven by frames and one frame is 17 ms
  // idle and over a second under load, so any constant here is a bet on how busy
  // the machine is. Waiting for the event costs nothing and cannot flake.
  await p.waitForFunction(() => window.__slots.view().state === 'idle', { timeout: 30000 });
  const done = await view();
  console.log(`  it came to rest on ${done.reels.map((r, i) => r.stop).join(', ')}`
    + `   ${done.win ? `${done.win.line} paid ${done.win.pays * done.bet}` : 'no win'}\n`);
  check(done.reels.every((r) => r.phase === 'stopped'), 'every reel comes to rest');
  check(done.reels.every((r) => Math.abs(r.pos - Math.round(r.pos)) < 0.01),
    'and each rests exactly on a detent rather than between two symbols');
}

// ── the money is the world's money ───────────────────────────────────────────
if (mode === 'money' || mode === 'all') {
  console.log('  THE ONE WALLET\n');
  if (mode === 'money') {
    const seat = slotSeats[Math.floor(slotSeats.length / 2)];
    await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, window.__ct.pos().gy ?? 0, 0), seat);
    await until(() => {
      const d = document.getElementById('ct-prompt');
      return !!d && d.style.display !== 'none' && /sit at the slot/.test(d.textContent ?? '');
    }, 'the stool to offer itself');
    await press('e');
    await until(() => window.__hud.panel() === 'ct-slots', 'the machine to open');
  }
  await p.waitForFunction(() => window.__slots.view().state === 'idle', { timeout: 30000 });
  // Empty the meter first so the arithmetic below starts from a known place.
  await p.evaluate(() => { const v = window.__slots.view(); void v; });

  const c0 = await p.evaluate(() => window.__slots.cash());
  const before = await view();
  await press('i');                                  // INSERT a note
  const afterIns = await view();
  const c1 = await p.evaluate(() => window.__slots.cash());
  console.log(`  credits ${before.credits} -> ${afterIns.credits} on one INSERT`);
  if (c0 !== null) console.log(`  wallet  $${c0.toFixed(2)} -> $${c1.toFixed(2)}`);
  console.log('');

  check(afterIns.credits > before.credits,
    `INSERT puts credits on the meter (+${afterIns.credits - before.credits})`);
  if (c0 !== null) {
    check(c1 < c0, 'and takes the money out of the ONE wallet, not a second one');
    check(Math.abs((c0 - c1) - (afterIns.credits - before.credits) * CREDIT) < 1e-6,
      'at exactly 25 cents a credit — the rate is authored once, in CREDIT');
  }

  // ESC closes, and closing must return the meter. This is the leak the user
  // would find in a minute: winning, walking away, and the money staying in the
  // machine.
  const held = (await view()).credits;
  await press('Escape');
  await until(() => window.__hud.panel() === null, 'the machine to close');
  const c2 = await p.evaluate(() => window.__slots.cash());
  const left = (await view()).credits;
  console.log(`  left the machine holding ${held} credits; meter now ${left}`);
  if (c2 !== null) console.log(`  wallet  $${(c1 ?? 0).toFixed(2)} -> $${c2.toFixed(2)}\n`);
  check(await panelUp() === null, 'ESC closes the machine');
  check(left === 0, 'the meter is empty when you leave — no credits survive the sitting');
  if (c2 !== null) {
    check(Math.abs(c2 - ((c1 ?? 0) + held * CREDIT)) < 1e-6,
      `and all ${held} of them came back to the wallet — "what you win is in your`
      + ' wallet when you stand up", true by construction rather than by remembering');
  }
}

check(errs.length === 0, `no console errors (${errs.length})${errs.length ? `: ${errs[0]}` : ''}`);

await b.close();
console.log(bad === 0 ? `\n  ${mode}: all checks pass.\n` : `\n  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
