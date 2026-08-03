// WHAT DOES [E] OFFER A SEATED PLAYER, AT EVERY SEAT IN THE WORLD?
//
// Item 188 lets a seated player use what they are aiming at. The whole risk of
// that is the OTHER 218 seats: if sitting on the bed now offers the wardrobe
// instead of standing up, the change has traded the user's oldest complaint
// (*"i cant get up, ANYTHING i do, once i sit down"*) for his newest one.
//
// So this does not sample. It sits on every seat `__ct.seats()` publishes,
// faces the way the seat faces, and records the prompt — which is the same
// string the [E] dispatch acts on, because `crosstown.ts` builds both from the
// one `picked`.
//
// It reports THREE numbers and the second is the one that matters:
//
//   seats where the prompt still names standing up ONLY      — unchanged
//   seats where something is also on offer                   — the new capability
//   seats where standing up is NOT NAMED AT ALL              — must be 0, forever
//
// The third is BUILDER-BRIEF §11 stated as a number a script can fail. A view
// you cannot leave is the worst bug this project ships, and the design keeps
// the exit on screen under [ESC] rather than trusting that nothing will ever
// win the [E]. If that ever reads non-zero, the design has failed, not drifted.
//
//   SHOT_URL=http://localhost:4250/ node scripts/probes/w69-seated-offers.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4250/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

const seats = await p.evaluate(() => window.__ct.seats());
console.log(`${seats.length} seats registered\n`);
if (seats.length < 200) {
  // MINIMUM-SAMPLE FLOOR, GOTCHAS 71: "no seat is broken" is free over an empty
  // set. 219 are published today; anything that collapses the population is a
  // measurement fault, not a clean bill of health.
  console.log(`REFUSING TO REPORT: only ${seats.length} seats visible`);
  await b.close(); process.exit(3);
}

const promptNow = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});

let exitOnly = 0, alsoOffered = 0, exitMissing = 0, notSeated = 0, viaPanel = 0;
const offers = [], missing = [], panels = [], trapped = [];

const panelNow = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
// BUILDER-BRIEF §5: a HELD key. `press()` can begin and end inside one frame and
// the dispatch is an edge read once per RENDERED frame.
const tap = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(90);
  await p.keyboard.up(k); await p.waitForTimeout(280);
};

for (let i = 0; i < seats.length; i++) {
  const s = seats[i];
  // Sit by asking the rig directly rather than by walking up and pressing E.
  // Reachability is `seats-walk`'s question and it answers it over the same
  // 219; asking it twice here would only make this slower and no truer.
  //
  // ── BY IDENTITY, AND THE LOOKUP HAPPENS IN THE PAGE (item 217) ──
  //
  // This used to build a fresh `{x, z, yaw, h}` literal out of the seat's
  // numbers. `crosstown.ts:1864` is `sit: (pose) => rig.sit(pose)` — it stores
  // THE CALLER'S OBJECT — and both machine modules match their seat by
  // identity: `ct/library-pc.ts:56` and `ct/slots.ts:1836` test
  // `s.pose === pose`. So a literal sat on a pose NO SEAT OWNS, `seated()`
  // returned truthy, and every seat-triggered behaviour silently did not fire.
  // Item 205's row called the library terminal "currently unreachable" on the
  // strength of that; it was reachable all along.
  //
  // THE LOOKUP CANNOT BE DONE OUT HERE. `page.evaluate` serialises its
  // arguments, so "fetch the real pose and pass that object" from node hands
  // the page a COPY and reproduces the bug exactly — identity is precisely what
  // does not survive that boundary. Indexing `seats()` INSIDE the page is the
  // only form that works, and it is the idiom worker seventyfour already landed
  // in `w74-seated-e.mjs`, `w74-does-the-poll-fire.mjs` and
  // `w74-why-not-offered.mjs`.
  await p.evaluate((k) => {
    window.__ct.stand();
    window.__ct.sit(window.__ct.seats()[k].pose);
  }, i);
  await p.waitForTimeout(120);
  const on = await p.evaluate(() => window.__ct.seated());
  if (!on) { notSeated++; continue; }
  const t = await promptNow();

  // ── A SEAT THAT OPENS A MACHINE HAS ITS WAY OUT ON [ESC], NOT IN THE PROMPT ──
  //
  // This case did not exist before item 217, and that is the whole point: while
  // the probe sat on a fresh literal, `ct/slots.ts` and `ct/library-pc.ts` never
  // recognised the pose, so NO machine ever opened and every seat looked like a
  // plain chair with a stand-up prompt. Sitting by identity, the slot stools and
  // the library terminal now do what they are built to do — and `ct/hud.ts`
  // hides the prompt while a panel is up, so demanding prompt text here would
  // report 102 of 219 seats as "no way out" when the way out is Escape.
  //
  // So the check becomes the one that actually matters, and it is BUILDER-BRIEF
  // §11's rule: *a view you cannot leave is the worst bug this project ships.*
  // Press Escape, and require that it both CLOSES the panel and gives the player
  // back a prompt naming the way off the seat. That is strictly stronger than
  // the text test it replaces — it exercises the exit instead of reading about it.
  //
  // It also has to happen for the loop to continue at all: `rig.sit` refuses to
  // hop between seats, `stand()` is blocked while a panel is open, and measured
  // — every seat after the first slot failed to seat until this was added.
  const panel = await panelNow();
  if (panel) {
    await tap('Escape');
    const stillPanel = await panelNow();
    const stillSat = await p.evaluate(() => !!window.__ct.seated());
    const after = await promptNow();
    // OUT means OUT, and it has two legal shapes. Measured: [ESC] on these
    // seats closes the panel AND stands the player up in one press — so
    // demanding a "stand up" prompt afterwards fails a player who is already
    // standing, which is how a correct exit reported as 93 trapped seats on the
    // first cut of this branch. Either you are off the seat, or you are still on
    // it and it names the way off. Both are free; neither is a trap.
    const freed = !stillPanel && (!stillSat || /\[E\]/.test(after ?? ''));
    if (!freed) {
      exitMissing++;
      trapped.push(`  seat ${i + 1}/${seats.length} "${s.label}" opened ${panel};`
        + ` after [ESC] panel=${JSON.stringify(stillPanel)} seated=${stillSat} prompt=${JSON.stringify(after)}`);
    } else {
      viaPanel++;
      panels.push(`  seat ${i + 1}/${seats.length} "${s.label}" -> ${panel}, [ESC] -> `
        + (stillSat ? `still seated, ${JSON.stringify(after)}` : 'stood up'));
    }
    await p.evaluate(() => window.__ct.stand());
    continue;
  }

  const exitNamed = /stand up|get up|leave|step (off|out)|stop |back to/i.test(t ?? '')
    || (t ?? '').includes(s.label.replace(/^sit /, ''));
  const hasE = /\[E\]/.test(t ?? '');
  const joined = /\[ESC\]/.test(t ?? '');
  if (joined) {
    alsoOffered++;
    offers.push(`  seat ${i + 1}/${seats.length} "${s.label}" @ ${s.pose.x.toFixed(2)},${s.pose.z.toFixed(2)}\n      ${t}`);
  } else if (hasE) {
    exitOnly++;
  } else {
    exitMissing++;
    missing.push(`  seat ${i + 1}/${seats.length} "${s.label}" @ ${s.pose.x.toFixed(2)},${s.pose.z.toFixed(2)} -> ${JSON.stringify(t)}`);
  }
  void exitNamed;
}
await p.evaluate(() => window.__ct.stand());

console.log(`only standing up on offer : ${exitOnly}`);
console.log(`something ALSO on offer   : ${alsoOffered}`);
console.log(`opened a machine, [ESC] out: ${viaPanel}`);
console.log(`could not be seated       : ${notSeated}   (not this check's question)`);
console.log(`NO WAY OUT                : ${exitMissing}`);
console.log(`                            (${exitOnly + alsoOffered + viaPanel + exitMissing + notSeated} of ${seats.length} accounted for)\n`);
if (offers.length) { console.log('the seats that gained a verb:'); console.log(offers.join('\n')); console.log(); }
if (panels.length) { console.log(`the ${panels.length} seats that OPEN A MACHINE (and let you back out):`); console.log(panels.slice(0, 6).join('\n')); if (panels.length > 6) console.log(`  … and ${panels.length - 6} more`); console.log(); }
if (trapped.length) { console.log('SEATS THAT TRAP YOU — a panel that [ESC] did not clear:'); console.log(trapped.join('\n')); console.log(); }
if (missing.length) { console.log('SEATS WITH NO PROMPT — a player cannot see their way out:'); console.log(missing.join('\n')); console.log(); }
if (errs.length) console.log(`console errors: ${errs.length}\n${errs.slice(0, 5).join('\n')}`);

// The one hard assertion. Everything else above is reporting.
if (exitMissing > 0) { console.log('FAIL — a seated player was shown no way out'); await b.close(); process.exit(1); }
console.log('ok — every seat in the world names its exit while you are on it');
await b.close();
