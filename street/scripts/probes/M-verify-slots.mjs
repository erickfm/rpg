// VERIFIER (M) — L's row: "add a slots interface and game where when i sit down
// i enter the slots interface".
//
// I did not build this and I am not L. This walks the claim from where a PLAYER
// stands and asserts the four things the row promises that a player can feel,
// deliberately NOT re-deriving L's mathematics: the RTP enumeration is a claim
// about arithmetic and `L-slots-rtp.mjs` already proves it with mutations. What a
// verifier adds is that the thing HAPPENS in the world, and that the money is
// real on the way out.
//
// Aimed by L's own station, not by a coordinate I typed: ask the world for the
// stools, warp to one, press E once.
//
// AGAINST THE BUNDLE, because L says so and is right — `ct/slots.ts` reaches
// `ct/hud.ts`, which is the shape that drops a module to an undefined namespace
// in Rollup while working perfectly in dev (GOTCHAS 28, 37). SHOT_URL is required
// rather than defaulted, because a default port is somebody else's server
// (GOTCHAS 26, 48).
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('usage: SHOT_URL=http://localhost:<your own preview>/ node scripts/M-verify-slots.mjs');
  console.error('       and it must be a PREVIEW of a build, not the dev server');
  process.exit(2);
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1180, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(600);

const results = [];
const say = (ok, name, detail) => results.push([ok, name, detail]);
const f2 = (n) => +n.toFixed(2);
const money = (n) => `$${n.toFixed(2)}`;
const panel = () => p.evaluate(() => window.__hud.panel());
const seated = () => p.evaluate(() => window.__ct.seated());
const cash = () => p.evaluate(() => window.__inv.cash());
// DOWN, HOLD, UP — never `keyboard.press`, which is instantaneous. The `[E]`
// dispatch is edge-triggered on `input.keys` read ONCE PER FRAME, so a press and
// release inside a single frame is never observed as held. A frame is 17 ms on an
// idle machine and far longer under load (GOTCHAS 30), so `press()` worked three
// runs in four and dropped the first E on the fourth — which then reported
// "one E puts you on the stool: still standing" against a stool that works.
const press = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(130);
  await p.keyboard.up(k); await p.waitForTimeout(200);
};
/** WAIT FOR THE EVENT, not for a number of milliseconds. Returns as soon as the
 *  predicate holds, so a slow frame costs latency rather than a false red — the
 *  other half of GOTCHAS 30, and the reason the prompt check flaked. */
const until = async (fn, ms = 2500) => {
  const t0 = Date.now();
  for (;;) {
    if (await fn()) return true;
    if (Date.now() - t0 > ms) return false;
    await p.waitForTimeout(80);
  }
};
const promptText = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? d.textContent : null;
});

// ── the subject, asked for rather than typed ───────────────────────────────
const stools = await p.evaluate(() =>
  (window.__ct.seats() || []).filter((s) => /sit at the slot/i.test(s.label || ''))
    .map((s) => ({ at: s.at, pose: s.pose })));
// GOTCHAS 32/34: an empty subject set is an ABORT. Every verdict below is free
// if there are no stools to sit on.
if (!stools.length) {
  console.error('ABORT: no seat labelled "sit at the slot" — nothing to verify');
  await b.close(); process.exit(3);
}
say(stools.length >= 90, 'the machines register a stool each', `${stools.length} stools`);

// ── 1. IT OPENS BECAUSE YOU SAT, not on a second [E] ──────────────────────
//
// This is the row's headline and the whole of the user's sentence: *"when i sit
// down i enter the slots interface"*. It is also the claim I had reason to doubt
// before running it — `ctx.seat` registers its stand-up spot AT the seat, so a
// seated player's dispatch is won by "stand up" at distance 0 and NOTHING else
// can be offered. I reported that as a hard limit in notes/M-bank-int.md and
// named this row as the one it would bite. It does not bite it, and the reason
// is worth recording: L does not use a second spot at all — the panel is opened
// by NOTICING the sit, so no dispatch has to win.
const s0 = stools[0];
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [s0.at.x, s0.at.z]);
await p.waitForTimeout(320);
{
  const before = await panel();
  say(before === null, 'nothing is up before you sit', `__hud.panel() = ${JSON.stringify(before)}`);
  await press('e');
  const on = await until(async () => (await seated()) !== null);
  say(on, 'one E puts you on the stool', on ? 'seated' : 'still standing');
  // the sit-watcher is POLLED rather than a callback, because ctx.seat cannot tell
  // its owner it was taken — so wait for the panel, do not sleep a guess at it
  const up = await until(async () => (await panel()) !== null);
  say(up, 'AND THE MACHINE IS UP, on that one press and no second one',
    `__hud.panel() = ${JSON.stringify(await panel())}`);
}

// ── 2. THE MONEY IS REAL, and it is the one wallet ────────────────────────
//
// The row claims *"what you win is in your wallet when you stand up"* is true by
// construction — the credit meter exists only between sitting and standing, and
// `onClose` cashes it out. Measured through `__inv.cash()`, which is
// ct/inventory.ts publishing `ctx.purse`: a different module from L's, so it is
// the shared wallet and not a second one.
const cash0 = await cash();
say(typeof cash0 === 'number', 'the pockets publish a balance to measure against',
  `${money(cash0)} before sitting`);
await press('i');                                   // feed it a $5 note
const cashFed = await cash();
say(Math.abs((cash0 - cashFed) - 5) < 0.005, 'feeding it takes exactly $5 out of the wallet',
  `${money(cash0)} -> ${money(cashFed)}`);
for (let i = 0; i < 4; i++) { await p.keyboard.press(' '); await p.waitForTimeout(3600); }
await press('Escape');
const shut = await until(async () => (await panel()) === null);
const cashOut = await cash();
say(shut, 'ESC closes the machine', `__hud.panel() = ${JSON.stringify(await panel())}`);
say(cashOut >= cashFed, 'and standing off it pays the meter back into the wallet',
  `${money(cashFed)} while playing -> ${money(cashOut)} after ESC`);
// the meter must be EMPTY afterwards, or the money exists in two places
// `__slots.view()` is L's own published state; `credits` is not a top-level
// function on it and guessing one threw. Read what the module actually offers.
const meter = await p.evaluate(() => {
  const v = window.__slots && window.__slots.view ? window.__slots.view() : null;
  return v && typeof v.credits === 'number' ? v.credits : null;
});
say(meter === 0 || meter === null, 'and the credit meter is left at zero',
  meter === null ? 'no __slots affordance to read — taken on the wallet alone' : `meter ${meter}`);

// ── 3. YOU ARE NOT LEFT ON THE STOOL ──────────────────────────────────────
//
// The failure mode I care about most, because it is the one that traps a player
// in the world: a cabinet that closes onto a seat you cannot leave. C has a
// "stuck in seat" row for exactly this shape.
//
// ESC DOES BOTH — it closes the machine AND stands you up. L's row says so in as
// many words (*"`ESC` leaves and pays you out on the way"*) and I had not
// believed it: my first version asserted that a FURTHER E stands you up, which
// was true when I first verified this row and is not true now. Mainline has since
// made ESC leave the stool as well, which is strictly better.
//
// AND MY CHECK TURNED THAT IMPROVEMENT INTO A RED. The extra E sat me back DOWN,
// `__ct.seated()` came back non-null, and the check reported "STILL SEATED" — a
// player-trapping regression against L's row that did not exist. Then the walk
// legs measured 0 in all four directions, because I really was seated again with
// the panel up, which made the false red look corroborated.
//
// This is the second time in this one script that I have had to check whether the
// red was mine (the first was holding `w` into the machine you had been sitting
// at). Both times the world was right. The protocol's line is exactly right: a
// rejection costs one message, and a wrong red costs a builder a re-walk and
// costs me my credibility.
{
  const off = await until(async () => (await seated()) === null);
  say(off, 'ESC leaves the stool as well as the machine',
    off ? 'standing, with no second keypress needed' : 'STILL SEATED after ESC');
  const back = await until(async () => /sit at the slot/i.test((await promptText()) || ''));
  say(back, 'and the stool offers itself again, so the state really did reset',
    `prompt: ${JSON.stringify(await promptText())}`);
  // EVERY DIRECTION, NOT ONE. My first version held `w` for 600 ms, measured
  // 0.000 m and filed THAT as a red too — standing leaves you facing the machine
  // with the stool behind, so forward and back are both legitimately blocked and
  // sideways is how you leave a slot machine in life as well as here.
  const legs = [];
  for (const k of ['w', 's', 'a', 'd']) {
    const q = await p.evaluate(() => window.__ct.pos());
    await p.keyboard.down(k); await p.waitForTimeout(650); await p.keyboard.up(k);
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => window.__ct.pos());
    legs.push([k, f2(Math.hypot(r[0] - q[0], r[2] - q[2]))]);
  }
  say(Math.max(...legs.map((l) => l[1])) > 1.0,
    'and you are not trapped — some direction is open',
    legs.map(([k, d]) => `${k} ${d}`).join(' · ')
      + '  (forward is the machine and back is the stool, correctly)');
}

// ── 4. AND A SECOND STOOL, because 96 of anything is a mirror ────────────
//
// GOTCHAS 41: checking one instance of a repeated thing proves nothing about the
// others. A stool from the far end of the list, not the neighbour of the first.
{
  const sN = stools[stools.length - 1];
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [sN.at.x, sN.at.z]);
  await p.waitForTimeout(320);
  // UP TO THREE TRIES TO SIT, and the retry separates a dropped keypress from a
  // stool that does not open its cabinet. This flaked once at 14 of 15 with
  // `panel = null` — not because the last stool is different but because the E
  // never registered, and the E dispatch is edge-triggered on a per-frame read
  // (GOTCHAS 30). Asserting the SIT first means the two can never be confused,
  // which is the third time in this session I have needed exactly this.
  let sat2 = false;
  for (let t = 0; t < 3 && !sat2; t++) {
    await press('e');
    sat2 = await until(async () => (await seated()) !== null, 1400);
  }
  say(sat2, 'the last stool in the list can be sat on', sat2 ? 'seated' : 'never sat after three tries');
  const up2 = sat2 && await until(async () => (await panel()) !== null);
  say(up2, 'and it opens the same cabinet',
    `__hud.panel() = ${JSON.stringify(await panel())}`);
  await press('Escape');
  const off2 = await until(async () => (await seated()) === null);
  say(off2, 'and ESC leaves that one too', off2 ? 'standing' : 'STILL SEATED');
}

say(errs.length === 0, 'no console errors through any of that',
  errs.length ? errs.slice(0, 3).join(' | ') : 'clean');

await b.close();
let bad = 0;
for (const [ok, name, detail] of results) {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}\n        ${detail}`);
}
console.log(`\n${results.length - bad} of ${results.length} passed`);
process.exit(bad ? 1 : 0);
