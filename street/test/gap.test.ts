// gap.ts is pure geometry, so it is the one thing in this project that can be
// checked without a browser, a port or a frame. Everything here is arithmetic
// with a known right answer.
//
// THE POINT OF THIS FILE is the turned-box section. `trapAgainst` decides where
// the V overlay paints red and where `nudgeClear` will not park a car, and it
// spent its life reading a turned box's `minX/maxX` as world coordinates — then,
// after w24, as a bounding rectangle. The first was wrong; the second is exact
// per world axis but blind to the box's OWN axes, which is where a slot between
// two turned boxes actually runs.
import { describe, expect, it } from 'vitest';
import { corridor, isTrap, nudgeClear, trapAgainst, ENTERABLE, PASSABLE } from '../src/proto/ct/gap';
import type { AABB } from '../src/proto/fp';

/** a box by centre and half-extents, so the turned cases read as geometry */
const box = (cx: number, cz: number, hx: number, hz: number, rot?: number): AABB =>
  ({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz, ...(rot ? { rot } : {}) });

const D45 = Math.PI / 4;

describe('the axis-aligned world, which must not move', () => {
  it('measures a slot between two boxes that face each other', () => {
    const a = box(0, 0, 0.5, 0.5), b = box(1.6, 0, 0.5, 0.5);
    expect(corridor(a, b)).toBeCloseTo(0.6, 12);
    expect(isTrap(corridor(a, b)!)).toBe(true);
  });

  it('is not fooled by boxes merely diagonal to each other', () => {
    // no shared span on either axis: you can always leave the way you came in
    expect(corridor(box(0, 0, 0.5, 0.5), box(1.6, 1.6, 0.5, 0.5))).toBe(null);
  });

  it('calls a wide gap passable and a hairline gap unenterable', () => {
    expect(isTrap(PASSABLE + 0.01)).toBe(false);
    expect(isTrap(ENTERABLE - 0.01)).toBe(false);
    expect(isTrap((ENTERABLE + PASSABLE) / 2)).toBe(true);
  });

  it('clears a corridor that other boxes already fill solid', () => {
    // the staircase case: two boxes 0.6 apart, with the space between them
    // packed by bands that each reach right across it
    const a = box(0, 0, 0.5, 0.5), b = box(1.6, 0, 0.5, 0.5);
    const fill = [box(0.65, 0, 0.15, 0.5), box(0.95, 0, 0.15, 0.5)];
    expect(trapAgainst(a, [a, b])).toBeCloseTo(0.6, 12);
    expect(trapAgainst(a, [a, b, ...fill])).toBe(null);
  });

  it('does NOT clear a corridor whose filling has a hole in it', () => {
    const a = box(0, 0, 0.5, 0.5), b = box(1.6, 0, 0.5, 0.5);
    const holed = [box(0.65, 0, 0.15, 0.5), box(1.15, 0, 0.15, 0.5)];  // 0.2 gap
    expect(trapAgainst(a, [a, b, ...holed])).toBeCloseTo(0.6, 12);
  });

  it('nudgeClear leaves a legal offset exactly where it was drawn', () => {
    const others = [box(3, 0, 0.5, 0.5)];
    const r = nudgeClear(0, (o) => box(o, 0, 0.5, 0.5), others);
    expect(r).toEqual({ at: 0, moved: 0, ok: true });
  });

  it('nudgeClear steps a trapping offset to the nearest legal one', () => {
    const others = [box(1.6, 0, 0.5, 0.5)];
    const r = nudgeClear(0, (o) => box(o, 0, 0.5, 0.5), others);
    expect(r.ok).toBe(true);
    expect(trapAgainst(box(r.at, 0, 0.5, 0.5), others)).toBe(null);
  });
});

describe('turned boxes are measured in their own frame', () => {
  // Two parallel bars turned 45°, centres 2 m apart along world X. Each is
  // 2.0 long and 0.2 thick, lying NW–SE.
  //
  // Their real separation is perpendicular to the bars: centre offset (2,0)
  // projected onto the bars' cross-axis (√2/2, √2/2) is 1.41421, less the two
  // half-thicknesses, = 1.21421 m. Wide open.
  //
  // Their WORLD-X separation is 0.44437 — measured between T1's east corner
  // and T2's west corner, two points 1.6 m apart from each other — and it
  // lands squarely inside the 0.40–0.95 trap band. That is the phantom this
  // item exists to stop, and it is what a world-axis reading reports.
  const T1 = box(0, 0, 1.0, 0.1, D45);
  const T2 = box(2, 0, 1.0, 0.1, D45);

  it('the phantom is real: the world-X separation IS in the trap band', () => {
    const halfSpanX = (1.0 + 0.1) * Math.SQRT1_2;          // 0.77782
    const worldXSep = (2 - halfSpanX) - halfSpanX;
    expect(worldXSep).toBeCloseTo(0.44437, 5);
    expect(isTrap(worldXSep)).toBe(true);                  // ← what we must not report
  });

  it('reports the true perpendicular gap instead, and it is passable', () => {
    const w = corridor(T1, T2)!;
    expect(w).toBeCloseTo(2 * Math.SQRT1_2 - 0.2, 10);     // 1.21421
    expect(isTrap(w)).toBe(false);
  });

  it('so a second turned collider raises NO phantom trap', () => {
    expect(trapAgainst(T1, [T1, T2])).toBe(null);
    expect(trapAgainst(T2, [T1, T2])).toBe(null);
  });

  it('but a GENUINE trap beside a turned box is still caught', () => {
    // slide the second bar in until the perpendicular gap is 0.6 m: that is
    // a real slot between two real faces, and it must go red.
    const want = 0.6, d = (want + 0.2) * Math.SQRT2;       // centre offset along X
    const near = box(d, 0, 1.0, 0.1, D45);
    expect(corridor(T1, near)).toBeCloseTo(want, 10);
    expect(trapAgainst(T1, [T1, near])).toBeCloseTo(want, 10);
  });

  it('and a turned box against an axis-aligned wall is exact', () => {
    // the chamfer's own shape: a 45° bar with a plain wall to its east.
    // The bar's extreme corner sits at x = (1.0 + 0.1)/√2 = 0.77782, so a wall
    // face at x = 1.4 leaves 0.62218 m — a trap, and a real one.
    const wall = box(2.4, 0, 1.0, 4.0);                    // face at x = 1.4
    const w = corridor(T1, wall)!;
    expect(w).toBeCloseTo(1.4 - (1.1 * Math.SQRT1_2), 10);
    expect(isTrap(w)).toBe(true);
    expect(trapAgainst(T1, [T1, wall])).toBeCloseTo(w, 10);
  });

  it('a rot of 0 is the identity, not merely close to it', () => {
    // `rot: 0` is falsy, so it takes the unrotated branch by construction —
    // this pins that the two branches agree on the same geometry.
    const a = box(0, 0, 0.5, 0.5), b = box(1.6, 0, 0.5, 0.5);
    const turnedByNothing = { ...a, rot: 1e-300 };
    expect(corridor(turnedByNothing, b)).toBeCloseTo(corridor(a, b)!, 12);
  });

  it('a quarter turn is the same box, and reads the same', () => {
    // a square turned 90° is itself; a corridor against it must not move
    const sq = box(0, 0, 0.5, 0.5);
    const turned = box(0, 0, 0.5, 0.5, Math.PI / 2);
    const b = box(1.6, 0, 0.5, 0.5);
    expect(corridor(turned, b)).toBeCloseTo(corridor(sq, b)!, 12);
  });

  it('an oriented corridor can still be cleared by a filler square to it', () => {
    // two 45° bars 0.6 m apart, with a third bar at the SAME angle lying in
    // the slot between them: solid brick, not a trap.
    const want = 0.6, d = (want + 0.2) * Math.SQRT2;
    const near = box(d, 0, 1.0, 0.1, D45);
    expect(trapAgainst(T1, [T1, near])).toBeCloseTo(want, 10);
    const filler = box(d / 2, 0, 1.0, want / 2, D45);
    expect(trapAgainst(T1, [T1, near, filler])).toBe(null);
  });

  it('and is NOT cleared by a filler at some other angle', () => {
    // the conservative refusal: a box turned off the corridor's frame has a
    // projection that covers ground it does not, so it may not clear a slot.
    const want = 0.6, d = (want + 0.2) * Math.SQRT2;
    const near = box(d, 0, 1.0, 0.1, D45);
    const skew = box(d / 2, 0, 1.0, want / 2, D45 + 0.3);
    expect(trapAgainst(T1, [T1, near, skew])).toBeCloseTo(want, 10);
  });
});

// ── the property, checked against geometry rather than against my arithmetic ──
//
// EVERY CASE ABOVE IS ONE I CHOSE, and cases I choose share my blind spots.
// I had `orientedCorridor` taking the NARROWEST qualifying separation instead
// of the widest — a real error, reasoned out and wrong — and all sixteen of the
// hand-written cases above passed with it, because in each of them only one
// axis ever qualifies and widest and narrowest are the same number.
//
// So this asks the question directly instead: over a few thousand random
// pairs, whenever `corridor` reports a slot, is that number the actual
// distance between the two rectangles? The right-hand side is exact
// polygon-polygon distance, computed from the corners with no reference to
// anything in gap.ts. It disagrees with narrowest on ~4% of pairs.

/** the four corners of a box, in world coordinates */
function corners(c: AABB): [number, number][] {
  const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
  const hx = (c.maxX - c.minX) / 2, hz = (c.maxZ - c.minZ) / 2;
  const s = c.rot ? Math.sin(c.rot) : 0, k = c.rot ? Math.cos(c.rot) : 1;
  const ax = { x: k, z: -s }, az = { x: s, z: k };
  const out: [number, number][] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    out.push([cx + sx * hx * ax.x + sz * hz * az.x, cz + sx * hx * ax.z + sz * hz * az.z]);
  }
  return [out[0], out[1], out[3], out[2]];      // wind them into a ring
}

/** distance from point p to segment ab */
function ptSeg(p: [number, number], a: [number, number], b: [number, number]): number {
  const vx = b[0] - a[0], vz = b[1] - a[1];
  const len2 = vx * vx + vz * vz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / len2));
  const dx = p[0] - (a[0] + t * vx), dz = p[1] - (a[1] + t * vz);
  return Math.hypot(dx, dz);
}

/** exact distance between two disjoint convex polygons */
function polyDist(A: [number, number][], B: [number, number][]): number {
  let best = Infinity;
  for (const [P, Q] of [[A, B], [B, A]] as [typeof A, typeof B][]) {
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      for (const q of Q) best = Math.min(best, ptSeg(q, a, b));
    }
  }
  return best;
}

describe('the reported corridor IS the distance between the boxes', () => {
  it('agrees with exact polygon geometry on thousands of random turned pairs', () => {
    let rng = 20260802;                                    // fixed seed: a failure is reproducible
    const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const rndBox = () => box((rnd() - 0.5) * 8, (rnd() - 0.5) * 8,
      0.15 + rnd() * 1.5, 0.15 + rnd() * 1.5, rnd() * Math.PI);

    let checked = 0, worst = 0;
    for (let i = 0; i < 4000; i++) {
      const a = rndBox(), b = rndBox();
      const w = corridor(a, b);
      if (w === null) continue;
      const truth = polyDist(corners(a), corners(b));
      worst = Math.max(worst, Math.abs(w - truth));
      checked++;
    }
    expect(checked).toBeGreaterThan(500);                  // the loop must not be vacuous
    expect(worst).toBeLessThan(1e-9);
  });
});
