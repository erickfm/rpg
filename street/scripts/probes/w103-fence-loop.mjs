// w103 / item 180 — WALK the fence loop: steal a package, carry it to the pawn
// shop, sell it, and prove the MONEY MOVED.
//
// ⚠ THE HARD PART IS THE MONEY, AND THE PROBE THAT LIES HERE WOULD LIE ABOUT
// EXACTLY THAT.
//
// ══ REWRITTEN 2026-08-03 FOR ITEM 261. READ THE HISTORY; IT IS THE POINT ══
//
// When this probe was written `__ct` published NOTHING about the wallet — no
// cash, no inventory — and `crosstown.ts` was not named by item 180, so per
// BUILDER-BRIEF §9 its author did not add one. The cash was therefore measured
// through a comparator the world already published: `ct/int-bodega.ts:762`
// words its own prompt off the wallet,
//
//     cash >= 2.50  ->  "buy cereal — $2.50"
//     cash <  2.50  ->  "cereal $2.50 — you’re short"
//
// so the run drained the purse against that threshold and then did arithmetic
// on a hand-typed `START_CASH = 14.5` and `CEREAL = 2.5` to work out where it
// stood. **That reconstruction was fragile twice over.** Two literals copied
// out of two other files, which BUILDER-BRIEF §8 calls the single most
// expensive habit in this codebase; and a threshold read off a DOM element
// whose text has outlived its own hiding before — a check 40 m from the jail
// once still read `[E] into the HOUSE OF DETENTION`.
//
// AND IT FORCED A WEAKER ASSERTION THAN THE FEATURE DESERVED. With only a
// threshold, one of the two signs is not evidence at all. After five cereals
// cash is $2.00, so:
//
//     fence SOCKS      +$0.50  ->  $2.50  ->  flips to "buy"    ← DISCRIMINATING
//     fence CATALOGUE  +$0.25  ->  $2.25  ->  stays  "short"    ← proves nothing
//
// The first cut called that "both signs exercised" and went green five runs
// running. Mutating the world — `ct/int-pawn.ts:368` `ctx.purse.cash += paid`
// → `+= 0`, a fence that takes your goods and pays NOTHING — got **16/16
// PASSED**, because that run drew a catalogue and "still short" is exactly what
// a broken fence produces too. The repair was a population floor: keep selling
// until the wallet CROSSES, and fail if a run never gets there.
//
// **`__ct.purse()` removes the whole apparatus.** The check reads the number:
//
//     cash after a sale  −  cash before it  ===  the price the fence NAMED
//
// which discriminates on EVERY sale, including the $0.25 catalogue the crossing
// test had to throw away: `+= 0` gives a delta of 0 against a stated 0.25 and
// goes red on the first sale, whatever the roll hands you. So the crossing is
// no longer load-bearing. It is kept as a CORROBORATING witness — the till
// prompt and the published number must tell the same story — because that is
// the assertion that would catch an accessor wired to the wrong object, which
// is the one way `purse()` could be wrong and still look plausible.
//
// `__ct.forcePackages` is published now too, and it matters more here than
// anywhere: **a game day is 24 REAL MINUTES**, so this run used to call
// `advanceClock(1440)` up to forty times hunting for a parcel the nightly roll
// might not have placed. It asks for one.
//
// EVERY COORDINATE AND EVERY PRICE IS READ FROM THE WORLD, never typed here:
// the parcel, the fence counter and the bodega till are all found by matching
// their own published label text, and the cereal price is parsed out of the
// till's own rendered label. This probe cannot strand itself against a counter
// that moved.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

const say = [];
let bad = 0;
const ok = (c, m, d = '') => { say.push(`${c ? ' ok  ' : 'FAIL '} ${m}${d ? `\n        ${d}` : ''}`); if (!c) bad++; };
const money = (n) => `$${n.toFixed(2)}`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
// A PAINTED FRAME, NOT A TIMEOUT — a probe that waits on a clock photographs a
// solid white room (the brief's own example).
// `painted()` returns {frames, triangles, calls} (crosstown.ts), not a number —
// the first cut of this probe compared the OBJECT to 0, which is always false,
// and timed out against a perfectly healthy world. Read the field, and require
// TRIANGLES rather than frames: a frame can be counted for an empty scene,
// which is the solid-white-room failure this rule exists for.
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const spots = () => p.evaluate(() => window.__ct.spots());
const find = async (re) => (await spots()).find((s) => re.test(s.label ?? ''));
const pos = () => p.evaluate(() => window.__ct.pos());
const cash = () => p.evaluate(() => window.__ct.purse().cash);
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

// ── 0. THE INSTRUMENT ITSELF, before anything is claimed with it ───────────
// GOTCHAS 32: a hook that is missing must abort, not quietly measure nothing.
const hooks = await p.evaluate(() => ({
  purse: typeof window.__ct.purse, force: typeof window.__ct.forcePackages,
}));
if (hooks.purse !== 'function') {
  console.log(`\nEXIT 3: \`__ct.purse()\` is not published (${hooks.purse}). Nothing was measured.`);
  await b.close(); process.exit(3);
}
if (hooks.force !== 'function') {
  console.log(`\nEXIT 3: \`__ct.forcePackages()\` is not published (${hooks.force}). Nothing was measured.`);
  await b.close(); process.exit(3);
}
const opening = await cash();
ok(typeof opening === 'number' && Number.isFinite(opening),
  'the wallet publishes a number, so this run measures money instead of inferring it',
  `opening balance ${money(opening)}`);

// ── 1. THE FENCE EXISTS AT ALL, and it is inside the pawn shop ────────────
let fence = await find(/no questions|pawn counter/);
ok(!!fence, 'the pawn counter publishes a fence spot',
  fence ? `at (${fence.x.toFixed(2)}, ${fence.z.toFixed(2)}) r=${fence.r}` : 'NO SPOT MATCHED — the fence is not registered');
if (!fence) { console.log(say.join('\n')); await b.close(); process.exit(1); }

// ── 2. NEGATIVE CASE FIRST, on the world's own opening inventory ──────────
//
// The player starts with `{ CEREAL: 3 }` and nothing else, and cereal is not
// stolen goods — so the fence must refuse it BY NAME. Running this before any
// theft means the refusal is measured on a state I did not construct.
await goTo(fence);
let f = await find(/no questions|pawn counter/);
ok(/he doesn’t want anything/.test(f.label),
  'with only bought goods in your pockets, the fence refuses IN WORDS', `label: ${f.label}`);
// AND THE REFUSAL STILL NAMES THE PLACE. This is the assertion that stops the
// station regressing: `interiors-walk`'s customer-station check reads the label
// in whatever state the player happens to be in, so a spot that only names the
// counter while you are holding loot is a station it sees only sometimes.
ok(/counter/i.test(f.label),
  'and it names the COUNTER even while refusing — the station cannot depend on your pockets',
  `label: ${f.label}`);
ok(f.ok === true, 'and the spot is still LIVE while refusing — a refusal is not a dead spot',
  `ok=${f.ok}`);
// AND A REFUSAL COSTS NOTHING. Free now that the number is readable; it was not
// expressible at all against a threshold prompt.
await pressE();
ok(Math.abs((await cash()) - opening) < 0.0005,
  'pressing [E] on a refusal moves no money at all',
  `${money(opening)} -> ${money(await cash())}`);

// ── 3. DRAIN THE WALLET, AND CROSS-CHECK PROMPT AGAINST NUMBER ────────────
//
// Not needed to measure the sale any more — that is `after − before` now — but
// kept for two reasons. It walks the bodega, and it is where the till's own
// wording is checked against the published figure. If `purse()` were reading a
// different object, or a stale copy, this is what would say so.
const till = await find(/buy cereal|cereal \$.* short/);
ok(!!till, 'the bodega till publishes a cash-threshold prompt to cross-check against');
if (!till) { console.log(say.join('\n')); await b.close(); process.exit(1); }
const tillLabel = async () => (await find(/buy cereal|cereal \$.* short/)).label;
// PRICE FROM THE TILL'S OWN LABEL. The old `const CEREAL = 2.5` was a copy of
// int-bodega.ts:773 and is exactly the duplication §8 is about.
const CEREAL = Number(/\$(\d+\.\d\d)/.exec(await tillLabel())?.[1] ?? NaN);
ok(Number.isFinite(CEREAL), 'and it states its own price, so nothing is retyped here',
  `till: "${await tillLabel()}" -> ${money(CEREAL)}`);
let buys = 0;
for (; buys < 12; buys++) {
  await goTo(till);
  const t = await find(/buy cereal|cereal \$.* short/);
  if (/short/.test(t.label)) break;
  const was = await cash();
  await pressE();
  const now = await cash();
  if (buys === 0) {
    ok(Math.abs((was - now) - CEREAL) < 0.0005,
      'buying takes EXACTLY the stated price out of the published wallet',
      `${money(was)} -> ${money(now)}, delta ${money(was - now)} against a stated ${money(CEREAL)}`);
  }
}
await goTo(till);
const drained = await cash();
ok(/short/.test(await tillLabel()) === (drained < CEREAL),
  `the till's wording and the published number AGREE after ${buys} cereals`,
  `cash ${money(drained)} vs price ${money(CEREAL)} — label "${await tillLabel()}"`);
ok(drained < CEREAL && drained >= 0, 'and the wallet really is under the line, by the number',
  `${money(drained)} < ${money(CEREAL)}`);

// ── 4. STEAL AND SELL — every sale asserted against the price it NAMED ────
//
// ⚠ WHAT THIS USED TO BE, AND WHY IT IS SHORTER NOW. It stole up to eight
// parcels across up to forty simulated days, hunting for a sale expensive
// enough to push the wallet back over $2.50, because a CROSSING was the only
// outcome a fence paying nothing could not fake. With `purse()` the delta is
// the measurement, so every sale is discriminating and the day-hunt is gone.
//
// THE FLOOR IS DERIVED FROM THE BUILDING, NOT PREDICTED: `forcePackages(true)`
// puts a parcel on every landing, so the number available is exactly the number
// of landings the building publishes, and the run is required to complete
// `min(3, landings)` sales. A floor typed from a guess is the fault worker
// onehundredtwo found in this very probe — set from the prediction, so it stayed
// green while the assertion it guarded went red.
await p.evaluate(() => window.__ct.forcePackages(true));
await p.waitForTimeout(200);
const landings = await p.evaluate(() =>
  window.__ct.scene().userData.packages?.list?.()?.map((q) => ({ x: q.x, z: q.z, floor: q.floor })) ?? []);
ok(landings.length > 0, 'the building publishes its landings, so the floor can be derived',
  `${landings.length} package-bearing doors`);
const TARGET = Math.min(3, landings.length);

let sales = 0, crossings = 0, stolenNames = [], walked = null;
for (let round = 0; round < 12 && sales < TARGET; round++) {
  // A parcel that is live RIGHT NOW. `pkgTaken` is keyed `day:num`, so a
  // neighbour already robbed today stays robbed — advance a day when the
  // landings run dry rather than re-pressing a dead spot.
  let parcel = null, gy = null;
  const cands = (await spots()).filter((s) => /steal .* package/.test(s.label ?? ''));
  for (const c of cands) {
    // Storey heights are NOT typed: floor 0 is gy 0 for any storey height, and
    // for the upper landings the world's own `ok()` is asked which candidate
    // works. An empirical search against the world is a derivation; a ladder of
    // constants asserted blind is not.
    const near = landings.find((L) => Math.abs(L.x - c.x) < 0.6 && Math.abs(L.z - c.z) < 0.6);
    const ladder = near && near.floor === 0 ? [0] : [0, 2.7, 3.0, 5.4, 6.0, 8.1, 9.0];
    for (const g of ladder) {
      await p.evaluate(([x, z, gg]) => window.__ct.warp(x, z, 0, gg, 0), [c.x, c.z, g]);
      await p.waitForTimeout(150);
      const live = (await spots()).find((q) => Math.abs(q.x - c.x) < 0.01 && Math.abs(q.z - c.z) < 0.01);
      if (live?.ok) { parcel = c; gy = g; break; }
    }
    if (parcel) break;
  }
  if (!parcel) {                       // every landing robbed today — new day
    await p.evaluate(() => window.__ct.advanceClock(1440));
    await p.waitForTimeout(150);
    continue;
  }

  if (walked === null) {
    // WALK the last stretch once — movement and reach are exactly what a warp
    // cannot prove (BUILDER-BRIEF §10). Once is enough; the rest is arithmetic.
    await p.evaluate(([x, z, g]) => window.__ct.warp(x, z - 1.2, 0, g, 0), [parcel.x, parcel.z, gy]);
    await p.waitForTimeout(200);
    const b0 = await pos();
    await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w');
    await p.waitForTimeout(200);
    const b1 = await pos();
    walked = Math.hypot(b1[0] - b0[0], b1[2] - b0[2]);
    ok(walked > 0.3, 'you can WALK up to the parcel, not only warp onto it',
      `moved ${walked.toFixed(2)} m`);
  }
  await goTo(parcel, gy);
  await pressE();
  const stillThere = (await spots()).some((s) => Math.abs(s.x - parcel.x) < 0.01
    && Math.abs(s.z - parcel.z) < 0.01 && s.ok);
  if (sales === 0) ok(!stillThere, 'pressing [E] takes the parcel — its spot stops offering', `"${parcel.label}"`);

  // sell it
  await goTo(fence);
  const lab = (await find(/no questions|pawn counter/)).label;
  const m = /^sell the (.+) at the counter — \$(\d+\.\d\d), no questions$/.exec(lab ?? '');
  if (!m) continue;                    // nothing fenceable came out of that one
  const goods = m[1], price = Number(m[2]);
  if (sales === 0) {
    ok(true, 'carrying stolen goods, the fence names the thing and the price BEFORE you press', `label: ${lab}`);
    ok(price > 0 && price <= 8, `the price is mean — ${money(price)} for the ${goods}`,
      'nothing in the table is worth more than a cheap meal; that is the joke');
  }

  const was = await cash();
  await pressE();
  const now = await cash();
  sales++; stolenNames.push(`${goods} ${money(price)}`);

  // ⚠ THIS IS THE MEASUREMENT. Not a prompt flipping, not a bracket: the
  // published wallet rose by exactly what the counter said it would. A fence
  // that pays nothing fails this on the FIRST sale regardless of what the roll
  // handed over — which the crossing test could not do.
  ok(Math.abs((now - was) - price) < 0.0005,
    `sale ${sales}: the ${goods} paid EXACTLY the ${money(price)} the counter named`,
    `${money(was)} -> ${money(now)}, delta ${money(now - was)}`);

  const afterLabel = (await find(/no questions|pawn counter/)).label;
  ok(!afterLabel.includes(`sell the ${goods} at the counter`),
    `the ${goods} LEFT your pockets — the fence stops offering it`, `now: ${afterLabel}`);

  // CORROBORATION, not the measurement: the bodega's own wording must agree
  // with the number after the money lands. This is what catches an accessor
  // reading a different object from the one the fence pays into.
  await goTo(till);
  const t = await tillLabel();
  ok(/short/.test(t) === (now < CEREAL),
    `and the till's wording still agrees with the number — ${money(now)} vs ${money(CEREAL)}`,
    `till: "${t}"`);
  if (was < CEREAL && now >= CEREAL) crossings++;
}
await p.evaluate(() => window.__ct.forcePackages(null));

// THE POPULATION FLOOR, derived from the landings the building publishes.
ok(sales >= TARGET,
  `THE MONEY MOVED — ${sales} of a required ${TARGET} sales completed and each matched its stated price`,
  `${stolenNames.join(', ')} · opening ${money(opening)} -> final ${money(await cash())}`
  + ` · ${crossings} of them also crossed the till's ${money(CEREAL)} line`);

ok(errs.length === 0, 'no console errors', errs.slice(0, 3).join(' | '));

console.log('');
console.log(say.join('\n'));
console.log('');
console.log(`${say.length - bad}/${say.length} passed`);
await b.close();
process.exit(bad ? 1 : 0);
