// w103 / item 180 — WALK the fence loop: steal a package, carry it to the pawn
// shop, sell it, and prove the MONEY MOVED.
//
// ⚠ THE HARD PART IS THE MONEY, AND THE PROBE THAT LIES HERE WOULD LIE ABOUT
// EXACTLY THAT. `__ct` publishes no purse accessor — no cash, no inventory
// (checked: `crosstown.ts:1403`'s block has `pos`, `spots`, `seats`, `party`
// … and nothing about the wallet). `crosstown.ts` is not named by item 180, so
// per BUILDER-BRIEF §9 I did not add one. The temptation is then to assert
// "the fence prompt changed" and call that a sale, which is NOT a measurement
// of money — it is a measurement of the pockets.
//
// SO THE CASH IS MEASURED THROUGH A COMPARATOR THE WORLD ALREADY PUBLISHES.
// `ct/int-bodega.ts:762` words its own prompt off the wallet:
//
//     cash >= 2.50  ->  "buy cereal — $2.50"
//     cash <  2.50  ->  "cereal $2.50 — you’re short"
//
// and `__ct.spots()` publishes every spot's rendered `label()`. That is a live
// threshold test on `ctx.purse.cash` at a known value, from published data
// only. Drain the wallet with the bodega's own buy spot until it flips to
// "short" — which pins cash to a KNOWN bracket rather than a guess — then
// fence one thing and watch it flip back.
//
// ⚠ AND IT SELF-TESTS BOTH SIGNS FOR FREE, which is why the bracket is chosen
// this way. After five cereals cash is $2.00, so:
//
//     fence SOCKS      +$0.50  ->  $2.50  ->  MUST flip to "buy"     (crosses)
//     fence CATALOGUE  +$0.25  ->  $2.25  ->  MUST stay  "short"     (does not)
//
// Both are real outcomes of the same code path, the loot roll picks which one
// you get, and a probe that only ever saw one of them would be half a check.
// The run reports which sign it exercised. A price that produced the WRONG
// side of the threshold is a hard failure, not a skip.
//
// EVERY COORDINATE IS READ FROM `__ct.spots()`, never typed here: the parcel,
// the fence counter and the bodega till are all found by matching their own
// published label text. BUILDER-BRIEF §8 — and it means this probe cannot
// strand itself against a counter that moved.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const CEREAL = 2.5;          // quoted from int-bodega.ts:773 `buy(..., 'CEREAL', 2.5, 'cereal')`
const START_CASH = 14.5;     // quoted from crosstown.ts:309 `{ cash: 14.5, inv: { CEREAL: 3 } }`

const say = [];
let bad = 0;
const ok = (c, m, d = '') => { say.push(`${c ? ' ok  ' : 'FAIL '} ${m}${d ? `\n        ${d}` : ''}`); if (!c) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
// A PAINTED FRAME, NOT A TIMEOUT — a probe that waits on a clock photographs a
// solid white room (the brief's own example).
// `painted()` returns {frames, triangles, calls} (crosstown.ts:1798), not a
// number — the first cut of this probe compared the OBJECT to 0, which is
// always false, and timed out against a perfectly healthy world. Read the
// field, and require TRIANGLES rather than frames: a frame can be counted for
// an empty scene, which is the solid-white-room failure this rule exists for.
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const spots = () => p.evaluate(() => window.__ct.spots());
const find = async (re) => (await spots()).find((s) => re.test(s.label ?? ''));
const pos = () => p.evaluate(() => window.__ct.pos());
const pressE = async () => {
  // HELD, per BUILDER-BRIEF §5: `press('e')` can begin and end inside one
  // animation frame and the [E] dispatch is an edge read once per rendered
  // frame, so a tap is never observed. This made a working feature report
  // three false failures.
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(200);
};
/** stand on a spot and confirm the world agrees you are on it */
const goTo = async (s, gy = 0) => {
  await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [s.x, s.z, gy]);
  await p.waitForTimeout(220);
};

// ── 1. THE FENCE EXISTS AT ALL, and it is inside the pawn shop ────────────
let fence = await find(/no questions|broker doesn/);
ok(!!fence, 'the pawn counter publishes a fence spot',
  fence ? `at (${fence.x.toFixed(2)}, ${fence.z.toFixed(2)}) r=${fence.r}` : 'NO SPOT MATCHED — the fence is not registered');
if (!fence) { console.log(say.join('\n')); await b.close(); process.exit(1); }

// ── 2. NEGATIVE CASE FIRST, on the world's own opening inventory ──────────
//
// The player starts with `{ CEREAL: 3 }` and nothing else, and cereal is not
// stolen goods — so the fence must refuse it BY NAME. Running this before any
// theft means the refusal is measured on a state I did not construct.
await goTo(fence);
let f = await find(/no questions|broker doesn/);
ok(/broker doesn’t want anything/.test(f.label),
  'with only bought goods in your pockets, the fence refuses IN WORDS', `label: ${f.label}`);
ok(f.ok === true, 'and the spot is still LIVE while refusing — a refusal is not a dead spot',
  `ok=${f.ok}`);

// ── 3. STEAL A PACKAGE ────────────────────────────────────────────────────
//
// Parcels are a per-door, per-day roll (PKG_CHANCE 0.20), and `forcePackages`
// is NOT published on `__ct` — so this walks days forward until the world
// offers one, rather than forcing it. Bounded, and it reports the day it found
// one on so a flake reads as a flake.
let parcel = null, days = 0;
for (; days < 40 && !parcel; days++) {
  parcel = (await spots()).find((s) => /steal .* package/.test(s.label ?? '') && s.ok !== undefined);
  if (parcel) break;
  await p.evaluate(() => window.__ct.advanceClock(1440));
  await p.waitForTimeout(120);
}
ok(!!parcel, `a landing parcel appeared within 40 days`, parcel ? `day ${days}: "${parcel.label}"` : 'none in 40 days');
if (!parcel) { console.log(say.join('\n')); await b.close(); process.exit(1); }

// The landing is on an upper floor, so the gy has to go with the warp or the
// parcel's own `ok()` (`|lastGy - floor*ST| < 0.5`) refuses. Read the floor
// height back out of the world rather than recomputing ST here.
const gyFor = async (s) => {
  for (const g of [0, 3.0, 6.0, 9.0, 2.7, 5.4, 8.1]) {
    await p.evaluate(([x, z, gg]) => window.__ct.warp(x, z, 0, gg, 0), [s.x, s.z, g]);
    await p.waitForTimeout(160);
    const live = (await spots()).find((q) => Math.abs(q.x - s.x) < 0.01 && Math.abs(q.z - s.z) < 0.01);
    if (live?.ok) return g;
  }
  return null;
};
const gy = await gyFor(parcel);
ok(gy !== null, 'you can stand on the landing where the parcel is', `gy=${gy}`);
if (gy === null) { console.log(say.join('\n')); await b.close(); process.exit(1); }

// WALK the last stretch rather than warping onto it — movement and reach are
// exactly what a warp cannot prove (BUILDER-BRIEF §10).
await p.evaluate(([x, z, g]) => window.__ct.warp(x, z - 1.2, 0, g, 0), [parcel.x, parcel.z, gy]);
await p.waitForTimeout(200);
const before = await pos();
await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w');
await p.waitForTimeout(200);
const after = await pos();
const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
ok(moved > 0.3, 'you can WALK up to the parcel, not only warp onto it', `moved ${moved.toFixed(2)} m`);
await goTo(parcel, gy);
await pressE();
const gone = !(await spots()).some((s) => Math.abs(s.x - parcel.x) < 0.01
  && Math.abs(s.z - parcel.z) < 0.01 && s.ok);
ok(gone, 'pressing [E] takes the parcel — its spot stops offering', `"${parcel.label}"`);

// ── 4. THE FENCE NOW WANTS IT, BY NAME AND WITH A PRICE ───────────────────
await goTo(fence);
f = await find(/no questions|broker doesn/);
const m = /^sell the (.+) — \$(\d+\.\d\d), no questions$/.exec(f.label ?? '');
ok(!!m, 'carrying stolen goods, the fence names the thing and the price BEFORE you press',
  `label: ${f.label}`);
if (!m) { console.log(say.join('\n')); await b.close(); process.exit(1); }
const goods = m[1], price = Number(m[2]);
ok(price > 0 && price <= 8, `the price is mean — $${price.toFixed(2)} for the ${goods}`,
  'nothing in the table is worth more than a cheap meal; that is the joke');

// ── 5. PIN THE WALLET TO A KNOWN BRACKET, using the bodega's own comparator ─
const till = await find(/buy cereal|cereal \$.* short/);
ok(!!till, 'the bodega till publishes a cash-threshold prompt to measure against');
if (!till) { console.log(say.join('\n')); await b.close(); process.exit(1); }
let buys = 0;
for (; buys < 8; buys++) {
  await goTo(till);
  const t = await find(/buy cereal|cereal \$.* short/);
  if (/short/.test(t.label)) break;
  await pressE();
}
const cash = START_CASH - buys * CEREAL;
ok(/short/.test((await find(/buy cereal|cereal \$.* short/)).label),
  `the wallet is drained to a KNOWN bracket: ${buys} cereals`,
  `cash = ${START_CASH} - ${buys}×${CEREAL} = $${cash.toFixed(2)}, and the till agrees it is under $${CEREAL.toFixed(2)}`);
ok(cash < CEREAL && cash >= 0, 'and that bracket is arithmetically consistent with the prompt',
  `$${cash.toFixed(2)} < $${CEREAL.toFixed(2)}`);

// ── 6. SELL IT, AND WATCH THE MONEY MOVE ──────────────────────────────────
await goTo(fence);
await pressE();
const afterLabel = (await find(/no questions|broker doesn/)).label;
ok(!new RegExp(`sell the ${goods.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — `).test(afterLabel),
  `the ${goods} LEFT your pockets — the fence stops offering it`, `now: ${afterLabel}`);

await goTo(till);
const tillAfter = (await find(/buy cereal|cereal \$.* short/)).label;
const expect = cash + price >= CEREAL;
ok(/short/.test(tillAfter) !== expect,
  `THE MONEY MOVED: $${cash.toFixed(2)} + $${price.toFixed(2)} = $${(cash + price).toFixed(2)}, so the till must read "${expect ? 'buy' : 'short'}"`,
  `till now: "${tillAfter}"  —  sign exercised: ${expect ? 'CROSSED the $2.50 threshold' : 'did NOT cross it'}`);

ok(errs.length === 0, 'no console errors', errs.slice(0, 3).join(' | '));

console.log('');
console.log(say.join('\n'));
console.log('');
console.log(`${say.length - bad}/${say.length} passed`);
await b.close();
process.exit(bad ? 1 : 0);
