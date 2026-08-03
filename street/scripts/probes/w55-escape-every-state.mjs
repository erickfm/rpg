#!/usr/bin/env node
// ITEM 100: CAN YOU ALWAYS GET UP? FROM EVERY STATE THE MACHINE HAS.
//
// BUILDER-BRIEF §11 and the worst bug this project ships. The user, twice:
// *"no im telling you i can't get up anything i do once i sit down"*.
//
// This machine now LOCKS THE CAMERA as well as swallowing the keyboard, so
// there are more ways to be stuck than there were: the panel can close and
// leave the view locked, the view can release and leave the player on the
// stool, the stool can release and leave the pointer captive. Each is a
// different half of "trapped" and each looks fine from the other two.
//
// So every state is escaped and FIVE things are asserted each time:
//   · the panel is down
//   · the player is off the stool
//   · the field of view is back to the player's own zoom, not the lean-in
//   · the cursor is the page's again, not the machine's pixel hand
//   · THE FEET ACTUALLY MOVE — walked, not inferred
//
// That last one is the only one that cannot be faked by a flag, and it is the
// one the user's complaint was actually about.
//
//   SHOT_URL=http://localhost:4183/ node scripts/probes/w55-escape-every-state.mjs
//
// Exit 0 fine, 1 measured and wrong, 3 nothing measured.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL to YOUR OWN server.'); process.exit(3); }

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 20000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  await b.close(); process.exit(3);
}
await p.waitForTimeout(600);

const until = async (fn, what, ms = 12000) => {
  try { await p.waitForFunction(fn, { timeout: ms }); return true; }
  catch { console.log(`      (timed out waiting for ${what})`); return false; }
};

const seats = await p.evaluate(() =>
  window.__ct.seats().filter((x) => x.label === 'sit at the slot'));
if (!seats.length) {
  console.error("ABORTED: no seat is labelled 'sit at the slot'. Nothing below was measured.");
  await b.close(); process.exit(3);
}
console.log(`\n  ${seats.length} slot stools on the floor.\n`);

/** The player's resting fov, read BEFORE any machine is opened — the number the
 *  lock has to hand back. Read, not typed: `crosstown.ts` owns a scroll-zoom
 *  smoother and its resting value is not this file's business. */
const RESTING_FOV = await p.evaluate(() => window.__ct.camera().fov);
console.log(`  the player's own field of view is ${RESTING_FOV.toFixed(1)}°\n`);

const state = () => p.evaluate(() => ({
  panel: window.__hud.panel(),
  seated: !!window.__ct.seated(),
  fov: window.__ct.camera().fov,
  cursor: document.body.style.cursor,
  pos: window.__ct.pos(),
  machine: window.__slots.view().state,
  credits: window.__slots.view().credits,
}));

/** Sit at the next unused stool, so no two cases share a machine — a stool that
 *  refuses to re-offer itself would otherwise make every case after the first
 *  free (GOTCHAS §34). */
let seatIx = 0;
const sitDown = async () => {
  const s = seats[(seatIx++ * 7) % seats.length];
  await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[3], 0), s);
  const offered = await until(() => {
    const d = document.getElementById('ct-prompt');
    return !!d && d.style.display !== 'none' && /sit at the slot/.test(d.textContent ?? '');
  }, 'the stool to offer itself');
  if (!offered) return false;
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  return until(() => window.__hud.panel() === 'ct-slots', 'the machine to open');
};

/**
 * DOES HE ACTUALLY WALK? Not "is a flag clear" — hold a key and measure the
 * ground he covers. A screenshot cannot prove you are not wedged and neither
 * can `seated === false`.
 *
 * S, NOT W, AND THE FIRST VERSION OF THIS WENT RED FOR THE WRONG REASON.
 *
 * `FirstPerson.stand()` puts you back where you sat down from and does not turn
 * you round, so the moment you get up you are standing at the stool FACING THE
 * MACHINE — with a 0.6 m cabinet and a bank of five more behind it directly
 * ahead. Pressing W there walks into a collider, and on the first stool measured
 * it covered exactly 0.00 m. Nothing was wrong: you cannot walk through a slot
 * machine, and a check that demands you can is a check that fails on a correct
 * world. (The other five stools moved 0.75 m, which is a player SLIDING along
 * that collider at an angle rather than walking freely — the same non-answer
 * wearing a plausible number, which is worse. Half of the "defects" on this
 * project are the instrument; BUILDER-BRIEF §7.)
 *
 * Backing away from the machine you have just got up from is both unambiguous
 * and the thing the user's complaint is actually about — he could not leave.
 */
const canWalk = async () => {
  const a = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down('s');
  await p.waitForTimeout(500);
  await p.keyboard.up('s');
  await p.waitForTimeout(120);
  const c = await p.evaluate(() => window.__ct.pos());
  return Math.hypot(c[0] - a[0], c[2] - a[2]);
};

/** Escape from wherever we are, then prove all five things. */
const escapeFrom = async (name) => {
  const before = await state();
  console.log(`  ${name}: machine ${before.machine}, ${before.credits} credits,`
    + ` panel ${before.panel}, fov ${before.fov.toFixed(1)}°`);
  check(before.panel === 'ct-slots', `${name}: the machine is up — the case is real, not free`);
  check(Math.abs(before.fov - RESTING_FOV) > 0.5,
    `${name}: the view IS locked to the machine (${before.fov.toFixed(1)}° vs`
    + ` ${RESTING_FOV.toFixed(1)}°) — otherwise there is nothing to release`);

  await p.keyboard.down('Escape'); await p.waitForTimeout(90); await p.keyboard.up('Escape');
  await p.waitForTimeout(400);
  const s = await state();
  check(s.panel === null, `${name}: ESCAPE PUTS THE MACHINE DOWN`);
  check(s.seated === false, `${name}: …and takes you off the stool`);
  check(Math.abs(s.fov - RESTING_FOV) < 0.5,
    `${name}: …and gives the field of view back (${s.fov.toFixed(1)}°)`);
  check(s.cursor === '', `${name}: …and gives the page its own cursor back ("${s.cursor}")`);
  const walked = await canWalk();
  console.log(`      backed away for half a second and moved ${walked.toFixed(2)} m\n`);
  check(walked > 0.15, `${name}: …AND THE FEET ACTUALLY MOVE`);
};

// ── 1. IDLE, EMPTY METER — the state you land in ─────────────────────────────
if (await sitDown()) await escapeFrom('idle, empty');
else { console.error('ABORTED: could not sit down at all.'); await b.close(); process.exit(3); }

// ── 2. IDLE WITH CREDITS ON THE METER ────────────────────────────────────────
if (await sitDown()) {
  await p.evaluate(() => window.__slots.insert(40));
  await p.waitForTimeout(200);
  await escapeFrom('idle, credits up');
  const cashed = await p.evaluate(() => window.__slots.view().credits);
  check(cashed === 0,
    'leaving a loaded machine does not eat the meter — ESC must never be the'
    + ' expensive choice');
}

// ── 3. MID-SPIN, with the reels turning ──────────────────────────────────────
if (await sitDown()) {
  await p.evaluate(() => window.__slots.insert(40));
  await p.keyboard.down(' '); await p.waitForTimeout(90); await p.keyboard.up(' ');
  await until(() => window.__slots.view().state === 'spinning', 'the reels to start');
  await escapeFrom('mid-spin');
}

// ── 4. MID-PAYOUT, with the meter counting up ────────────────────────────────
//
// The one state `settled()` reports false for on purpose, and therefore the one
// most likely to have a guard in front of it that refuses to let go.
if (await sitDown()) {
  await p.evaluate(() => window.__slots.insert(400));
  let paying = false;
  for (let i = 0; i < 60 && !paying; i++) {
    await p.keyboard.down(' '); await p.waitForTimeout(90); await p.keyboard.up(' ');
    paying = await until(() => window.__slots.view().state === 'paying', 'a win', 2600);
    if (!paying) await until(() => window.__slots.view().state === 'idle', 'the spin to end');
  }
  if (paying) await escapeFrom('mid-payout');
  else console.log('  (no win came up in 60 spins — the mid-payout case was not measured)\n');
  check(paying, 'a paying spin was actually reached — the case above is not free');
}

// ── 5. IN ATTRACT, after the machine has been left alone ─────────────────────
if (await sitDown()) {
  await until(() => window.__slots.view().idleT > 7, 'the attract to start', 15000);
  const attracting = await p.evaluate(() => window.__slots.view().idleT > 6);
  check(attracting, 'the machine really is in attract — the case below is not free');
  await escapeFrom('in attract');
}

// ── 6. AND YOU CAN SIT BACK DOWN AFTERWARDS ──────────────────────────────────
//
// fp.ts's `forceUp` note: Escape has two independent paths to standing up, and
// a stranded flag un-seats you one frame after you next sit ANYWHERE. That bug
// is invisible in every case above, because each of them ends standing.
const again = await sitDown();
check(again, 'AND YOU CAN SIT BACK DOWN — a stranded forceUp would un-seat you'
  + ' one frame after the next sit (fp.ts:251)');
if (again) {
  await p.waitForTimeout(400);
  const still = await state();
  check(still.panel === 'ct-slots' && still.seated,
    '…and you are still there half a second later, not bounced back off');
  await escapeFrom('after re-sitting');
}

check(errs.length === 0, `no page errors (${errs.length})`);
if (errs.length) console.log(`   ${errs.join('\n   ')}`);
console.log(`\n  ${bad === 0 ? 'all checks pass' : `${bad} FAILED`}.\n`);
await b.close();
process.exit(bad ? 1 : 0);
