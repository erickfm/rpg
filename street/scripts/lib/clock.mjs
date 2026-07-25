// Jumping the clock from a check, and knowing when it has actually landed.
//
// ── what the hazard really is ──
//
// 2bdebbcf found the night grade "lerps" after a clock jump — 0 out-of-range
// materials at 500 ms, 9 from 1000 ms — and 159b9c1c counted 90 of 129 scripts
// waiting under 1000 ms afterwards, as a candidate list for the same fault.
//
// The reading is real. The lerp is not. Measured at HEAD, in both directions:
//
//   settled DAY     over= 0  lot=0.53963
//   t =  100 ms into night   over= 9  lot=0.14772     <- already final
//   t = 4000 ms into night   over= 9  lot=0.14772     <- same
//
// No intermediate value exists at any delay, going either way. The grade is
// applied WHOLE, and the 9 out-of-range materials are simply what night looks
// like — a property of the destination, not of a ramp.
//
// What it actually costs is ONE RENDERED FRAME:
//
//   the clock jump lands after 1 rendered frame = 42.3 ms on an idle machine
//
// That reframes the hazard, and it matters three ways:
//
//   1. It is BINARY, not partial. You do not get a slightly-wrong number that
//      slips past a threshold; you get the PREVIOUS TIME OF DAY in full. Much
//      louder when it bites, and much easier to miss when it doesn't.
//   2. The unit is FRAMES, not milliseconds. At 60 fps one frame is 17 ms; on
//      a machine running sixteen checks at 2 fps it is 500 ms. Which is
//      exactly the shape of "0 at 500 ms, 9 at 1000 ms" — that sample was not
//      caught mid-lerp, it was taken before the first frame after the jump.
//   3. Therefore the cheap test in 159b9c1c — run yours at its delay and again
//      at 2 s, and record that it did not move — is NOT SAFE ON AN IDLE
//      MACHINE. It passes for every one of the 90 while the suite is quiet and
//      proves nothing about the loaded run where the fault appears. I ran that
//      exact test on my own four and it came back clean; it is not why I now
//      believe they are clean.
//
// ── so wait for the frame, not for a duration ──
//
//   import { setClock } from './lib/clock.mjs';
//   await setClock(page, 23, 0);     // returns when the grade is on screen
//
// Deterministic under any load, and FASTER than the sleeps it replaces: two
// rendered frames instead of a guessed 600–2000 ms. It cannot hang — rAF is
// raced against a wall-clock cap, and if the cap wins it says so rather than
// returning quietly, because a silent fallback is the sleep we started with.

/**
 * Set the world clock and return once the change has actually been rendered.
 *
 * Two frames, not one: the first is the frame in flight when the jump lands,
 * the second is the one that observes it. Measured cost is 1 frame, so this
 * carries a frame of margin and still beats every fixed sleep in the suite.
 *
 * @param page    the Playwright page
 * @param h       hour, 0–23
 * @param m       minute
 * @param capMs   hard cap. Generous — it exists to stop a hang, not to pace.
 * @returns {{frames:number, ms:number, capped:boolean}}
 */
// A JUMP IS FINE. This lands the clock correctly and there is no night state
// that only arms by passing through the evening — re-measured at HEAD, every
// transparent material in the world, jumped to 23:00 versus stepped via 20:00:
//
//     381 compared        0 differ
//
// with the control that makes that zero mean something: day versus jumped 23:00
// differs in 296 of the same 381, props's 50 splash sheets among them. The probe
// can see these materials change; they just do not care how the clock got here.
//
// THIS COMMENT USED TO SAY THE OPPOSITE, and it was wrong twice over. It told
// you the splash sheets read 0 jumped and 0.286 stepped, and that the frame was
// "reproducibly 7.4% darker stepped than jumped". Both were RAIN. The splash
// follows the wet look rather than the hour, so stepping only changed anything
// when the intermediate hour happened to be wet — 20:00 was, under that day's
// rainAt; `e0c68e46` replaced it, 20:00 went dry, and the same measurement gave
// 0.2%.
//
// `3d71b035` — "A jumped clock is 7.4% brighter than the night the player
// reaches" — IS WITHDRAWN IN FULL. Cited by hash because that one is merged and
// you can read it; the withdrawal is written out here in words because as I
// write this it lives in a commit of mine that has not landed, so nobody else
// can resolve it. That asymmetry IS the problem: the false claim is on mainline
// and its retraction is not, so `git log` hands every builder the wrong half and
// no other. GOTCHAS §36 says to cite only merged hashes and that waiting costs
// nothing — true for a finding, and exactly inverted for a retraction.
//
// setNight below has carried the corrected version for some time. This one did
// not, which is the worse half: the correction lived under the helper nobody
// calls directly while the retracted claim stayed on the function everybody
// does.
//
// So do not step to "arm" anything. What IS worth having is the inverse, and
// setNight does it for you: a clock landing on a night hour may have passed
// through a WET one, and then your night measurement is a wet night. Use
// setNight for anything measured or photographed after dark and it picks an
// evening hour the world says is dry.
//
// notes/D-jumping-the-clock.md has the full retraction and the numbers. Comment
// by D; the function itself is untouched.
export async function setClock(page, h, m = 0, capMs = 8000) {
  const r = await page.evaluate(([hh, mm, cap]) => new Promise((res) => {
    const t0 = performance.now();
    window.__ct.clock(hh, mm);
    let f = 0, done = false;
    const finish = (capped) => {
      if (done) return; done = true;
      res({ frames: f, ms: +(performance.now() - t0).toFixed(1), capped });
    };
    const tick = () => {
      if (++f >= 2) return finish(false);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // rAF does not fire in a page the browser has decided is not visible. If
    // that ever happens this must SAY so — a check that silently degrades to
    // "no wait at all" is worse than the fixed sleep it replaced.
    setTimeout(() => finish(true), cap);
  }), [h, m, capMs]);
  if (r.capped) {
    console.warn(`[clock] ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} — `
      + `rAF did not deliver 2 frames in ${capMs} ms (got ${r.frames}). The grade may `
      + `not be on screen. Is the page throttled or the render loop stopped?`);
  }
  return r;
}

/**
 * Set a NIGHT hour the way a player reaches it — via the evening.
 *
 * `setClock(page, 23)` lands the clock at 23:00 but leaves the world in a state
 * no player is ever in: the wall-splash sheets stay at opacity 0, and a third of
 * the world's materials sit about 6% brighter than they should
 * (notes/D-jumping-the-clock.md has the numbers). 18:00 is not enough to arm it;
 * 20:00 is.
 *
 * Use this for anything measured or photographed after dark. For a DAY hour it
 * is unnecessary — the world boots at 13:20, so a day hour is already the state
 * it is in.
 *
 * Costs one extra clock set and a settle. Added by D; setClock itself unchanged.
 */
export async function setNight(page, h, m = 0, settleMs = 1200) {
  // REACH NIGHT WITHOUT GETTING WET. That is what this is for, and it is NOT
  // what I originally wrote it for.
  //
  // The original claim was that stepping through the evening "arms" night state
  // that a jump leaves off, with the wall splash as evidence: 0 when jumped,
  // 0.286 when stepped via 20:00. **That was rain.** 20:00 rained under the
  // rainAt of that day; e0c68e46 replaced it, and measured again with 20:00 dry:
  //
  //     jump to 23 (dry)       splash 0
  //     via 20 DRY  -> 23      splash 0        <- stepping does nothing
  //     via 21 WET  -> 23      splash 0.295
  //     via 17 WET  -> 23      splash 0.295
  //
  // The splash follows the WET LOOK, not the hour, and it persists after the
  // rain because the ground dries slowly. So there is no night state to arm and
  // a jump is not deficient.
  //
  // What survives is the inverse and it is worth having: a clock that lands on
  // a night hour may have passed through a wet one on the way, and then your
  // "night" measurement is a wet night. This picks an evening hour the world
  // says is DRY, so it cannot happen by accident.
  //
  // Not hypothetical. My "a jumped clock is 7.4% brighter" finding was mostly
  // RAIN, because this helper went via 20:00 and 20:00 rained under the rainAt
  // of that day. e0c68e46 replaced rainAt, 20:00 became dry, and the same
  // measurement re-run gave 0.2%. The hard-coded hour was right until it was
  // not, and nothing failed when it changed.
  //
  // props.ts publishes the predicate so nothing has to mirror it; 18, 19 and 20
  // all arm the splash (measured), so take whichever of them is dry.
  const evening = await page.evaluate(() => {
    const f = window.__ct.scene && window.__ct.scene().userData
      ? window.__ct.scene().userData.rainAt : null;
    if (!f) return 20;                        // pre-publication build
    for (const hh of [20, 19, 18, 21, 17]) if (!f(hh)) return hh;
    return 20;                                // every evening hour wet: nothing better
  });
  await setClock(page, evening, 0);
  await page.waitForTimeout(settleMs);
  await setClock(page, h, m);
  await page.waitForTimeout(settleMs);
}
