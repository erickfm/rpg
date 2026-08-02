#!/usr/bin/env node
// THE CLAIM: the blackjack table works IN THE WORLD — SITTING DOWN opens it
// (not a second [E], not a bare `window.__blackjack.open()` call), its keys
// reach it through K's gate, the world is frozen behind it, and the chips
// come out of and go back into the one wallet at the one rate.
//
// `notes/BLOCKED-L.md` used to be the reason this called `open()` directly:
// the felt table registered no seats, so there was no way for a player — or a
// check — to reach the game by sitting. `ct/int-casino.ts` closed that (four
// seats at `TX,TZ` carrying `blackjack.ts`'s own `SEAT_LABEL`, asserted by
// population in `L-blackjack-reachable.mjs`), which this file had not caught
// up to: it kept calling `open()` past nobody being seated, and `27be185fc`'s
// deliberate "NOT SEATED MEANS NOT OPEN, NO CONDITION ON IT" tick — the fix
// for the global `[E]` deadlock the user hit twice — closed the panel again
// one frame later, failing everything downstream. **The world was right; this
// check was calling a door that, by the time it was written, already had a
// real handle.** Fixed by using the handle: sit at the seat the world
// actually publishes, the same way `L-slots-inworld.mjs` does.
//
// WHY THIS IS WORTH HAVING BEYOND THE RULES CHECKS. Three of the faults this
// catches live in the join rather than in the game, and none of them can be
// seen by the node checks that prove the rules: keys that never arrive
// because a gate ate them, a world that keeps walking behind an open
// cabinet, and money that moves at a rate the slot machine does not use.
// `ct/hud.ts` has already had the first of those — the ATM opened, drew
// perfectly and answered no key at all, including ESC — so it is not a
// hypothetical. A fourth is added here: that the seat-close rule itself
// still fires on a force-stand that never touches the panel's own Escape
// handler, which is the exact shape of the bug `27be185fc` fixed.
//
//   SHOT_URL=http://localhost:<yours>/ node scripts/L-blackjack-inworld.mjs
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 aborted — nothing measured.

import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const MODES = ['all', 'money', 'keys'];
const mode = process.argv[2] ?? 'all';
if (!MODES.includes(mode)) {
  console.error(`usage: SHOT_URL=… node scripts/L-blackjack-inworld.mjs [${MODES.join('|')}]`);
  process.exit(2);
}
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
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 25000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  console.error('  Nothing was measured. This is not a red.');
  await b.close(); process.exit(3);
}
await reportWorld(p, URL);            // GOTCHAS §26: prove which build, do not name it
await p.waitForTimeout(300);

const view = () => p.evaluate(() => window.__blackjack?.view?.() ?? null);
const panelUp = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const cash = () => p.evaluate(() => window.__blackjack.cash());
const until = async (fn, what, ms = 15000) => {
  try { await p.waitForFunction(fn, { timeout: ms }); return true; }
  catch { console.log(`      (timed out waiting for ${what})`); return false; }
};

console.log('');
const live = await p.evaluate(() => typeof window.__blackjack?.open === 'function');
check(live, 'ct/blackjack.ts reached ct/world.ts\'s glob and register() ran —'
  + ' it is reached by a DYNAMIC import of ct/hud.ts, the shape that drops a module'
  + ' to an undefined namespace in the bundle while dev works (GOTCHAS §28)');
if (!live) { await b.close(); process.exit(1); }

const CHIP = await p.evaluate(() => window.__blackjack.chip());
// ONE RATE, ASSERTED ACROSS THE TWO GAMES.
//
// `ct/blackjack.ts` carries a `CHIP_HINT` fallback so its painter can answer
// "can this player buy in at all" when drawn outside the world, and `register()`
// sets it from `ct/slots.ts`'s `CREDIT`. A fallback that is never checked is a
// second exchange rate waiting to happen, and the comment beside it promises
// this check exists — so it does.
const SLOT_CREDIT = await p.evaluate(() => window.__slots?.credit?.() ?? null);
check(SLOT_CREDIT !== null && Math.abs(CHIP - SLOT_CREDIT) < 1e-9,
  `a blackjack chip and a slot credit are the SAME money ($${CHIP.toFixed(2)}`
  + ` vs $${SLOT_CREDIT === null ? '?' : SLOT_CREDIT.toFixed(2)}) — one building`
  + ' cannot have two exchange rates, and the felt\'s fallback constant is where'
  + ' a second one would quietly appear');
const rules = await p.evaluate(() => window.__blackjack.rules());
console.log(`  a chip is $${CHIP.toFixed(2)};`
  + ` ${rules.decks} decks, blackjack pays ${rules.blackjackPays}\n`);

// ── SITTING DOWN IS THE TRIGGER, not a bare open() call ─────────────────────
//
// Aimed from the SOURCE, never from memory (GOTCHAS §20): the seat is found
// by asking the world for its seats and matching blackjack.ts's own label,
// the same pattern `L-slots-inworld.mjs` and `L-blackjack-reachable.mjs` both
// use, so this keeps working if the casino floor is ever re-laid. The label
// itself is a citation copy of `SEAT_LABEL` in `ct/blackjack.ts` — a script
// cannot import a TS module the browser build compiled, so every check in
// this file's family (L-blackjack-reachable.mjs included) hardcodes the same
// string rather than each guessing its own.
const BJ_LABEL = 'sit at the blackjack table';
const bjSeats = await p.evaluate(
  (label) => window.__ct.seats().filter((s) => s.label === label), BJ_LABEL);
console.log(`  ${bjSeats.length} seats publish themselves as '${BJ_LABEL}'\n`);
if (!bjSeats.length) {
  console.error(`ABORTED: no seat in the world is labelled '${BJ_LABEL}'.`
    + ' Either the casino did not build or the felt table lost its seats —'
    + ' see notes/BLOCKED-L.md. Nothing below was measured.');
  await b.close(); process.exit(3);
}
check(bjSeats.length === 4, `4 seats on the player side of the felt table (found ${bjSeats.length})`);

const seat = bjSeats[0];
await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, 0, 0), seat);
await until(() => {
  const d = document.getElementById('ct-prompt');
  return !!d && d.style.display !== 'none' && /blackjack/i.test(d.textContent ?? '');
}, 'the seat to offer itself');
const beforeSit = await panelUp();
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
const seated = await until(() => !!window.__ct.seated(), 'the player to be seated');
const opened = await until(() => window.__hud.panel() === 'ct-blackjack', 'the table to open');
console.log(`  sat at (${seat.pose.x.toFixed(2)}, ${seat.pose.z.toFixed(2)});`
  + ` panel before: ${beforeSit ?? 'none'}\n`);
check(seated, 'pressing E at the seat actually seats the player');
check(beforeSit === null, 'no panel was up beforehand — the check is measuring the sit');
check(opened, 'SITTING DOWN OPENS THE TABLE — the seat is the trigger, not a second [E]'
  + ' and not a bare open() call past the "not seated means not open" rule');

// THE FREEZE, checked with a control rather than trusted. A modal that traps you
// and a modal that works look identical until you try to walk.
const before = await p.evaluate(() => window.__ct.pos());
await p.keyboard.down('w'); await p.waitForTimeout(450); await p.keyboard.up('w');
const during = await p.evaluate(() => window.__ct.pos());
const movedWhileOpen = Math.hypot(during[0] - before[0], during[2] - before[2]);
console.log(`  held W with the table up: moved ${movedWhileOpen.toFixed(2)} m\n`);
check(movedWhileOpen < 0.05,
  `the world is frozen behind it (${movedWhileOpen.toFixed(2)} m) — you cannot walk`
  + ' out of the casino while a hand is in front of you');

// ── THE TRAP THIS ITEM PROTECTS AGAINST: a force-stand, not the panel's own
// Escape ─────────────────────────────────────────────────────────────────
//
// `ct/blackjack.ts`'s tick rule is "NOT SEATED MEANS NOT OPEN, NO CONDITION
// ON IT" (27be185fc) — written because a stand that never touches
// `panel.close()` (a warp, a floor change, or — exactly what this calls —
// `__ct.stand()` reaching straight past the panel) used to leave the table
// open with nobody sitting at it, and `ct/hud.ts` blocks keydown EVERYWHERE
// while a panel is open, which is the global `[E]` deadlock the user hit
// twice. Every check above this line stands up through the panel's own
// Escape handler, which cannot exercise that rule at all. This can.
await p.evaluate(() => window.__ct.stand());
const autoClosed = await until(() => window.__hud.panel() === null,
  'the table to close on a force-stand', 2000);
check(autoClosed, 'standing WITHOUT Escape still closes the table — the "not seated'
  + ' means not open" rule still fires on a force-stand, the exact shape of the'
  + ' [E] deadlock this item exists to keep closed');

// Sit back down: the mode-gated checks below assume an open table.
await p.evaluate((s) => window.__ct.warp(s.at.x, s.at.z, 0, 0, 0), seat);
await p.waitForTimeout(200);
await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
await until(() => window.__hud.panel() === 'ct-blackjack', 'the table to re-open');

if (mode === 'keys' || mode === 'all') {
  // ── the keys reach it through the gate ────────────────────────────────────
  //
  // `ct/hud.ts`'s gate takes keydown before the world sees it, which is what
  // makes digits usable inside a panel and is also how the ATM once opened and
  // answered nothing at all. So the letters are pressed for real rather than
  // called through the station.
  await p.evaluate(() => window.__blackjack.buyIn(200));
  const idle = await view();
  check(idle.chips >= 100, `bought in: ${idle.chips} chips on the rail`);

  await p.keyboard.press(' ');
  const dealt = await until(() => window.__blackjack.view().phase !== 'betting', 'SPACE to deal');
  check(dealt, 'SPACE deals a hand — the key reaches the panel through the gate');

  const reached = await until(() => {
    const v = window.__blackjack.view();
    return v.phase === 'player' && v.moves.length > 0;
  }, 'the table to offer a move');
  if (reached) {
    const v0 = await view();
    const cards0 = v0.hands[0].cards.length;
    // STAND is always offered, so it is the one key that can be pressed on any
    // hand without the check having to reason about strategy.
    await p.keyboard.press('s');
    const stood = await until(() => window.__blackjack.view().phase !== 'player', 'S to stand');
    check(stood, 'S stands — a letter key is dispatched to the game, not to the world');
    check(cards0 >= 2, `and the hand it was offered on was real (${cards0} cards)`);
  } else {
    // A natural resolves without ever offering a move. Not a failure — but say
    // so, rather than reporting a pass on a hand that was never played.
    console.log('      (that hand was a natural — no move was ever offered)');
  }
  await until(() => window.__blackjack.view().phase === 'betting', 'the hand to settle', 25000);
}

if (mode === 'money' || mode === 'all') {
  console.log('\n  THE ONE WALLET\n');
  await until(() => window.__blackjack.view().phase === 'betting', 'the table to be idle');
  // Empty the rail first so the arithmetic starts from a known place.
  await p.keyboard.press('c');
  await p.waitForTimeout(250);
  const c0 = await cash();
  const v0 = await view();
  check(v0.chips === 0, `the rail starts empty (${v0.chips})`);

  await p.keyboard.press('i');                      // buy in $20
  await p.waitForTimeout(300);
  const v1 = await view();
  const c1 = await cash();
  console.log(`  I: chips ${v0.chips} -> ${v1.chips}   wallet $${c0.toFixed(2)} -> $${c1.toFixed(2)}\n`);
  check(v1.chips > v0.chips, `I buys in (+${v1.chips - v0.chips} chips)`);
  check(c1 < c0, 'and it comes out of the ONE wallet, not a second one');
  check(Math.abs((c0 - c1) - (v1.chips - v0.chips) * CHIP) < 1e-6,
    `at exactly $${CHIP.toFixed(2)} a chip — the SAME rate the slot machine uses,`
    + ' read from ct/slots.ts rather than declared twice, so one building cannot'
    + ' have two exchange rates');

  // ESC has to pay you out. It is the only way a player leaves, and a cabinet
  // that keeps the chips is a bug he finds in one sitting.
  const held = v1.chips;
  await p.keyboard.press('Escape');
  await until(() => window.__hud.panel() === null, 'the table to close');
  const c2 = await cash();
  const v2 = await view();
  console.log(`  ESC: left holding ${held} chips; rail now ${v2.chips};`
    + ` wallet $${c1.toFixed(2)} -> $${c2.toFixed(2)}\n`);
  check(await panelUp() === null, 'ESC closes the table');
  check(v2.chips === 0, 'the rail is empty when you leave — no chips survive the sitting');
  check(Math.abs(c2 - (c1 + held * CHIP)) < 1e-6,
    `and all ${held} of them came back to the wallet — the same contract the slot`
    + ' machine has, so "what you win is in your wallet when you stand up" is true'
    + ' by construction in both games');
  check(Number.isInteger(v1.chips) && Number.isInteger(v2.chips),
    'and the rail is whole chips throughout — 3:2 on an odd stake pays half a chip,'
    + ' which is how float money got into the wallet the first time');
}

check(errs.length === 0, `no console errors (${errs.length})${errs.length ? `: ${errs[0]}` : ''}`);

await b.close();
console.log(bad === 0 ? `  ${mode}: all checks pass.\n` : `  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
