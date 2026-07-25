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
// JUMPING TO A NIGHT HOUR DOES NOT GIVE YOU THE NIGHT THE PLAYER SEES. This
// function lands the clock correctly — that is measured and holds — but some of
// the world's night state only arrives if the clock PASSES THROUGH the evening.
// The wall-splash sheets on the building line are at opacity 0 when the clock is
// set straight to 23:00 and at 0.286 when it goes via 20:00, and the whole frame
// is reproducibly 7.4% darker stepped than jumped (spread within a group 0.02).
//
// A player never jumps, so this is a measuring artefact rather than a defect.
// If you are measuring anything after dark, step:
//
//     await setClock(page, 20, 0); await page.waitForTimeout(1200);
//     await setClock(page, 23, 0);
//
// notes/D-jumping-the-clock.md has the numbers. Comment added by D; the
// function itself is untouched.
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
