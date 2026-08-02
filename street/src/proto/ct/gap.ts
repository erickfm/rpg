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

// ── TURNED BOXES ARE MEASURED IN THEIR OWN FRAME ───────────────────────────
//
// EVERY min/max IN THIS FILE USED TO BE READ AS A WORLD COORDINATE, and for a
// box with a `rot` (`AABB.rot`, fp.ts) they are not: they are its extents in
// its OWN frame. Handed one of those raw, the corridor tests did not
// approximate the answer, they computed a different box's answer. The bodega's
// chamfer, turned 45°, has local `maxX` 9.914 while its real east corner
// reaches x = 10.0; against the wing shopfront's face at 10.4 that is the
// difference between a 0.486 m corridor and a 0.4 m one — the first inside the
// trap band, the second not. The overlay painted a wall red for a slot made of
// brick.
//
// w24 fixed that with a BOUNDING BOX: the smallest world-axis rectangle
// containing the turned box. That is exact for every WORLD-AXIS question — a
// rotated rectangle's bounding box touches its own corners, so its X and Z
// extents are the box's true X and Z extents — and it removed the false red.
// What it cannot see is the box's OWN axes, and that is where a slot between
// two turned boxes actually runs. w24 named it as the thing to fix before a
// second turned collider existed (notes/archive/w24-collider-rotation.md,
// finding 2), and this is that fix:
//
// · The corridor width is a SEPARATING-AXIS test over both boxes' own axes.
//   For an axis-aligned pair the candidate axes ARE world X and Z, so the test
//   reduces to the arithmetic below — and to keep that identity beyond doubt
//   rather than by argument, an unrotated pair still takes the ORIGINAL
//   expressions, untouched, on an explicit branch. `nudgeClear` decides where
//   parked cars stand; the drawn world must not move by a float.
// · Clearing a corridor (`corridorFilled`) needs 2-D coverage once the slot is
//   turned. The oriented path does the same interval union in the CORRIDOR's
//   frame, and refuses to let a filler count unless that filler is square to
//   that frame — where a projection is exact coverage. A filler at some other
//   angle is skipped, which can only leave a corridor UNCLEARED, i.e. it can
//   only over-report red, never hide a trap. That is the direction this
//   project's own history says to err in.

type Vec = { x: number; z: number };
const AXIS_X: Vec = { x: 1, z: 0 }, AXIS_Z: Vec = { x: 0, z: 1 };

/** The box's own axes in WORLD directions. Same convention as `fp.ts`'s
 *  `inFrame`, read off it rather than re-derived: `inFrame` maps world→local
 *  by [[k,-s],[s,k]], so local→world is its transpose and the box's local +x
 *  is (k, −s), its local +z is (s, k). Getting this backwards is a 90° error
 *  that looks plausible in every symmetric test case. */
function axesOf(c: AABB): [Vec, Vec] {
  if (!c.rot) return [AXIS_X, AXIS_Z];
  const s = Math.sin(c.rot), k = Math.cos(c.rot);
  return [{ x: k, z: -s }, { x: s, z: k }];
}

/** `c` projected onto unit axis `n`, as [lo, hi]. Exact for a turned box: a
 *  box's extent along any direction is the sum of each half-extent times the
 *  size of its own axis's component along it. */
function project(c: AABB, n: Vec): [number, number] {
  const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
  const hx = (c.maxX - c.minX) / 2, hz = (c.maxZ - c.minZ) / 2;
  const [ax, az] = axesOf(c);
  const mid = cx * n.x + cz * n.z;
  const ext = hx * Math.abs(ax.x * n.x + ax.z * n.z)
            + hz * Math.abs(az.x * n.x + az.z * n.z);
  return [mid - ext, mid + ext];
}

/** Is `c` square to a frame built on `n`? Only then does projecting it onto
 *  that frame describe the region it actually covers, rather than the shadow
 *  of a diagonal sliver. */
function squareTo(c: AABB, n: Vec): boolean {
  const [ax] = axesOf(c);
  const d = Math.abs(ax.x * n.x + ax.z * n.z);
  return d < 1e-6 || d > 1 - 1e-6;
}

/** `c` in WORLD axes, exactly — or `null` when it is turned off them, where no
 *  axis-aligned rectangle describes what it covers. An unrotated box is
 *  returned unchanged, the same object, so the axis-aligned world takes the
 *  arithmetic it always did down to object identity. */
function worldBox(c: AABB): AABB | null {
  if (!c.rot) return c;
  if (!squareTo(c, AXIS_X)) return null;
  const [x0, x1] = project(c, AXIS_X), [z0, z1] = project(c, AXIS_Z);
  return { minX: x0, maxX: x1, minZ: z0, maxZ: z1 };
}

/** The box's four corners, wound into a ring. */
function corners(c: AABB): [number, number][] {
  const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
  const hx = (c.maxX - c.minX) / 2, hz = (c.maxZ - c.minZ) / 2;
  const [ax, az] = axesOf(c);
  const at = (sx: number, sz: number): [number, number] =>
    [cx + sx * hx * ax.x + sz * hz * az.x, cz + sx * hx * ax.z + sz * hz * az.z];
  return [at(-1, -1), at(-1, 1), at(1, 1), at(1, -1)];
}

/** distance from point `p` to segment `a`–`b` */
function ptSeg(p: [number, number], a: [number, number], b: [number, number]): number {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const len2 = vx * vx + vz * vz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / len2));
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vz));
}

/**
 * The true clearance between two disjoint boxes — the smallest distance
 * between any point of one and any point of the other.
 *
 * WHY THIS EXISTS AND THE SEPARATING AXIS DOES NOT SUFFICE. A separation
 * measured along an axis is only the real clearance when the two boxes meet
 * face to face along it. Where a turned box presents a CORNER to a flat face,
 * the axis separation is the shadow of a diagonal and is too small — I shipped
 * that for one commit, and a property test over 4000 random pairs put the
 * worst case at 0.634 m of understatement. Understating is the safe direction
 * (a wide gap reads as a trap, never the reverse) but it is still a phantom,
 * and phantom red on a wall is the exact bug this item exists to prevent.
 *
 * For two convex polygons the closest pair is always vertex-to-edge, so
 * checking every vertex of each against every edge of the other is exact. That
 * is 32 point-segment distances for a pair of rectangles, on a path only taken
 * when a box is actually turned.
 */
function clearance(a: AABB, b: AABB): number {
  const A = corners(a), B = corners(b);
  let best = Infinity;
  for (let i = 0; i < 4; i++) {
    const a0 = A[i], a1 = A[(i + 1) % 4], b0 = B[i], b1 = B[(i + 1) % 4];
    for (let j = 0; j < 4; j++) {
      best = Math.min(best, ptSeg(B[j], a0, a1), ptSeg(A[j], b0, b1));
    }
  }
  return best;
}

/**
 * The corridor between two boxes when at least one is turned: the slot they
 * face each other across, and the frame it runs in.
 *
 * A candidate axis `n` gives a corridor when the boxes are SEPARATED along it
 * and their extents still OVERLAP along its perpendicular `m` — the same two
 * conditions the axis-aligned test uses, stated without assuming n is world X
 * or Z. Both axes of both boxes are tried, which is the standard separating-
 * axis candidate set for two rectangles in 2-D.
 *
 * THE AXES DECIDE WHETHER THERE IS A CORRIDOR; `clearance` says HOW WIDE.
 * Those are two different questions and answering both with the separation
 * along one axis is what made my first two attempts wrong:
 *
 * · Taking the NARROWEST qualifying separation reports a phantom. Two bars
 *   turned 45°, 2 m apart along world X, are 1.214 m apart in reality while
 *   their world-X separation is 0.444 m — inside the trap band, and measured
 *   between two corners 1.6 m from each other.
 * · Taking the widest is better but still not the clearance: where a turned
 *   box presents a CORNER to a flat face, every axis understates it. Worst
 *   case over 4000 random pairs, 0.634 m.
 *
 * So the axis test is kept for what it is good at — deciding that the two
 * boxes FACE each other rather than sitting diagonally, and naming the frame
 * the slot runs in, which `orientedFilled` needs — and the width comes from
 * the geometry. For an axis-aligned pair at most one axis can ever qualify
 * (separated on X forbids overlapping on X) and the clearance along it is the
 * separation, so the reduction to today's answer is exact.
 */
function orientedCorridor(a: AABB, b: AABB): { w: number; n: Vec; m: Vec } | null {
  let best: { w: number; n: Vec; m: Vec } | null = null;
  for (const c of [a, b]) {
    const [ax, az] = axesOf(c);
    for (const [n, m] of [[ax, az], [az, ax]] as [Vec, Vec][]) {
      const [a0, a1] = project(a, n), [b0, b1] = project(b, n);
      const sep = Math.max(b0 - a1, a0 - b1);
      if (!(sep > 0)) continue;
      const [p0, p1] = project(a, m), [q0, q1] = project(b, m);
      if (!(Math.min(p1, q1) - Math.max(p0, q0) > 0)) continue;
      if (!best || sep > best.w) best = { w: sep, n, m };
    }
  }
  return best && { w: clearance(a, b), n: best.n, m: best.m };
}

/** Is the oriented corridor between `a` and `b` already solid? The interval
 *  union of `corridorFilled`, done in the corridor's own frame. */
function orientedFilled(a: AABB, b: AABB, others: AABB[]): boolean {
  const found = orientedCorridor(a, b);
  if (!found) return false;
  const { n, m } = found;
  const [a0, a1] = project(a, n), [b0, b1] = project(b, n);
  const [gapLo, gapHi] = b0 - a1 >= a0 - b1 ? [a1, b0] : [b1, a0];
  const [p0, p1] = project(a, m), [q0, q1] = project(b, m);
  const crossLo = Math.max(p0, q0), crossHi = Math.min(p1, q1);

  const segs: [number, number][] = [];
  for (const o of others) {
    if (o === a || o === b) continue;
    if (!squareTo(o, n)) continue;              // conservative: cannot clear with it
    const [o0, o1] = project(o, m);
    if (o0 > crossLo + 1e-6 || o1 < crossHi - 1e-6) continue;   // must reach across
    const [r0, r1] = project(o, n);
    const lo = Math.max(r0, gapLo), hi = Math.min(r1, gapHi);
    if (hi > lo) segs.push([lo, hi]);
  }
  if (!segs.length) return false;
  segs.sort((p, q) => p[0] - q[0]);
  if (segs[0][0] > gapLo + 1e-6) return false;
  let covered = segs[0][1];
  for (let i = 1; i < segs.length; i++) {
    const [lo, hi] = segs[i];
    if (lo > covered + 1e-6) return false;
    covered = Math.max(covered, hi);
  }
  return covered >= gapHi - 1e-6;
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
export function corridor(a: AABB, b: AABB): number | null {
  // THE UNROTATED PAIR TAKES THE ORIGINAL EXPRESSIONS. `orientedCorridor`
  // computes the same answer for it, but "the same" through a different chain
  // of floating-point operations is not the same, and `nudgeClear` turns this
  // number into where a parked car stands. An explicit branch is the only way
  // to say "the drawn world cannot move" and be believed.
  if (a.rot || b.rot) {
    const found = orientedCorridor(a, b);
    return found ? found.w : null;
  }
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
function corridorRect(a: AABB, b: AABB): { rect: AABB; axis: 'x' | 'z' } | null {
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
    // identity on the ORIGINAL, geometry from `worldBox`: it hands back a
    // fresh object for a turned box, so `raw === a` is the only comparison
    // that still means "this is one of the two boxes in question".
    if (raw === a || raw === b) continue;
    const o = worldBox(raw);
    // A box turned off the world axes cannot CLEAR an axis-aligned corridor:
    // its bounding rectangle covers ground it does not, and believing that
    // would clear a slot a body still fits into. Skipping it can only leave a
    // corridor reported — the safe direction, and the same refusal
    // `orientedFilled` makes in the corridor's own frame.
    if (!o) continue;
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
    // Same two questions either way — how wide is the slot, and is anything
    // already standing in it — asked in world axes when they are the boxes'
    // axes, and in the corridor's own frame when they are not.
    if (box.rot || o.rot) {
      if (orientedFilled(box, o, others)) continue;
    } else {
      const found = corridorRect(box, o);
      if (found && corridorFilled(found.rect, found.axis, box, o, others)) continue;
    }
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
