import type { AABB } from '../fp';

// ── THE DANGEROUS-GAP RULE ─────────────────────────────────────────────────
//
// The player capsule is RADIUS = 0.36, so 0.72 m across. A corridor between two
// solid boxes should be either comfortably passable or too narrow to enter.
// In between is a trap: wide enough to walk into at an angle, too narrow to turn
// round or walk out of, which is how the user ended up wedged between two parked
// cars saying "im literally stuck here".
//
// This lives in its own module because the arrangement it constrains is drawn in
// two places — the main street's parked cars in crosstown.ts and the side
// street's in ct/sidestreet.ts — and a rule enforced in one of them is a rule
// that will be broken by the other.
//
// It is a CONSTRAINT ON THE DRAW, not a hand-placed arrangement. The parking
// spread is sampled from the seeded distribution on purpose and the user likes
// the variety, so the fix is to reject a sample that lands in the band and take
// the next one, never to go back to fixed offsets. The trap also moves with the
// draw: the same tree-against-truck slot that measured 0.49 m one session was
// gone the next, because another module's rnd() draws had shifted everything
// downstream. You cannot chase these one arrangement at a time.

/** comfortably passable: 0.72 m of capsule plus room to turn */
export const PASSABLE = 0.95;
/** too narrow for the capsule to get into at all */
export const ENTERABLE = 0.40;

/** Is this gap a trap? */
export const isTrap = (w: number) => w > ENTERABLE && w < PASSABLE;

/**
 * The corridor between two boxes, or null if they do not form one.
 *
 * A corridor only exists where the boxes' spans OVERLAP on one axis: then the
 * separation on the other axis is a slot of that width. Boxes merely diagonal to
 * each other are not a trap — you can always leave a diagonal gap the way you
 * came in — and counting those produces a flood of false positives that buries
 * the real ones.
 */
export function corridor(a: AABB, b: AABB): number | null {
  const overlapX = a.minX < b.maxX && b.minX < a.maxX;
  const overlapZ = a.minZ < b.maxZ && b.minZ < a.maxZ;
  const sx = Math.max(b.minX - a.maxX, a.minX - b.maxX);
  const sz = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ);
  if (overlapZ && sx > 0) return sx;
  if (overlapX && sz > 0) return sz;
  return null;
}

/** Does this box leave a trap against any of `others`? Returns the offending
 *  width, or null if every gap it makes is either passable or unenterable. */
export function trapAgainst(box: AABB, others: AABB[]): number | null {
  for (const o of others) {
    const w = corridor(box, o);
    if (w !== null && isTrap(w)) return w;
  }
  return null;
}

/**
 * Slide a box along one axis until it stops making a trap.
 *
 * `place` turns an offset into a candidate box, so the caller keeps ownership of
 * how its thing is positioned — this only decides WHICH offset is acceptable. It
 * walks outward in both directions from the drawn offset so the accepted one is
 * always the nearest legal spot to what the distribution actually chose: the
 * variety survives, the trap does not.
 *
 * Returns the offset it settled on. If nothing within `reach` is clear it
 * returns the original and reports it, because silently shipping a trap is worse
 * than a logged one.
 */
export function nudgeClear(
  drawn: number,
  place: (offset: number) => AABB,
  others: AABB[],
  reach = 3.0,
  step = 0.25,
): { at: number; moved: number; ok: boolean } {
  if (!trapAgainst(place(drawn), others)) return { at: drawn, moved: 0, ok: true };
  for (let d = step; d <= reach; d += step) {
    for (const s of [1, -1]) {
      const at = drawn + s * d;
      if (!trapAgainst(place(at), others)) return { at, moved: s * d, ok: true };
    }
  }
  return { at: drawn, moved: 0, ok: false };
}
