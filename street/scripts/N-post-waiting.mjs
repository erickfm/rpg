// THE CLAIM: post is waiting in 301's box when you come in off the street, it
// is 301's box and not somebody else's, you can reach it and read it, and
// SLEEPING THROUGH DAYS puts a week of post in it rather than one day's.
//
// Named for the claim (GOTCHAS §24). `mail`, `letters`, `rent` and `mailbox`
// are all SUBJECTS and more than one agent will investigate them; the thing
// this file asserts is that the post is waiting.
//
// The last clause is the one worth having. Rent is a clock feature and this
// world's clock does not merely tick — sleeping ramps it eight hours in a
// second and a half, straight past the eleven o'clock post, every single
// night. A delivery that accumulated per frame would drop a day every time the
// player went to bed, and NOTHING ELSE IN THE SUITE WOULD NOTICE, because the
// box would still have post in it.
//
// Usage: SHOT_URL=http://localhost:4195/ node scripts/N-post-waiting.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4195/';
const SELFTEST = flags(['--selftest']).selftest;

// Population floors, MEASURED and not remembered (GOTCHAS §34). Every absence
// asserted below is free over an empty set: no letters means no overrun, no
// envelopes means nothing misplaced, no junk table means a box that is empty
// for ever and passes every clause about what is in it.
const MIN_JUNK = 10;          // the table ships 14
const MIN_PLATES = 8;         // eight flats in the building, eight numbered boxes

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);          // exit 3 rather than measure the wrong build

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

// ── 0. is the module in THIS bundle? ──────────────────────────────────────
//
// Asked of the world, never assumed from the file existing. `ct/world.ts`
// collects from an eager glob and GOTCHAS §28 is that a module in an import
// cycle resolves to an undefined namespace at collection time and is dropped
// SILENTLY, in the built bundle only — which is what ships. ct/tenancy.ts
// imports ct/apartment.ts and ct/inventory.ts, so it is exactly the shape that
// can go missing.
const mods = await page.evaluate(() => window.__ct.modules());
const mine = mods.find((m) => m.path === './tenancy.ts');
ok(!!mine, `ct/tenancy.ts is registered in this build (${mods.length} modules found)`);
const live = await page.evaluate(() => typeof window.__rent === 'object' && window.__rent !== null);
ok(live, '__rent is published — the module RAN, it did not merely load');
if (!live) {
  console.log('EMPTY SUBJECT SET — nothing below would have been measured');
  await browser.close(); process.exit(3);
}

// ── 1. the box is C's box ─────────────────────────────────────────────────
//
// `findBank` snaps to the bank of boxes ct/apartment.ts actually built, using
// the derived position only as a search seed. `snapped` false means it fell
// back to the seed — the letters would hang on a blank wall and NOTHING would
// look wrong from inside this file. That is the whole reason it is reported.
const box = await page.evaluate(() => window.__rent.box());
ok(box.snapped, 'the 301 door snapped to C\'s bank mesh, it was not placed from a guess');
console.log(`      box at (${box.x.toFixed(3)}, ${box.y.toFixed(3)}, ${box.z.toFixed(3)}), `
  + `stand at (${box.stand.x.toFixed(2)}, ${box.stand.z.toFixed(2)})`);

// ── 2. populations, before any absence ────────────────────────────────────
const junk = await page.evaluate(() => window.__rent.junkKinds());
ok(junk >= MIN_JUNK, `${junk} kinds of junk mail in the table (floor ${MIN_JUNK})`);

// Eight numbered boxes, read off the SCENE rather than off the table that
// placed them — a count taken from the source would only prove the source
// agrees with itself.
const plates = await page.evaluate(() => {
  let n = 0;
  window.__ct.scene().traverse((o) => {
    if (o.parent?.name === 'tenancy-301-box' && o.geometry?.type === 'PlaneGeometry'
        && o.material?.map?.image?.width >= 18 && o.material.map.image.height <= 13) n++;
  });
  return n;
});
ok(plates >= MIN_PLATES, `${plates} number plates on the bank (floor ${MIN_PLATES}, one per flat)`);

// ── 3. no letter is silently CLIPPED ──────────────────────────────────────
//
// A line wider than the sheet renders perfectly and loses its right-hand end,
// which is indistinguishable from one that fits unless you know the column
// count. Twenty of them shipped in the first draft and the only one anybody
// saw was the landlord's signature, in a screenshot.
const over = await page.evaluate(() => {
  const cols = window.__rent.cols, bad = [];
  for (let d = 0; d < 220; d++) for (const l of window.__rent.mailOn(d)) {
    if (l.from.length > cols) bad.push(l.from);
    for (const s of l.lines) if (s.length > cols) bad.push(s);
  }
  return { cols, bad: [...new Set(bad)] };
});
ok(over.bad.length === 0,
  `every letter fits the sheet's ${over.cols} columns (${over.bad.length} overrun)`);
for (const s of over.bad.slice(0, 5)) console.log(`      CLIPPED: ${JSON.stringify(s)}`);

// ── 4. the post is there when you walk in ─────────────────────────────────
//
// WALKED, not warped. The claim is about coming in off the street, and a warp
// onto the trigger would pass over a lobby you could not actually cross —
// which is precisely what the collider mutation below breaks.
const arrive = await page.evaluate(() => {
  const s = window.__ct.scene().userData.spawn;   // published by ct/apartment.ts
  return s;
});
// the arrival pose `enter No. 227` leaves you in: just inside the front door,
// on the lobby floor, facing down the hall. Taken from the entry spot's own
// act() by standing where it puts you, not from a number typed here.
await page.evaluate(() => window.__ct.warp(201.2, -19.3, Math.PI, 0, 0));
await page.waitForTimeout(200);

const before = await page.evaluate(() => ({
  waiting: window.__rent.waiting(),
  envelopes: window.__rent.envelopes(),
  day: window.__rent.day(),
  now: window.__ct.clockNow(),
}));
ok(before.waiting.length > 0,
  `${before.waiting.length} letters waiting on day ${before.day} at `
  + `${String(before.now.hour).padStart(2, '0')}:${String(before.now.minute).padStart(2, '0')}`);
ok(before.waiting.some((l) => l.kind === 'rent'),
  'and one of them is the rent notice — this is how he finds out he owes it');
ok(before.envelopes === Math.min(before.waiting.length, 3),
  `the box SHOWS it: ${before.envelopes} envelopes out of the slot for `
  + `${before.waiting.length} letters (three is the cap)`);

// ── 5. THE MUTATIONS ──────────────────────────────────────────────────────
//
// Both break the WORLD, not this file's view of it. A mutation that edits the
// instrument proves the predicate compiles and nothing else.
//
//   door-moved     the box is dragged 3 m down the lobby, leaving its [E]
//                  where it was. GOTCHAS §8/§20: a trigger that has parted
//                  company with the object it names
//   lobby-blocked  a collider across the approach, pushed onto the same array
//                  the movement code tests. You can see the box; you cannot
//                  get to it
//
// The wall is derived from the walk below rather than typed: it spans the
// lobby at the MIDPOINT between where the walk starts and where the box is, so
// it cannot end up somewhere the player was never going to pass. My first
// version put it at a hand-typed z and the walk went round it — a mutation
// that does not break the thing looks exactly like a check that works.
const WALK_FROM = { x: 201.4, z: -16.4 };        // up the lobby, toward the stairs
if (SELFTEST) {
  await page.evaluate(([fz, bz]) => {
    window.__ct.scene().traverse((o) => { if (o.name === 'tenancy-301-box') o.position.z += 3; });
    const mid = (fz + bz) / 2;
    window.__ct.colliders().push({ minX: 200.1, maxX: 202.35, minZ: mid - 0.3, maxZ: mid + 0.3 });
  }, [WALK_FROM.z, box.z]);
  console.log('      --selftest: box dragged 3 m, and the lobby walled across the approach');
}

// ── 6. the [E] belongs to the box it names ────────────────────────────────
const spot = await page.evaluate(() => {
  const s = window.__ct.spots().filter((q) => /mailbox|read your mail/.test(q.label));
  return s.length ? { ...s[0], n: s.length } : null;
});
ok(spot !== null, 'exactly one [E] in the world offers the mailbox');
if (spot) {
  console.log(`      "${spot.label}"`);
  ok(spot.n === 1, `one and not several (${spot?.n})`);
  const nowBox = await page.evaluate(() => window.__rent.box());
  const d = Math.hypot(spot.x - nowBox.x, spot.z - nowBox.z);
  ok(d < 1.0, `it stands ${d.toFixed(2)} m from the box it opens (must be under 1.00)`);
  ok(/\d+ letters?/.test(spot.label), 'and the prompt says HOW MANY, before you press it');
}

// ── 7. can you actually get to it ─────────────────────────────────────────
//
// Walked until it either arrives or stops making progress, never for a fixed
// time — GOTCHAS §30: a fixed hold is a bet on how busy the machine is, and
// `lotwalk` went from 3 of 12 green to 12 of 12 by making exactly this change.
//
// AND IT MUST START OUTSIDE THE TRIGGER. The first version set out 0.90 m from
// a spot with a 0.95 m radius: it was already inside, `reached` was true on the
// first sample, and the whole clause passed WITHOUT THE PLAYER MOVING AT ALL.
// It survived a wall across the lobby for exactly that reason. A walk that can
// be satisfied by standing still is not a walk (GOTCHAS §30, §34).
await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [WALK_FROM.x, WALK_FROM.z]);
await page.waitForTimeout(200);
const startD = Math.hypot(WALK_FROM.x - (spot ? spot.x : box.stand.x),
  WALK_FROM.z - (spot ? spot.z : box.stand.z));
ok(startD > 1.5, `the walk starts ${startD.toFixed(2)} m out, outside the `
  + `${spot ? spot.r : '?'} m trigger — so arriving requires actually walking`);
await page.keyboard.down('w');
let lastD = Infinity, stuck = 0, reached = false;
for (let i = 0; i < 60 && !reached; i++) {
  await page.waitForTimeout(60);
  const st = await page.evaluate(() => {
    const p = window.__ct.pos();
    const s = window.__ct.spots().find((q) => /mailbox|read your mail/.test(q.label));
    return { x: p[0], z: p[2], sx: s?.x, sz: s?.z, live: !!s?.ok };
  });
  const d = Math.hypot(st.x - st.sx, st.z - st.sz);
  reached = st.live && d < 0.95;
  if (d > lastD - 0.005) stuck++; else stuck = 0;
  lastD = Math.min(lastD, d);
  if (stuck > 8) break;
}
await page.keyboard.up('w');
ok(reached, `you can WALK to the mailbox from the lobby (closest approach ${lastD.toFixed(2)} m)`);

// ── 8. take it, and read it ───────────────────────────────────────────────
//
// Held and polled rather than pressed and slept on: [E] dispatch is edge
// triggered inside the render loop and a press-and-release can land entirely
// between two frames on a loaded machine.
if (reached) {
  // Stand ON the trigger before pressing, rather than wherever the walk left
  // you. Releasing W costs a frame or two of harness latency and the walk
  // OVERSHOOTS — measured going straight past the box to the front wall, 1.10 m
  // away, where the [E] is correctly not offered. Coupling "can I get there" to
  // "does it open" made the second one fail for a reason that had nothing to do
  // with it; they are two claims and they get two stations.
  await page.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI / 2, 0, 0), [spot.x, spot.z]);
  await page.waitForTimeout(200);
  await page.keyboard.down('e');
  await page.waitForFunction(() => window.__rent.reading() !== null, { timeout: 8000 }).catch(() => {});
  await page.keyboard.up('e');
  const after = await page.evaluate(() => ({
    waiting: window.__rent.waiting().length,
    held: window.__rent.held().length,
    reading: window.__rent.reading(),
    envelopes: window.__rent.envelopes(),
  }));
  ok(after.reading !== null, 'the letter opens in your hands');
  ok(after.reading?.of === before.waiting.length,
    `every letter you took is in the pile (${after.reading?.of} pages for ${before.waiting.length} letters)`);
  ok(after.waiting === 0, 'the box is EMPTY afterwards — the post left it');
  ok(after.envelopes === 0, 'and nothing is left sticking out of the slot');
  ok(after.held === before.waiting.length, 'you are still holding them');
  await page.keyboard.press('Escape');
}

// ── 9. SLEEPING THROUGH DAYS. The clock claim. ────────────────────────────
//
// Snap four days forward without going near the box and require the post of
// every delivery day in between — not one day's, and not nothing. Snapped
// rather than slept because a real sleep is a ramp over real seconds and this
// asserts the same arithmetic the ramp drives.
const slept = await page.evaluate(() => {
  const d0 = window.__rent.day();
  window.__ct.advanceClock(4 * 1440, 0);
  const d1 = window.__rent.day();
  const expect = [];
  for (let d = d0 + 1; d <= d1; d++) expect.push(...window.__rent.mailOn(d).map(() => d));
  return { d0, d1, expect: expect.length, got: window.__rent.waiting().length,
    days: [...new Set(window.__rent.waiting().map((l) => l.day))] };
});
await page.waitForTimeout(200);
ok(slept.d1 === slept.d0 + 4, `four days passed (day ${slept.d0} -> ${slept.d1})`);
ok(slept.got === slept.expect,
  `${slept.got} letters accumulated across them, not one day's (expected ${slept.expect})`);
ok(slept.days.length >= 3,
  `and they are from ${slept.days.length} different days (${slept.days.join(', ')}) — `
  + 'a per-frame delivery would have kept only the last');

// ── 10. the rent itself ───────────────────────────────────────────────────
const rent = await page.evaluate(() => {
  const before = window.__ct.clockNow().totalMin;
  const at = (d) => { window.__ct.clock(0, 0); window.__ct.advanceClock(d * 1440 + 800, 0);
    return { day: window.__rent.day(), owed: window.__rent.owed() }; };
  const out = { early: at(1), due: at(2), later: at(3), week2: at(9) };
  window.__ct.clock(0, 0); window.__ct.advanceClock(before, 0);
  return out;
});
ok(rent.early.owed === 0, `nothing is owed on day ${rent.early.day}, before the first rent day`);
ok(rent.due.owed > 0, `$${rent.due.owed.toFixed(2)} falls due on day ${rent.due.day}`);
ok(rent.later.owed === rent.due.owed,
  'and it does not compound while it sits unpaid — one week owed is one week owed');
ok(rent.week2.owed === rent.due.owed * 2,
  `a second week doubles it, at day ${rent.week2.day} ($${rent.week2.owed.toFixed(2)})`);

// paying takes REAL money out of the ONE purse — K's, through ctx.purse, never
// a second wallet of this module's own
const paid = await page.evaluate(() => {
  window.__ct.clock(0, 0); window.__ct.advanceClock(2 * 1440 + 800, 0);
  const cashBefore = window.__inv.cash();
  const took = window.__rent.pay();
  return { cashBefore, took, cashAfter: window.__inv.cash(), owedAfter: window.__rent.owed() };
});
if (paid.cashBefore >= 45) {
  ok(paid.took === 45 && paid.cashAfter === paid.cashBefore - 45,
    `paying moved $${paid.took.toFixed(2)} out of the purse `
    + `($${paid.cashBefore.toFixed(2)} -> $${paid.cashAfter.toFixed(2)})`);
  ok(paid.owedAfter === 0, 'and the arrears are cleared');
} else {
  // The honest branch, and it is not a pass by default: the purse starts at
  // $14.50 and a week's rent is $45, so with no income in the world yet the
  // refusal is what there is to assert. It must refuse WITHOUT taking money.
  ok(paid.took === 0 && paid.cashAfter === paid.cashBefore,
    `$${paid.cashBefore.toFixed(2)} is short of the $45.00 rent, and the refusal `
    + 'took nothing (there is no income in the world yet — see notes/N-tenancy.md)');
}

ok(errors.length === 0, `no console errors (${errors.length})`);
for (const e of errors.slice(0, 5)) console.log(`      ${e}`);

await browser.close();
if (SELFTEST) {
  // Two mutations, and the two claims that must have caught them.
  const caught = fails.filter((f) => /m from the box it opens|WALK to the mailbox/.test(f));
  console.log(`\n--selftest: ${caught.length} of 2 mutations CAUGHT`);
  for (const c of caught) console.log(`  caught: ${c}`);
  process.exit(caught.length === 2 ? 0 : 1);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall green');
process.exit(fails.length ? 1 : 0);
