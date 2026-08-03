// Item 232 — DOES THE CORRECTED PREDICATE GO RED WHERE THE OLD ONE WENT GREEN?
//
// The row asks for exactly that demonstration on the two registered checks,
// `O-jail-walk.mjs` and `A-eye-height-holds.mjs`.
//
// ── WHY THIS PROBE EXISTS AND canfail.mjs DOES NOT CARRY THE CASE ──────────
//
// The flip CANNOT be shown by re-running the two checks on today's geometry,
// and that is a finding rather than an obstacle: at both of them the player
// ends up **0.18 m** from a spot whose radius is 1.05 (jail) or 0.75 (apt301),
// which is inside r+0.15 AND inside r+0.60. Both margins agree there, so both
// versions are green and the false green is LATENT, not active.
//
// The obvious canfail route — shrink `interior.ts:1435`'s `doorR` until the
// player falls in the disputed band — was tried and REJECTED. `doorR` feeds
// `lookTolerance(r, d) = atan2(r, max(0.35, d))`, so driving r to ~0 makes the
// look cone 0 rad and nothing in the world can be aimed at either. The check
// would go red for three reasons at once, and item 233's rule is that CAUGHT
// must mean red BECAUSE OF the mutation. A mutation that breaks everything
// proves nothing about the margin.
//
// So the flip is shown where it actually lives: stand the player in the ring
// r+TOUCH .. r+REACH at the two real spots those checks assert on, and evaluate
// BOTH predicates against the world's own answer.
//
// POPULATION FLOOR AND BOTH SIGNS. A control leg stands inside the touch radius
// where the two predicates must AGREE and the world must offer the spot; if the
// band leg and the control leg do not disagree, this probe has measured nothing
// and exits 3 rather than printing a comfortable verdict.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });

const M = await p.evaluate(() => ({
  touch: window.__ct.touchMargin?.(), reach: window.__ct.reachMargin?.(),
}));
if (![M.touch, M.reach].every((v) => typeof v === 'number' && isFinite(v))) {
  console.error(`ABORT: accessors did not both resolve — ${JSON.stringify(M)}`);
  await b.close(); process.exit(3);
}
console.log(`built bundle: touchMargin=${M.touch}  reachMargin=${M.reach}\n`);

// The two spots the registered checks actually assert on.
const TARGETS = [
  ['O-jail-walk.mjs',        /HOUSE OF DETENTION/i],
  ['A-eye-height-holds.mjs', /sleep until morning/i],
];

// Put the player at distance `d` from the spot, facing 180 deg AWAY from it.
// Facing away isolates the aim-free pass, which is the clause both checks are
// really about — an aimed player reaches 6 m with no margin term at all.
//
// ── TWO CORRECTIONS THIS PROBE MADE TO ITSELF, both found on its first run ──
//
// 1. ONE APPROACH ANGLE IS NOT ENOUGH. Walking out along +x from the jail door
//    puts the player into the building's own wall collider: asked for 1.43 m,
//    the warp landed at 1.19 m — back inside the touch bound — and the flip
//    silently did not happen. A door spot sits ON a facade, so at least one
//    bearing from it is always into masonry. So: try 16 bearings and keep the
//    one that lands nearest the distance asked for.
//
// 2. "IS THERE A PROMPT" IS THE WRONG QUESTION — IT MUST BE "IS IT THIS SPOT'S".
//    At the apt301 bed the reader returned `[E] steal 101's package`, a
//    DIFFERENT spot a metre away, and the probe scored it as "the world offers
//    this spot". That is the same false-green it was written to expose, one
//    level up. The offer test now matches the prompt against the target's own
//    label.
async function sample(spot, d, band) {
  let best = null;
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * Math.PI * 2;
    const px = spot.x + d * Math.cos(ang), pz = spot.z + d * Math.sin(ang);
    const away = Math.atan2(spot.x - px, -(spot.z - pz)) + Math.PI;
    await p.evaluate(([x, z, yaw]) => { window.__ct.warp(x, z, yaw); }, [px, pz, away]);
    await p.waitForTimeout(150);
    // ── RE-AIM FROM WHERE WE LANDED, NOT FROM WHERE WE AIMED ────────────────
    //
    // THIS IS THE THIRD FAULT THIS PROBE FOUND IN ITSELF, and it made the whole
    // result flaky: 2,2,1,1,1 flips over five runs. A collider DISPLACES the
    // warp — at the jail door by up to 0.3 m — and the yaw above was computed
    // from the position we ASKED for. Displaced, "180 deg away" was no longer
    // away: the player ended up within the 15 deg look cone and the world
    // offered the spot at 1.42 m, which is the AIMED pass (`d < 6`, no margin)
    // doing exactly what it should. The probe then scored a correct world as
    // "no flip".
    //
    // Facing away is the whole experiment — it is what isolates the aim-free
    // clause the two checks are about — so it has to be re-established against
    // the position actually occupied.
    await p.evaluate(([sx, sz]) => {
      const v = window.__ct.pos();
      window.__ct.warp(v[0], v[2], Math.atan2(sx - v[0], -(sz - v[2])) + Math.PI);
    }, [spot.x, spot.z]);
    // ── FOURTH FAULT, AND THE ONE THAT MADE THE JAIL LOOK IMPOSSIBLE ────────
    //
    // `waitForTimeout` is not a frame. The prompt is rebuilt once per RENDERED
    // frame, so a fixed sleep reads whatever the last frame left on screen —
    // and stepping through 16 bearings means the previous bearing's prompt is
    // still there. That produced the flat contradiction of a spot reported at
    // 1.42 m (outside touch) while the screen still showed its prompt from a
    // bearing where the player had been pushed to 0.73 m (inside it).
    //
    // `probes/w88-why-jail-offers.mjs` is what settled it: at the jail the warp
    // is displaced 0.69 m by the door collider, so the player really was inside
    // the touch bound and the WORLD WAS RIGHT ALL ALONG. Pump real frames and
    // read position and prompt from the same one. (GOTCHAS 30: a frame is 17 ms
    // idle and over a second under load — never assume a sleep contains one.)
    for (let f = 0; f < 4; f++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    const got = await p.evaluate(([label]) => {
      const v = window.__ct.pos();
      const s = window.__ct.spots().find((q) => (q.label ?? '') === label);
      // ── FIFTH FAULT, AND IT IS NOT THIS PROBE'S ALONE ──────────────────────
      //
      // `#ct-prompt`.textContent IS A GHOST. `ct/hud.ts:1715` hides the prompt
      // with `style.display = 'none'` and RETURNS WITHOUT CLEARING THE TEXT, so
      // the element keeps the last thing it ever offered, forever. Measured:
      // warped 40 m up the street from the jail door, and after a real 'w'
      // movement nudge, `textContent` still read "[E] into the HOUSE OF
      // DETENTION" (`probes/w88-does-prompt-clear.mjs`).
      //
      // That is what made the jail look impossible — a spot 1.34 m away and
      // 180 deg off axis appeared to be offered. It was not; the screen was
      // showing a corpse. `display` is the truth and `textContent` is only the
      // caption.
      const el = document.getElementById('ct-prompt');
      const shown = !!el && getComputedStyle(el).display !== 'none';
      const txt = shown ? ((el.textContent ?? '').trim() || null) : null;
      return {
        x: v[0], z: v[2],
        d: s ? Math.hypot(s.x - v[0], s.z - v[2]) : null,
        prompt: txt,
        // THE OFFER MUST BE FOR THIS SPOT. A neighbour's prompt is not evidence.
        offersThis: txt !== null && label.length > 0 && txt.includes(label),
      };
    }, [spot.label]);
    if (got.d === null) return got;
    // ── THE ACCEPTANCE TEST IS "DID I LAND IN THE BAND", NOT "NEAR THE TARGET"
    //
    // Ranking bearings by |landed - asked| accepted a landing 0.35 m off, and at
    // the jail the door collider displaces the warp by 0.69 m — straight through
    // the touch bound and out the other side. The experiment is only valid if
    // the player is ACTUALLY standing between the two bounds, so that is what is
    // required, and a bearing that misses is simply not a sample.
    if (band && got.d > band.lo && got.d < band.hi) return got;
    if (best === null || Math.abs(got.d - d) < Math.abs(best.d - d)) best = got;
  }
  return band ? null : best;      // in-band was demanded and no bearing gave it
}

let flips = 0, agreements = 0, rows = 0;

for (const [check, re] of TARGETS) {
  const spot = await p.evaluate(([src]) => {
    const s = window.__ct.spots().find((q) => new RegExp(src, 'i').test(q.label ?? ''));
    return s ? { label: s.label, x: s.x, z: s.z, r: s.r } : null;
  }, [re.source]);
  if (!spot) { console.log(`${check}: spot ${re} NOT FOUND — skipped`); continue; }

  console.log(`── ${check}`);
  console.log(`   spot "${spot.label}"  r ${spot.r}`);
  console.log(`   old bound r+${M.reach} = ${(spot.r + M.reach).toFixed(2)} m` +
              `   new bound r+${M.touch} = ${(spot.r + M.touch).toFixed(2)} m`);

  // IN THE BAND: between the two bounds, so the predicates must disagree.
  const dBand = spot.r + M.touch + (M.reach - M.touch) / 2;
  const bounds = { lo: spot.r + M.touch, hi: spot.r + M.reach };
  const band = await sample(spot, dBand, bounds);
  if (band === null || band.d === null) {
    console.error(`   ABORT: no bearing put the player inside the band `
      + `(${bounds.lo.toFixed(2)} .. ${bounds.hi.toFixed(2)} m) — colliders displace every approach.`);
    console.error(`          Nothing was measured for this target; not scoring it as a pass or a fail.`);
    await b.close(); process.exit(3);
  }
  const oldSaysNear = band.d < spot.r + M.reach;
  const newSaysNear = band.d < spot.r + M.touch;
  const worldOffers  = band.offersThis;
  rows++;
  console.log(`   IN THE BAND at ${band.d.toFixed(2)} m, facing away:`);
  console.log(`      old predicate (r+${M.reach}) says near = ${oldSaysNear}   -> the check would pass`);
  console.log(`      new predicate (r+${M.touch}) says near = ${newSaysNear}  -> the check goes RED`);
  console.log(`      the WORLD offers THIS spot  = ${worldOffers}`
    + `${band.prompt ? `   (prompt on screen: "${band.prompt}"${worldOffers ? '' : ' — a DIFFERENT spot'})` : '   (no prompt at all)'}`);
  if (oldSaysNear && !newSaysNear && !worldOffers) {
    flips++;
    console.log(`      => FLIPPED: green -> red, and the NEW answer is the world's.`);
  } else {
    console.log(`      => no flip here.`);
  }

  // CONTROL: inside the touch radius the two must AGREE and the world must offer.
  const dIn = Math.max(0.05, spot.r - 0.1);
  const inside = await sample(spot, dIn);
  if (inside.d !== null && Math.abs(inside.d - dIn) <= 0.35) {
    const bothNear = inside.d < spot.r + M.touch && inside.d < spot.r + M.reach;
    console.log(`   CONTROL inside the radius at ${inside.d.toFixed(2)} m:`
      + ` both predicates near = ${bothNear}, world offers THIS spot = ${inside.offersThis}`);
    if (bothNear && inside.offersThis) agreements++;
  }
  console.log();
}

console.log('── verdict ──');
if (rows === 0) {
  console.error('ABORT: neither target spot was found — nothing was measured.');
  await b.close(); process.exit(3);
}
if (agreements === 0) {
  console.error('ABORT: the control never agreed — inside the radius the world offered nothing.');
  console.error('       The prompt reader is broken and the band results above prove nothing.');
  await b.close(); process.exit(3);
}
console.log(`  ${rows} registered-check predicates put in the disputed band`);
console.log(`  ${flips} flipped green -> red, agreeing with the world where the old one did not`);
console.log(`  ${agreements} control samples where both predicates agree and the world offers`);
await b.close();
if (flips < rows) {
  console.error(`\nNOT PROVEN: ${rows - flips} predicate(s) did not flip.`);
  process.exit(1);
}
console.log(`\nPROVEN — the corrected predicate is RED exactly where the old one was GREEN,`);
console.log(`and the world agrees with the corrected one at every sample.`);
process.exit(0);
