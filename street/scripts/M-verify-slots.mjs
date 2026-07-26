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
const press = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(280); };

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
  const on = await seated();
  say(on !== null, 'one E puts you on the stool', on ? 'seated' : 'still standing');
  // give the sit-watcher a few frames; it is polled rather than a callback,
  // because ctx.seat cannot tell its owner it was taken
  await p.waitForTimeout(700);
  const up = await panel();
  say(up !== null, 'AND THE MACHINE IS UP, on that one press and no second one',
    `__hud.panel() = ${JSON.stringify(up)}`);
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
await p.waitForTimeout(500);
const cashOut = await cash();
say((await panel()) === null, 'ESC closes the machine', `__hud.panel() = ${JSON.stringify(await panel())}`);
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

// ── 3. YOU CAN GET OFF THE STOOL ──────────────────────────────────────────
//
// The failure mode I care about most, because it is the one that traps a player
// in the world: a cabinet that closes onto a seat you cannot leave. C had a
// "stuck in seat" row for exactly this shape.
await press('e');
say((await seated()) === null, 'a further E gets you off the stool',
  (await seated()) === null ? 'standing' : 'STILL SEATED');
{
  // EVERY DIRECTION, NOT ONE. My first version held `w` for 600 ms and reported
  // 0.000 m — and filed it as a red on L's row until I looked: standing up leaves
  // you facing the machine you were just sitting at, with the stool behind you, so
  // FORWARD and BACK are both legitimately blocked and sideways is how you leave a
  // slot machine in life as well as here. Measured: w 0.000, s 0.168, a 2.285,
  // d 2.303.
  //
  // This is GOTCHAS 48's family and the reason the protocol says a rejection costs
  // one message but a wrong red costs a builder a re-walk and costs me my
  // credibility. The claim is "you are not trapped", so it has to ask whether ANY
  // direction is open.
  const legs = [];
  for (const k of ['w', 's', 'a', 'd']) {
    const q = await p.evaluate(() => window.__ct.pos());
    await p.keyboard.down(k); await p.waitForTimeout(650); await p.keyboard.up(k);
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => window.__ct.pos());
    legs.push([k, f2(Math.hypot(r[0] - q[0], r[2] - q[2]))]);
  }
  const best = Math.max(...legs.map((l) => l[1]));
  say(best > 1.0, 'and you are not trapped — some direction is open',
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
  await press('e');
  await p.waitForTimeout(700);
  say((await panel()) !== null, 'the last stool in the list works the same way',
    `__hud.panel() = ${JSON.stringify(await panel())}`);
  await press('Escape'); await p.waitForTimeout(300);
  await press('e');
  say((await seated()) === null, 'and you get off that one too',
    (await seated()) === null ? 'standing' : 'STILL SEATED');
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
