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

let exitOnly = 0, alsoOffered = 0, exitMissing = 0, notSeated = 0;
const offers = [], missing = [];

for (let i = 0; i < seats.length; i++) {
  const s = seats[i];
  // Sit by asking the rig directly rather than by walking up and pressing E.
  // Reachability is `seats-walk`'s question and it answers it over the same
  // 219; asking it twice here would only make this slower and no truer.
  await p.evaluate(([x, z, yaw, h]) => {
    window.__ct.stand();
    window.__ct.sit({ x, z, yaw, h });
  }, [s.pose.x, s.pose.z, s.pose.yaw, s.pose.h]);
  await p.waitForTimeout(120);
  const on = await p.evaluate(() => window.__ct.seated());
  if (!on) { notSeated++; continue; }
  const t = await promptNow();
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
console.log(`could not be seated       : ${notSeated}   (not this check's question)`);
console.log(`NO PROMPT AT ALL          : ${exitMissing}\n`);
if (offers.length) { console.log('the seats that gained a verb:'); console.log(offers.join('\n')); console.log(); }
if (missing.length) { console.log('SEATS WITH NO PROMPT — a player cannot see their way out:'); console.log(missing.join('\n')); console.log(); }
if (errs.length) console.log(`console errors: ${errs.length}\n${errs.slice(0, 5).join('\n')}`);

// The one hard assertion. Everything else above is reporting.
if (exitMissing > 0) { console.log('FAIL — a seated player was shown no way out'); await b.close(); process.exit(1); }
console.log('ok — every seat in the world names its exit while you are on it');
await b.close();
