// Wait for the RENDER LOOP, not for the clock on the wall.
//
// GOTCHAS 30: a fixed sleep for anything the render loop drives fails only
// under load, which is the run where it matters. `lib/clock.mjs` already solves
// this for a clock jump and bakes the wait into `setClock`. This is the same
// wait for everything else — the case that turns up most is a WARP:
//
//     await page.evaluate(() => window.__ct.warp(x, z, 0, 0.14, 0));
//     await page.waitForTimeout(150);        // <- hope
//     const start = await pos();             // <- may be the position BEFORE the warp
//
// A stale read there does not look like a bug. It looks like the player walked
// a strange distance, and you go looking in the world. `citizenSprite` cost me
// exactly this: its texture carries the previous frame's player position until
// its onFrame hook runs, and a probe that warped and read without yielding
// decoded the sector from wherever it had been standing before — reported as a
// keeper facing the wrong way, in a room that was fine.
//
//   import { afterFrames } from './lib/frames.mjs';
//   await page.evaluate(() => window.__ct.warp(...));
//   await afterFrames(page);        // two rendered frames, then read
//
// Two by default: one to run the frame the warp landed in, one for anything
// that reacts to the finished position (billboards and the crowd both register
// LATE hooks).

/**
 * Resolve once `n` animation frames have actually been rendered.
 * Warns — loudly, like setClock — if rAF does not deliver them, because a
 * helper that silently degrades to "no wait at all" is worse than the sleep it
 * replaced.
 */
export async function afterFrames(page, n = 2, capMs = 4000) {
  const r = await page.evaluate(([want, cap]) => new Promise((res) => {
    const t0 = performance.now();
    let f = 0, done = false;
    const finish = (capped) => {
      if (done) return; done = true;
      res({ frames: f, ms: +(performance.now() - t0).toFixed(1), capped });
    };
    const tick = () => {
      if (++f >= want) return finish(false);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(() => finish(true), cap);
  }), [n, capMs]);
  if (r.capped) {
    console.warn(`[frames] rAF did not deliver ${n} frames in ${capMs} ms (got ${r.frames}). `
      + 'Whatever you read next is from before the change. Is the page throttled '
      + 'or the render loop stopped?');
  }
  return r;
}
