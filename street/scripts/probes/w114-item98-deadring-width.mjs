// ITEM 98 — HOW WIDE IS THE DEAD RING? The number the user's decision is judged on.
//
// His two complaints pull on one constant:
//   *"i feel like i select stuff without even looking at it"*   (ceiling too wide)
//   the door is dead until you line up on it                     (ceiling too narrow)
// He was shown both and chose **25°**. This measures what that bought.
//
// ── WHAT "DEAD RING" MEANS HERE, STATED ONCE ──────────────────────────────
//
// A spot declares a radius `r`. Inside `r + TOUCH_MARGIN` you get it for free,
// aim-free — that is the touch circle. Outside it you must be aimed at it, and
// the aimed test is an ANGLE, so the lateral half-width it actually covers is
// `d · tan(edge)`. When that is **less than the spot's own r**, you can stand
// beside the door — inside the circle the world says the door occupies — and be
// offered nothing at all. That annulus is the dead ring.
//
//   DEAD RING = the CONTIGUOUS run of d outward from `r + TOUCH_MARGIN`
//               for which `d · tan(measuredEdge(d)) < r`
//
// Contiguous from the touch circle, not "every dead sample anywhere" — see the
// note at the `outer` calculation; the far tail flickers on the 1° step alone.
//
// Every term is measured or read off the world. `r` and TOUCH_MARGIN come from
// `__ct`; `measuredEdge` is swept against the real prompt. NOTHING IS RETYPED —
// two workers retyped this file's clamp and both got it wrong, which is what the
// exported `LOOK_CEILING` now exists to stop (BUILDER-BRIEF §8).
//
// ── WHY YOU CAN BELIEVE A NUMBER THIS PROBE PRINTS ────────────────────────
//
// A passing probe is the most dangerous thing a builder ships here, so this one
// refuses rather than reports unless all of the following hold:
//
//   SELF-TEST, BOTH SIGNS.  The oracle must be shown to say YES (standing on the
//     subject) and to say NO (aimed 180° away from it at 3 m). An oracle stuck on
//     one answer produces a beautiful ring of either 0 m or infinity.
//   POPULATION FLOOR, DERIVED.  The number of distances swept is
//     `(D_MAX - dTouch) / STEP`, computed from the world's own r and
//     TOUCH_MARGIN — not a constant I liked the look of — and every one of them
//     must return an edge.
//   BOTH SIGNS IN THE SWEEP ITSELF.  At least one distance with lateral < r and
//     at least one with lateral >= r. If the ring is the whole sweep, the sweep
//     is too short to have found its outer edge and the width is a lower bound,
//     not a measurement; it exits 3.
//
//   SHOT_URL=http://localhost:4482/ node scripts/probes/w114-item98-deadring-width.mjs [runs]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4482/');
const RUNS = Number(process.argv[2] ?? 1);
const STEP = 0.1;          // distance resolution of the ring's edge
// How far out to sweep. Settable because a run has to reach PAST the ring's
// outer edge to have measured it — the both-signs check below refuses rather
// than printing a lower bound — and the edge moves with the ceiling under test.
const D_MAX = Number(process.argv[3] ?? 4.5);
const DEG = 1;             // angular resolution of the lateral edge

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));

const yawAt = (ux, uz) => Math.atan2(-ux, uz);

/** What the player is actually offered. `#ct-prompt` is hidden with display:none
 *  and KEEPS ITS LAST TEXT, so every read checks `display` first. */
const offered = async (px, pz, yaw) => {
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [px, pz]);
  await p.evaluate(([x, z, y, g]) => window.__ct.warp(x, z, y, g, 0), [px, pz, yaw, gy]);
  // 8 frames: 3 was not enough and made the band blink (w89's header).
  for (let i = 0; i < 8; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  return p.evaluate(() => {
    // `canSee` refuses EVERYTHING while `landing` is set (crosstown.ts:1985).
    if (window.__ct.landing?.()) return '<<LANDING>>';
    const el = document.getElementById('ct-prompt');
    if (!el || getComputedStyle(el).display === 'none') return null;
    const t = (el.textContent ?? '').trim();
    return t.length ? t : null;
  });
};

// ── the subject: isolated, so the prompt is a clean oracle for it ──────────
// On a contested spot the prompt cannot tell "not a candidate" from "outranked".
const spots = await p.evaluate(() => window.__ct.spots()
  .map((s) => ({ x: s.x, z: s.z, r: s.r, label: s.label, gy: window.__ct.groundAt(s.x, s.z) }))
  .filter((s) => s.gy < 0.5 && s.x < 100));
const ISO = 8;
const isolated = spots.filter((s) => !spots.some((o) => o !== s
  && Math.hypot(o.x - s.x, o.z - s.z) < ISO));

const TOUCH_MARGIN = await p.evaluate(() => window.__ct.touchMargin());
if (typeof TOUCH_MARGIN !== 'number' || !isFinite(TOUCH_MARGIN)) {
  console.error(`ABORT: touchMargin() did not resolve off __ct -> ${TOUCH_MARGIN}`);
  await b.close(); process.exit(3);
}

let subject = null, dir = null;
for (const s of isolated) {
  for (let k = 0; k < 8 && !subject; k++) {
    const a = (k * Math.PI) / 4;
    const ux = Math.sin(a), uz = Math.cos(a);
    const px = s.x + ux * 1.0, pz = s.z + uz * 1.0;
    const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [px, pz]);
    if (gy > 0.5) continue;
    const t = await offered(px, pz, yawAt(ux, uz));
    if (t && s.label && t.includes(s.label.slice(0, 18))) { subject = s; dir = { ux, uz }; }
  }
  if (subject) break;
}
if (!subject) { console.error('ABORT: no isolated spot with a clean 1 m approach.'); await b.close(); process.exit(3); }

const key = subject.label.slice(0, 18);
const hit = (t) => !!t && t.includes(key);
const dTouch = subject.r + TOUCH_MARGIN;
const N_FLOOR = Math.floor((D_MAX - dTouch) / STEP);   // DERIVED from the world's own numbers

console.log(`world      ${URL}`);
console.log(`subject    "${subject.label}"  r=${subject.r}  at (${subject.x.toFixed(2)}, ${subject.z.toFixed(2)})`);
console.log(`touch      r + TOUCH_MARGIN = ${subject.r} + ${TOUCH_MARGIN} = ${dTouch.toFixed(2)} m  (aim-free below this)`);
console.log(`sweep      ${dTouch.toFixed(2)} .. ${D_MAX} m at ${STEP} m, edge at ${DEG}° — population floor ${N_FLOOR}\n`);

// ── SELF-TEST, BOTH SIGNS. An oracle stuck on one answer measures nothing. ──
const posCase = await offered(subject.x, subject.z, yawAt(dir.ux, dir.uz));
const negCase = await offered(subject.x + dir.ux * 3, subject.z + dir.uz * 3, yawAt(-dir.ux, -dir.uz));
console.log(`self-test  YES-case (standing on it):        ${JSON.stringify(posCase)}  -> ${hit(posCase) ? 'ok' : 'FAILED'}`);
console.log(`self-test  NO-case  (3 m, aimed 180° away):  ${JSON.stringify(negCase)}  -> ${!hit(negCase) ? 'ok' : 'FAILED'}`);
if (!hit(posCase) || hit(negCase)) {
  console.error('\nABORT: the oracle cannot produce both answers, so nothing below would mean anything.');
  await b.close(); process.exit(3);
}

/** Largest off-axis angle, in degrees, at which `subject` is still offered from
 *  distance `d`. Linear from 0 and stops at the first miss AFTER a hit — the
 *  band is not assumed monotonic, so a binary search would be a lie. */
async function edgeAt(d) {
  let last = null;
  const px = subject.x + dir.ux * d, pz = subject.z + dir.uz * d;
  for (let deg = 0; deg <= 89; deg += DEG) {
    const t = await offered(px, pz, yawAt(dir.ux, dir.uz) + (deg * Math.PI) / 180);
    if (hit(t)) last = deg; else if (last !== null) break;
  }
  return last;
}

const widths = [], outers = [];
for (let run = 1; run <= RUNS; run++) {
  const rows = [];
  for (let d = dTouch + STEP; d <= D_MAX + 1e-9; d += STEP) {
    const dd = +d.toFixed(2);
    const deg = await edgeAt(dd);
    rows.push({ d: dd, deg, lat: deg === null ? 0 : dd * Math.tan((deg * Math.PI) / 180) });
  }
  if (rows.length < N_FLOOR) {
    console.error(`\nABORT run ${run}: swept ${rows.length} distances, floor is ${N_FLOOR}.`);
    await b.close(); process.exit(3);
  }
  const dead = rows.filter((q) => q.lat < subject.r);
  const alive = rows.filter((q) => q.lat >= subject.r);
  if (!dead.length || !alive.length) {
    console.error(`\nABORT run ${run}: the sweep found only one sign `
      + `(${dead.length} dead, ${alive.length} alive). The ring's outer edge is outside `
      + `${D_MAX} m, so any width printed would be a lower bound, not a measurement.`);
    await b.close(); process.exit(3);
  }
  // OUTER EDGE = the end of the CONTIGUOUS dead run that starts at the touch
  // circle. NOT "the last dead row anywhere in the sweep" — my first cut did
  // that and it read 3.30 m where the ring is 1.05 m, because past the ring the
  // measured lateral sits within ±0.05 m of `r` and the 1° angular step is worth
  // MORE than that: at d = 3.0 the step from 19° to 20° moves lateral 1.033 ->
  // 1.092, straddling r = 1.05. So out there "dead" and "live" alternate on
  // quantisation, not on the world, and only the contiguous run near the spot is
  // a real annulus the player can walk into. The quantisation floor is printed
  // below so nobody has to rediscover this.
  let k = 0;
  while (k < rows.length && rows[k].lat < subject.r) k++;
  const outer = k === 0 ? dTouch : rows[k - 1].d;
  const width = outer - dTouch;
  const quant = rows.map((q) => q.d * (Math.tan(((q.deg ?? 0) + DEG) * Math.PI / 180) - Math.tan((q.deg ?? 0) * Math.PI / 180)));
  if (run === 1) {
    console.log(`  lateral quantisation from the ${DEG}° step: `
      + `${Math.min(...quant).toFixed(3)} .. ${Math.max(...quant).toFixed(3)} m — `
      + `a |lateral - r| under that is not a reading`);
  }
  widths.push(width); outers.push(outer);
  console.log(`run ${run}:  dead ring ${dTouch.toFixed(2)} .. ${outer.toFixed(2)} m   `
    + `WIDTH ${width.toFixed(2)} m   (${dead.length}/${rows.length} distances cover less than r)`);
  if (run === 1) {
    console.log('\n   d      edge°    lateral (m)   r      verdict');
    for (const q of rows) {
      console.log(`  ${q.d.toFixed(2)}   ${String(q.deg ?? 'none').padStart(5)}    ${q.lat.toFixed(3).padStart(7)}     ${subject.r}   ${q.lat < subject.r ? 'DEAD' : 'live'}`);
    }
    console.log('');
  }
}

const mean = widths.reduce((a, c) => a + c, 0) / widths.length;
console.log(`\nDEAD RING WIDTH over ${RUNS} run(s): mean ${mean.toFixed(2)} m  `
  + `min ${Math.min(...widths).toFixed(2)}  max ${Math.max(...widths).toFixed(2)}  `
  + `spread ${(Math.max(...widths) - Math.min(...widths)).toFixed(2)} m`);
console.log(`outer edge: ${outers.map((q) => q.toFixed(2)).join(', ')} m`);
console.log(`console errors: ${errs.length}`);
await b.close();
