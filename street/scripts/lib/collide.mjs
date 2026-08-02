// ONE definition of "is this world point inside that collider", for probes.
//
// WHY THIS EXISTS. `fp.ts` gained rotated colliders (`AABB.rot`) so the bodega's
// 45-degree chamfer could be one box instead of a staircase of eight. On a
// turned box `minX..maxX / minZ..maxZ` are extents **in the box's own frame**,
// so a world point has to be turned into that frame before the plain min/max
// test means anything — `fp.ts:55` `inFrame`, applied by `blocked()` at
// `fp.ts:287` before every comparison.
//
// Instruments written before that landed compare raw world x/z against those
// extents, which for the chamfer tests an axis-aligned 2.83 x 1.41 rectangle
// standing in for a box turned 45 degrees. The two regions are not the same
// region, and the player sits outside the true box and inside the imaginary
// one. That is the whole of the (8.50, -94.50) "trap": `unstick` ejects the
// player correctly, `fp.ts` agrees he is free, and the instrument reports him
// buried in a wall. One false player-facing defect, and a builder-day to
// disprove it (notes/w38-chamfer-trap-premise.md).
//
// WHY IT IS A LIBRARY AND NOT A FOURTH COPY. `inFrame` had already been hand-
// copied into `w38-chamfer-trap.mjs` to write that note, and BUILDER-BRIEF §8
// is explicit that a second hand-typed copy of a number or a formula is the
// most expensive habit here. `w38-chamfer-trap-premise.md` asked for exactly
// this file by name.
//
// WHY THE PAGE GETS IT AS SOURCE TEXT. A browser probe cannot import `fp.ts` —
// it is TypeScript, and against a built bundle it is not separately reachable
// at all. Playwright serializes each `page.evaluate` callback on its own, so a
// helper referenced from three different callbacks would be textually repeated
// three times, which is the thing this file exists to stop. So the definitions
// below are the ONLY ones: `installCollide(page)` ships their own `toString()`
// into the page once, as `window.__probeCollide`, and every callback in every
// probe calls through that. Node-side callers just import them.
//
// WHAT THIS IS NOT. It is a faithful copy of `fp.ts`'s geometry, not a link to
// it — nothing here can notice if `fp.ts` changes. The real fix is for the
// world to publish its own predicate (`__ct.blocked(x, z)`, beside
// `__ct.colliders()`), at which point this file should be deleted rather than
// maintained. That needs `crosstown.ts`, which item 82 does not name.

/** A world point in the box's OWN frame, so the plain min/max tests work
 *  unchanged on a turned box. Identity when `rot` is absent or zero — the same
 *  arithmetic, not an approximation of it.
 *
 *  Copied from `src/proto/fp.ts:55-61` (`inFrame`), which is the authority. */
export function inFrame(c, x, z) {
  if (!c.rot) return { x: x, z: z };
  const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
  const s = Math.sin(c.rot), k = Math.cos(c.rot);
  const dx = x - cx, dz = z - cz;
  return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
}

/** Is (x, z) inside collider `c`, padded by the player radius `R`?
 *
 *  The padding is applied in the BOX's frame, not the world's — deliberately,
 *  and `fp.ts:281-288` says why at length: it was always a square Minkowski sum
 *  standing in for the player's circle, and on a turned box the square turns
 *  with it. Same approximation, no worse, and it is what makes the stop
 *  distance against a 45-degree wall a constant instead of sawing with the
 *  wall's angle. Matching `fp.ts` exactly is the entire point of this file, so
 *  do not "improve" it here — improve it there.
 *
 *  Height is deliberately ignored, exactly as `blocked()` does for a caller
 *  that omits `atY`: every collider is a wall at every height. That is the only
 *  safe default for "am I stuck in this", and it is what the callers here want.
 */
export function insideOne(c, x, z, R) {
  const q = inFrame(c, x, z);
  return q.x > c.minX - R && q.x < c.maxX + R && q.z > c.minZ - R && q.z < c.maxZ + R;
}

/** `fp.ts:279` `blocked()`, over whatever collider array you hand it. Which
 *  array that should be is the CALLER's choice and is a separate question from
 *  this one — actors and geometry both stop the player, and only some callers
 *  care which (see `__ct.staticColliders()`, notes/w38-static-colliders.md). */
export function blockedAt(cols, x, z, R) {
  for (let i = 0; i < cols.length; i++) if (insideOne(cols[i], x, z, R)) return true;
  return false;
}

/** The axis-aligned box a turned collider really occupies IN WORLD SPACE.
 *
 *  For candidate-finding only — "which pairs of things are close enough to be
 *  worth testing" — never for a verdict, which is `blockedAt`'s job. A rotated
 *  box's world footprint is strictly larger than its own-frame extents (the
 *  chamfer's 2.83 x 1.41 spans 3.00 x 3.00 in world axes), so using this to
 *  search can only widen the net, never narrow it. Identity when `rot` is
 *  absent, so an unrotated world searches exactly as it did before. */
export function worldAabb(c) {
  if (!c.rot) return { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ };
  const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
  const hx = (c.maxX - c.minX) / 2, hz = (c.maxZ - c.minZ) / 2;
  // `inFrame` is Ry(-rot); the corners go out through its inverse, Ry(rot).
  const s = Math.sin(c.rot), k = Math.cos(c.rot);
  const ex = Math.abs(hx * k) + Math.abs(hz * s);
  const ez = Math.abs(hx * s) + Math.abs(hz * k);
  return { minX: cx - ex, maxX: cx + ex, minZ: cz - ez, maxZ: cz + ez };
}

/** The source the page gets. Built from the functions above by `toString()`, so
 *  there is exactly one definition of each and no way for the two to drift. */
const PAGE_SRC = `(() => {
  const inFrame = ${inFrame.toString()};
  const insideOne = ${insideOne.toString()};
  const blockedAt = ${blockedAt.toString()};
  const worldAabb = ${worldAabb.toString()};
  return { inFrame, insideOne, blockedAt, worldAabb };
})()`;

/** Install the predicates into the page as `window.__probeCollide`, then prove
 *  they arrived. Call once, after the world is up; every `page.evaluate`
 *  callback afterwards can use them.
 *
 *  IT VERIFIES ITSELF ON PURPOSE. The failure mode of shipping source text into
 *  a page is silent — a CSP that forbids `eval`, or a callback that runs before
 *  the install — and the symptom would be a probe reporting no traps at all,
 *  which reads exactly like a pass. GOTCHAS 71: a check proving an absence must
 *  prove it looked at something. */
export async function installCollide(page) {
  await page.evaluate((src) => { window.__probeCollide = (0, eval)(src); }, PAGE_SRC);
  const ok = await page.evaluate(() => {
    const C = window.__probeCollide;
    if (!C || typeof C.blockedAt !== 'function') return null;
    // a 2x1 box turned 45 degrees about the origin: (0.9, 0) is outside it and
    // inside its own-frame extents, which is the entire bug in one point.
    const c = { minX: -1, maxX: 1, minZ: -0.5, maxZ: 0.5, rot: Math.PI / 4 };
    return { turned: C.insideOne(c, 0.9, 0, 0), flat: C.insideOne({ ...c, rot: 0 }, 0.9, 0, 0) };
  });
  if (!ok) throw new Error('installCollide: window.__probeCollide did not arrive in the page');
  if (ok.turned !== false || ok.flat !== true) {
    throw new Error(`installCollide: the installed predicate is not frame-aware (${JSON.stringify(ok)})`);
  }
}
