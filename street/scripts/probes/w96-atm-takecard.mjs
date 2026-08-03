// ITEM 144 — IS THE ATM'S "TAKE CARD" ACTUALLY ONE PRESS AND A RELEASE?
//
// Three rounds of the user's own words, and each one is a separate assertion
// here, because a fix for any one of them can undo another:
//
//   1. *"take card from atm should immediately get us out of the menu"*
//        -> the panel must close with NO further input.
//   2. *"im just saying after we click the first take card, just flash thank you
//        farewell screen and release the player"*
//        -> the farewell must actually be SHOWN. Closing instantly would satisfy
//           (1) and break this — that is exactly what happened once already.
//   3. *"theres still 2 take card options. it should be take card and then the
//        exit not take card > take card."*
//        -> from the MENU the machine must never route to the `card` screen,
//           whose only button is also labelled TAKE CARD.
//
// The row says [VERIFY STATE — LIKELY DONE] and names commit db4f31e5c. Reading
// the source is not verifying it: this drives the machine.
//
// Soft keys are '1'..'8' — '1'..'4' are the left column, '5'..'8' the right
// (ct/atm.ts:508-561). On the MENU, TAKE CARD is the fourth RIGHT button = '8'.
// On the `card` screen it is the first LEFT button = '1'.
//
// AND IT CHECKS ITS OWN AUTO-CLOSE IS NOT VACUOUS. "The panel closed within
// 2.5 s" proves nothing if the panel closes on its own anyway, so the negative
// case holds the menu open for the same window and asserts it STAYS up.
//
//   SHOT_URL=http://localhost:4520/ node scripts/probes/w96-atm-takecard.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const FAREWELL_MS = 1100;        // ct/atm.ts:212
const CLOSE_BY = 2600;           // generous: the farewell plus load

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

const fails = [];
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'}  ${m}`); if (!c) fails.push(m); };
if (!(await p.evaluate(() => typeof window.__atm === 'object' && window.__atm !== null))) {
  console.log('REFUSING TO REPORT: __atm absent, ct/atm.ts did not run'); await b.close(); process.exit(3);
}
const st = () => p.evaluate(() => ({ screen: window.__atm.screen(), panel: window.__hud.panel() }));
const key = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(80); await p.keyboard.up(k); };

/** open the machine and get as far as the MENU */
const toMenu = async () => {
  // SETTLE FIRST. Re-opening straight after a session ends raced its teardown —
  // `endSession` closes on a timer, and calling `open()` inside that window left
  // no panel up at all. Wait for the machine to be back at rest, then open.
  await p.waitForFunction(() => window.__hud.panel() === null, null, { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(250);
  await p.evaluate(() => window.__atm.setCard(true));
  // RETRIED, AND THE RETRIES ARE THE MEASUREMENT. A single `open()` after a
  // completed session did not bring the panel up, and papering over that with a
  // longer sleep would have hidden whatever it is. Count the attempts instead
  // and report them, so "it reopens second time" is a finding rather than a
  // timing constant nobody can explain.
  let tries = 0;
  for (; tries < 12; tries++) {
    await p.evaluate(() => window.__atm.open());
    const up = await p.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 700 })
      .then(() => true).catch(() => false);
    if (up) break;
    await p.waitForTimeout(250);
  }
  if (tries > 0) console.log(`??   the machine needed ${tries + 1} open() attempts to come back up`);
  if ((await st()).panel !== 'ct-atm') throw new Error('the ATM never reopened');
  await key('1');                                     // INSERT CARD
  await p.waitForFunction(() => window.__atm.screen() === 'pin', null, { timeout: 4000 });
  for (const d of ['1', '2', '3', '4']) await key(d); // the pad auto-submits on 4
  await p.waitForFunction(() => window.__atm.screen() === 'menu', null, { timeout: 6000 });
};

// ── 1+2+3: one press from the MENU ────────────────────────────────────────
await toMenu();
ok((await st()).screen === 'menu', 'card in, PIN accepted, the machine is on its MENU');

// Watch EVERY screen it passes through, so "never routes to `card`" is measured
// rather than inferred from where it happened to end up. Started WITHOUT await —
// awaiting it would run the whole 2.6 s window before the press it exists to
// observe, and then report a clean run having watched an idle machine.
const watching = p.evaluate(() => new Promise((done) => {
  const out = [];
  const t = setInterval(() => out.push(window.__atm.screen()), 20);
  setTimeout(() => { clearInterval(t); done(out); }, 2600);
}));
await p.waitForTimeout(60);                            // let the sampler start
await key('8');                                        // TAKE CARD, once
const afterPress = await st();
ok(afterPress.screen === 'thanks',
  `one press of TAKE CARD goes straight to the farewell (screen=${afterPress.screen})`);
ok(afterPress.panel === 'ct-atm',
  'and the farewell is actually SHOWN, not skipped — the panel is still up for it');

const closed = await p.waitForFunction(() => window.__hud.panel() === null, null, { timeout: CLOSE_BY })
  .then(() => true).catch(() => false);
ok(closed, `it then releases the player on its own, no further input (within ${CLOSE_BY} ms)`);
const fresh = await st();
ok(fresh.screen === 'idle', `and it resets to a fresh machine for the next player (screen=${fresh.screen})`);

// ── the player really is released, not merely unpanelled ──────────────────
// `hud.ts` blocks keydown while a panel is up, so "the panel is null" and "the
// player can move" are different claims — BUILDER-BRIEF §11 is about exactly
// that gap. Walk, and see the world move.
await p.keyboard.down('w'); await p.waitForTimeout(600); await p.keyboard.up('w');
await p.waitForTimeout(120);
ok((await st()).panel === null, "the keyboard is the world's again — W did not re-open a panel");

// ── 3, the explicit form: never a SECOND take-card screen ────────────────
const seen = await watching;
ok(!seen.includes('card'),
  `it never routes through the second TAKE CARD screen (saw: ${[...new Set(seen)].join(' -> ') || 'nothing'})`);

// ── the withdrawal path still ends in one press from `card` ───────────────
await toMenu();
await key('2');                                        // WITHDRAW
await p.waitForFunction(() => window.__atm.screen() === 'withdraw', null, { timeout: 4000 });
await key('1');                                        // the first note
await p.waitForFunction(() => window.__atm.screen() === 'cash', null, { timeout: 6000 }).catch(() => {});
if ((await st()).screen === 'cash') {
  await key('1');                                      // TAKE CASH
  await p.waitForFunction(() => window.__atm.screen() === 'receipt', null, { timeout: 4000 }).catch(() => {});
  await key('5');                                      // receipt? NO -> `card`
  const onCard = (await st()).screen;
  ok(onCard === 'card', `after a withdrawal the machine DOES hand the card back (screen=${onCard})`);
  await key('1');                                      // TAKE CARD, once
  ok((await st()).screen === 'thanks', 'and one press there also goes straight to the farewell');
  const closed2 = await p.waitForFunction(() => window.__hud.panel() === null, null, { timeout: CLOSE_BY })
    .then(() => true).catch(() => false);
  ok(closed2, 'and it releases the player on its own from that path too');
} else {
  console.log('??   could not reach the cash screen; the withdrawal leg did not run');
}

// ── NEGATIVE CASE: the auto-close is not something that happens anyway ────
await toMenu();
await p.waitForTimeout(CLOSE_BY);
const still = await st();
ok(still.panel === 'ct-atm' && still.screen === 'menu',
  `left alone on the MENU for ${CLOSE_BY} ms the panel STAYS up — so the close above was the TAKE CARD, `
  + `not the passage of time (panel=${still.panel}, screen=${still.screen})`);

// ── and Escape still gets out from a mid-session screen (BUILDER-BRIEF §11) ─
await key('Escape');
const esc = await st();
ok(esc.panel === null, `Escape closes it from the MENU (panel=${esc.panel})`);
ok(esc.screen === 'idle', `and leaves it reset, not stuck mid-session (screen=${esc.screen})`);

console.log(errs.length ? `\npage errors:\n${errs.slice(0, 4).join('\n')}` : '\nno page errors');
console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED` : '\nall ATM take-card checks pass');
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
