#!/usr/bin/env node
// THE CLAIM: blackjack is reachable now. int-casino.ts's felt table at
// (TX, TZ) = (-2.6, -13.0) — the one with a dealer standing at it — now
// registers four seats carrying blackjack.ts's own SEAT_LABEL, imported
// rather than retyped. Sitting on one should open the panel; standing up
// should close it and return the chips; and the three OTHER games' stools
// (roulette, craps, poker) must keep opening nothing at all.
//
//   SHOT_URL=http://localhost:4180/ node scripts/L-blackjack-reachable.mjs
//
// Exit codes: 0 fine, 1 wrong, 2 usage, 3 aborted — nothing measured.

import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN preview. No default (GOTCHAS §26, §48).');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 25000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  process.exit(3);
}
await reportWorld(p, URL);
await p.waitForTimeout(300);

const view = () => p.evaluate(() => window.__blackjack?.view?.() ?? null);
const panelUp = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const cash = () => p.evaluate(() => window.__blackjack.cash());
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});
const until = async (fn, what, ms = 15000) => {
  try { await p.waitForFunction(fn, { timeout: ms }); return true; }
  catch { console.log(`      (timed out waiting for ${what})`); return false; }
};

// ── 0. find the labelled seats live in the world (not hand-typed) ──────────
const seatInfo = await p.evaluate(() => {
  const seats = window.__ct.seats();
  const byLabel = {};
  for (const s of seats) { (byLabel[s.label] ??= []).push(s); }
  return Object.fromEntries(Object.entries(byLabel).map(([k, v]) => [k, v.length]));
});
console.log('\n  seat labels in the world:', JSON.stringify(seatInfo), '\n');

const bjLabel = 'sit at the blackjack table';
check((seatInfo[bjLabel] ?? 0) === 4, `4 seats carry '${bjLabel}' (found ${seatInfo[bjLabel] ?? 0})`);
// 'sit at the table' is not casino-exclusive: int-library.ts's 4 reading-table
// chairs (world x ~1085) share the same string. The casino's own 17 —
// roulette(5) + craps(6) + poker(6) — cluster at world x ~675-685, so filter
// on that rather than trusting the raw total.
const tableSeatsByRoom = await p.evaluate((label) => {
  const seats = window.__ct.seats().filter((s) => s.label === label);
  return { casino: seats.filter((s) => s.pose.x < 1000).length, other: seats.filter((s) => s.pose.x >= 1000).length };
}, 'sit at the table');
check(tableSeatsByRoom.casino === 17,
  `roulette(5) + craps(6) + poker(6) = 17 casino seats still carry 'sit at the table'`
  + ` (found ${tableSeatsByRoom.casino}; ${tableSeatsByRoom.other} more belong to other rooms, e.g. the library)`);

const bjSeat = await p.evaluate((label) => {
  const s = window.__ct.seats().find((s) => s.label === label);
  return s ? { x: s.pose.x, z: s.pose.z, yaw: s.pose.yaw, atX: s.at.x, atZ: s.at.z } : null;
}, bjLabel);
check(bjSeat !== null, `found a blackjack seat's world pose: ${JSON.stringify(bjSeat)}`);
if (!bjSeat) { await b.close(); process.exit(1); }

// ── 1. walk up to it and sit ────────────────────────────────────────────────
// Warp to the seat's own registered APPROACH point — crosstown.ts's `at`,
// which is where the [E] trigger actually lives (`s.approach ?? {x,z}`), not
// the seat's own x/z. Warping to the seat coordinate itself is what made the
// negative-control stools below look unreachable on the first run — they
// were reachable, the probe just stood in the wrong place.
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 3.6, 0), [bjSeat.atX, bjSeat.atZ]);
await p.waitForTimeout(1600);   // storey settle, GOTCHAS §51
const pr0 = await prompt();
console.log(`  approached the seat, prompt: ${JSON.stringify(pr0)}`);
check(pr0 === 'sit down' || (pr0 && pr0.includes('sit')), `an [E] prompt is offered near the seat (${JSON.stringify(pr0)})`);

await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await until(() => window.__ct.seated() !== null, 'the sit to land', 2000);
const seated = await p.evaluate(() => window.__ct.seated());
check(seated !== null, 'E sits the player down');

const opened = await until(() => window.__hud.panel() === 'ct-blackjack', 'the blackjack panel to open');
check(opened, 'sitting on the seat opens the blackjack panel');

if (opened) {
  const v0 = await view();
  console.log(`  view() at open: ${JSON.stringify(v0)}`);

  // ── 2. play a hand: buy in, deal, hit/stand ───────────────────────────────
  await p.evaluate(() => window.__blackjack.buyIn(200));
  const v1 = await view();
  check(v1.chips > 0, `bought in: ${v1.chips} chips`);
  console.log(`  view() after buyIn: ${JSON.stringify(v1)}`);

  await p.keyboard.press(' ');
  const dealt = await until(() => window.__blackjack.view().phase !== 'betting', 'SPACE to deal');
  check(dealt, 'SPACE deals a hand');
  const v2 = await view();
  console.log(`  view() after deal: ${JSON.stringify(v2)}`);

  const canAct = await until(() => {
    const v = window.__blackjack.view();
    return v.phase === 'player' && v.moves.length > 0;
  }, 'the table to offer a move', 5000);
  if (canAct) {
    await p.keyboard.press('h');
    // the hit card flies in on its own t0-based animation, during which
    // `moves` is deliberately empty (the painter's own rule, blackjack.ts
    // ~line 1120) so a key cannot be pressed on a hand mid-deal. Wait for it
    // to finish rather than for a fixed sleep (GOTCHAS §30).
    await until(() => {
      const v = window.__blackjack.view();
      return v.phase !== 'player' || v.moves.length > 0;
    }, 'the hit card to land and a move to be offered again');
    const v3 = await view();
    console.log(`  view() after H (hit): ${JSON.stringify(v3)}`);
    if (v3.phase === 'player' && v3.moves.length > 0) {
      await p.keyboard.press('s');
      const stood = await until(() => window.__blackjack.view().phase !== 'player', 'S to stand');
      check(stood, 'H hits and S stands — both letter keys reach the game');
    } else {
      check(true, 'H hit and the hand resolved on its own (bust or 21) — S was not needed');
    }
  } else {
    console.log('      (that hand was a natural — no move was ever offered)');
  }
  await until(() => window.__blackjack.view().phase === 'betting', 'the hand to settle', 25000);
  const v4 = await view();
  console.log(`  view() settled: ${JSON.stringify(v4)}\n`);

  // ── 3. stand up: the modal trap check ─────────────────────────────────────
  const chipsBeforeStand = v4.chips;
  const cashBeforeStand = await cash();
  await p.keyboard.press('Escape');
  const closed = await until(() => window.__hud.panel() === null, 'the panel to close on Escape');
  check(closed, 'Escape closes the panel (the modal-trap check, GOTCHAS/C-modal-traps-URGENT.md)');
  const stillSeated = await p.evaluate(() => window.__ct.seated());
  check(stillSeated === null, 'and standing up actually leaves the seat (seated() is null)');
  const cashAfterStand = await cash();
  console.log(`  stood up: rail ${chipsBeforeStand} chips -> wallet $${cashBeforeStand.toFixed(2)} -> $${cashAfterStand.toFixed(2)}`);
  check(Math.abs((cashAfterStand - cashBeforeStand) - chipsBeforeStand * await p.evaluate(() => window.__blackjack.chip())) < 1e-6
    || chipsBeforeStand === 0,
    'standing up returned the chips on the rail to the wallet');

  // prove the world is actually walkable again — not still frozen
  const before = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down('w'); await p.waitForTimeout(300); await p.keyboard.up('w');
  const after = await p.evaluate(() => window.__ct.pos());
  const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
  check(moved > 0.05, `movement works again after standing (${moved.toFixed(2)} m)`);
  // let residual momentum from that W-hold settle before the next warp — a
  // warp sets position, not velocity, and pressing straight into the
  // negative-control loop caught stool 0 mid-drift the first time this ran.
  await p.waitForTimeout(400);
}

// ── 4. the negative control: the OTHER three games must NOT open blackjack ──
console.log('\n  NEGATIVE CONTROL: roulette / craps / poker must not open blackjack\n');
const otherSeats = await p.evaluate(() => {
  const seats = window.__ct.seats().filter((s) => s.label === 'sit at the table' && s.pose.x < 1000);
  return seats.slice(0, 3).map((s) => ({ x: s.at.x, z: s.at.z }));
});
for (const [i, s] of otherSeats.entries()) {
  // Make sure the player is UNSEATED before this iteration's own E press,
  // whatever state the previous iteration left behind — otherwise E toggles
  // to "stand" instead of "sit" and the check is testing the wrong thing.
  const seatedBefore = await p.evaluate(() => window.__ct.seated());
  if (seatedBefore !== null) {
    await p.keyboard.press('e');
    await p.waitForTimeout(300);
  }
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [s.x, s.z]);
  await p.waitForTimeout(900);
  const pr = await prompt();
  const before = await p.evaluate(() => window.__hud?.panel?.() ?? null);
  // A single keydown/up pair right after a warp occasionally misses (found on
  // stool 0: the prompt was correctly offered, the press did nothing, and an
  // IDENTICAL press moments later — the loop's own "stand back up" — landed
  // it, at that seat, one iteration late). Not a seat-reachability fault: the
  // fix is to retry the press a couple of times, not to wait longer on one.
  let seatedNow = null;
  for (let attempt = 0; attempt < 3 && seatedNow === null; attempt++) {
    await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
    await until(() => window.__ct.seated() !== null, 'the sit to land', 1200);
    seatedNow = await p.evaluate(() => window.__ct.seated());
  }
  const panelNow = await p.evaluate(() => window.__hud?.panel?.() ?? null);
  console.log(`  stool ${i}: prompt ${JSON.stringify(pr)}  seatedBefore=${JSON.stringify(seatedBefore)}`
    + `  seatedNow=${JSON.stringify(seatedNow)}`);
  check(seatedNow !== null, `stool ${i}: sat down ('sit at the table')`);
  check(panelNow !== 'ct-blackjack', `stool ${i}: did NOT open blackjack (panel=${JSON.stringify(panelNow)})`);
  // stand back up for the next one
  await p.keyboard.press('e');
  await p.waitForTimeout(300);
}

check(errs.length === 0, `no console errors (${errs.length})${errs.length ? `: ${errs[0]}` : ''}`);

await b.close();
console.log(bad === 0 ? '\n  ALL CHECKS PASS.\n' : `\n  ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
