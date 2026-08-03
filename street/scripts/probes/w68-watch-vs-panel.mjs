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
//
// SHOWN vs STOWED is read off the live element, not asserted from source:
// `hud.ts`'s `watchTransform` stows with `translateY(140%)` and shows with
// `translateY(<WATCH_DROP>px)`, so the element's real bounding box against the
// viewport bottom is the honest question and survives anyone retuning the drop.
//
// Usage:  SHOT_URL=http://localhost:4240/ node scripts/probes/w68-watch-vs-panel.mjs [outprefix]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

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

console.log('');
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
