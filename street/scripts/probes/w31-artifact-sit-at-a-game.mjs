// ITEM 60's second acceptance clause: "you have opened it and WALKED the bodega
// chamfer plus SAT AT ONE GAME" — this is the sitting half, run against the
// PACKED ARTIFACT rather than against a dev server.
//
// Aim it at the file, not at a port:
//   SHOT_URL=file:///abs/path/to/dist/artifact.html node scripts/probes/w31-artifact-sit-at-a-game.mjs
//
// THREE THINGS, and the third is the one this project has actually shipped bugs
// in. Sitting down is easy; the user's words when it went wrong were *"no im
// telling you i can't get up anything i do once i sit down"*, and
// BUILDER-BRIEF §11 makes standing up part of the test rather than a nicety.
//
//   1. a game seat exists in the artifact and is reachable
//   2. you can WALK onto its approach and sit — not warp straight into it
//   3. ONE press of E gets you back up again
//
// IT WALKS THE LAST STRETCH. Warping onto the approach point and pressing E is
// how every other seat probe here does it, and it is how a check goes its whole
// life without testing its own subject (BUILDER-BRIEF §7). So this warps to a
// standoff point, holds W until it arrives, and only then presses E — if the
// approach were walled off, this notices and a warp would not.
//
// THE KEYPRESS IS HELD. `press('e')` can begin and end inside one animation
// frame and the [E] dispatch is an edge read once per rendered frame, so a tap
// is never observed — that made a working feature report three false failures
// (BUILDER-BRIEF §5).
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('SHOT_URL is required — aim this at the artifact file:// URL or a port.');
  process.exit(2);
}
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.seats, null, { timeout: 30000 });
await p.mouse.click(450, 300);                       // focus before any key goes anywhere
await p.waitForTimeout(300);

const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };
const seated = () => p.evaluate(() => !!window.__ct.seated());
const pos = () => p.evaluate(() => window.__ct.pos());

// A GAME, not any seat. The casino's slot stools and the blackjack rail are the
// two things in this world you sit at to PLAY something, which is what the item
// means; a bus bench or the 301 bed would satisfy "a seat" and not the clause.
const seat = await p.evaluate(() => {
  const all = window.__ct.seats();
  const game = all.filter((s) => /slot|blackjack|machine|table/i.test(s.label));
  // A SLOT OR THE BLACKJACK RAIL BY PREFERENCE. `/table/` also catches the
  // casino's coupon table, which is furniture you sit at rather than a game you
  // play — taking whatever sorted first got exactly that, and it is not what the
  // item's "sat at one game" means.
  const s = game.find((q) => /slot|blackjack/i.test(q.label)) ?? game[0];
  return s ? { label: s.label, x: s.pose.x, z: s.pose.z, ax: s.at.x, az: s.at.z,
               games: game.length, total: all.length } : { games: 0, total: all.length };
});
if (!seat.label) {
  console.log(`FAIL — no game seat among ${seat.total} seats; nothing measured`);
  await b.close(); process.exit(3);
}
console.log(`${seat.total} seats in the artifact, ${seat.games} of them at a game`);
console.log(`sitting at: "${seat.label}"`);
console.log(`  seat pose (${seat.x.toFixed(2)}, ${seat.z.toFixed(2)})  approach (${seat.ax.toFixed(2)}, ${seat.az.toFixed(2)})`);

// Face from the approach point toward the seat, and stand STANDOFF metres back
// along that same bearing so the walk is into the seat rather than sideways.
const STANDOFF = 1.2;
const yaw = await p.evaluate(([sx, sz, ax, az]) => Math.atan2(sx - ax, -(sz - az)), [seat.x, seat.z, seat.ax, seat.az]);

// FORWARD COMES FROM fp.ts, NOT FROM ME.
//
//     src/proto/fp.ts:477   this.fwd.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
//     src/proto/fp.ts:480   if (input.keys.has('w')) mv.add(this.fwd);
//
// so W walks along `(sin yaw, -cos yaw)` and the standoff that puts the seat
// straight ahead is `approach - fwd * d`. Cited with line numbers rather than
// re-derived, per BUILDER-BRIEF §8.
//
// I GOT THIS WRONG ONCE BY "MEASURING" IT, and the failure is worth the lines.
// My first version placed the standoff, held W, and flipped the offset if the
// distance to the seat grew. That looked like the careful thing to do and it was
// the instrument: a casino aisle is narrow, both standoff points were inside
// collision, and what the probe actually observed was the player being SHOVED
// out of a wall — not the direction of travel. It duly "measured" the convention
// backwards and inverted a correct calculation. Half of all apparent defects
// here are the tool (BUILDER-BRIEF §7); this one was mine, twice over.
//
// So the direction is read out of the source that owns it, and the thing that is
// genuinely uncertain — whether the standoff point is CLEAR — is what gets
// measured, by checking where the warp actually landed.
const place = (d) => p.evaluate(([ax, az, y, dd]) => {
  const bx = ax - Math.sin(y) * dd, bz = az + Math.cos(y) * dd;
  window.__ct.warp(bx, bz, y, window.__ct.groundAt(bx, bz), 0);
  return [bx, bz];
}, [seat.ax, seat.az, yaw, d]);

// THE DRIFT IS REPORTED, NOT JUDGED, and this is a threshold I deleted rather
// than tuned. I first required the warp to land within 0.25 m of the standoff
// and to fall back to a shorter one otherwise. Measured across runs, the shove
// at 1.2 m came out 0.68 m, then 0.30 m, then 0.30 m for the same warp — the
// casino floor has CITIZENS on it, and where a body happens to be standing
// decides it. The run that landed 0.30 m out walked in and sat down perfectly
// well, so the check was failing runs that were fine.
//
// Loosening the number until it agreed with me is exactly what BUILDER-BRIEF
// forbids, so the proxy goes instead: what this item asks is whether you can
// WALK to the seat and SIT, and that is judged directly below. Where the warp
// landed is information about the crowd, not a verdict.
const want = await place(STANDOFF);
await p.waitForTimeout(400);
const p0 = await pos();
const drift = Math.hypot(p0[0] - want[0], p0[2] - want[1]);
const d0 = Math.hypot(p0[0] - seat.ax, p0[2] - seat.az);
console.log(`\nstanding ${d0.toFixed(2)} m from the approach at (${p0[0].toFixed(2)}, ${p0[2].toFixed(2)}), facing the stool`);
console.log(`  (asked for ${STANDOFF} m back; shoved ${drift.toFixed(2)} m by collision or a citizen — reported, not judged)`);

// WALK IN. Held W, sampled, so a blocked approach shows up as no progress
// rather than as a silent teleport.
let moved = 0;
for (let i = 0; i < 12; i++) {
  const a = await pos();
  await hold('w', 120);
  await p.waitForTimeout(60);
  const c = await pos();
  moved += Math.hypot(c[0] - a[0], c[2] - a[2]);
  const d = Math.hypot(c[0] - seat.ax, c[2] - seat.az);
  if (d < 0.28) break;
}
const p1 = await pos();
const walked = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
const left = Math.hypot(p1[0] - seat.ax, p1[2] - seat.az);
console.log(`  walked ${walked.toFixed(2)} m (path length ${moved.toFixed(2)} m), now ${left.toFixed(2)} m from the approach point`);

let bad = 0;
const say = (okay, line) => { console.log(`${okay ? 'ok  ' : 'FAIL'} ${line}`); if (!okay) bad++; };
say(walked > 0.5, `the approach is walkable — covered ${walked.toFixed(2)} m on foot, not by warping`);
say(left < d0, `walking CLOSED the distance to the seat: ${d0.toFixed(2)} m -> ${left.toFixed(2)} m`);

const promptBefore = await p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || ['(none)'])[0]);
console.log(`  prompt on arrival: ${promptBefore}`);

// SIT — held, not tapped.
await hold('e', 120);
await p.waitForTimeout(700);
const isSeated = await seated();
say(isSeated, `pressing [E] seats the player at "${seat.label}"`);

if (isSeated) {
  const sp = await pos();
  console.log(`  seated at (${sp[0].toFixed(2)}, ${sp[2].toFixed(2)})`);
  const promptSeated = await p.evaluate(() => (document.body.innerText.match(/\[E\][^\n]*/) || ['(none)'])[0]);
  console.log(`  prompt while seated: ${promptSeated}`);

  // AND GET BACK UP — the clause the user lost an evening to: *"no im telling
  // you i can't get up anything i do once i sit down"* (BUILDER-BRIEF §11).
  //
  // SITTING AT A GAME OPENS A PANEL, and `hud.ts` blocks keydown while a panel
  // is open — which is the whole point of §11 and the reason a bare [E] does
  // nothing here. My first run read that as "trapped in the seat" and it was the
  // probe not knowing the modal rule. So the exit is tested the way §11 states
  // it: **Escape must close the panel, and standing up must work from there** —
  // and both halves are reported separately, because a world where Escape closes
  // the panel but E cannot stand is a real bug and would otherwise hide inside a
  // single pass/fail.
  // MY PANEL DETECTOR IS REPORTED, NOT JUDGED — it is a guess at somebody
  // else's markup and it found nothing, so asserting on it would be a check that
  // cannot fail (the exact family this repo calls a guard that "slept"). It is
  // printed so the next reader knows the selector is unproven, and the verdict
  // below rests on `__ct.seated()`, which the world publishes.
  const panelOpen = () => p.evaluate(() => !!document.querySelector('.panel, [class*="panel"], dialog[open]'));
  console.log(`  panel detected by my selector on sitting: ${await panelOpen()}  (selector UNPROVEN — reported, not judged)`);

  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  const afterEsc = { panel: await panelOpen(), seated: await seated() };
  console.log(`  after Escape: ${afterEsc.seated ? 'still seated' : 'already stood up'} (my panel selector: ${afterEsc.panel ? 'still sees one' : 'sees none'})`);

  let still = afterEsc.seated;
  if (still) {
    await hold('e', 120);
    await p.waitForTimeout(800);
    still = await seated();
    console.log(`  after [E] with the panel closed: ${still ? 'STILL SEATED' : 'stood up'}`);
  }
  say(!still, 'the player gets back up — Escape then [E], not trapped in the seat');
  if (!still) {
    const up = await pos();
    console.log(`  standing again at (${up[0].toFixed(2)}, ${up[2].toFixed(2)})`);
  }
}

// The artifact is opened from file://, where a dynamic import of a source path
// is blocked by CORS. That is the PROBE's problem, not the world's, so it is
// named rather than counted — but anything else is a real page error.
const real = errs.filter((e) => !/CORS policy|ERR_FAILED|\.ts'/.test(e));
console.log(`\npage errors: ${errs.length} total, ${real.length} not file:// import noise`);
for (const e of real.slice(0, 4)) console.log(`   ${e}`);
say(real.length === 0, 'no page errors beyond the file:// import noise');

await b.close();
console.log(`\n${bad ? `${bad} FAILED` : 'SAT AT A GAME IN THE ARTIFACT, AND GOT BACK UP'}`);
process.exit(bad ? 1 : 0);
