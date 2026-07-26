#!/usr/bin/env node
// THE CLAIM: the blackjack table works IN THE WORLD — its panel opens in the
// built bundle, its keys reach it through K's gate, the world is frozen behind
// it, and the chips come out of and go back into the one wallet at the one rate.
//
// Its sibling `L-slots-inworld.mjs` walks a player to a stool and plays. This
// one cannot, and the difference is the whole of `notes/BLOCKED-L.md`: the felt
// table registers no seats, so there is no way for a player to reach the game
// and no way for a check to press the key that would. Everything downstream of
// the seat is testable, and all of it is tested here.
//
// WHY IT IS WORTH HAVING WITHOUT THE SEAT. Three of the faults this catches live
// in the join rather than in the game, and none of them can be seen by the node
// checks that prove the rules: keys that never arrive because a gate ate them,
// a world that keeps walking behind an open cabinet, and money that moves at a
// rate the slot machine does not use. `ct/hud.ts` has already had the first of
// those — the ATM opened, drew perfectly and answered no key at all, including
// ESC — so it is not a hypothetical.
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
const rules = await p.evaluate(() => window.__blackjack.rules());
console.log(`  a chip is $${CHIP.toFixed(2)};`
  + ` ${rules.decks} decks, blackjack pays ${rules.blackjackPays}\n`);

// ── the cabinet opens, and the world stops ──────────────────────────────────
await p.evaluate(() => window.__blackjack.open());
const opened = await until(() => window.__hud.panel() === 'ct-blackjack', 'the table to open');
check(opened, 'the table opens as a panel on K\'s shared cabinet');

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

// The one thing this file cannot test, said out loud rather than left as a gap
// somebody has to notice: there is no seat, so a player cannot reach any of the
// above. See notes/BLOCKED-L.md.
console.log('\n  NOT TESTED HERE: sitting down. The felt table registers no seats,');
console.log('  so nothing a player can press reaches this cabinet — notes/BLOCKED-L.md.\n');

await b.close();
console.log(bad === 0 ? `  ${mode}: all checks pass.\n` : `  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
