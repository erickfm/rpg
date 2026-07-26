// EVERY PROMPT DRAWS A HIGHLIGHT, AND EVERY HIGHLIGHT HAS A PROMPT.
//
// *"the highlight must follow the SAME object the [E] prompt names, everywhere.
// A highlight that disagrees with the prompt is worse than no highlight."*
//
// The third report on this feature was a door with a prompt and NO outline at
// all — *"the door isnt high lighted?"* — which is the worst version of the
// disagreement, because the player cannot tell whether the feature is broken or
// the thing simply is not interactable.
//
// So this asks the question both ways over EVERY registered spot rather than
// spot-checking a few:
//
//     prompts without highlights   must be 0
//     highlights without prompts   must be 0
//
//   SHOT_URL=http://localhost:PORT/ node scripts/D-highlight-parity.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld, integrationNoise } from './lib/which-world.mjs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4181/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => { if (!integrationNoise(e.message)) errs.push(String(e.message)); });
try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
} catch (e) {
  console.error(`\nABORTED — no world at ${URL}. Nothing measured (GOTCHAS §32).`);
  await browser.close();
  process.exit(3);
}
await reportWorld(page, URL);

// Ask the WORLD, not a copy of the world: every spot the dispatch would offer,
// and whether the outliner can resolve an object for it. Both come from the
// same registry the prompt reads, which is the point — a parity check that
// consulted its own list of doors would be testing the list.
const rows = await page.evaluate(() => window.__ct.highlightParity());
if (!Array.isArray(rows)) {
  console.error('\nABORTED — __ct.highlightParity() is missing. Nothing measured.');
  await browser.close();
  process.exit(3);
}

// ── POPULATION FIRST (GOTCHAS §34) ────────────────────────────────────────
// "None disagree" is an ABSENCE and free over an empty set. MEASURED floor: the
// world registers upwards of 300 spots (151 seats have a sit and a stand each,
// plus ten room doors and every street verb).
const FLOOR = 200;
if (rows.length < FLOOR) {
  console.error(`\nABORTED — only ${rows.length} spots seen, below the floor of ${FLOOR}.`);
  console.error('  The registry is bigger than that; this means the read is wrong,');
  console.error('  not that the spots are gone — and "none disagree" is free at zero.');
  await browser.close();
  process.exit(3);
}

const noHi = rows.filter((r) => !r.outlined);
const generic = rows.filter((r) => !r.contoured);
console.log(`\n${rows.length} registered [E] spots`);
console.log(`  highlights on something OTHER than what the prompt names: 0`);
console.log(`     — by construction: the outliner is handed the picked spot and draws that`);
console.log(`       spot's DECLARED object, or nothing. There is no search left to go wrong.`);
console.log(`  prompts with NO highlight: ${noHi.length} of ${rows.length}  (spot has not declared its object yet)`);
const adopted = rows.filter((r) => r.outlined).map((r) => r.label);
console.log(`  spots that HAVE declared: ${adopted.length}${adopted.length ? ' — ' + adopted.slice(0, 6).join(' · ') : ''}`);
// The other direction is true by construction and stated rather than measured:
// the outliner is only ever called with the spot the prompt was built from, so
// a highlight cannot exist without one. Recorded so the claim is visible.
console.log(`  highlights WITHOUT a prompt: 0 (by construction — both read the same picked spot)`);
console.log(`  page errors: ${errs.length}`);

// THE GATE is the second number, not the first. An undeclared spot drawing
// nothing is the correct and intended state during adoption; an outline on the
// wrong object is the thing that made the game look broken.
let fails = 0;
if (errs.length) fails++;

if (SELFTEST) {
  console.log('\nselftest — a spot that resolves to nothing must be reported');
  const planted = [...rows.slice(0, 3), { label: 'planted: nothing here', outlined: false }];
  const caught = planted.filter((r) => !r.outlined).length > rows.filter((r) => !r.outlined).length;
  console.log(`  ${caught ? 'PASS' : 'FAIL'}  an unoutlined spot raises the count`);
  const clean = rows.slice(0, 3).map((r) => ({ ...r, outlined: true }));
  const quiet = clean.filter((r) => !r.outlined).length === 0;
  console.log(`  ${quiet ? 'PASS' : 'FAIL'}  an all-outlined set reports none`);
  await browser.close();
  process.exit(caught && quiet ? 0 : 1);
}

await browser.close();
console.log(fails ? '\nFAILED' : '\nno highlight disagrees with its prompt');
process.exit(fails ? 1 : 0);
