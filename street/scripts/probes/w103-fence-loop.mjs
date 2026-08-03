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
// ⚠ ONLY ONE OF THE TWO SIGNS IS EVIDENCE, AND I HAD IT WRONG. After five
// cereals cash is $2.00, so:
//
//     fence SOCKS      +$0.50  ->  $2.50  ->  flips to "buy"    ← DISCRIMINATING
//     fence CATALOGUE  +$0.25  ->  $2.25  ->  stays  "short"    ← proves nothing
//
// The first cut of this probe called that "both signs exercised" and went green
// five runs running. Then I mutated the world — `ctx.purse.cash += paid` →
// `+= 0`, a fence that takes your goods and pays NOTHING — and the probe
// reported **16/16 PASSED**, because that run drew a catalogue and "still
// short" is exactly what a broken fence produces too.
//
// So the run keeps stealing and selling until the wallet CROSSES, and fails if
// it never does (§4's population floor). Each sale is still checked against its
// own prediction; the cheap ones simply cannot be the whole run.
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

// ── 3. PIN THE WALLET TO A KNOWN BRACKET, using the bodega's own comparator ─
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
let cash = START_CASH - buys * CEREAL;
const tillLabel = async () => (await find(/buy cereal|cereal \$.* short/)).label;
await goTo(till);
ok(/short/.test(await tillLabel()),
  `the wallet is drained to a KNOWN bracket: ${buys} cereals`,
  `cash = ${START_CASH} - ${buys}×${CEREAL} = $${cash.toFixed(2)}, and the till agrees it is under $${CEREAL.toFixed(2)}`);
ok(cash < CEREAL && cash >= 0, 'and that bracket is arithmetically consistent with the prompt',
  `$${cash.toFixed(2)} < $${CEREAL.toFixed(2)}`);

// ── 4. STEAL AND SELL, UNTIL THE WALLET CROSSES THE LINE ──────────────────
//
// ⚠ READ THIS BEFORE SIMPLIFYING IT BACK TO ONE SALE. The first cut of this
// probe stole ONE package, sold it, and asserted the till read whatever
// `cash + price` predicted — "both signs exercised", five runs, all green. It
// was HALF A CHECK, and I only found that out by mutating the world:
// `ctx.purse.cash += paid` → `+= 0`, rebuild, and the run came back **16/16
// PASSED**. The roll had given a $0.25 catalogue, whose predicted outcome is
// "still short" — and a fence that pays NOTHING also leaves you short. The
// assertion agreed with the mutation.
//
// **A branch whose expected answer is the same as the broken world's answer is
// not evidence.** Only a CROSSING discriminates: "short" → "buy" cannot happen
// unless money actually arrived. So the negative sign is not a second half of
// the check — it is the non-discriminating half, and treating the pair as
// "both signs covered" was the exact self-deception the brief warns about.
//
// The fix is a POPULATION FLOOR on the discriminating case: keep stealing and
// selling until the wallet crosses $2.50, and **FAIL if a run never gets
// there** rather than reporting a green that measured nothing. Each individual
// sale is still asserted against its own prediction, so the cheap outcomes are
// checked too — they just cannot be the whole run.
let crossed = false, sales = 0, days = 0, stolenNames = [];
for (let round = 0; round < 8 && !crossed; round++) {
  // find a parcel that is live right now, advancing days if none is out
  let parcel = null;
  for (; days < 40; days++) {
    parcel = (await spots()).find((s) => /steal .* package/.test(s.label ?? ''));
    if (parcel) break;
    await p.evaluate(() => window.__ct.advanceClock(1440));
    await p.waitForTimeout(120);
  }
  if (!parcel) break;

  // The landing is on an upper floor, so gy has to go with the warp or the
  // parcel's own ok() (|lastGy - floor*ST| < 0.5) refuses. Found by trying the
  // storey heights the building actually uses, not by recomputing ST here.
  let gy = null;
  for (const g of [0, 3.0, 6.0, 9.0, 2.7, 5.4, 8.1]) {
    await p.evaluate(([x, z, gg]) => window.__ct.warp(x, z, 0, gg, 0), [parcel.x, parcel.z, g]);
    await p.waitForTimeout(160);
    const live = (await spots()).find((q) => Math.abs(q.x - parcel.x) < 0.01
      && Math.abs(q.z - parcel.z) < 0.01);
    if (live?.ok) { gy = g; break; }
  }
  // Only a HARD failure on the first round. On later rounds a parcel we cannot
  // reach is a retry, not a defect: the run's verdict is the population floor at
  // the bottom, and failing here as well would turn "the second parcel of the
  // night was on an awkward landing" into a red on a healthy world. That is the
  // flake this project keeps catching in its own instruments.
  if (gy === null) {
    if (round === 0) { ok(false, 'you can stand on the landing where the parcel is', `${parcel.label}`); break; }
    await p.evaluate(() => window.__ct.advanceClock(1440)); days++; continue;
  }

  if (round === 0) {
    // WALK the last stretch once — movement and reach are exactly what a warp
    // cannot prove (BUILDER-BRIEF §10). Once is enough; the rest is arithmetic.
    await p.evaluate(([x, z, g]) => window.__ct.warp(x, z - 1.2, 0, g, 0), [parcel.x, parcel.z, gy]);
    await p.waitForTimeout(200);
    const b0 = await pos();
    await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w');
    await p.waitForTimeout(200);
    const b1 = await pos();
    ok(Math.hypot(b1[0] - b0[0], b1[2] - b0[2]) > 0.3,
      'you can WALK up to the parcel, not only warp onto it',
      `moved ${Math.hypot(b1[0] - b0[0], b1[2] - b0[2]).toFixed(2)} m`);
  }
  await goTo(parcel, gy);
  await pressE();
  const stillThere = (await spots()).some((s) => Math.abs(s.x - parcel.x) < 0.01
    && Math.abs(s.z - parcel.z) < 0.01 && s.ok);
  if (round === 0) ok(!stillThere, 'pressing [E] takes the parcel — its spot stops offering', `"${parcel.label}"`);

  // sell it
  await goTo(fence);
  const lab = (await find(/no questions|pawn counter/)).label;
  const m = /^sell the (.+) at the counter — \$(\d+\.\d\d), no questions$/.exec(lab ?? '');
  if (!m) { await p.evaluate(() => window.__ct.advanceClock(1440)); days++; continue; }
  const goods = m[1], price = Number(m[2]);
  if (round === 0) {
    ok(true, 'carrying stolen goods, the fence names the thing and the price BEFORE you press', `label: ${lab}`);
    ok(price > 0 && price <= 8, `the price is mean — $${price.toFixed(2)} for the ${goods}`,
      'nothing in the table is worth more than a cheap meal; that is the joke');
  }
  await pressE();
  sales++; stolenNames.push(`${goods} $${price.toFixed(2)}`);
  const afterLabel = (await find(/no questions|pawn counter/)).label;
  ok(!afterLabel.includes(`sell the ${goods} at the counter`),
    `the ${goods} LEFT your pockets — the fence stops offering it`, `now: ${afterLabel}`);

  const was = cash; cash += price;
  await goTo(till);
  const t = await tillLabel();
  const expectBuy = cash >= CEREAL;
  ok(/short/.test(t) !== expectBuy,
    `sale ${sales}: $${was.toFixed(2)} + $${price.toFixed(2)} = $${cash.toFixed(2)} — the till must read "${expectBuy ? 'buy' : 'short'}"`,
    `till: "${t}"${expectBuy ? '  ← DISCRIMINATING: only real money can cross this line' : '  (does not cross — cannot tell a paying fence from a broken one)'}`);
  // ⚠ SET FROM WHAT WAS OBSERVED, NOT FROM WHAT WAS PREDICTED. This read
  // `if (expectBuy) crossed = true` for one build, and against the `+= 0`
  // mutation the sale assertion went red while THE FLOOR BELOW STILL REPORTED
  // GREEN — a floor derived from the prediction cannot fail when the prediction
  // is what is wrong. Exactly the family of sleeping guard GOTCHAS 58 is about,
  // in my own check, twice in one item.
  if (expectBuy && !/short/.test(t)) crossed = true;
  if (!crossed) { await p.evaluate(() => window.__ct.advanceClock(1440)); days++; }
}

// THE POPULATION FLOOR. Without this line a run that only ever sold catalogues
// exits 0 having proved nothing about money at all — which is precisely what
// the `+= 0` mutation slipped through.
ok(crossed,
  'THE MONEY MOVED — the run reached a CROSSING, the only outcome a broken fence cannot fake',
  `${sales} sale(s): ${stolenNames.join(', ')} — final $${cash.toFixed(2)}, till crossed $${CEREAL.toFixed(2)}`);

ok(errs.length === 0, 'no console errors', errs.slice(0, 3).join(' | '));

console.log('');
console.log(say.join('\n'));
console.log('');
console.log(`${say.length - bad}/${say.length} passed`);
await b.close();
process.exit(bad ? 1 : 0);
