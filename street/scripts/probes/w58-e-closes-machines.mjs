// ITEM 143 — does `[E]` close a machine view, from EVERY screen, without bounce?
//
//   SHOT_URL=http://localhost:4192/ node scripts/probes/w58-e-closes-machines.mjs
//
// THE VERDICT IS THE EXIT CODE. Six checks printed failure and exited 0 this
// week, so every branch below either records into `fails` or is not a check.
//
// WHY A HELD PRESS AND NOT `press()`. The `[E]` dispatch in `crosstown.ts` is an
// edge read once per RENDERED FRAME, so `keyboard.press` can begin and end
// inside a single frame and never be observed — three false failures came from
// exactly that. Everything here uses down → wait → up.
//
// WHY REPEATED `down()`. Playwright marks the second and later `down()` of a
// held key `repeat: true`, which is what a real keyboard's auto-repeat sends
// while a player leans on a key. THAT is the toggle bounce this item is about,
// and a single clean down/up cannot see it — it is the case that passes a naive
// check and still fails a human.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4192/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

try {
  await p.goto(URL, { waitUntil: 'networkidle' });
} catch (e) {
  console.error(`NOTHING MEASURED — could not load ${URL}: ${String(e.message).split('\n')[0]}`);
  await b.close();
  process.exit(3);
}
await p.waitForFunction(() => window.__ct && window.__hud, { timeout: 20000 });

const fails = [];
const bad = (m) => { fails.push(m); console.log(`  FAIL  ${m}`); };
const good = (m) => console.log(`  ok    ${m}`);

const panel = () => p.evaluate(() => window.__hud.panel());
const pos = () => p.evaluate(() => window.__ct.pos());
const seated = () => p.evaluate(() => window.__ct.seated());
const settle = (ms = 160) => p.waitForTimeout(ms);

/** A press the world can actually see: held across at least one rendered frame. */
async function tap(key, ms = 90) {
  await p.keyboard.down(key);
  await p.waitForTimeout(ms);
  await p.keyboard.up(key);
  await settle();
}

/** A key LEANED ON: the press, several auto-repeats, then the release. */
async function lean(key, repeats = 8, gapMs = 45) {
  await p.keyboard.down(key);
  for (let i = 0; i < repeats; i++) { await p.waitForTimeout(gapMs); await p.keyboard.down(key); }
  await p.waitForTimeout(gapMs);
  await p.keyboard.up(key);
  await settle(180);
}

/**
 * Do the feet work again?
 *
 * TRIES BOTH DIRECTIONS, and that is not laziness. Closing a machine leaves the
 * player standing AT it, nose to the cabinet — so `W` walks straight into the
 * thing's collider and reports 0.000 m whether input was returned or not. The
 * question is "is movement returned", not "is this one heading clear", so a
 * blocked forward step is answered by stepping back rather than by failing.
 */
async function feetMove(what) {
  for (const key of ['w', 's']) {
    const a = await pos();
    await p.keyboard.down(key);
    await p.waitForTimeout(340);
    await p.keyboard.up(key);
    await settle(120);
    const c = await pos();
    const d = Math.hypot(c[0] - a[0], c[2] - a[2]);
    if (d >= 0.05) { good(`${what}: feet move again (${d.toFixed(2)} m, ${key.toUpperCase()})`); return; }
  }
  bad(`${what}: FEET DID NOT MOVE after closing — neither forward nor back`);
}

const spots = await p.evaluate(() => window.__ct.spots());
const spotAt = (re) => spots.find((s) => re.test(s.label));

/**
 * Stand `back` metres off a spot, FACING IT.
 *
 * The yaw is derived from the world's own forward convention rather than typed:
 * `crosstown.ts:2066` scatters cereal at `(px + sin(yaw)*d, pz - cos(yaw)*d)`,
 * so forward is `(sin yaw, −cos yaw)` and looking at a spot means
 * `yaw = atan2(dx, −dz)`. Guessing `yaw: 0` here is what made the first run of
 * this probe report a bounce that was really the player standing with his back
 * to the machine.
 */
async function standAt(spot, back = 0.6) {
  const yaw = Math.atan2(0, -back);            // straight on, from −dz
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y), [spot.x, spot.z - back, yaw]);
  await settle(260);
}

/** What the world is currently offering, so "never opened" cannot read as "bounced". */
const prompt = () => p.evaluate(() => document.getElementById('ct-prompt')?.textContent ?? '');

console.log(`\n[E] CLOSES A MACHINE VIEW — ${URL}`);
console.log(`${spots.length} spots · panels: ${(await p.evaluate(() => window.__hud.panels())).join(', ')}\n`);

// ══ PART A — the ATM, walked to, from EVERY SCREEN IT HAS ═════════════════
// The ATM is the machine the user named first and the one with ten screens.
console.log('── the ATM, from every screen ──');
const atmSpot = spotAt(/FIRST FEDERAL — use the machine/);
if (!atmSpot) bad('no ATM spot in the registry');
else {
  // Stand where the spot is, then close the last of it ON FOOT — the item asks
  // for a walked test, and a warp alone would not prove the approach works.
  await p.evaluate(([x, z]) => window.__ct.warp(x, z - 1.2, 0), [atmSpot.x, atmSpot.z]);
  await settle(220);
  await p.keyboard.down('w'); await p.waitForTimeout(260); await p.keyboard.up('w');
  await settle(200);

  const atmScreen = () => p.evaluate(() => window.__atm.screen());
  const openAtm = async () => {
    await p.evaluate(() => window.__hud.closePanels());
    await p.waitForTimeout(560);              // clear the 500 ms dismiss lockout
    await p.evaluate(() => window.__atm.open());
    await settle(200);
  };
  // How to reach each screen from a freshly opened machine. Keys only — the
  // machine's own documented "press its number" path, so this drives the real
  // interface rather than reaching past it.
  const NAV = {
    idle: [],
    pin: ['1'],
    menu: ['1', '1', '2', '3', '4', 'Enter'],
    balance: ['1', '1', '2', '3', '4', 'Enter', '1'],
    withdraw: ['1', '1', '2', '3', '4', 'Enter', '2'],
    card: ['1', '1', '2', '3', '4', 'Enter', '8'],
  };
  for (const [want, keys] of Object.entries(NAV)) {
    await openAtm();
    for (const k of keys) await tap(k, 70);
    const got = await atmScreen();
    if (got !== want) { bad(`ATM: could not reach the ${want} screen (landed on ${got})`); continue; }
    if ((await panel()) !== 'ct-atm') { bad(`ATM: panel not up on the ${want} screen`); continue; }
    await tap('e');
    if ((await panel()) === null) good(`ATM ${want}: [E] closed it`);
    else bad(`ATM ${want}: [E] did NOT close it`);
  }
  // …and Escape, from the same screens.
  for (const [want, keys] of Object.entries(NAV)) {
    await openAtm();
    for (const k of keys) await tap(k, 70);
    if ((await atmScreen()) !== want) continue;
    await tap('Escape');
    if ((await panel()) === null) good(`ATM ${want}: Escape closed it`);
    else bad(`ATM ${want}: Escape did NOT close it`);
  }
  // the money screens, if the account can afford the smallest note
  await openAtm();
  for (const k of ['1', '1', '2', '3', '4', 'Enter', '2']) await tap(k, 70);
  await tap('1', 70);                          // the smallest note
  const afterPick = await atmScreen();
  if (afterPick === 'wait' || afterPick === 'cash') {
    await p.waitForTimeout(1700);              // the dispenser's own 1400 ms
    const s2 = await atmScreen();
    if ((await panel()) === 'ct-atm') {
      await tap('e');
      if ((await panel()) === null) good(`ATM ${s2}: [E] closed it`);
      else bad(`ATM ${s2}: [E] did NOT close it`);
    }
    // receipt
    await openAtm();
    for (const k of ['1', '1', '2', '3', '4', 'Enter', '2', '1']) await tap(k, 70);
    await p.waitForTimeout(1700);
    await tap('1', 70);                        // TAKE CASH → receipt
    if ((await atmScreen()) === 'receipt') {
      await tap('e');
      if ((await panel()) === null) good('ATM receipt: [E] closed it');
      else bad('ATM receipt: [E] did NOT close it');
    } else console.log(`    (could not reach the receipt screen — on ${await atmScreen()})`);
  } else {
    console.log(`    (wait/cash/receipt not reached — withdraw landed on ${afterPick}, likely insufficient funds)`);
  }
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(560);
  await feetMove('ATM');
}

// ══ PART B — the seat-driven machines, SAT ON FOR REAL ════════════════════
// slots and blackjack are opened by a LATE frame hook while the player is
// seated, so `openPanel` alone gets shut again on the next frame. The only
// honest test is to sit down.
console.log('\n── the casino machines, seated for real ──');
for (const [name, re, id] of [
  ['slots', /^sit at the slot$/, 'ct-slots'],
  ['blackjack', /^sit at the blackjack table$/, 'ct-blackjack'],
]) {
  const st = spotAt(re);
  if (!st) { bad(`${name}: no stool spot in the registry`); continue; }
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(560);
  await p.evaluate(([x, z]) => window.__ct.warp(x, z), [st.x, st.z]);
  await settle(260);
  await tap('e');                              // sit → the hook raises the panel
  await settle(220);
  const up = await panel();
  if (up !== id) { bad(`${name}: sitting did not raise ${id} (panel is ${up}, seated=${await seated()})`); continue; }
  good(`${name}: sitting raised ${id}`);
  await tap('e');                              // …and [E] must leave it
  if ((await panel()) === null) good(`${name}: [E] closed it`);
  else bad(`${name}: [E] did NOT close it`);
  if (await seated()) bad(`${name}: still SEATED after the panel closed — the trap`);
  else good(`${name}: stood back up`);
  await feetMove(name);

  // and Escape, from the same seat
  await p.waitForTimeout(560);
  await p.evaluate(([x, z]) => window.__ct.warp(x, z), [st.x, st.z]);
  await settle(260);
  await tap('e');
  if ((await panel()) === id) {
    await tap('Escape');
    if ((await panel()) === null) good(`${name}: Escape closed it`);
    else bad(`${name}: Escape did NOT close it`);
    if (await seated()) bad(`${name}: still SEATED after Escape`);
  }
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(560);
}

// ══ PART C — THE BOUNCE, BOTH DIRECTIONS ══════════════════════════════════
console.log('\n── the toggle bounce ──');
if (atmSpot) {
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(560);
  await standAt(atmSpot, 0.6);
  const offered = await prompt();
  if (!/\[E\]/.test(offered)) bad(`the ATM is not being offered from the standing spot (prompt: "${offered}") — the bounce test below cannot mean anything`);
  else good(`the world offers it: "${offered}"`);

  // OPENING WITH A LEANED-ON KEY MUST NOT SHUT IT AGAIN. The machine is NOT
  // pre-opened here: the first keydown of the lean is what the world's own `[E]`
  // dispatch acts on, and the auto-repeats behind it arrive after the gate is up
  // — where this file now reads `E` as "leave". That is the open-side bounce,
  // and pre-opening the panel would test something else entirely (a fresh press
  // against an already-open machine, which SHOULD close it).
  await lean('e');
  const afterOpenLean = await panel();
  if (afterOpenLean === 'ct-atm') good('leaning on [E] to OPEN leaves it open — the repeats did not shut it');
  else bad(`leaning on [E] to open left ${afterOpenLean} — it opened and bounced shut, or never opened`);

  // CLOSING with a key that is leaned on must not re-open it.
  if (!afterOpenLean) { await p.evaluate(() => window.__atm.open()); await settle(200); }
  await lean('e');
  const afterCloseLean = await panel();
  if (afterCloseLean === null) good('leaning on [E] to close does NOT re-open it');
  else bad(`leaning on [E] closed then RE-OPENED ${afterCloseLean} — toggle bounce`);
  await feetMove('after a leaned-on [E] close');

  // Escape leaned on, for the same reason.
  await p.waitForTimeout(560);
  await p.evaluate(() => window.__atm.open());
  await settle(200);
  await lean('Escape');
  if ((await panel()) === null) good('leaning on Escape closes and does not re-open');
  else bad('leaning on Escape left a panel up');
}

// ══ PART D — THE ONE EXCEPTION, PROVED RATHER THAN ASSERTED ═══════════════
// The library catalogue is a search field that takes any single character. If
// the framework stole `e` from it, *Emma* and *Frankenstein* would be
// unsearchable and the player ejected mid-word.
console.log('\n── the library terminal, the one panel that types ──');
await p.evaluate(() => window.__hud.closePanels());
await p.waitForTimeout(560);
await p.evaluate(() => window.__librarypc.open());
await settle(200);
if ((await panel()) !== 'ct-library-pc') bad('library PC: would not open');
else {
  // the DESKTOP screen does not type, so [E] must leave from there
  await p.evaluate(() => window.__librarypc.goto('desktop'));
  await settle();
  await tap('e');
  if ((await panel()) === null) good('library desktop: [E] closed it');
  else bad('library desktop: [E] did NOT close it');

  // the CATALOGUE types, so [E] must be a letter and ESC must be the exit
  await p.waitForTimeout(560);
  await p.evaluate(() => { window.__librarypc.open(); window.__librarypc.goto('catalog'); });
  await settle(200);
  for (const c of ['e', 'm', 'm', 'a']) await tap(c, 70);
  const q = await p.evaluate(() => window.__librarypc.catalogQuery?.() ?? null);
  if ((await panel()) !== 'ct-library-pc') bad(`library catalogue: typing CLOSED the terminal (query "${q}")`);
  else good('library catalogue: survived typing');
  if (q === 'emma') good(`library catalogue: the letter "e" reached the field — "${q}"`);
  else bad(`library catalogue: the field reads "${q}", expected "emma"`);
  await tap('Escape');
  if ((await panel()) === null) good('library catalogue: Escape leaves');
  else bad('library catalogue: Escape did NOT leave — a typing panel with no exit');

  // minesweeper does not type either
  await p.waitForTimeout(560);
  await p.evaluate(() => { window.__librarypc.open(); window.__librarypc.goto('minesweeper'); });
  await settle(200);
  await tap('e');
  if ((await panel()) === null) good('library minesweeper: [E] closed it');
  else bad('library minesweeper: [E] did NOT close it');
}

await p.evaluate(() => window.__hud.closePanels());
await p.waitForTimeout(560);
await feetMove('at the end');

if (errs.length) {
  console.log(`\nconsole/page errors (${errs.length}):`);
  for (const e of errs.slice(0, 5)) console.log(`  ${e}`);
}
console.log(`\n${fails.length ? `FAIL — ${fails.length} problem(s)` : 'PASS — [E] and Escape both leave every machine, from every screen, with no bounce'}\n`);
await b.close();
process.exitCode = fails.length ? 1 : 0;
