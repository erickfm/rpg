import * as THREE from 'three';
import type { AABB } from '../fp';

// ── STANDING A MODULE ON A STREET IT WAS NOT AUTHORED FOR ────────────────────
//
// *"swap the used car lot and the college pls"* (2026-08-11), and that one
// sentence walks straight into the oldest unstated assumption in this world:
// **every module knows which way its street runs, and none of them says so.**
//
//   · `ct/street.ts`'s `openSite` cuts a hole with `XB = side * FACE` — it can
//     only open the MAIN street's east or west wall, never the side street's.
//   · `ct/lot.ts` reads `X0 = site.minX, X1 = site.maxX` and comments them
//     "street edge, back" — true for an east main-street site and false for
//     any other. 2790 lines hang off it: the aisle runs along x, the office is
//     at `X1 - …`, the fence is at `X0 + 0.18`, the back wall at `X1 - 0.08`.
//   · `ct/college-yard.ts` typed `X0 = 46, X1 = 57, WALK_Z = -110` and built
//     along x with its facade at low z.
//
// Rewriting either module to carry an axis is a rewrite of the module. The
// cheaper and safer move — and the one this codebase has made before, at
// `placeChurchEast` — is to **leave the module in the frame it was written for
// and turn the frame**. That worked for the church because `buildCivic` "only
// ever calls scene.add and registers nothing". The lot and the yard DO
// register: colliders, seats, ground, per-frame proximity. So a Group is not
// enough on its own, and this file is the missing half of it.
//
// A `SiteFrame` is a rigid placement: a yaw and an origin. `frameGroup` turns
// the geometry; `frameBox`, `frameSeatXZ` and `frameFromWorld` turn everything
// the module registers or asks about, in the same transform, so the collision
// the world holds is the collision you can see.
//
// ── WHY THE YAW IS A RIGHT ANGLE AND NOT ANY ANGLE ───────────────────────────
//
// `frameBox` maps an axis-aligned box by transforming its four corners and
// taking the extent. At a multiple of 90° that is EXACT: the box is the same
// box, turned. At any other angle it is a bounding box, i.e. bigger than the
// solid it describes, and a collider bigger than its mesh is the fault
// `cd7655e5` was written about, from the other side. Both streets here meet at
// a right angle, so nothing needs the general case — but say so, because the
// next caller will not measure it.

/** A rigid placement: local coordinates in, world coordinates out.
 *
 *  `world = R(rotY) · local + (ox, 0, oz)`, which is exactly what a
 *  `THREE.Group` with `rotation.y = rotY` and `position = (ox, 0, oz)` does to
 *  its children — so geometry needs no conversion at all, only the things a
 *  Group cannot reach.
 *
 *  `local` is the module's own site in its own frame. It is carried here
 *  because the published `Site` has to state WORLD bounds (the ground query in
 *  `crosstown.ts` tests them directly against the player's x/z) while the
 *  module filling it wants its own. Two different questions, one object. */
export interface SiteFrame {
  /** yaw, in radians. Keep it to a multiple of π/2 — see the note above. */
  rotY: number;
  ox: number;
  oz: number;
  /** the site in the FILLING MODULE's coordinates */
  local: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** local → world. */
export function frameToWorld(f: SiteFrame, x: number, z: number): [number, number] {
  const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
  return [x * c + z * s + f.ox, -x * s + z * c + f.oz];
}

/** world → local. The exact inverse: rotate by -rotY about the origin. */
export function frameFromWorld(f: SiteFrame, x: number, z: number): [number, number] {
  const dx = x - f.ox, dz = z - f.oz;
  const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
  return [dx * c - dz * s, dx * s + dz * c];
}

/** An axis-aligned box in local coordinates → the same box in world ones.
 *
 *  `maxY` and `minY` are carried through untouched: a `SiteFrame` never tips or
 *  lifts anything, so a collider capped at a wall's coping stays capped there.
 *  Getting THAT wrong is the "collision that goes to the moon" report. */
export function frameBox(f: SiteFrame, b: AABB): AABB {
  const c = [
    frameToWorld(f, b.minX, b.minZ), frameToWorld(f, b.minX, b.maxZ),
    frameToWorld(f, b.maxX, b.minZ), frameToWorld(f, b.maxX, b.maxZ),
  ];
  const xs = c.map((p) => p[0]), zs = c.map((p) => p[1]);
  return {
    ...b,
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minZ: Math.min(...zs), maxZ: Math.max(...zs),
  };
}

/** The Group a framed module builds into. Everything added to it lands in the
 *  world already turned, with no per-mesh arithmetic anywhere. */
export function frameGroup(f: SiteFrame): THREE.Group {
  const g = new THREE.Group();
  g.rotation.y = f.rotY;
  g.position.set(f.ox, 0, f.oz);
  return g;
}

/** A yaw declared in local terms, as the world will see it. Seats and any
 *  `rotation.y` computed OUTSIDE the group need this; anything inside the
 *  group already has it applied by the group itself. */
export function frameYaw(f: SiteFrame, yaw: number): number {
  return yaw + f.rotY;
}

// ── THE USED CAR LOT'S SIDE-STREET SITE ──────────────────────────────────────
//
// Written here, once, because THREE files need it and no two of them may
// import each other:
//
//   · `ct/street.ts` cuts the hole and publishes the site.
//   · `ct/college-yard.ts` re-exports `COLLEGE_FACE_Z` off the back of it —
//     `crosstown.ts:1303` derives `WORLD_BOUNDS.minZ` from that import, and
//     `crosstown.ts` is the trunk and not a builder's to edit. The name is now
//     a lie (the college is on the main street and this is the lot's back
//     fence) and it should be renamed when the trunk is next open. It is
//     load-bearing: the walk clamp is the only thing that stops the player
//     leaving the world at the south, and if it does not follow the lot's back
//     wall you get *"i cant walk into …"* for the third time.
//   · `ct/lot.ts` fills it.
//
// x 46 … 57 is the 11 m the COMMUNITY COLLEGE stood on, and 57 is the plane
// both side-street rosters end on — the jail's site begins there. z -110 is the
// side street's south building line (`placeBldZ(xs, -111.7, b, 1)` puts the
// facade 1.7 out from -111.7).
//
// TWENTY METRES DEEP, against 23.2 on the main street. The depth is free here
// in a way the frontage is not: the roster's 11 m is fixed by two run totals,
// but nothing stands behind the side street's south row, so the lot takes the
// depth it needs to still be a lot. `ct/lot.ts` sizes its bays off it —
// `BAYS = floor((BAY_X1 - BAY_X0) / 2.7)` gives four at this depth.
// ── AND THE MOUTH IS OFF-CENTRE, BECAUSE ELEVEN METRES SAYS SO ───────────────
//
// The lot's plan is a drive aisle straight in from the street with stock
// flanking it — the user described it, so it is theirs — and it needs
// 6.8 + 2 x 4.3 = 15.4 m across the frontage to hold two rows. It has 11.
// So the narrow lot runs ONE row, the aisle hugs the high end of the frontage,
// and the mouth has to be where the aisle is or you drive into the fence.
//
// `openSite` takes the fractions off each end independently for exactly this.
// The low end keeps 4.1 m of boundary wall with chain-link on it; the high end
// keeps a gate post and nothing else, because there is no frontage left to
// spend there. That is what a lot squeezed against a corner looks like.
export const SIDE_LOT = {
  X0: 46, X1: 57,
  /** the side street's south building line */
  WALK_Z: -110,
  DEPTH: 20,
  /** fraction of the frontage the boundary wall keeps at each end. Read by
   *  `openSite` (the wall) and by `ct/lot.ts` (the chain-link that rides on it
   *  and the aisle that has to fit between them) — one pair of numbers, or the
   *  fence crosses the gate. */
  GATE_LO: 0.40,
  GATE_HI: 0.04,
  /** How far the site is held back from its own east property line at x 57.
   *
   *  THE JAIL IS ON THE OTHER SIDE OF THAT LINE, and this is the join
   *  `cd7655e5` was written about, from the other end. `openSite` puts a
   *  flank's BODY behind its plane — *"a party wall's thickness belongs to the
   *  building that is gone"* — which is right when the neighbour is a building
   *  and wrong here: the jail sits back behind a 4 m forecourt (`ct/jail.ts`,
   *  `FX = site.minX + FORE`), so x 57…57.5 is open paving, and an unshifted
   *  flank would stand a 13.6 m wall in it and fight the jail's own forecourt
   *  screen for the corner at (57, -110).
   *
   *  Held back by its own thickness instead, the wall occupies 56.5…57 —
   *  which is the college's old east party wall's footprint EXACTLY. The two
   *  buildings share the corner edge and no face area, the jail owns x ≥ 57 and
   *  z ≥ -110, the lot owns x ≤ 57 and z ≤ -110, and the join follows if either
   *  of them moves. */
  FLANK_T: 0.5,
} as const;

/** The lot's mouth in world x — the gap between the two boundary-wall runs, and
 *  therefore the only place a car can get in.
 *
 *  `ct/tex-ground.ts` cuts the kerb here and lays the worn tarmac here, and
 *  `openSite` builds the wall either side of it. Both used to type their own
 *  copy of the old main-street opening; the kerb-cut list even carried a
 *  comment naming itself the one line to follow if the aisle moved, and it did
 *  not follow it. One derivation now. */
export const SIDE_LOT_MOUTH = (() => {
  const W = SIDE_LOT.X1 - SIDE_LOT.X0 - SIDE_LOT.FLANK_T;
  return { x0: SIDE_LOT.X0 + W * SIDE_LOT.GATE_LO, x1: SIDE_LOT.X1 - SIDE_LOT.FLANK_T - W * SIDE_LOT.GATE_HI };
})();

/** The world's south walk bound: the lot's back fence, plus the wall's own
 *  half-thickness so you cannot stand inside it. */
export const SOUTH_WALK_BOUND_Z = SIDE_LOT.WALK_Z - SIDE_LOT.DEPTH - 0.5;
