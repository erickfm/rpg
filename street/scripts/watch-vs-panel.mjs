// Item 189 — THE WRISTWATCH MUST STAND DOWN WHILE A CABINET IS UP.
//
// Worker sixtysix, building the loan (185), photographed its first SIGN box
// sitting behind a wristwatch. Cause: `poseFor` takes the eye along the target
// face's own NORMAL, and a form lying on a desk has a normal pointing STRAIGHT
// UP — so reading it means looking DOWN, and looking down is precisely the
// gesture `crosstown.ts` raises the watch on (`rig.pitch < -0.95`). The ATM,
// slots and blackjack are VERTICAL faces, which is the only reason four panels
// shipped before anyone hit this.
//
// ── WHY THIS PROBE IS SHAPED THE WAY IT IS ────────────────────────────────
//
// Every phase below could pass by measuring nothing, so each carries its own
// floor (BUILDER-BRIEF §7, GOTCHAS 79):
//
//   · Phase 1 asserts the watch CAN be shown. Without it, a fix that simply
//     deleted the watch would score four greens.
//   · Phase 2 asserts the PITCH IS ACTUALLY DOWN while the loan is open. That
//     is the precondition for the bug existing at all; if the loan ever stops
//     posing the player over the desk, this must fail loudly rather than pass
//     because there was nothing to obscure.
//   · Phase 3 puts a SCREEN-SPACE panel up (`ct-pockets`, no `surface`, so no
//     focus lock steals the camera) and drives the pitch down by hand. That is
//     the only configuration where "panel up" and "player genuinely looking
//     down" are independently controllable, so it is the one that isolates the
//     `&& !panelUp()` term rather than the pose.
//   · Phase 4 walks all three close paths. It re-drives the pitch down AFTER
//     the close, because `leave()` flies the camera back to the standing pose —
//     without that the watch would be stowed for the honest reason and the
//     check would prove nothing.
//   · Phase 5 is the POPULATION FLOOR, added when this file was registered in
//     `scripts/checks.mjs` (item 199). See its own header below — the four
//     floors above are per-phase and none of them could tell you that a phase
//     had stopped covering the world.
//
// SHOWN vs STOWED is read off the live element, not asserted from source:
// `hud.ts`'s `watchTransform` stows with `translateY(140%)` and shows with
// `translateY(<WATCH_DROP>px)`, so the element's real bounding box against the
// viewport bottom is the honest question and survives anyone retuning the drop.
//
// REGISTERED in `scripts/checks.mjs` as `watch-vs-panel` on 2026-08-03 (item
// 199), which is why this file moved out of `scripts/probes/` — the runner
// spawns `node scripts/<name>.mjs` and refuses to start if a registered name is
// not on disk there. BUILDER-BRIEF §7a: a probe graduates when something calls
// it. Its mutation case is `watch-over-panel` in `scripts/canfail.mjs`.
//
// Usage:  SHOT_URL=http://localhost:4650/ node scripts/watch-vs-panel.mjs [outprefix]
import { chromium } from 'playwright';
import { aim } from './lib/aim.mjs';
import { reportWorld } from './lib/which-world.mjs';
import { waitPainted } from './lib/painted.mjs';

const URL = aim('http://localhost:4240/');
const OUT = process.argv[2] ?? '/tmp/w68-watch';
const DOWN = -1.25;            // rad. Well past the -0.95 the watch triggers on.

const fails = [];
const notes = [];
const ok = (cond, msg) => { (cond ? notes : fails).push(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); return cond; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(900);

/**
 * The watch, as the SCREEN has it.
 *
 * `shown` is derived from geometry rather than from the transform string, and
 * it is the BINARY question "is any part of it on screen" rather than a
 * fraction with a threshold in it. Measured on the built bundle at 1280 x 800:
 * the element is 847.8 px tall (WATCH_ARM 600 canvas px of forearm running off
 * the left edge), and it clears the frame COMPLETELY when stowed —
 *
 *     shown   top 576.1  bottom 1423.8   ->  223.9 px on screen
 *     stowed  top 823.3  bottom 1671.0   ->    0.0 px on screen
 *
 * — so there is no threshold to get wrong. My first cut asked for a third of
 * the element to be visible and failed all four SHOWN cases at 0.264, which is
 * the check being wrong rather than the world; the numbers above are why I
 * believe the second cut instead of tuning the first (BUILDER-BRIEF §7).
 * Reading the transform string would re-type numbers hud.ts owns (§8).
 */
const watchState = () => p.evaluate(() => {
  const el = document.getElementById('ct-watch');
  if (!el) return { present: false };
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const visibleH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  return {
    present: true,
    top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
    left: +r.left.toFixed(1), right: +r.right.toFixed(1),
    h: +r.height.toFixed(1), vh,
    visiblePx: +visibleH.toFixed(1),
    shown: visibleH > 0,
    transform: getComputedStyle(el).transform,
  };
});

/** The player's pitch, DERIVED from the camera's own world basis — there is no
 *  `__ct.pitch()`, and `crosstown.ts:1378` builds pitch as `asin(dir.y)`, so
 *  this is the same quantity by the same rule rather than a second opinion. */
const pitchOf = () => p.evaluate(() => {
  const cam = window.__ct.camera?.();
  if (!cam) return null;
  cam.updateMatrixWorld(true);
  const e = cam.matrixWorld.elements;      // third column is local +Z in world
  const fy = -e[9];                        // camera looks down -Z
  return +Math.asin(Math.max(-1, Math.min(1, fy))).toFixed(4);
});

const panelNow = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const lookDown = async () => {
  await p.evaluate((d) => {
    const [x, , z] = window.__ct.pos();
    window.__ct.warp(x, z, undefined, undefined, d);
  }, DOWN);
  await p.waitForTimeout(450);             // the watch slides on a .18s ease
};

// ── PHASE 1 — the floor: with nothing up, looking down RAISES the watch ────
await lookDown();
const w1 = await watchState();
const pit1 = await pitchOf();
console.log(`[1] no panel, pitch ${pit1}  watch`, JSON.stringify(w1));
ok(w1.present, '1. the watch element exists at all');
ok(pit1 !== null && pit1 < -0.95, `1. FLOOR: pitch is genuinely down (${pit1} < -0.95)`);
ok(w1.shown, '1. FLOOR: with no panel up and the head down, the watch is SHOWN');
await p.screenshot({ path: `${OUT}-1-watch-up-no-panel.png` });

// ── PHASE 2 — THE REAL CASE: the loan form, a HORIZONTAL surface ───────────
// Found by its own geometry (a 0.30 x 0.40 sheet in the bank), never by a
// coordinate typed here — the desk can move without this following it by hand.
const spot = await p.evaluate(() => (window.__ct.spots?.() ?? [])
  .map((s) => ({ label: String(typeof s.label === 'function' ? s.label() : s.label), x: s.x, z: s.z }))
  .find((s) => /loan application/i.test(s.label)));
console.log('[2] loan spot:', JSON.stringify(spot));
if (!ok(!!spot, '2. FLOOR: the loan application spot is registered in the world')) {
  // no spot means phase 2 measured nothing; do not let 3 and 4 carry the report
  console.log('cannot reach the loan form — refusing to report on the horizontal case');
} else {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [spot.x, spot.z]);
  await p.waitForTimeout(700);
  // BUILDER-BRIEF §5 — a HELD press. A tap can begin and end inside one frame.
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(1100);                 // the 0.40 s fly-in, plus slack
  const id2 = await panelNow();
  const pit2 = await pitchOf();
  const w2 = await watchState();
  console.log(`[2] panel=${id2}  pitch ${pit2}  watch`, JSON.stringify(w2));
  await p.screenshot({ path: `${OUT}-2-loan-open.png` });
  ok(id2 === 'ct-loan', `2. the loan cabinet is up (got ${id2})`);
  ok(pit2 !== null && pit2 < -0.95, `2. FLOOR: reading the form really does put the head down (${pit2} < -0.95) — this is the bug's precondition`);
  ok(!w2.shown, '2. the watch is STOWED while the loan form is up');
  // and the direct form of the complaint: the watch must not be over the sheet.
  const overlap = await p.evaluate(() => {
    const w = document.getElementById('ct-watch')?.getBoundingClientRect();
    const cap = document.querySelector('#ct-loan');
    if (!w || !cap) return null;
    const c = cap.getBoundingClientRect();
    const ix = Math.max(0, Math.min(w.right, c.right) - Math.max(w.left, c.left));
    const iy = Math.max(0, Math.min(w.bottom, c.bottom) - Math.max(w.top, c.top));
    return +(ix * iy).toFixed(1);
  });
  console.log(`[2] watch/panel-element overlap area: ${overlap} px^2`);
  ok(overlap === 0 || overlap === null, `2. the watch overlaps the loan panel element by 0 px^2 (got ${overlap})`);

  // ── PHASE 4a — close by ESCAPE, then look down again ───────────────────
  await p.keyboard.press('Escape');
  await p.waitForTimeout(900);
  ok((await panelNow()) === null, '4a. Escape closed the loan');
  await lookDown();
  const w4a = await watchState();
  const pit4a = await pitchOf();
  console.log(`[4a] after Escape, pitch ${pit4a}  watch`, JSON.stringify(w4a));
  ok(pit4a !== null && pit4a < -0.95, `4a. FLOOR: head is down again after the close (${pit4a})`);
  ok(w4a.shown, '4a. the watch RETURNS after Escape');
  await p.screenshot({ path: `${OUT}-4a-after-escape.png` });

  // ── PHASE 4b — close by [E], the world's own verb ──────────────────────
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [spot.x, spot.z]);
  await p.waitForTimeout(600);
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(1100);
  ok((await panelNow()) === 'ct-loan', '4b. the loan re-opened for the [E] close path');
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(1000);
  ok((await panelNow()) === null, '4b. [E] closed the loan');
  await lookDown();
  const w4b = await watchState();
  ok(w4b.shown, '4b. the watch RETURNS after an [E] close');
}

// ── PHASE 3 — the term itself, isolated ───────────────────────────────────
// `ct-pockets` has no `surface`, so no focus lock takes the camera: this is the
// one configuration where "a panel is up" and "the head is down" are set
// independently. If this passes, the guard is the `&& !panelUp()` term and not
// a side effect of where the loan pose happens to point.
const opened = await p.evaluate(() => window.__hud?.openPanel?.('ct-pockets') ?? false);
if (ok(opened === true, '3. FLOOR: the screen-space pockets panel opened')) {
  await lookDown();
  const pit3 = await pitchOf();
  const w3 = await watchState();
  console.log(`[3] panel=${await panelNow()}  pitch ${pit3}  watch`, JSON.stringify(w3));
  await p.screenshot({ path: `${OUT}-3-pockets-head-down.png` });
  ok((await panelNow()) === 'ct-pockets', '3. the pockets cabinet is up');
  ok(pit3 !== null && pit3 < -0.95, `3. FLOOR: the head is genuinely down with the panel up (${pit3} < -0.95) — without this the phase proves nothing`);
  ok(!w3.shown, '3. the watch is STOWED on `panelUp()` alone, head down, no pose involved');

  // ── PHASE 4c — the panel closes ITSELF, as the ATM's farewell does ─────
  await p.evaluate(() => window.__hud.closePanels());
  await p.waitForTimeout(500);
  ok((await panelNow()) === null, '4c. a self-close cleared the cabinet');
  const w4c = await watchState();
  console.log('[4c] after a self-close, watch', JSON.stringify(w4c));
  ok(w4c.shown, '4c. the watch RETURNS after a panel closes itself (the ATM farewell path)');
  await p.screenshot({ path: `${OUT}-4c-after-selfclose.png` });
}

// ── PHASE 5 — THE POPULATION FLOOR ────────────────────────────────────────
//
// WHY THE FOUR FLOORS ABOVE ARE NOT ONE. Each of phases 1–4 refuses to pass
// vacuously *about the panel it names*. None of them can tell you that the
// check has stopped covering the WORLD — and that is the failure this file was
// written to predict. Its own note (`notes/sixtyeight-watch-vs-panel.md`) says
// the fault "will hit the mail (155) and the library PC (157)": two panels that
// did not exist when phases 1–4 were written and that phases 1–4 would never
// have noticed arriving. Registering a check that names two panels by hand, in
// a world that grows panels, is how `masonry.mjs` came to examine zero faces.
//
// So the population is the world's OWN roster — `__hud.panels()`, which
// `ct/hud.ts` builds from `everyPanel()` — and every member of it is swept.
// Nothing here is a typed list of ids: add a panel to the world and this phase
// starts asserting against it on the next run, with no edit to this file.
//
// MEASURED 2026-08-03 on the built bundle at b39f22d6f
// (`scripts/probes/w109-panel-roster.mjs`): the roster is 7 —
//   ct-pockets, ct-atm, ct-letter, ct-loan, ct-library-pc   raise from anywhere
//   ct-slots, ct-blackjack                                  do not
// The last two are MACHINE-BOUND: `__hud.openPanel` calls `open()` and returns
// true, but the panel is not up on the very next evaluate and never becomes up
// (polled at 0 ms, 250 ms and 1000 ms; zero console errors, so it is not the
// `resolving the diegetic surface threw` path). They are re-closed by their own
// per-frame "you are up while you are sitting here" hook, which is deliberate
// and is not this check's business. They are EXCUSED, not skipped, and the
// excusal is asserted in BOTH directions below so it cannot rot quietly.
const MACHINE_BOUND = ['ct-slots', 'ct-blackjack'];
const closeAll = async () => { await p.evaluate(() => window.__hud.closePanels()); await p.waitForTimeout(300); };
await closeAll();
const roster = await p.evaluate(() => window.__hud?.panels?.() ?? []);
console.log(`[5] roster (${roster.length}):`, JSON.stringify(roster));
ok(roster.length > 0, `5. FLOOR: the world publishes a panel roster at all (${roster.length} panels)`);

// AT RISK IS MEASURED, NOT LISTED. A `STOWED` verdict proves nothing unless the
// head is genuinely down — phase 2's floor says so, and it is the same argument
// here. But a panel with a diegetic focus lock does not let you point the head
// wherever you like: `crosstown.ts` holds the eye on the face's own pose and
// `__ct.warp`'s pitch argument loses. Measured on this build, with each cabinet
// up and DOWN (-1.25 rad) requested:
//
//     ct-pockets     -1.25     the warp wins  (screen-space, no focus lock)
//     ct-loan        -1.5707   the POSE is already straight down — the bug's own case
//     ct-library-pc  -1.25     the warp wins
//     ct-atm         -0.1419   the lock holds the eye on a near-vertical screen
//     ct-letter       0        the lock holds the eye level
//
// My first cut asserted `pitch < -0.95` for all five and failed ct-atm and
// ct-letter. That is the CHECK being wrong and the world being right
// (BUILDER-BRIEF §7): those two cannot put the player's head down while they are
// up, so the watch was never going to rise over them and there is nothing for
// this file to defend there. Asserting STOWED on them anyway would pass for the
// HONEST reason and count as coverage it is not — the vacuous pass this phase
// exists to prevent, wearing the opposite hat.
//
// So each panel is classified by what the world actually did, and only the
// at-risk ones carry the assertion. Nothing here is a typed id list; a future
// panel joins whichever set its own pose puts it in.
const raised = [];
const refused = [];
const atRisk = [];
const poseSafe = [];
for (const id of roster) {
  await closeAll();
  const opened = await p.evaluate((i) => window.__hud.openPanel(i), id);
  await p.waitForTimeout(500);
  if (!opened || (await panelNow()) !== id) { refused.push(id); continue; }
  raised.push(id);
  await lookDown();
  const pit = await pitchOf();
  const w = await watchState();
  const down = pit !== null && pit < -0.95;
  console.log(`[5] ${id}  pitch ${pit}  visiblePx ${w.visiblePx}  ${down ? 'AT RISK' : 'pose-safe'}`);
  if (!down) { poseSafe.push(`${id}@${pit}`); await closeAll(); continue; }
  atRisk.push(id);
  ok(!w.shown, `5. ${id}: the watch is STOWED while this cabinet is up, head down at ${pit}`);
  await closeAll();
  await lookDown();
  ok((await watchState()).shown, `5. ${id}: the watch RETURNS when this cabinet closes`);
}
await closeAll();
console.log(`[5] raised ${raised.length}: ${raised.join(', ')}   refused ${refused.length}: ${refused.join(', ') || '—'}`);
console.log(`[5] at risk ${atRisk.length}: ${atRisk.join(', ') || '—'}   pose-safe ${poseSafe.length}: ${poseSafe.join(', ') || '—'}`);

// THE FLOOR ITSELF, in three assertions that fail for three different reasons.
//
// (1) Nothing was skipped: a panel is either swept or excused, never neither.
// (2) The excused set has not GROWN — a panel that silently stopped raising is
//     coverage lost, and it looks exactly like coverage that was never there.
// (3) The excused set has not gone STALE — if slots or blackjack start raising
//     from anywhere, they must be swept, not carried on this list for ever.
// (2) and (3) are the two signs of the same fact and they fail apart, which is
// why they are not one `deepEqual`.
ok(raised.length + refused.length === roster.length,
  `5. FLOOR: every panel in the roster was swept or excused (${raised.length}+${refused.length} of ${roster.length})`);
const surprise = refused.filter((id) => !MACHINE_BOUND.includes(id));
ok(surprise.length === 0,
  `5. FLOOR: no panel has silently stopped raising${surprise.length ? ` — ${surprise.join(', ')} did; either it is machine-bound (add it to MACHINE_BOUND with the measurement) or its open() has regressed` : ''}`);
const stale = MACHINE_BOUND.filter((id) => !refused.includes(id));
ok(stale.length === 0,
  `5. FLOOR: the machine-bound excusal is not stale${stale.length ? ` — ${stale.join(', ')} now raises and must be SWEPT, not excused` : ''}`);
// (4) …and the derived count. Not a typed number: it is the roster the world
//     just handed us, minus the members it just refused to raise.
ok(raised.length === roster.length - MACHINE_BOUND.length && raised.length > 0,
  `5. FLOOR: the sweep raised ${raised.length} panel(s); the roster minus the machine-bound is ${roster.length - MACHINE_BOUND.length}`);
// (5) THE ONE THAT STOPS THE WHOLE PHASE PASSING VACUOUSLY. Everything above
//     counts panels; this counts ASSERTIONS THAT COULD HAVE FAILED. If every
//     panel in the world became pose-safe — or the focus lock started winning
//     everywhere, or `lookDown` quietly stopped working — the loop would sweep
//     seven panels, assert nothing, and report green. Measured at 3 today
//     (ct-pockets, ct-loan, ct-library-pc); the floor is that it is not 0,
//     because 1 is enough to defend the fix and 0 is enough to hide its loss.
ok(atRisk.length > 0,
  `5. FLOOR: ${atRisk.length} panel(s) could actually put the head down while up — 0 would mean this phase asserted nothing`);

console.log('');
console.log(`population: ${roster.length} panels published, ${raised.length} raised, `
  + `${refused.length} machine-bound, ${atRisk.length} at risk, ${poseSafe.length} pose-safe`);
for (const n of notes) console.log('  ', n);
for (const f of fails) console.log('  ', f);
console.log('');
console.log(`console errors: ${errs.length}`);
for (const e of errs.slice(0, 8)) console.log('   ', e);
console.log(`shots at ${OUT}-*.png`);
console.log(fails.length === 0
  ? `WATCH/PANEL OK — ${notes.length} assertions, 0 failures`
  : `WATCH/PANEL BAD — ${fails.length} of ${fails.length + notes.length} assertions failed`);
await b.close();
process.exit(fails.length === 0 ? 0 : 1);
