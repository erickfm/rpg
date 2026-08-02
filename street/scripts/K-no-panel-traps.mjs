// THE CLAIM: EVERY panel in the world can be left, and leaving it gives the
// player back to the world.
//
// This is the guard for the trap the user actually hit — *"pressing e doesnt
// get me out of it"*. C found the mechanism on a casino slot stool: sitting
// down opened a modal, the modal's gate swallowed every keydown, and neither
// `E` nor `Escape` ever reached the world. **Both of that night's fixes lived
// DOWNSTREAM of the swallowed event and neither could be reached.** A fix below
// the layer that eats the input is not a fix.
//
// So this tests the layer that eats the input, and it tests it on EVERY panel
// rather than on the ones I remembered: `__hud.panels()` is the framework's own
// registry, and registering is how a panel comes into existence, so a new one
// cannot escape this check by being new.
//
// FOR EACH PANEL: open it · confirm the world is frozen · press ESCAPE ·
// confirm it closed, the freeze lifted, and the player can walk.
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-no-panel-traps.mjs [--selftest]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const URL = aim('http://localhost:4292/');
const ARGS = flags(['--selftest']);
const SELFTEST = ARGS.selftest;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

if (!(await page.evaluate(() => typeof window.__hud?.panels === 'function'))) {
  console.log('__hud.panels absent — the framework did not run; nothing measured');
  await browser.close(); process.exit(3);
}

const panels = await page.evaluate(() => window.__hud.panels());
console.log(`      ${panels.length} registered: ${panels.join(', ')}`);
// MEASURED FLOOR, not remembered: the ATM and the pockets are mine and always
// present; anything less than two means the registry itself broke and every
// verdict below would pass over an empty set (GOTCHAS §34).
ok(panels.length >= 2, `there are panels to test (${panels.length}, floor 2)`);
if (panels.length < 2) { console.log('EMPTY SUBJECT SET'); await browser.close(); process.exit(3); }

// somewhere open on the pavement, so "can you walk" has room to be true
const HOME = [-5.2, -34];
const stand = () => page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z)), HOME);
const walked = async () => {
  await stand();
  await page.waitForTimeout(220);
  const from = await page.evaluate(() => { const q = window.__ct.pos(); return [q[0], q[2]]; });
  await page.keyboard.down('w');
  let d = 0, stalled = 0;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(120);
    const now = await page.evaluate(([x, z]) => {
      const q = window.__ct.pos(); return Math.hypot(q[0] - x, q[2] - z);
    }, from);
    if (now - d < 0.01) stalled++; else stalled = 0;
    d = now;
    if (d >= 1.0 || stalled >= 8) break;
  }
  await page.keyboard.up('w');
  return d;
};

// THE CONTROL, first and once: with nothing open, W walks. Every verdict below
// is "the player got the world back", and that is free if they never had it.
const FREE = await walked();
ok(FREE >= 1.0, `CONTROL: with no panel open, a held W walks (${FREE.toFixed(2)} m)`);

for (const id of panels) {
  await stand();
  await page.waitForTimeout(200);

  if (SELFTEST) {
    // THE MUTATION: swallow Escape in CAPTURE on window BEFORE the panel opens,
    // so it is registered ahead of the framework's gate and genuinely gets there
    // first. That ordering is the whole bug — tonight's trap was a blocker
    // installed ahead of the exit, and installing this one AFTER the panel is
    // up does not reproduce it (my first version did that and the selftest
    // sailed through, which is exactly the "a mutation that does not break the
    // thing proves nothing" trap in GOTCHAS §27).
    await page.evaluate(() => {
      window.__trap = (e) => {
        if (e.key && e.key.toLowerCase() === 'escape') { e.stopImmediatePropagation(); e.preventDefault(); }
      };
      window.addEventListener('keydown', window.__trap, { capture: true, passive: false });
    });
  }
  const opened = await page.evaluate((q) => window.__hud.openPanel(q), id);
  await page.waitForTimeout(320);
  const up = await page.evaluate(() => window.__hud.panel());
  if (!opened || up !== id) {
    // A panel that declines to open is not a trap, and saying so beats a red
    // that reads as one. The pockets, for instance, refuse to re-open for half
    // a second after the player dismisses them.
    console.log(`      ${id}: did not open (${up ?? 'none'}) — skipped, not failed`);
    await page.evaluate(() => window.__hud.closePanels());
    if (SELFTEST) await page.evaluate(() => window.removeEventListener('keydown', window.__trap, true));
    continue;
  }

  // THE FREEZE IS SUPPOSED TO BE THERE. The desk was explicit: blocking world
  // input while a panel is up is CORRECT and is what stops the player walking
  // around behind an open ATM. What was missing was the way out.
  //
  // DRIVEN AS A REAL KEY, and I got this wrong here first even though I had
  // already written the warning into `K-sleep-fade.mjs`: a synthetic
  // `KeyboardEvent` dispatched ON `window` makes window the TARGET, so capture
  // and bubble listeners fire in REGISTRATION ORDER and `main.ts` (registered
  // first) wins. It reported 0.825 m of walking through four frozen panels —
  // measuring its own artifact, not the world.
  const before = await page.evaluate(() => { const q = window.__ct.pos(); return [q[0], q[2]]; });
  await page.keyboard.down('w');
  await page.waitForTimeout(600);
  await page.keyboard.up('w');
  const frozen = await page.evaluate(([x, z]) => {
    const q = window.__ct.pos(); return Math.hypot(q[0] - x, q[2] - z);
  }, before);
  ok(frozen < 0.2, `${id}: the world is frozen behind it (${frozen.toFixed(3)} m)`);

  // …AND ESCAPE GETS YOU OUT. Driven as a REAL key, because a synthetic event
  // dispatched on `window` makes window the target and fires capture and bubble
  // listeners in registration order, which is not how a real key reaches the
  // page (that cost me a round on the sleep fade).
  await page.keyboard.press('Escape');
  await page.waitForTimeout(420);
  const after = await page.evaluate(() => window.__hud.panel());
  ok(after === null, `${id}: ESCAPE CLOSES IT (panel is now ${after ?? 'none'})`);

  const free = await walked();
  ok(free >= 1.0, `${id}: …and the player can walk again afterwards (${free.toFixed(2)} m)`);

  if (SELFTEST) {
    await page.evaluate(() => window.removeEventListener('keydown', window.__trap, true));
    await page.evaluate(() => window.__hud.closePanels());
  }
}

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
ok(errors.length === 0, 'no page errors');

await browser.close();
if (SELFTEST) {
  const caught = fails.length > 0;
  console.log(caught ? 'SELFTEST: caught the swallowed Escape' : 'SELFTEST: NOT CAUGHT — this check is decoration');
  process.exit(caught ? 0 : 2);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
