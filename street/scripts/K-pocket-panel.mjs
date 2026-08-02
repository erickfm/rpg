// THE CLAIM: the pockets panel opens on `i`, it and the wallet are never out at
// the same time, the wheel chooses a pocket, and G drops the pocket you chose.
//
// Split from `K-pocket-loop.mjs` because it is a different claim about a
// different thing — that one is about the world changing when you take
// something, this one is about the screen.
//
// WHETHER IT IS ON SCREEN IS READ FROM THE ELEMENT'S OWN RECTANGLE, not from a
// flag the module sets. Both panels park themselves off the bottom of the
// viewport with `translateY(150%)`, so "is it visible" has an answer that does
// not depend on believing the code: is any of it inside the window. A boolean
// going true would pass just as happily with the canvas painted transparent,
// parked, or 3000 px wide.
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-pocket-panel.mjs [--selftest]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const URL = aim('http://localhost:4292/');
const ARGS = flags(['--selftest']);
const SELFTEST = ARGS.selftest;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

// on screen = any part of the element inside the viewport, and BIG enough to be
// a panel rather than a sliver
//
// OPACITY IS PART OF "SHOWN" NOW, and it has to be. The held wallet parks itself
// off the bottom of the viewport, so a rectangle test alone answered it; a
// `makePanel` cabinet is always centred and only FADES in, so by position alone
// it is on screen the moment it is built. A predicate that was right about one
// presentation and silently wrong about the other is GOTCHAS §34 — the check
// would have gone on passing while measuring nothing.
const onScreen = (id) => page.evaluate((q) => {
  const el = document.getElementById(q);
  if (!el) return { there: false, shown: false, h: 0 };
  const r = el.getBoundingClientRect();
  const o = parseFloat(getComputedStyle(el).opacity || '0');
  return {
    there: true, h: Math.round(r.height), o: +o.toFixed(2),
    shown: o > 0.5 && r.top < window.innerHeight - 40 && r.height > 100,
  };
}, id);
// the transition is 180 ms of CSS, so POLL for the rectangle rather than sleep
// on it — GOTCHAS §30, the same reason the take is polled and not slept on.
const settle = (id, want) => page.waitForFunction(([q, w]) => {
  const el = document.getElementById(q);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const o = parseFloat(getComputedStyle(el).opacity || '0');
  return (o > 0.5 && r.top < window.innerHeight - 40 && r.height > 100) === w;
}, [id, want], { timeout: 5000 }).catch(() => {});

// RIGHT-CLICK IS HELD, NOT CLICKED. `main.ts` turns the right button into a
// pseudo-key in `input.keys` and `crosstown.ts` reads it once a frame with an
// edge test, so a down-then-immediately-up can land entirely between two frames
// and the wallet never hears about it. GOTCHAS §30, and it caught me here: the
// first run of this check reported six reds that were all one dropped click —
// the wallet not opening, so the next `i` TOGGLED THE PANEL SHUT instead of
// re-opening it, so the wheel had nothing to move and G fell back to dropping
// the last-taken thing. One event, six wrong verdicts, all of them mine.
const rightClick = async () => {
  await page.mouse.move(640, 360);
  await page.mouse.down({ button: 'right' });
  // held across frames, not clicked — but NOT waited on for a result, because
  // "the wallet does not appear" is now one of the outcomes being tested
  await page.waitForTimeout(320);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(200);
};

if (!(await page.evaluate(() => typeof window.__inv === 'object' && window.__inv !== null))) {
  console.log('__inv absent — ct/inventory.ts did not run in this build; nothing measured');
  await browser.close(); process.exit(3);
}

// ── the panel exists, and starts PUT AWAY ────────────────────────────────
const start = await onScreen('ct-pockets');
ok(start.there, 'the pockets panel is built');
ok(!start.shown, 'it starts put away, not lying open over the world');

// ── a population, before anything is asserted about what it shows ────────
//
// The starting purse holds cereal; a check that ran on empty pockets would pass
// its selection tests over nothing at all (GOTCHAS §34), so this walks to a
// newspaper and takes it first — two kinds, which is also the minimum that
// makes "the wheel MOVED the selection" mean anything.
const spot = await page.evaluate(() => window.__ct.spots().find((q) => /take the folded newspaper/.test(q.label)) ?? null);
ok(spot !== null, 'there is a newspaper to put in it');
if (!spot) { await browser.close(); process.exit(3); }
await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z)), [spot.x, spot.z]);
await page.keyboard.down('e');
await page.waitForFunction(() => (window.__inv.pockets().NEWSPAPER ?? 0) > 0, { timeout: 8000 }).catch(() => {});
await page.keyboard.up('e');
const kinds = await page.evaluate(() => window.__inv.slots());
ok(kinds.length >= 2, `carrying ${kinds.length} kinds (${kinds.join(', ')}) — floor 2`);
if (kinds.length < 2) { console.log('EMPTY SUBJECT SET'); await browser.close(); process.exit(3); }

// ── i opens it ───────────────────────────────────────────────────────────
await page.keyboard.press('i');
await settle('ct-pockets', true);
const opened = await onScreen('ct-pockets');
ok(opened.shown, `i brings the pockets out (${opened.h} px on screen)`);

// ── one thing in your hands at a time ────────────────────────────────────
//
// Two claims, and they are different since the pockets moved onto the panel
// framework — this block used to test only the second and now goes red if
// either breaks.
//
// FIRST, THE FREEZE: with a cabinet up, the world behind it hears nothing, and
// the wallet is part of the world behind it. A right-click must do NOTHING.
// (Before the framework it opened the wallet and closed the pockets, which was
// the old exclusion; the new answer is stronger and the old assertion was
// stale, not the code.)
await rightClick();
const frozen = { pockets: await onScreen('ct-pockets'), wallet: await onScreen('ct-wallet') };
ok(!frozen.wallet.shown, 'a right-click with the pockets up does NOT open the wallet — the world is frozen');
ok(frozen.pockets.shown, '…and the pockets are still the thing in your hands');

// SECOND, THE EXCLUSION, checked from the other side (GOTCHAS §41 — a mutual
// rule enforced on one side only is the ordinary way this breaks). Put the
// pockets away, take the wallet out, then press i: the wallet must go.
await page.keyboard.press('i');
await settle('ct-pockets', false);
await rightClick();
ok((await onScreen('ct-wallet')).shown, 'with nothing up, right-click brings the wallet out');
await page.keyboard.press('i');
await settle('ct-pockets', true);
const back = { pockets: await onScreen('ct-pockets'), wallet: await onScreen('ct-wallet') };
ok(back.pockets.shown, 'i brings the pockets back');
ok(!back.wallet.shown, '…and that put the WALLET away — one thing in your hands');

// ── the wheel chooses ────────────────────────────────────────────────────
const sel0 = await page.evaluate(() => window.__inv.sel());
await page.mouse.wheel(0, 120);
await page.waitForFunction((s) => window.__inv.sel() !== s, sel0, { timeout: 4000 }).catch(() => {});
const sel1 = await page.evaluate(() => window.__inv.sel());
ok(sel1 !== sel0, `the wheel moves the selection (${sel0} -> ${sel1})`);
// …and it WRAPS rather than stopping, so a player cannot get stuck at an end
const seen = new Set([sel0, sel1]);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); seen.add(await page.evaluate(() => window.__inv.sel())); }
ok(seen.size === 6, `it reaches all six pockets and wraps (${seen.size} distinct)`);

// ── G DROPS THE ONE YOU CHOSE, and not the last one you took ─────────────
//
// This is the whole reason the check exists. With the panel SHUT, G drops the
// last thing you picked up; with it OPEN it must drop the SELECTED thing, and
// nothing distinguishes those two unless the selection is on something that is
// NOT the last-taken item.
//
// CEREAL is that something, and it is also the case the panel had to learn to
// state: it was bought over a counter, so there is no object in the world to
// put back and it CANNOT be dropped. That makes it the sharpest probe available
// — with it selected, a correct G does nothing at all, and a G that had been
// quietly falling back to "the last thing you took" would drop the newspaper.
// The verdict is therefore an ABSENCE, so the population that makes the absence
// meaningful (a newspaper actually in the pockets) is asserted above.
const pick = async (want) => {
  for (let i = 0; i < 12 && await page.evaluate(() => window.__inv.selected()) !== want; i++) {
    await page.mouse.wheel(0, 120); await page.waitForTimeout(70);
  }
  return page.evaluate(() => window.__inv.selected());
};
const pressG = async () => {
  const b = await page.evaluate(() => window.__inv.pockets());
  await page.keyboard.down('g');
  await page.waitForFunction((q) => JSON.stringify(window.__inv.pockets()) !== JSON.stringify(q), b, { timeout: 2500 })
    .catch(() => {});   // an unchanged purse is a legitimate outcome here
  await page.keyboard.up('g');
  return { before: b, after: await page.evaluate(() => window.__inv.pockets()) };
};

let chose = await pick(SELFTEST ? 'NEWSPAPER' : 'CEREAL');
if (SELFTEST) {
  // THE MUTATION: put the selection on the NEWSPAPER — the last-taken item —
  // behind the assertion's back. The verdict below says "nothing left the
  // pockets", which is true of a correct G on an undroppable selection and
  // false the moment the selection is something G really can drop. If the
  // check were only watching the cereal count it would sail through this.
  console.log('      --selftest: selection moved to the newspaper behind the assertion');
} else {
  ok(chose === 'CEREAL', 'chose a pocket that is NOT the last thing taken');
  ok(!(await page.evaluate(() => window.__inv.canDrop('CEREAL'))),
    '…and the panel knows it cannot be put back — it says so before you press');
}

const g1 = await pressG();
ok(JSON.stringify(g1.after) === JSON.stringify(g1.before),
  `G on that pocket changed nothing (${JSON.stringify(g1.before)} -> ${JSON.stringify(g1.after)})`);
ok((g1.after.NEWSPAPER ?? 0) === (g1.before.NEWSPAPER ?? 0),
  '…and above all did NOT drop the last thing taken — G honours the SELECTION');

// and the positive half: choose the newspaper and it really does go
chose = await pick('NEWSPAPER');
ok(chose === 'NEWSPAPER', 'chose the newspaper');
const g2 = await pressG();
ok((g2.after.NEWSPAPER ?? 0) === (g2.before.NEWSPAPER ?? 0) - 1,
  `G drops the chosen one when it CAN be put back (NEWSPAPER ${g2.before.NEWSPAPER ?? 0} -> ${g2.after.NEWSPAPER ?? 0})`);

// ── and it puts away again ───────────────────────────────────────────────
await page.keyboard.press('i');
await settle('ct-pockets', false);
ok(!(await onScreen('ct-pockets')).shown, 'i puts the pockets away again');

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
ok(errors.length === 0, 'no page errors');

await browser.close();
if (SELFTEST) {
  const caught = fails.length > 0;
  console.log(caught ? 'SELFTEST: caught it' : 'SELFTEST: NOT CAUGHT — this check is decoration');
  process.exit(caught ? 0 : 2);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
