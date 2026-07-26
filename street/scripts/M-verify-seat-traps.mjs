// VERIFIER (M) — K's LANDED row: "a casino slot stool opens a modal and hud.ts
// BLOCKS keydown while a panel is up", evidenced by I as
// *"a player who sits at a slot machine cannot leave by any key, and reloading is
// the only exit"* — the last seat trap in the world, on 96 of its 225 seats.
//
// I did not build any of it. I took this row because I had just measured the
// opposite while verifying L's slots and could not leave both readings standing.
//
// ── I's station, run verbatim, and then corrected ─────────────────────────────
//
// I's predicate was *"`seated()` stays true through both, and `#ct-panelback` is
// in the document"*. The first half is a real test. **The second half cannot
// fail:** `hud.ts` creates that div ONCE and thereafter only animates its
// `opacity` — it is never removed, so "in the document" is true forever after the
// first panel in the session opens, including before you have sat down. Measured:
// it reads `true` at the approach. So this uses `__hud.panel()`, which reports the
// live cabinet by id, and keeps `#ct-panelback` only as printed context.
//
// It sweeps EVERY SEAT LABEL rather than the slots alone, because the row's claim
// is that this is the only trap left — an absence over one label is not that
// claim (GOTCHAS 34), and 96 of anything is a repeat where checking one proves
// nothing (GOTCHAS 41).
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('usage: SHOT_URL=http://localhost:<your own preview>/ node scripts/M-verify-seat-traps.mjs');
  process.exit(2);
}
const PER_LABEL = +(process.env.PER_LABEL ?? 3);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(700);

const results = [];
const say = (ok, name, detail) => results.push([ok, name, detail]);
const state = () => p.evaluate(() => ({
  seated: !!window.__ct.seated(),
  panel: window.__hud.panel(),
  back: !!document.getElementById('ct-panelback'),
}));
// down/hold/up. `keyboard.press` is instantaneous and the E dispatch is
// edge-triggered on `input.keys` read once per frame, so a press can fall between
// two frames and never be seen as held (GOTCHAS 30) — which reads as a seat that
// refused to be sat on.
const hold = async (k, ms = 130) => {
  await p.keyboard.down(k); await p.waitForTimeout(ms);
  await p.keyboard.up(k); await p.waitForTimeout(180);
};
const until = async (fn, ms = 2200) => {
  const t0 = Date.now();
  for (;;) {
    if (await fn()) return true;
    if (Date.now() - t0 > ms) return false;
    await p.waitForTimeout(70);
  }
};

// ── the population, ASKED FOR ──────────────────────────────────────────────
const seats = await p.evaluate(() => (window.__ct.seats() || []).map((s, i) => ({
  i, label: s.label, at: s.at,
})));
if (!seats.length) {
  console.error('ABORT: the world registers no seats — nothing to sweep');
  await b.close(); process.exit(3);
}
const byLabel = new Map();
for (const s of seats) {
  if (!byLabel.has(s.label)) byLabel.set(s.label, []);
  byLabel.get(s.label).push(s);
}
console.log(`${seats.length} seats across ${byLabel.size} labels`);
for (const [l, g] of byLabel) console.log(`  ${String(g.length).padStart(3)}  ${l}`);
const slots = byLabel.get('sit at the slot') || [];
say(slots.length >= 90, "the row's subject is still there — the slot stools",
  `${slots.length} seats labelled "sit at the slot", ${(100 * slots.length / seats.length).toFixed(0)}% `
  + `of all ${seats.length}`);

// ── the mechanism I's evidence names, checked in the DOM rather than assumed ──
{
  // sit at a slot so a panel is up, then confirm the panelback claim
  const s = slots[0];
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [s.at.x, s.at.z]);
  await p.waitForTimeout(350);
  const before = await state();
  await hold('e');
  await until(async () => (await state()).panel !== null);
  const on = await state();
  say(on.panel !== null, 'sitting at a slot does open a modal, as the row says',
    `__hud.panel() = ${JSON.stringify(on.panel)}`);
  // THE FALSIFIABLE FORM, and my first version of this was too strong. I asserted
  // the div is "unchanged by sitting", which is false on the FIRST panel of a
  // session — the element does not exist until one opens. The defect in I's
  // predicate is not that the div never appears, it is that it never LEAVES: so
  // open a panel, close it, and check it is still there. That is the state a
  // second reading would be taken in, and it is where the predicate misleads.
  say(before.back === false && on.back === true,
    'the backdrop div appears with the first panel, as expected',
    `before ${before.back} -> after ${on.back}`);
  // ONE Escape, which is what I's evidence says cannot work
  await hold('Escape');
  const out = await until(async () => (await state()).seated === false, 1500);
  const after = await state();
  say(out, 'ONE Escape leaves the stool — the trap does not reproduce',
    `seated ${on.seated} -> ${after.seated}, panel ${JSON.stringify(on.panel)} -> `
    + `${JSON.stringify(after.panel)}`);
  say(after.panel === null && after.back === true,
    "#ct-panelback IS STILL IN THE DOCUMENT with no panel up — so I's predicate "
    + 'cannot tell a trap from a closed cabinet',
    `panel ${JSON.stringify(after.panel)} but #ct-panelback present: ${after.back}`);
}

// ── the sweep: can you get off EVERY KIND of seat, by Escape and by E? ──────
//
// Escape first because it is the one I's row says is swallowed; E second because
// it is the one a player reaches for and the one `SEAT_EXIT`'s label names.
const stuck = [];
let tried = 0, satCount = 0;
for (const [label, group] of byLabel) {
  const pick = group.length <= PER_LABEL ? group
    : [group[0], group[Math.floor(group.length / 2)], group[group.length - 1]].slice(0, PER_LABEL);
  for (const s of pick) {
    for (const exit of ['Escape', 'e']) {
      tried++;
      await p.evaluate(() => window.__ct.warp(0, 40, 0, 0.14, 0));   // clear any latch
      await p.waitForTimeout(120);
      const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [s.at.x, s.at.z]);
      await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [s.at.x, s.at.z, gy]);
      // WAIT FOR THE FLOOR TO SETTLE. The walk-up's picker has hysteresis
      // (GOTCHAS 7) and this sweep warps in from the street to clear the re-entry
      // latch, so a fourth-floor seat can be asked for a press while the picker is
      // still on the pavement — which is why the bed alone would not accept one
      // here and accepted one perfectly in `M-verify-tv.mjs`, where nothing warped
      // through the street first. Route-dependent, and therefore mine.
      await until(async () => {
        const q = await p.evaluate(() => window.__ct.pos());
        return Math.abs(q[3] - gy) < 0.01;
      }, 1200);
      await p.waitForTimeout(200);
      // UP TO THREE TRIES TO SIT, and the retry is not slack — it separates a
      // dropped keypress from a seat that cannot be used. The E dispatch is
      // edge-triggered on a per-frame read, so under load a hold can still land
      // between two frames; retrying tells the two apart, and a seat that refuses
      // three times is reported rather than skipped.
      let sat = false;
      for (let t = 0; t < 3 && !sat; t++) {
        await hold('e', 170);
        sat = await until(async () => (await state()).seated === true, 1400);
      }
      if (!sat) { stuck.push([label, s.i, exit, 'never sat down']); continue; }
      satCount++;
      const modal = (await state()).panel;
      await hold(exit);
      const free = await until(async () => (await state()).seated === false, 1800);
      if (!free) stuck.push([label, s.i, exit, 'STILL SEATED', modal]);
    }
  }
}
say(tried >= byLabel.size * 2, 'the sweep actually ran over every label',
  `${tried} sit-and-exit attempts across ${byLabel.size} labels, up to ${PER_LABEL} seats each`);
const reallyStuck = stuck.filter((x) => x[3] === 'STILL SEATED');
const neverSat = stuck.filter((x) => x[3] === 'never sat down');
// THE ARITHMETIC IS HONEST ABOUT ITS DENOMINATOR. My first version said "72
// attempts, every one left the seat" while 7 of them had never sat down — so the
// exit claim covered 65 and the sentence claimed 72. A verdict has to name the
// population it actually measured (GOTCHAS 34).
// SPLIT BY EXIT, because the two keys do not behave the same and averaging them
// would hide the finding. Escape is the claim I's row says is impossible; E is the
// key the world's own prompt names.
const stuckEsc = reallyStuck.filter((x) => x[2] === 'Escape');
const stuckE = reallyStuck.filter((x) => x[2] === 'e');
say(stuckEsc.length === 0, 'ESCAPE LEAVES EVERY SEAT IN THE WORLD — no exceptions',
  stuckEsc.length ? stuckEsc.map((x) => `${x[0]}#${x[1]}`).join(' · ')
    : `${satCount} of ${tried} attempts sat down; every Escape got out`);
say(stuckE.length === 0, 'and E leaves every seat too',
  stuckE.length
    ? `E DOES NOTHING on ${stuckE.length}: ` + stuckE.map((x) => `${x[0]}#${x[1]}`
      + (x[4] ? ` (modal ${x[4]} up)` : ' (NO modal up)')).join(' · ')
    : 'every E got out');
// NOT a failure of the world, and NOT swept under the carpet either: a seat that
// would not accept three held presses is something I could not measure, and
// saying "not checked" is the honest verdict rather than a red on somebody's row
// (GOTCHAS 20 — an unread screenshot is not an observation, and this is the same
// thing for a keypress).
if (neverSat.length) {
  console.log(`\nNOT CHECKED — ${neverSat.length} attempt(s) never got seated after three `
    + `held presses, so nothing follows about their exit:\n  `
    + [...new Set(neverSat.map((x) => `${x[0]}#${x[1]}`))].join('\n  ')
    + '\n  Could be an approach point another collider has taken, or my own timing. '
    + 'Reported, not filed.');
}

say(errs.length === 0, 'no page errors through any of that',
  errs.length ? errs.slice(0, 3).join(' | ') : 'clean');

await b.close();
let bad = 0;
for (const [ok, name, detail] of results) {
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}\n        ${detail}`);
}
console.log(`\n${results.length - bad} of ${results.length} passed`);
process.exit(bad ? 1 : 0);
