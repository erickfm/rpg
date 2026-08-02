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
 * A collider's footprint in WORLD axes — which for a turned box (`AABB.rot`,
 * fp.ts) is not the box.
 *
 * EVERY FUNCTION BELOW READS min/max AS WORLD COORDINATES, and for a box with
 * a `rot` they are not: they are its extents in its OWN frame. Handed one of
 * those raw, the corridor tests do not approximate the answer, they compute a
 * different box's answer — and they did. The bodega's chamfer, turned 45°, has
 * local `maxX` 9.914 while its real east corner reaches x = 10.0; against the
 * wing shopfront's face at 10.4 that is the difference between a 0.486 m
 * corridor and a 0.4 m one, and the first is inside the trap band while the
 * second is not. The overlay painted a wall red for a slot made of brick.
 *
 * So a turned box is measured by the smallest world-axis rectangle that
 * CONTAINS it. Two properties, and the second is the price:
 *
 * · An UNROTATED box is returned unchanged — the same object, not a copy of
 *   it — so every existing collider takes exactly the arithmetic it always
 *   did, down to object identity. That is what keeps `nudgeClear`'s parked-car
 *   decisions, and therefore the drawn world, bit-for-bit where they were.
 * · A turned box is measured LARGER than it is, so gaps against it measure
 *   SMALLER than they are. That direction is safe for a false alarm — a
 *   passable gap may read as a trap — but it can also push a real trap under
 *   `ENTERABLE` and hide it, and for a 45° box the inflation is not small.
 *   Exact oriented-corridor geometry is the honest fix and it is NOT done here:
 *   the corridor width would generalise (a separating-axis test over both
 *   boxes' axes reduces to this one for axis-aligned pairs), but
 *   `corridorFilled` below would not — clearing a turned corridor needs 2-D
 *   coverage, not an interval union along one axis, and half a generalisation
 *   that reports MORE false red than today would be worse than none. There is
 *   one turned collider in the world; when there is a second, this is the
 *   thing to fix, and it is written up in notes/w24-collider-rotation.md.
 */
function footprint(c: AABB): AABB {
  if (!c.rot) return c;
  const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
  const hx = (c.maxX - c.minX) / 2, hz = (c.maxZ - c.minZ) / 2;
  const s = Math.abs(Math.sin(c.rot)), k = Math.abs(Math.cos(c.rot));
  const ex = hx * k + hz * s, ez = hx * s + hz * k;
  return { minX: cx - ex, maxX: cx + ex, minZ: cz - ez, maxZ: cz + ez };
}

/**
 * The corridor between two boxes, or null if they do not form one.
 *
 * A corridor only exists where the boxes' spans OVERLAP on one axis: then the
 * separation on the other axis is a slot of that width. Boxes merely diagonal to
 * each other are not a trap — you can always leave a diagonal gap the way you
 * came in — and counting those produces a flood of false positives that buries
 * the real ones.
 */
export function corridor(ra: AABB, rb: AABB): number | null {
  const a = footprint(ra), b = footprint(rb);
  const overlapX = a.minX < b.maxX && b.minX < a.maxX;
  const overlapZ = a.minZ < b.maxZ && b.minZ < a.maxZ;
  const sx = Math.max(b.minX - a.maxX, a.minX - b.maxX);
  const sz = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ);
  if (overlapZ && sx > 0) return sx;
  if (overlapX && sz > 0) return sz;
  return null;
}

/** The corridor between `a` and `b`, as the RECTANGLE it occupies rather than
 *  only its width, plus WHICH AXIS the gap itself runs along — `trapAgainst`
 *  needs both to ask "is something else already standing in it", and the axis
 *  has to come from here rather than be re-guessed from the rectangle's own
 *  proportions afterwards: the "overlap" side is not always wider than the
 *  "gap" side (two nearly-square boxes can do either), so comparing spans
 *  after the fact picks the wrong axis exactly when it matters. Same overlap
 *  test as `corridor()`; kept separate rather than folded in because most
 *  callers (the parked-car draw) only ever want the width, and every one of
 *  them already existed before this was added — BUILDER-BRIEF §9. */
function corridorRect(ra: AABB, rb: AABB): { rect: AABB; axis: 'x' | 'z' } | null {
  const a = footprint(ra), b = footprint(rb);
  const overlapX = a.minX < b.maxX && b.minX < a.maxX;
  const overlapZ = a.minZ < b.maxZ && b.minZ < a.maxZ;
  if (overlapZ) {
    const sx = Math.max(b.minX - a.maxX, a.minX - b.maxX);
    if (sx > 0) {
      const [west, east] = a.maxX <= b.minX ? [a, b] : [b, a];
      return {
        axis: 'x',
        rect: {
          minX: west.maxX, maxX: east.minX,
          minZ: Math.max(a.minZ, b.minZ), maxZ: Math.min(a.maxZ, b.maxZ),
        },
      };
    }
  }
  if (overlapX) {
    const sz = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ);
    if (sz > 0) {
      const [south, north] = a.maxZ <= b.minZ ? [a, b] : [b, a];
      return {
        axis: 'z',
        rect: {
          minX: Math.max(a.minX, b.minX), maxX: Math.min(a.maxX, b.maxX),
          minZ: south.maxZ, maxZ: north.minZ,
        },
      };
    }
  }
  return null;
}

/**
 * Is `rect` (a candidate corridor) already filled solid by `others`, so there
 * is no actual gap there for a player to enter?
 *
 * THE BODEGA CORNER'S OWN FALSE ALARM. Its 45° chamfer is approximated by a
 * staircase of abutting bands (`ct/bodega-corner.ts`) — each one flush with
 * its immediate neighbour, so consecutive bands never register a corridor at
 * all (their separation is exactly 0). But `trapAgainst` checks a box against
 * EVERY other collider, not only its immediate neighbour, and two bands three
 * or four steps apart in the same staircase — with solid bands from the SAME
 * wall already standing in every metre between them — measure a "gap" of
 * 0.5-0.75 m by the plain two-box test, which lands inside the trap band. The
 * corner lights up worst exactly where the staircase has the most bands,
 * which reads as "the geometry is worst here" when the geometry is fine and
 * the check is counting a wall as a hole in itself.
 *
 * `rect` is one axis wide (the gap) and one axis exact (the two boxes'
 * shared overlap) — see `corridorRect`. A collider "fills" part of it only if
 * it reaches all the way across the EXACT axis (the staircase case: every
 * band shares the same far edge), otherwise a box that merely clips a corner
 * of the gap would wrongly clear a corridor a capsule could still be wedged
 * into beside it. What remains is checked as an INTERVAL UNION along the gap
 * axis, not "does any single box cover it", because the staircase fills a
 * multi-band gap with several bands, no one of which spans it alone.
 */
function corridorFilled(rect: AABB, axis: 'x' | 'z', a: AABB, b: AABB, others: AABB[]): boolean {
  const alongX = axis === 'x';
  const segs: [number, number][] = [];
  for (const raw of others) {
    // identity on the ORIGINAL, geometry from the footprint: `footprint()`
    // hands back a fresh object for a turned box, so `raw === a` is the only
    // comparison that still means "this is one of the two boxes in question".
    if (raw === a || raw === b) continue;
    const o = footprint(raw);
    if (alongX) {
      // must reach exactly across rect's Z span to count
      if (o.minZ > rect.minZ + 1e-6 || o.maxZ < rect.maxZ - 1e-6) continue;
      const lo = Math.max(o.minX, rect.minX), hi = Math.min(o.maxX, rect.maxX);
      if (hi > lo) segs.push([lo, hi]);
    } else {
      if (o.minX > rect.minX + 1e-6 || o.maxX < rect.maxX - 1e-6) continue;
      const lo = Math.max(o.minZ, rect.minZ), hi = Math.min(o.maxZ, rect.maxZ);
      if (hi > lo) segs.push([lo, hi]);
    }
  }
  if (!segs.length) return false;
  segs.sort((p, q) => p[0] - q[0]);
  const [gapLo, gapHi] = alongX ? [rect.minX, rect.maxX] : [rect.minZ, rect.maxZ];
  if (segs[0][0] > gapLo + 1e-6) return false;   // does not start at the gap's own edge
  let covered = segs[0][1];
  for (let i = 1; i < segs.length; i++) {
    const [lo, hi] = segs[i];
    if (lo > covered + 1e-6) return false;       // a real hole in the union
    covered = Math.max(covered, hi);
  }
  return covered >= gapHi - 1e-6;
}

/** Does this box leave a trap against any of `others`? Returns the offending
 *  width, or null if every gap it makes is either passable or unenterable. */
export function trapAgainst(box: AABB, others: AABB[]): number | null {
  for (const o of others) {
    if (o === box) continue;
    const w = corridor(box, o);
    if (w === null || !isTrap(w)) continue;
    const found = corridorRect(box, o);
    if (found && corridorFilled(found.rect, found.axis, box, o, others)) continue;
    return w;
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
