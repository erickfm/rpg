// w105 / item 261 — the two hooks published on `__ct` this item: `purse()` and
// `forcePackages()`. Does each one do what it says, and — the harder half —
// could this check FAIL if it didn't?
//
// ⚠ THE FAILURE MODE A HOOK CHECK FALLS INTO. `ok(typeof purse().cash ===
// 'number')` passes against a hook that returns a frozen literal, and so does
// "it agrees with `__inv.cash()`" if both read the same dead constant. Neither
// assertion can tell a wired hook from a decorative one. So every claim here is
// about something MOVING or NOT moving:
//
//   · spend at the bodega till  -> cash must DROP by the till's own price
//   · stand there and press nothing -> cash must NOT move (the negative sign)
//   · forcePackages(true)/(false) -> the landings must go FULL / EMPTY
//
// A hook wired to nothing gives the same answer twice, and every pair above
// asks for two different answers.
//
// ⚠ THE POPULATION FLOOR IS DERIVED, NOT PREDICTED. The packages leg does not
// say "expect 12 parcels" — it asks the building how many landings it has
// (`scene.userData.packages.list().length`, ct/apartment.ts:2371) and requires
// ALL of them under force(true) and NONE under force(false). A floor typed from
// a prediction is the exact fault worker onehundredtwo found in its own fence
// probe: it stays green while the assertion it guards goes red.
//
// ⚠ NOTHING IS TYPED THAT THE WORLD PUBLISHES. The cereal price is parsed out
// of the till's own rendered label, not copied from int-bodega.ts; the landing
// count comes from the building. BUILDER-BRIEF §8.
//
// ⚠ SPAWN IS INSIDE APARTMENT 301 AT x = 198 (GOTCHAS 79b). Nothing here reads
// `visible`, and every station is reached by warping onto its published spot.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

const say = [];
let bad = 0;
const ok = (c, m, d = '') => { say.push(`${c ? ' ok  ' : 'FAIL '} ${m}${d ? `\n        ${d}` : ''}`); if (!c) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
// TRIANGLES, not frames and not a timeout: a counted frame over an empty scene
// is the solid-white-room failure (GOTCHAS 78/80).
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const purse = () => p.evaluate(() => window.__ct.purse?.() ?? null);
const spots = () => p.evaluate(() => window.__ct.spots());
const find = async (re) => (await spots()).find((s) => re.test(s.label ?? ''));
const goTo = async (s, gy = 0) => {
  await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [s.x, s.z, gy]);
  await p.waitForTimeout(220);
};
const pressE = async () => {                       // HELD — BUILDER-BRIEF §5
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(200);
};

// ── 1. THE HOOK IS THERE AND IT IS NUMBERS ────────────────────────────────
const p0 = await purse();
ok(p0 !== null, '`__ct.purse()` is published at all',
  p0 === null ? 'undefined — the hook did not land' : JSON.stringify(p0));
if (p0 === null) { console.log(say.join('\n')); await b.close(); process.exit(1); }
ok(typeof p0.cash === 'number' && Number.isFinite(p0.cash),
  'cash is a finite number, not an object and not a string', `cash = ${p0.cash}`);
ok(p0.inv && typeof p0.inv === 'object' && Object.values(p0.inv).every((v) => typeof v === 'number'),
  'the pockets come back as {id: count} numbers', JSON.stringify(p0.inv));
// `undefined` does not survive page.evaluate; normalising to null/true is the
// only way a probe sees the same shape the world has.
ok(p0.account === null || typeof p0.account === 'number',
  'the bank balance is a number or an explicit null, never a hole', `account = ${p0.account}`);
ok(typeof p0.card === 'boolean', 'the card is an explicit boolean', `card = ${p0.card}`);

// ── 2. AN INDEPENDENT WITNESS ─────────────────────────────────────────────
// `__inv.cash()` (ct/inventory.ts:772) is a different module's window onto the
// same `ctx.purse`. Agreement is not proof on its own — two reads of one dead
// constant also agree — but disagreement would prove the new hook is looking at
// a different object, which is the one way it could be wrong and still plausible.
const invCash = await p.evaluate(() => window.__inv?.cash?.() ?? null);
ok(invCash !== null && Math.abs(invCash - p0.cash) < 0.0005,
  '`__ct.purse().cash` and `__inv.cash()` are the SAME wallet',
  `__ct ${p0.cash}  vs  __inv ${invCash}`);

// ── 3. READ-ONLY: WRITING THE COPY MUST NOT WRITE THE WORLD ───────────────
// A test hook that hands back live state lets a probe fund its own assertions.
// Both fields, because a shallow copy that forgot to clone `inv` would pass a
// cash-only version of this.
const tamper = await p.evaluate(() => {
  const a = window.__ct.purse();
  a.cash = 999999; a.inv.CEREAL = 999999; a.inv.__PLANTED__ = 7; a.account = 999999;
  const b = window.__ct.purse();
  return { cash: b.cash, cereal: b.inv.CEREAL ?? 0, planted: b.inv.__PLANTED__ ?? null,
           account: b.account, invSame: a.inv === window.__ct.purse().inv };
});
ok(Math.abs(tamper.cash - p0.cash) < 0.0005 && tamper.account === p0.account,
  'writing the returned object does NOT move the real cash or account',
  `after tampering: cash ${tamper.cash}, account ${tamper.account}`);
ok(tamper.cereal === (p0.inv.CEREAL ?? 0) && tamper.planted === null,
  'and `inv` is a fresh copy — neither an overwrite nor a planted key survives',
  `CEREAL ${tamper.cereal} (was ${p0.inv.CEREAL ?? 0}), planted key ${tamper.planted}`);
ok(tamper.invSame === false, 'two calls hand back two different `inv` objects',
  `identical object returned twice: ${tamper.invSame}`);

// ── 4. THE NUMBER MOVES WHEN MONEY MOVES — and only then ──────────────────
const till = await find(/buy cereal|cereal \$.* short/);
ok(!!till, 'the bodega till is published, so there is somewhere to spend');
let spent = null;
if (till) {
  await goTo(till);
  const label = (await find(/buy cereal|cereal \$.* short/)).label;
  // PRICE FROM THE WORLD'S OWN LABEL, never retyped from int-bodega.ts.
  const price = Number(/\$(\d+\.\d\d)/.exec(label)?.[1] ?? NaN);
  ok(Number.isFinite(price), 'the till states its price, so the delta can be predicted from the world',
    `label: "${label}"`);

  // NEGATIVE SIGN FIRST: standing at the counter is not shopping. If this hook
  // were reporting something that drifts on its own — a frame counter, a clock
  // — this is the assertion that catches it.
  const beforeIdle = (await purse()).cash;
  await p.waitForTimeout(600);
  const afterIdle = (await purse()).cash;
  ok(Math.abs(afterIdle - beforeIdle) < 0.0005,
    'standing at the till without pressing anything moves NOTHING',
    `${beforeIdle} -> ${afterIdle} over 600 ms`);

  if (Number.isFinite(price) && /buy cereal/.test(label)) {
    const before = await purse();
    await pressE();
    const after = await purse();
    spent = { before: before.cash, after: after.cash, price };
    ok(Math.abs((before.cash - after.cash) - price) < 0.0005,
      `buying drops the cash by EXACTLY the till's own price — $${price.toFixed(2)}`,
      `$${before.cash.toFixed(2)} -> $${after.cash.toFixed(2)}  (delta $${(before.cash - after.cash).toFixed(2)})`);
    ok((after.inv.CEREAL ?? 0) === (before.inv.CEREAL ?? 0) + 1,
      'and the pockets gain the box — the same read sees both halves of the trade',
      `CEREAL ${before.inv.CEREAL ?? 0} -> ${after.inv.CEREAL ?? 0}`);
    // AND THE PROMPT AGREES WITH THE NUMBER. This is the assertion that makes
    // the whole hook worth having: the fence probe had ONLY the left-hand side
    // of this, and had to infer the right-hand side by arithmetic on two
    // hand-copied literals.
    const t2 = (await find(/buy cereal|cereal \$.* short/)).label;
    ok(/short/.test(t2) === (after.cash < price),
      'the till prompt and the published number tell the same story',
      `cash $${after.cash.toFixed(2)} vs price $${price.toFixed(2)} — label "${t2}"`);
  }
}

// ── 5. forcePackages: BOTH SIGNS, AGAINST A FLOOR THE BUILDING DERIVES ────
const landings = await p.evaluate(() => window.__ct.scene().userData.packages?.list?.()?.length ?? 0);
ok(landings > 0, 'the building publishes its landings, so there is a floor to derive',
  `${landings} package-bearing doors`);
const present = () => p.evaluate(() =>
  window.__ct.scene().userData.packages.list().filter((q) => q.present).length);
const force = async (v) => {
  await p.evaluate((q) => window.__ct.forcePackages(q), v);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.waitForTimeout(120);
};
let allOn = null, allOff = null, rolled = null;
if (landings > 0) {
  ok(await p.evaluate(() => typeof window.__ct.forcePackages === 'function'),
    '`__ct.forcePackages` is published as a function');
  await force(true);  allOn = await present();
  await force(false); allOff = await present();
  await force(null);  rolled = await present();
  ok(allOn === landings, `forcePackages(true) fills EVERY landing — ${landings}/${landings}`,
    `${allOn} of ${landings} present`);
  ok(allOff === 0, 'forcePackages(false) empties every one of them', `${allOff} present`);
  // The discriminator: a no-op hook returns the same count for both signs.
  ok(allOn !== allOff, 'the two signs give DIFFERENT answers — the hook is wired, not decorative',
    `true -> ${allOn}, false -> ${allOff}`);
  ok(rolled >= 0 && rolled <= landings,
    'forcePackages(null) hands the landings back to the nightly roll',
    `${rolled} of ${landings} present on the roll`);
  // And the steal spot follows the parcels, which is what the fence loop needs.
  // TWO spots per landing, not one, and that is authored on purpose: a spot's
  // x/z are read once, so the parcel's two possible sides get one registration
  // each and `ok()` answers for whichever side today's roll chose
  // (ct/apartment.ts:2310-2318, 2336-2344). Asserting `2 × landings` rather
  // than `>= landings` because the loose form would pass a world that had
  // silently lost one side of every pair.
  await force(true);
  const steals = (await spots()).filter((s) => /steal .* package|pockets full/.test(s.label ?? '')).length;
  ok(steals === landings * 2, 'and every forced parcel offers an [E] steal spot on each side',
    `${steals} steal spots against ${landings} landings × 2 sides`);
  await force(null);
}

ok(errs.length === 0, 'no console errors', errs.slice(0, 3).join(' | '));

console.log('');
console.log(say.join('\n'));
console.log('');
console.log(`${say.length - bad}/${say.length} passed`);
console.log(`SUMMARY cash ${spent ? `$${spent.before.toFixed(2)}->$${spent.after.toFixed(2)} (-$${spent.price.toFixed(2)})` : 'not spent'}`
  + `  packages on/off/roll ${allOn}/${allOff}/${rolled} of ${landings}`);
await b.close();
process.exit(bad ? 1 : 0);
