// IS THE ATM BROKEN, OR IS `npm run walk` PRESSING E WRONG?
//
// Found while verifying item 283, and NOT fixed here: `scripts/D-walk.mjs` is
// not a file item 283 names, so BUILDER-BRIEF §9 says report it rather than
// touch it. This is the evidence for that report.
//
// `npm run walk` fails one assertion — "and pressing E opens the machine:
// 3 full-screen panels -> 3" — at the FIRST FEDERAL ATM. It fails identically
// with item 283's fix in and out (measured both ways on the built bundle), so
// it is pre-existing. The question this answers is whether the world is at
// fault or the instrument is.
//
// `D-walk.mjs:447` drives it with `page.keyboard.press('e')`. BUILDER-BRIEF §5:
// *"`p.keyboard.press('e')` can begin and end inside a single animation frame,
// and the `[E]` dispatch is an edge read ONCE PER RENDERED FRAME — so the tap is
// never observed. This made a fully working feature report three false
// failures."*
//
// So: walk to the ATM, and press E both ways at the same spot. If the held
// press opens the panel and the tap does not, the machine is fine and the check
// is measuring its own keystroke.
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w117-atm-tap-vs-held.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4190/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.evaluate(() => window.__ct.clock(10, 0));

// D-walk.mjs counts big fixed/absolute boxes rather than asking the HUD. Count
// it both ways, so the answer does not depend on that choice either.
const panels = () => p.evaluate(() => ({
  boxes: [...document.querySelectorAll('canvas,div')].filter((e) => {
    const r = e.getBoundingClientRect(), st = getComputedStyle(e);
    return r.width > 300 && r.height > 200 && st.display !== 'none' && st.visibility !== 'hidden'
      && +st.opacity !== 0 && (st.position === 'fixed' || st.position === 'absolute');
  }).length,
  hud: window.__hud?.panel?.() ?? null,
}));

await p.evaluate(() => window.__ct.warp(0, 0, 0, 0, 0));
await waitPainted(p, { frames: 4 });
const atm = await p.evaluate(() => (window.__ct.spots() || [])
  .find((s) => /use the machine/i.test(s.label ?? '') && s.ok) ?? null);
if (!atm) { console.log('REFUSING TO REPORT: no ATM spot on offer'); await b.close(); process.exit(3); }
console.log(`\nthe ATM: "${atm.label}" @ ${atm.x.toFixed(2)},${atm.z.toFixed(2)}  r ${atm.r}`);

// STAND WHERE D-walk STANDS. Its own line is `warp(-6.0, 7.29, -Math.PI/2)`
// (`D-walk.mjs:423`) — cited, not guessed, because standing on the ATM spot's
// own centre instead gives a different answer: from there the DOOR wins the
// pick and the prompt reads "[E] into FIRST FEDERAL".
const AT = { x: -6.0, z: 7.29, yaw: -Math.PI / 2 };

const trial = async (name, press) => {
  await p.evaluate(() => { window.__hud?.close?.(); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [AT.x, AT.z, AT.yaw]);
  await waitPainted(p, { frames: 6 });
  const t = await p.evaluate(() => {
    const d = document.getElementById('ct-prompt');
    return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
  });
  const before = await panels();
  await press();
  await p.waitForTimeout(900);
  const after = await panels();
  console.log(`  ${name.padEnd(22)} prompt ${JSON.stringify(t)}`);
  console.log(`  ${' '.repeat(22)} boxes ${before.boxes} -> ${after.boxes}    __hud.panel ${JSON.stringify(before.hud)} -> ${JSON.stringify(after.hud)}`);
  return {
    byBoxes: after.boxes > before.boxes,                       // D-walk.mjs's oracle
    byHud: !!after.hud && after.hud !== before.hud,            // the world's own state
  };
};

console.log('');
// EXACTLY D-walk.mjs:447's keystroke.
const tapped = await trial('press(\'e\')  [tap]', () => p.keyboard.press('e'));
// BUILDER-BRIEF §5's keystroke.
const held = await trial('down/up 120ms [held]', async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
});

console.log('');
console.log(`             tap        held`);
console.log(`  by boxes   ${String(tapped.byBoxes).padEnd(10)} ${held.byBoxes}     <- D-walk.mjs's oracle`);
console.log(`  by __hud   ${String(tapped.byHud).padEnd(10)} ${held.byHud}     <- the world's own state`);
console.log('');
if ((tapped.byHud || held.byHud) && !tapped.byBoxes && !held.byBoxes) {
  console.log('VERDICT: THE ATM WORKS AND THE CHECK IS WRONG — and it is the ORACLE, not the keystroke.');
  console.log('  `__hud.panel()` goes null -> "ct-atm" on a TAP as well as on a held press, so');
  console.log('  BUILDER-BRIEF §5 is not the cause here and the machine is not rotten.');
  console.log('  What fails is D-walk.mjs:443-452, which infers "a panel opened" by COUNTING');
  console.log('  DOM elements over 300x200 with position fixed/absolute. K\'s shared full-screen');
  console.log('  panel is ONE persistent element that is shown and repainted, so opening it moves');
  console.log('  no count: 3 -> 3, every time, however the key is pressed.');
  console.log('  FIX (not mine — item 283 does not name D-walk.mjs): assert on __hud.panel(),');
  console.log('  which is the state the world publishes for exactly this question.');
  console.log('  SECOND, SMALLER FAULT IN THE SAME LEG: D-walk.mjs:428 accepts the ATM as');
  console.log('  "offering itself" on `prompt.includes(\'FIRST FEDERAL\')`, which the DOOR prompt');
  console.log('  "[E] into FIRST FEDERAL" also satisfies. Measured: stand on the ATM spot\'s own');
  console.log('  centre (-7.00, 7.29) and the door wins the pick — so that clause can pass while');
  console.log('  the player is being offered the door. It wants the "use the machine" wording.');
} else if (held.byHud && !tapped.byHud) {
  console.log('VERDICT: the ATM works; D-walk.mjs\'s TAP is the fault (BUILDER-BRIEF §5).');
} else if (!held.byHud && !tapped.byHud) {
  console.log('VERDICT: the ATM did NOT open even on a held press. This is a REAL world fault.');
} else {
  console.log('VERDICT: mixed — read the table above.');
}
await b.close();
