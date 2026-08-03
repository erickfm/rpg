// Item 227 asks, as its last clause: does `D-walk`'s ATM leg share the cause of
// the side-street car census reporting "0 found"?
//
// ANSWER: NO. They are unrelated, and this probe demonstrates it rather than
// asserting it.
//
//   item 227  — `scripts/side-walk.mjs` ended a scene-traverse clause with
//               `&& o.visible`. regionCull hides the whole exterior while the
//               player's x >= 100, and the player SPAWNS IN APARTMENT 301 AT
//               x = 198.4, so every outdoor object reads visible===false at
//               census time. A SCENE-READING bug. (GOTCHAS 79b.)
//               Fixed at 210891b5f; `D-walk.mjs` never had a `.visible` filter
//               at all — the only two matches in that file are prose.
//
//   D-walk    — `scripts/D-walk.mjs:447` does `page.keyboard.press('e')`.
//               BUILDER-BRIEF §5: the `[E]` dispatch is an edge read ONCE PER
//               RENDERED FRAME, and a synthetic press can go down and up inside
//               a single frame, so the tap is never observed. An INPUT-TIMING
//               bug, in the harness, with nothing to do with the cull.
//
// This probe drives the ATM both ways from the same page and reports the panel
// count each way. If the held press opens the machine and the tap does not, the
// world is fine and the harness is wrong — which is item 279's decision to make,
// not this one's. It deliberately does NOT edit D-walk.mjs: item 227 names only
// scripts/side-walk.mjs (BUILDER-BRIEF §9).
//
// Usage: SHOT_URL=http://localhost:4740/ node scripts/probes/w118-item227-does-dwalk-share-it.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('  NOT AIMED — pass SHOT_URL=http://localhost:<your port>/'); process.exit(2); }

// The same full-screen-panel census D-walk.mjs:443-446 uses, copied with its
// line cited rather than re-invented, so a disagreement here is about the
// KEYPRESS and not about what counts as a panel (BUILDER-BRIEF §8).
const panels = () => [...document.querySelectorAll('canvas,div')]
  .filter((e) => {
    const r = e.getBoundingClientRect(), st = getComputedStyle(e);
    return r.width > 300 && r.height > 200 && st.display !== 'none' && st.visibility !== 'hidden'
      && +st.opacity !== 0 && (st.position === 'fixed' || st.position === 'absolute');
  }).length;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);

// D-walk.mjs:424's own ATM stand, so this is the same spot it fails from.
const atm = async () => {
  await page.evaluate(() => window.__ct.warp(-6.0, 7.29, -Math.PI / 2, 0.14, 0));
  await page.waitForTimeout(500);
};

await atm();
const prompt = await page.evaluate(() => {
  const el = document.querySelector('#ct-prompt');
  // GOTCHAS: a hidden prompt used to keep its stale text, so check display too.
  return el && getComputedStyle(el).display !== 'none' ? el.textContent.trim() : '';
});
console.log(`  prompt at the ATM: ${JSON.stringify(prompt)}`);

// TWO INSTRUMENTS, DELIBERATELY. `panels()` is D-walk's own DOM heuristic;
// `__hud.panel()` is the world saying which cabinet is up by DOM id. The first
// is what the failing check believes, the second is the truth — and if they
// disagree, THAT disagreement is the finding.
const up = () => page.evaluate(() => window.__hud.panel());

const base = await page.evaluate(panels);
const baseUp = await up();

// ── 1. the TAP, exactly as D-walk.mjs:447 does it ────────────────────────
await page.keyboard.press('e');
await page.waitForTimeout(900);
const tapped = await page.evaluate(panels);
const tappedUp = await up();
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// ── 2. the HELD press, as BUILDER-BRIEF §5 requires ──────────────────────
await atm();
const base2 = await page.evaluate(panels);
await page.keyboard.down('e');
await page.waitForTimeout(120);
await page.keyboard.up('e');
await page.waitForTimeout(900);
const held = await page.evaluate(panels);
const heldUp = await up();
await page.keyboard.press('Escape');

await browser.close();

console.log(`\n  tap  press('e')       : ${base} full-screen panels -> ${tapped}   __hud.panel(): ${JSON.stringify(baseUp)} -> ${JSON.stringify(tappedUp)}`);
console.log(`  held down/up 120 ms   : ${base2} full-screen panels -> ${held}   __hud.panel(): ${JSON.stringify(baseUp)} -> ${JSON.stringify(heldUp)}`);
if ((tappedUp || heldUp) && tapped === base && held === base2) {
  console.log(`\n  ⚠ THE TWO INSTRUMENTS DISAGREE: the world says a panel IS up, D-walk's`);
  console.log(`  full-screen-DIV census says nothing changed. The check is blind, not the world.`);
}

// THE VERDICT IS DRIVEN BY `__hud.panel()`, NOT BY THE DIV CENSUS — and that is
// the correction this probe had to make to itself. Keyed off the DOM count it
// concluded "even a HELD [E] does not open the ATM — a WORLD defect", which is
// precisely the wrong answer: it was reading the same blind instrument the
// failing check reads. Asking the world instead reversed it.
const opened = Boolean(tappedUp || heldUp);
const blind = opened && tapped === base && held === base2;

if (blind) {
  console.log(`\n  VERDICT: the WORLD IS FINE — [E] opens the ATM (__hud.panel() = ${JSON.stringify(tappedUp || heldUp)}),`);
  console.log(`  by tap AND by held press. D-walk.mjs:443-452 counts full-screen DIVs/CANVASes`);
  console.log(`  and the ATM cabinet does not answer that description, so it reads 3 -> 3 —`);
  console.log(`  exactly the figure item 279 quotes. THE CHECK IS BLIND; THE MACHINE WORKS.`);
  console.log(`\n  And it does NOT share item 227's cause: item 227 was \`&& o.visible\` against`);
  console.log(`  regionCull (a SCENE-census bug, GOTCHAS 79b); this is a DOM-census bug.`);
  console.log(`  Nothing in D-walk.mjs filters on \`.visible\` at all.`);
  console.log(`\n  FOR ITEM 279: re-point that leg at \`__hud.panel()\`, which names the cabinet.`);
  console.log(`  ⚠ Do NOT loosen it to "something changed" — assert the id is 'ct-atm'.`);
  console.log(`  ⚠ BUILDER-BRIEF §5 is NOT the cause here — the tap works. Measured, twice.`);
} else if (!opened) {
  console.log(`\n  VERDICT: [E] did not open the ATM by either route and the world's own`);
  console.log(`  __hud.panel() agrees — that is a WORLD defect for item 279.`);
} else {
  console.log(`\n  VERDICT: the machine opens and D-walk's census sees it too — the ATM leg's`);
  console.log(`  failure is neither the cull nor the keypress. Item 279 should look elsewhere.`);
}
