// Builder D's walk proofs. Everything here is WALKED, never eyeballed
// (GOTCHAS §1), and it covers the collision and [E] surfaces D has touched:
//
//   1 the library courtyard — open, and you can get back out
//   2 the bodega's canted corner — the cut is real and you cannot cross it
//   3 the churchyard — open at the gate, nave still solid, no floor hole
//   4 you cannot get inside any building's footprint
//   5 the bodega's two doors, and the two counters that spend money
//
// These lived in a scratchpad for most of D's run, which meant nobody else
// could run them and they died with the session. They are here now.
//
// RETRIES, and this is the whole reason this file is not a straight copy.
// Citizens are solid, and one standing in a doorway or a courtyard mouth
// blocks a 0.36 m player, so a single-shot walk reports a world bug that is
// really a pedestrian. Every leg gets three attempts and passes if ANY of
// them makes it — same idiom as E's scripts/E-yard-walk.mjs.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/D-walk.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

// WHICH WORLD THIS MEASURED — `reportWorld` prints it, below.
//
// I added a hand-rolled banner here in 312d2310, after 24163f69 found 60
// scripts hard-coded to the auditor's port with no SHOT_URL escape. Mine was
// never in that set, but its DEFAULT is 4231 — my port and nobody else's — and
// a default that happens to answer is how that failure stays invisible.
//
// `reportWorld` (435e5834) supersedes it and does strictly more: it proves the
// BUILD, not just the URL, so a live server on the right port serving a stale
// bundle is caught too. That was the other half of the same failure and my
// banner could not see it. Two lines saying nearly the same thing is how the
// weaker one gets trusted, so the weaker one goes.
const URL = aim('http://localhost:4231/');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);   // GOTCHAS 26: prove it, do not just name it
// SETTLE: 600 ms, and it is safe HERE because this pins a DAY hour. Measured,
// after 159b9c1c listed this script as a settle-ramp candidate.
//
// The world boots at 13:20 (crosstown.ts:190, fixed — not the real clock), so
// pinning 13:00 asks for the state it is already in and nothing has to travel.
// The 108 shell materials read mean channel 2.027835 identically at 600, 1000,
// 1500, 2000, 3000 and 4000 ms.
//
// Pin a NIGHT hour and the same 600 ms is a coin flip. Eight cold runs at
// clock(23,0), sampled at exactly 600 ms:
//
//     DAY 2.0278 · night 0.0919 x7
//
// One run in eight read the completely UNGRADED world — not a mid-ramp shade,
// the day value to four decimal places at a night hour, a 22x error. The
// transition landed between 400-600 ms in one run and 600-1000 ms in another,
// so 600 sits exactly on the edge. No intermediate value appeared at any of
// 200/400/600/700/800/900/1000/1200 ms, so it is a step, or a lerp faster than
// that sampling.
//
// The rule for the 90-script list is therefore the HOUR, not the wait: a script
// pinning a day hour is unaffected at any settle; one pinning a night hour and
// sampling under ~1000 ms is flaky rather than merely imprecise.
await setClock(page, 13, 0);
await page.mouse.click(640, 360);
await page.waitForTimeout(600);   // the CLICK, not the clock — see below
// WARM-UP, and it is not superstition. Without it the FIRST measured leg —
// whichever it happens to be — walks off sideways: warped to (8, -99.2) facing
// +z it ended at x 12.41, 4.4 m east, having never turned. Every subsequent
// leg from the identical warp walks straight and arrives in 3 steps. One
// throwaway warp and a settle is enough to make attempt 1 behave like the rest.
//
// This is the reason both door legs reported `[2 tries]` on EVERY run, which I
// had attributed in the retry comment below to "a citizen in the way". It was
// not. 098269aa is the cautionary version of the same mistake — a harness that
// had found a real bug and written a paragraph explaining it away — and mine
// was doing it in miniature: a retry that is always needed is not flakiness,
// it is a defect with a workaround in front of it.
await page.evaluate(() => window.__ct.warp(0, -40, 0, 0, 0));
await page.waitForTimeout(700);

const pos = () => page.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(2)));
const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});
const hold = async (k, ms) => {
  await page.keyboard.down(k); await page.waitForTimeout(ms);
  await page.keyboard.up(k); await page.waitForTimeout(90);
};
const warp = (x, z, yaw) => page.evaluate(([a, c, y]) => window.__ct.warp(a, c, y, 0, 0), [x, z, yaw]);

let fails = 0;
const say = (okd, name, detail, tries) => {
  if (!okd) fails++;
  console.log(`  ${okd ? 'PASS' : 'FAIL'}  ${name}: ${detail}${tries > 1 ? `  [${tries} tries]` : ''}`);
};
/** walk forward from (x,z) facing yaw, and test where you end up.
 *
 *  Retried because citizens are solid and one standing in a doorway blocks a
 *  0.36 m player — that is real and it is why E's scripts retry too. But see
 *  the warm-up above before trusting a retry to mean that: the retries this
 *  harness actually spent were a startup artefact, not pedestrians, and
 *  `[N tries]` is printed precisely so a systematic N is visible rather than
 *  averaged away. If every run needs 2, something is wrong that retrying is
 *  hiding. */
const walk = async (name, x, z, yaw, steps, test, fmt) => {
  let last, t = 0;
  for (t = 1; t <= 3; t++) {
    await warp(x, z, yaw); await page.waitForTimeout(340);
    for (let i = 0; i < steps; i++) await hold('w', 230);
    last = await pos();
    if (test(last)) break;
    await page.waitForTimeout(700);            // let whoever it was move on
  }
  say(test(last), name, fmt(last), t);
  return last;
};

// GOTCHAS §34 shape one: refuse a flag we do not understand rather than run the
// normal walk and print a pass while you believe you ran the selftest.
for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}

// ── --selftest ─────────────────────────────────────────────────────────────
//
// Break it on purpose and require it to notice. d0fd37fb's standard: "a tool
// nobody has watched fail" is worth about what "a tool nobody knows how to
// run" is worth, and until now this was both.
//
// It asserts the OPPOSITE of three things known to be true, through the same
// walk-and-assert path the real legs use, and demands all three FAIL. If any
// of them "passes", the harness is not testing the world and every green run
// above it was worthless.
//
// Exits the moment it has a verdict. 6a599df5 found nightgrade printing
// SELFTEST PASSED and then falling through to the normal verdict, so a passing
// selftest returned 1 — not repeating that.
if (process.argv.includes('--selftest')) {
  console.log('\nselftest — three assertions inverted, all must FAIL');
  const before = fails;
  await walk('you CAN walk into the east shops', 5.5, -30.0, Math.PI / 2, 8,
    (p) => p[0] > 8.0, (p) => `stopped at x ${p[0]}`);
  await walk('the churchyard wall does NOT hold', 5.5, -77.0, Math.PI / 2, 8,
    (p) => p[0] > 9.0, (p) => `stopped at x ${p[0]}`);
  await walk('the bodega chamfer can be crossed', 6.2, -97.2, Math.atan2(1.8, -2.2), 8,
    (p) => p[0] + p[2] > -80, (p) => `x+z = ${(p[0] + p[2]).toFixed(2)}`);
  const caught = fails - before;
  console.log(caught === 3
    ? '\nSELFTEST PASSED — 3 of 3 inverted assertions were caught'
    : `\nSELFTEST FAILED — only ${caught} of 3 inverted assertions were caught`);
  await browser.close();
  process.exit(caught === 3 ? 0 : 1);
}

// WHY THESE READ AN ABSOLUTE y AND NOT A HEIGHT ABOVE THE FLOOR.
//
// 716b21d13 says ask groundAt where the floor is rather than remembering it is
// 0.14, and I tried it: `pos()` returns the ground as p[3], so "how far above
// its own floor" looked like the honest quantity, and it is — everywhere except
// straight after a warp.
//
// crosstown.ts: `warp: (x, z, ...) => { rig.pos.set(x, rig.pos.y, z); … }`.
// **Warp preserves y.** It teleports in x and z and leaves the player's height
// exactly where the previous position left it, so a harness that warps and then
// reads height is reading the FLOOR IT CAME FROM. Measured at the churchyard,
// where the ground rises to 0.349: the offset reads 1.271 instead of 1.480 and
// stays there for four seconds, because nothing is settling — the y was never
// wrong, it was never updated.
//
// So the offset form fails on a sound world, which is GOTCHAS §34 the other way
// up. The absolute-y form below is loose — ±0.9 would swallow a 0.8 m drop —
// but it is loose in the safe direction and it does not depend on a y that the
// harness itself has invalidated. Tightening it needs the walk to settle the
// player onto the floor first, which is a bigger change than this note.
//
// a9d88ecf5 hit the same thing from the other side: "my harnesses read the
// wrong floor".

console.log('\n1. the library courtyard');
// z -19 is ON the south jamb of the mouth: probe there and the player scrapes
// the corner and makes only 0.36 m. The mouth runs z -19.5 … -10.5 (probed),
// so stand in the MIDDLE of it.
const deep = await walk('walked IN', -6.0, -16.5, -Math.PI / 2, 10,
  (p) => p[0] < -7.6, (p) => `x -6 -> ${p[0]}`);
say(Math.abs(deep[1] - 1.62) < 0.9, 'floor held', `eye y = ${deep[1]} (no drop into a hole)`, 1);
await walk('walked back OUT', deep[0], -16.5, Math.PI / 2, 10,
  (p) => p[0] > -7.2, (p) => `x ${deep[0]} -> ${p[0]}`);

console.log('\n2. the bodega canted corner');
await walk('stopped ON the cut, not through it', 6.2, -97.2, Math.atan2(1.8, -2.2), 8,
  (p) => p[0] + p[2] <= -86.9, (p) => `x+z = ${(p[0] + p[2]).toFixed(2)} (the cut is -87)`);
// and the cut is REAL: at z=-95 the face has retreated to x=8.0, so you can
// stand well past the 6.34 a square collider would stop you at
await walk('follows the cut in', 6.0, -95.0, Math.PI / 2, 8,
  (p) => p[0] > 6.9, (p) => `reached x = ${p[0]} at z=-95 (a square wall stops at 6.34)`);

console.log('\n3. the churchyard');
// The blanket church footprint is gone (E's patch) — it was sealing this yard
// the way the old blanket wall sealed the library courtyard. What holds you
// along the frontage now is E's churchyard WALL at x 7.00.
await walk('the wall holds off the gate', 5.5, -77.0, Math.PI / 2, 8,
  (p) => p[0] < 6.8, (p) => `stopped at x ${p[0]}`);
const yard = await walk('the GATE lets you in', 5.6, -80.0, Math.PI / 2, 10,
  (p) => p[0] > 7.3, (p) => `reached x ${p[0]}`);
say(Math.abs(yard[1] - 1.62) < 0.9, 'no floor hole at the gate', `eye y = ${yard[1]}`, 1);
// the nave has to still be solid, and the OLD proof could not tell that from
// "the churchyard is sealed" — which is the confusion that let the bug live
await walk('the nave is still solid', 9.0, -80.0, Math.PI / 2, 12,
  (p) => p[0] < 9.6, (p) => `stopped at x ${p[0]} from inside the yard`);
await walk('and you can leave again', 9.0, -80.0, -Math.PI / 2, 12,
  (p) => p[0] < 6.5, (p) => `back out to x ${p[0]}`);

// THE CLIMB — "i want to be able to walk up those stairs", for the church.
// Sampled all the way up rather than at the top, because the failure mode is
// not "you cannot get there", it is a camera that jolts a riser at every
// nosing (GOTCHAS §7 — the picker walks you up a smooth ramp, the drawn
// treads ride within half a riser of it).
// THESE THREE READ THE FLOOR PICKER, NOT A WALK'S FRAME SAMPLES, AND THAT IS
// THE WHOLE CORRECTION.
//
// They used to walk the ramp and count the rises between `hold('w', 180)`
// samples, and they reported three reds for days: "ground reached 0.45",
// "1 step of rise, not one teleport", "1 jump over 0.34 m". I nearly routed
// that to E as a regression on a CONFIRMED row.
//
// It was mine. **One 180 ms hold covers more ground than the entire ramp.**
// Sampling the picker directly at 0.05 m, the churchyard climb is
// 0 -> 0.55 over x 8.1..9.1 in increments of 0.020-0.021 — a continuous 1 m
// ramp with no discontinuity anywhere in it. The "teleport" and the "jolt"
// were the same single artifact seen twice: a probe too coarse to resolve what
// it was measuring reports smooth ground as a cliff. GOTCHAS §30's cousin —
// there the fixed sleep was too SHORT, here the stride is too LONG, and both
// fail a sound world.
//
// So the rise and the smoothness are asserted on the picker, which is the
// thing that actually defines the floor. But the LAST assertion still walks,
// deliberately: proving the picker describes a nice ramp proves nothing if the
// player is not wired to it (§34 — a check can pass finding nothing). One
// probe claim, one lived claim.
const RISER = 0.20;                        // a comfortable step; above this you feel it
const prof = await page.evaluate(() => {
  const g = window.__ct.groundAt ?? window.__ct.groundPick;
  const out = [];
  for (let x = 5.5; x <= 9.5; x += 0.05) out.push([+x.toFixed(2), +g(x, -79.9).toFixed(3)]);
  return out;
});
const top = Math.max(...prof.map((r) => r[1]));
let worst = 0, worstAt = 0;
for (let i = 1; i < prof.length; i++) {
  const d = prof[i][1] - prof[i - 1][1];
  if (d > worst) { worst = d; worstAt = prof[i][0]; }
}
say(top > 0.45, 'the church steps CLIMB', `the floor picker reaches ${top.toFixed(2)} at the door (kerb is 0.14)`, 1);
say(worst <= RISER, 'and they climb without a riser-sized jolt',
  `worst single 0.05 m step is ${worst.toFixed(3)} m at x ${worstAt}`, 1);

// …and the player is actually carried up it. Warp preserves y (see the note
// above), so read the GROUND under the player, which warp does not invalidate.
await page.evaluate(() => window.__ct.warp(5.6, -79.9, Math.PI / 2, 0, 0));
await page.waitForTimeout(700);
for (let i = 0; i < 14; i++) await hold('w', 180);
const climbed = +(await page.evaluate(() => window.__ct.pos()))[3];
say(climbed > 0.30, 'and the player is carried up it, not just the picker',
  `walked from 0 to ground ${climbed.toFixed(2)}`, 1);

console.log('\n4. no walking into buildings, and the lane you are owed');
// TWO-SIDED now, and the second half is new. A facade stands at 7.00 and its
// collider is inset by WALK_PROJECTION = 0.12, so the collider face is at
// 6.88 and a 0.36 m player capsule comes to rest at 6.52.
//
//   too far IN  -> you are inside the shopfront; the footprint is wrong
//   too far OUT -> the collider is reserving lane that no geometry occupies,
//                  which is what notes/lane-audit.md caught: a flat 0.30 m
//                  cushion held everyone at 6.34 and ate 15 % of the walk
//
// The old assertions only tested the first, so they PASSED the whole time the
// lane was being stolen. That is the bug this pair exists to catch.
for (const [name, x, z, yaw, test] of [
  ['east shops  z=-30', 5.5, -30.0, Math.PI / 2, (p) => p[0] < 6.88 && p[0] > 6.4],
  ['west shops  z=-60', -5.5, -60.0, -Math.PI / 2, (p) => p[0] > -6.88 && p[0] < -6.4],
  ['side st N   x=30', 30.0, -97.5, Math.PI, (p) => p[2] < -96.3 && p[2] > -96.9],
  ['side st S   x=30', 30.0, -108.5, 0, (p) => p[2] > -109.88 && p[2] < -109.3],
]) await walk(name, x, z, yaw, 8, test, (p) => `stopped at (${p[0]}, ${p[2]})`);

console.log('\n5. the doors, and the money');
// The fifth field is WHAT THE PROMPT MUST SAY, and it is new.
//
// This asserted `got !== ''` — any prompt at all passed. Walk into range of a
// neighbouring spot and the leg went green while the door under test was never
// found. 1776b21e classifies instruments by whether their two sides share an
// ancestor and 64df1705 found "a verdict that could not fail" in trash.mjs;
// applying that reading to my own file found this. A non-empty string is not a
// door.
for (const [name, x, z, yaw, steps, must] of [
  // yaw 0 is -z. The door is NORTH of this start point, so this is Math.PI —
  // getting it wrong walks you away from the door and reports a dead trigger.
  ['bodega street door', 8.0, -99.2, Math.PI, 8, 'BODEGA'],
  ['No. 227', 5.9, -44.0, Math.PI / 2, 6, 'No. 227'],
]) {
  let got = '', t = 0;
  // `break`, not `&& !got` in the condition. That is the whole bug: on a
  // FIRST-attempt success the update ran, the condition then failed, and `t`
  // came out of the loop as 2 — so both door legs printed `[2 tries]` on every
  // run while never having retried once. walk() above always used break and
  // was always honest, which is why only these two ever showed it.
  for (t = 1; t <= 3; t++) {
    await warp(x, z, yaw); await page.waitForTimeout(340);
    for (let i = 0; i < steps && !got; i++) { await hold('w', 230); await page.waitForTimeout(200); got = await prompt(); }
    if (got) break;
  }
  say(got.includes(must), name, JSON.stringify(got), t);
}
// The counters are the only spots in the world that SPEND, so prove the PURSE
// moves rather than that a prompt reads.
//
// This used to warp to hard-coded world coordinates and broke the moment the
// bodega interior was rebuilt somewhere else — which is the same "the room's
// own address showing through" that the rebuild was getting rid of. So: go in
// through the DOOR, then look for the counter from wherever you land.
await warp(8.0, -99.2, Math.PI);
await page.waitForTimeout(340);
for (let i = 0; i < 8; i++) { await hold('w', 230); await page.waitForTimeout(200); if ((await prompt()).includes('BODEGA')) break; }
await page.keyboard.press('e');
await page.waitForTimeout(800);
const inside = await pos();
let found = null;
outer:
for (let r = 0.75; r <= 3.75 && !found; r += 0.75) {
  for (let a = 0; a < 16; a++) {
    const x = inside[0] + r * Math.cos(a * Math.PI / 8);
    const z = inside[2] + r * Math.sin(a * Math.PI / 8);
    await page.evaluate(([X, Z]) => window.__ct.warp(X, Z, 0, 0, 0), [x, z]);
    await page.waitForTimeout(70);
    if ((await prompt()).includes('buy cereal')) { found = [x, z]; break outer; }
  }
}
say(!!found, 'the cereal counter is findable from the door',
  found ? `at (${found[0].toFixed(1)}, ${found[1].toFixed(1)}), ${JSON.stringify(await prompt())}` : 'not found within 3.75 m', 1);
if (found) {
  // BUY UNTIL REFUSED rather than pressing exactly five times: a dropped
  // keystroke made this fail once in four runs, and a proof that cries wolf is
  // worse than no proof.
  //
  // ── CONVERTED 2026-08-03, ITEM 261 ────────────────────────────────────────
  // This used to end on `bought >= 5 && bought <= 6` with the comment "$14.50
  // to start and cereal is $2.50, so the money runs out on the sixth" — TWO
  // hand-typed copies of numbers owned by `crosstown.ts:309` and
  // `int-bodega.ts:773`, and the check was a count of keystrokes standing in
  // for a measurement of money. It would have gone red for a reason that is not
  // a defect the day anybody changed the opening purse, and it could not tell a
  // till that charges the wrong amount from one that charges nothing: five
  // presses is five presses either way.
  //
  // `__ct.purse()` publishes the number, so the claim can be the real one — the
  // wallet went DOWN by the price the till itself states, once per press, and
  // it stops exactly when what is left will not cover another. Nothing below is
  // typed; both figures come out of the world.
  //
  // ⚠ COUNT THE BOXES, NOT THE KEYSTROKES. The obvious conversion — assert
  // `opening − left === bought × price` — is WRONG and I only found out by
  // running it against a world whose opening purse had been moved to $20.00.
  // `bought` counts key presses, and the prompt is repainted a frame behind the
  // wallet, so with the money landing on exactly $0.00 the loop got one press
  // past the refusal: 9 presses, 8 boxes, and the assertion went red on a
  // healthy world. Keystrokes are the harness's own bookkeeping; the boxes in
  // your pockets are the world's. `purse().inv` publishes those, so the count
  // and the money now come from the same read and a dropped or duplicated press
  // cannot desynchronise them. (This is the flake the note above was already
  // worried about, in a new place.)
  const wallet = () => page.evaluate(() => window.__ct.purse());
  const price = Number(/\$(\d+\.\d\d)/.exec(await prompt() ?? '')?.[1] ?? NaN);
  say(Number.isFinite(price), 'the till states its own price, so nothing is retyped here',
    `prompt ${JSON.stringify(await prompt())} -> $${price.toFixed(2)}`, 1);
  const w0 = await wallet();
  let bought = 0;
  for (let i = 0; i < 12; i++) {
    if ((await prompt()).includes('you')) break;
    await page.keyboard.press('e');
    await page.waitForTimeout(300);
    bought++;
  }
  const w1 = await wallet();
  const left = w1.cash;
  const boxes = (w1.inv.CEREAL ?? 0) - (w0.inv.CEREAL ?? 0);
  say((await prompt()).includes('you'), 'the money runs out',
    `refused after ${bought} presses — ${JSON.stringify(await prompt())}`, 1);
  // THE MEASUREMENT: the wallet fell by exactly the stated price per box that
  // actually arrived. A till wired to charge nothing, or half, or twice, fails
  // here on any run — the old keystroke count could not see it at all, and a
  // till that charged you for a box it never handed over now fails too.
  say(Number.isFinite(price) && boxes > 0
    && Math.abs((w0.cash - left) - boxes * price) < 0.005,
    'and every box that arrived cost exactly the price on the label',
    `$${w0.cash.toFixed(2)} -> $${left.toFixed(2)} for ${boxes} box${boxes === 1 ? '' : 'es'}`
    + ` × $${price.toFixed(2)}  (${bought} presses)`, 1);
  // AND IT STOPS AT THE RIGHT MOMENT, by the number rather than by a count:
  // what is left must not cover another box.
  say(Number.isFinite(price) && left < price && left >= 0,
    'and it stops exactly when what is left will not cover another',
    `$${left.toFixed(2)} left against a $${price.toFixed(2)} box`, 1);
}

// ── the ATM answers, and answers with real money ──────────────────────────
//
// The user asked for this specifically: *"'doesn't work' is a request for an
// interaction ... What is not an answer is a machine that looks usable and
// ignores you."* It is a ctx.spot registered by ct/street.ts, and nothing
// guarded it — the interaction could rot silently and only a player would find
// out.
//
// The balance is asserted against the WALLET, not against a hard-coded 14.50,
// because the point of the feature is that it reads ctx.purse.cash rather than
// printing a number. This leg runs after the cereal legs above, so the purse is
// down to $2.00 by now, and the ATM has to say so — which a constant would not
// have caught.
{
  await warp(-6.0, 7.29, -Math.PI / 2);
  await page.waitForTimeout(420);
  const before = await prompt();
  say(before.includes('FIRST FEDERAL'), 'the ATM offers itself',
    JSON.stringify(before), 1);
  // THE ATM IS A CABINET NOW, NOT A LINE OF TEXT — and the two clauses that used
  // to live here asserted the old contract, so they went red the moment A wired
  // K's machine to this wall. That was the world moving on, not a regression:
  // the prompt reads `use the machine` instead of `check balance`, and pressing
  // E opens the shared full-screen panel.
  //
  // ONE OF THE OLD CLAUSES WAS ALSO WRONG BY DESIGN NOW, which is the more
  // interesting half. It asserted the ATM's balance EQUALS the cash your
  // shopping left — $2.00 from $14.50 less five cereal. K deliberately gave the
  // machine its own `purse.account`, separate from `purse.cash`, on the grounds
  // that *"a machine whose balance IS your cash can only tell you what your
  // wallet already says"*. So the numbers are supposed to differ, and a check
  // demanding they match would be arguing with a decision rather than guarding
  // a fault. It is deleted rather than adjusted.
  // ── AND IT OPENS ON THE MACHINE, WHICH IS WHY THIS LEG WENT RED (item 279) ──
  //
  // It read `3 full-screen panels -> 3` and had done since before this file was
  // last touched. **THE CHECK WAS WRONG AND THE WORLD WAS RIGHT**, and the
  // reason is one the old assertion could not have survived: it counted
  // full-screen DOM overlays, and the ATM stopped being one.
  //
  // `ct/atm.ts:775` gives its panel `surface: { mesh: screenMesh, … }` on the
  // user's own words — *"i want … the screen on the literal atm be the
  // overlay"*, and item 0c, *"i never want there to be menus popping up unless
  // they are embedded to look as if they are in the actual game"*. So opening
  // it paints the panel's canvas onto the cabinet's raked screen face IN THE
  // WORLD. Measured on the built bundle
  // (`scripts/probes/w123-item279-on-the-machine.mjs`): the `#ct-atm` wrapper
  // goes to opacity 1, but its CANVAS collapses to **0×0** because the framework
  // hands the pixels to the mesh instead. The old predicate wants >300×200, so
  // it can never see it — the count is 3 before and 3 after, for ever, and
  // `ESC gets you back out of it: 3 -> 3` passed while measuring NOTHING.
  //
  // So the leg now states the CURRENT contract, positively and two-sidedly, and
  // the "no screen-space menu" clause below means a revert to a pop-up panel
  // reddens this rather than greening it.
  const atmState = () => page.evaluate(() => {
    const m = window.__atm?.surfaceMesh?.();
    const mat = m && (Array.isArray(m.material) ? m.material[0] : m.material);
    const cv = document.getElementById('ct-atm')?.querySelector('canvas') ?? null;
    return {
      up: window.__hud?.panel() ?? null,
      known: window.__hud?.panels?.() ?? [],
      // THE IDENTITY, and it retypes no number: makePanel's CanvasTexture is a
      // VIEW onto the panel's own canvas, so while the machine is wearing the
      // panel its `map.image` IS that DOM canvas element. False when the mesh
      // is back on its own baked 99x68 fascia.
      onMachine: !!mat?.map?.image && !!cv && mat.map.image === cv,
      // only `onOpen`/`onClose` move this, so it proves the framework really
      // ran the open rather than something merely looking open
      padLive: window.__atm?.padLive?.() ?? null,
      // the OLD reading, kept as the "no menu popped up" clause
      overlays: [...document.querySelectorAll('canvas,div')]
        .filter((e) => { const r = e.getBoundingClientRect(), st = getComputedStyle(e);
          return r.width > 300 && r.height > 200 && st.display !== 'none' && st.visibility !== 'hidden'
            && +st.opacity !== 0 && (st.position === 'fixed' || st.position === 'absolute'); }).length,
    };
  });
  const a0 = await atmState();
  // POPULATION FLOOR. A leg that measures nothing must fail: if the world has no
  // ATM panel registered, or one is already up, everything below is meaningless.
  say(a0.known.includes('ct-atm') && a0.up === null && a0.onMachine === false && a0.padLive === false,
    'the ATM cabinet is registered and nothing is up yet',
    `panels ${JSON.stringify(a0.known)}, up ${JSON.stringify(a0.up)},`
    + ` onMachine ${a0.onMachine}, padLive ${a0.padLive}`, 1);
  // HELD, not tapped. Measured: a bare `press('e')` opens it once the world is
  // warm but NOT on a cold page — the [E] edge is read once per rendered frame
  // (BUILDER-BRIEF §5), and this leg must not depend on how long the run before
  // it took. `hold` is the helper this file already has.
  await hold('e', 120);
  await page.waitForTimeout(900);
  const a1 = await atmState();
  say(a1.up === 'ct-atm' && a1.padLive === true, 'and pressing E opens the machine',
    `${JSON.stringify(a0.up)} -> ${JSON.stringify(a1.up)}, padLive ${a0.padLive} -> ${a1.padLive}`, 1);
  say(a0.onMachine === false && a1.onMachine === true,
    'and it opens ON THE CABINET — the screen face wears the panel canvas',
    `onMachine ${a0.onMachine} -> ${a1.onMachine}`, 1);
  say(a1.overlays === a0.overlays,
    'and NOTHING popped up over the camera — no new full-screen overlay',
    `${a0.overlays} full-screen overlays -> ${a1.overlays}`, 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  const a2 = await atmState();
  say(a2.up === null && a2.onMachine === false && a2.padLive === false && a2.overlays === a0.overlays,
    'and ESC gets you back out of it',
    `up ${JSON.stringify(a1.up)} -> ${JSON.stringify(a2.up)},`
    + ` onMachine ${a1.onMachine} -> ${a2.onMachine}, padLive ${a1.padLive} -> ${a2.padLive}`, 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : '\nall D walks pass');
process.exit(fails ? 1 : 0);
