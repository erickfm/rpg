// Item 290 — DOES [E] ACTUALLY RELEASE A SEATED PLAYER? Pressed, not read about.
//
// Item 188's landed contract is *"29 seats released by [E], 0 trapped"*. The
// probe behind it (`w69-seated-offers.mjs`) seats through `__ct.sit()` and then
// reads the PROMPT TEXT and presses Escape — **it never presses `[E]` while
// seated at all**, so the number was never a measurement of the thing it names.
// The proof it was not: worker onehundredseventeen fixed item 283 — a latch
// armed by sitting could never discharge, `canSee` false for every spot until
// you stood — and item 188's figures did not move by one seat. **A check that
// reads green with the bug fully present.** (GOTCHAS 87's family.)
//
// So this presses the real key, at every seat, and counts what happens:
//
//   RELEASED   a HELD [E] while seated leaves you standing
//   OPENED     it raised a panel instead — legal, that is what the seat is for
//   NOTHING    it did neither. The seat is not trapped (Escape still works) but
//              the [E] the prompt advertises does not act.
//
// It reports the honest split and exits non-zero only on a genuine TRAP —
// still seated, no panel, and no way named. BUILDER-BRIEF §10a: this is the
// MEASUREMENT, taken once. It is a probe, not a suite entry; the cheap standing
// assertion that came out of it is `w119-290-seated-sight.mjs` beside it.
//
//   SHOT_URL=http://localhost:4750/ node scripts/probes/w119-290-seated-e-really.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4750/');
const LIMIT = Number(process.env.LIMIT ?? 0);        // 0 = every seat
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

const seats = await p.evaluate(() => window.__ct.seats());
console.log(`${seats.length} seats registered`);
// POPULATION FLOOR (GOTCHAS 71): "no seat is trapped" is free over an empty set.
if (seats.length < 200) {
  console.error(`REFUSING TO REPORT: only ${seats.length} seats visible — nothing measured.`);
  await b.close(); process.exit(3);
}

const promptNow = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});
const panelNow = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
// BUILDER-BRIEF §5: a HELD key. `press()` can begin and end inside one frame and
// the [E] dispatch is an edge read once per RENDERED frame — this is exactly the
// mechanism item 188's own probe skipped.
const hold = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(90);
  await p.keyboard.up(k); await p.waitForTimeout(260);
};

let released = 0, opened = 0, nothing = 0, notSeated = 0, trapped = 0, noPrompt = 0;
const nothingList = [], trappedList = [], openedList = [];
const n = LIMIT ? Math.min(LIMIT, seats.length) : seats.length;

for (let i = 0; i < n; i++) {
  const s = seats[i];
  // Sit BY IDENTITY, in the page — `page.evaluate` serialises arguments, so a
  // pose fetched out here is a COPY and the modules that match `s.pose === pose`
  // never recognise it. Same idiom as w69/w74; see w69's header.
  await p.evaluate((k) => {
    window.__ct.stand();
    window.__ct.sit(window.__ct.seats()[k].pose);
  }, i);
  await p.waitForTimeout(110);
  if (!(await p.evaluate(() => !!window.__ct.seated()))) { notSeated++; continue; }

  // ── WAIT FOR THE PROMPT, DO NOT PRESS INTO A NULL ONE ────────────────────
  //
  // The first cut of this probe pressed 110 ms after sitting and reported **89
  // seats where [E] "did nothing"** — every one of them a slot stool whose
  // prompt read `null` at the moment of the press and
  // `[E] play the slot machine` immediately after it. That was MY timing, not
  // the world's: the seated prompt is decided by the per-frame poll, and I was
  // pressing before the frame that decides it (GOTCHAS 30 — a fixed sleep
  // against anything the render loop drives fails only under load, and this
  // machine has five browsers on it).
  //
  // So it waits for the world to have an answer, and only then presses. A seat
  // that never produces one is counted separately rather than silently becoming
  // a "did nothing".
  const gotPrompt = await p.waitForFunction(() => {
    const d = document.getElementById('ct-prompt');
    return !!(d && d.style.display !== 'none' && (d.textContent ?? '').trim());
  }, null, { timeout: 4000 }).then(() => true).catch(() => false);
  if (!gotPrompt) { noPrompt++; await p.evaluate(() => window.__ct.stand()); continue; }

  const before = await promptNow();
  await hold('e');
  const stillSat = await p.evaluate(() => !!window.__ct.seated());
  const panel = await panelNow();

  if (panel) {
    opened++;
    openedList.push(`  ${i + 1}/${seats.length} "${s.label}" -> ${panel}`);
    await hold('Escape');
    await p.evaluate(() => window.__ct.stand());
    continue;
  }
  if (!stillSat) { released++; await p.evaluate(() => window.__ct.stand()); continue; }

  // Still seated, no panel. Is there a way out named at all?
  const after = await promptNow();
  const named = /\[E\]|\[ESC\]/.test(after ?? '');
  if (named) {
    nothing++;
    if (nothingList.length < 12) {
      nothingList.push(`  ${i + 1}/${seats.length} "${s.label}" prompt ${JSON.stringify(before)}`
        + ` -> [E] did nothing, still ${JSON.stringify(after)}`);
    }
  } else {
    trapped++;
    trappedList.push(`  ${i + 1}/${seats.length} "${s.label}" — seated, no panel, NO way named`
      + ` (prompt ${JSON.stringify(after)})`);
  }
  await p.evaluate(() => window.__ct.stand());
}

console.log(`\nDRIVEN THROUGH THE REAL [E] DISPATCH, ${n} seat(s):`);
console.log(`  RELEASED (stood up)      ${released}`);
console.log(`  OPENED a panel           ${opened}`);
console.log(`  [E] DID NOTHING          ${nothing}`);
console.log(`  TRAPPED (no way named)   ${trapped}`);
console.log(`  would not seat           ${notSeated}`);
console.log(`  never offered a prompt   ${noPrompt}`);
if (openedList.length) { console.log('\npanels opened by a seated [E]:'); console.log(openedList.slice(0, 12).join('\n')); }
if (nothingList.length) { console.log('\n[E] pressed and nothing happened (sample):'); console.log(nothingList.join('\n')); }
if (trappedList.length) { console.log('\nTRAPPED:'); console.log(trappedList.join('\n')); }
console.log(`\nconsole/page errors: ${errs.length}`);
await b.close();
process.exit(trapped ? 1 : 0);
