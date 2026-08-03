import * as THREE from 'three';
import type { AABB } from '../fp';
import { pixTex, dither } from './paint';

// ---- the fleet: sedan / hatch / pickup / van, welded greenhouses ---------
// front is -z. The slab carries doors + arches; the greenhouse is ONE
// BufferGeometry loft (windshield, roof, rear glass, trapezoid side windows
// all share vertices — no gaps, ever). Era bonus: trapezoid side-window UVs
// shear the texture exactly like affine mapping used to.

export const CAR_COLORS = ['#7a8a5c', '#8a5a5a', '#5a6a8a', '#8a825a', '#6a5a7a', '#4a5a52'];
export type CarKind = 'sedan' | 'hatch' | 'pickup' | 'van';

// Body length + rear wheel offset per kind, in car-local metres (front is
// -z). Hoisted out of `makeCar` and exported so `PICKUP_BED` below — and any
// future caller that needs a real vehicle dimension — reads the ONE table
// rather than a second hand-typed copy of `4.9`.
export const CAR_SPEC: Record<CarKind, { len: number; wheelZ: number }> = {
  sedan: { len: 4.5, wheelZ: 1.45 },
  hatch: { len: 3.8, wheelZ: 1.2 },
  pickup: { len: 4.9, wheelZ: 1.65 },
  van: { len: 4.6, wheelZ: 1.5 },
};

/** ── THE COLLISION SKIN, AND THE ONLY NUMBER ANYONE SHOULD TYPE ──────────
 *
 *  Every vehicle collider in this world is its body plus a uniform 0.15 m of
 *  slack. It is deliberate and it has shipped since item 1 — crosstown.ts's
 *  item-29 block calls it *"the SAME 0.15 m collision skin the bed floor has
 *  shipped with since item 1"*.
 *
 *  It is hoisted here because the LENGTH it produces was a hand-typed table,
 *  and it was typed TWICE, identically, in two different files:
 *
 *      crosstown.ts:516   const carHalf = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 }
 *      sidestreet.ts:122  const carHalf = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 }
 *
 *  Every entry is exactly `CAR_SPEC[kind].len / 2 + 0.15`, so both tables were
 *  a second hand-written copy of a number `CAR_SPEC` already owns — BUILDER-
 *  BRIEF §8's single most expensive habit, and the reason the shipped boxes
 *  were 0.18-0.29 m longer than the bodies they wrapped with nothing tying
 *  the two together. Both tables are gone; this is the derivation. */
export const CAR_SKIN = 0.15;
/** The half-WIDTH every vehicle collider in the world has carried: the 1.8 m
 *  body slab plus the same skin on each side, hence the ±1.05 that
 *  `crosstown.ts` and `sidestreet.ts` both wrote out by hand. */
export const CAR_HALF_W = 0.9 + CAR_SKIN;
/** Half the collider's length for a kind — the body's own half-length plus the
 *  skin. This replaces both `carHalf` tables. */
export function carHalfLen(kind: CarKind): number {
  return CAR_SPEC[kind].len / 2 + CAR_SKIN;
}

/** The pickup's open bed, in the vehicle's own LOCAL frame (front is -z).
 *  Exported so the world's collider system can build a standable-top box
 *  from the SAME numbers the mesh below uses, rather than a second hand-typed
 *  copy that could drift from it (BUILDER-BRIEF §8: derive, never retype).
 *  `z0`/`gateT`/`halfW`/`floorY` mirror `BED_Z0`, `GATE_T`, `HW` and
 *  `FLOOR_T` in the pickup branch of `makeCar`, which now READ these fields
 *  rather than restate them; `half` mirrors `CAR_SPEC.pickup.len / 2`.
 *
 *  `floorY` (0.50 m) is the one flat surface on the whole fleet a standing
 *  jump can gain from the street. Every other flat top is taller: the door
 *  line (BELT 0.84), the hoods (0.94), the roofs (1.4-1.8). That is why the
 *  bed floor is the surface this project made standable first
 *  (notes/w13-collider-volume.md).
 *
 *  ITEM 1 SAID "UNDER THE JUMP'S OWN APEX (~0.57 m)" HERE, AND THAT IS NOT
 *  WHY IT WORKS. 0.571 m is the apex of the CONTINUOUS system; measured, the
 *  world gives 0.471 m at `main.ts`'s dt clamp and 0.538 m at 60 fps
 *  (scripts/probes/w21-apex.mjs). **0.50 m is ABOVE the worst-case apex**, and
 *  the hop off the road only lands because `standTop` credits a surface from
 *  `TOP_EPS` (0.08 m) below it — a 51 mm margin off flat road, 191 mm off the
 *  kerb. The conclusion survived; the reason did not. Anything picked against
 *  "0.571" from here on is picked against a number this engine never reaches.
 *  (w21, item 29.) */
export const PICKUP_BED = {
  half: CAR_SPEC.pickup.len / 2,   // 2.45 — the mesh's own half-length
  z0: 0.55,                        // BED_Z0 — bed front, behind the cab
  gateT: 0.10,                     // GATE_T — tailgate thickness
  halfW: 0.9,                      // HW — the tub's inner half-width
  floorY: 0.50,                    // FLOOR_T — the floor's top surface
  railY: 0.97,                     // RAIL_T — the bed WALL's top face
  wallT: 0.16,                     // WALL_T — how thick that wall is
};

/** The body's own vertical extent, shared by all four kinds — rocker to
 *  beltline — plus the hood slab that sits ON the belt. Hoisted to module
 *  scope (they were locals in `makeCar`) so `HOOD_TOP` below is the SAME
 *  number the hood mesh is positioned from, and so a collider built from it
 *  cannot drift from the panel it describes. */
const ROCKER = 0.34, BELT = 0.84;
/** The hood/boot slab's thickness. It sits ON the belt, so its centre is
 *  `BELT + HOOD_T / 2` and its top face is `HOOD_TOP`. */
const HOOD_T = 0.10;

/** A ROAD WHEEL, PHASED SO IT STANDS ON A VERTEX AND NOT ON A FLAT.
 *
 *  **This is the fix for item 252, and it is one argument.** A
 *  `CylinderGeometry(r, r, w, N)` is an N-gon, not a circle. With the default
 *  `thetaStart` of 0 and an even N, laying it on its side puts the middle of a
 *  FLAT at the bottom — so the tyre only reaches down by the apothem
 *  `r·cos(π/N)`, while every caller seats the hub at `ground + r` because that
 *  is what a circle would need. The difference is the whole defect:
 *
 *      car tyre  r 0.34, 10-gon:  0.34 − 0.34·cos(π/10) = **16.6 mm** of air
 *      bus tyre  r 0.44, 10-gon:  0.44 − 0.44·cos(π/10) = **21.5 mm** of air
 *
 *  Measured, not reasoned: 83 car tyres and 4 bus tyres, one figure each, no
 *  spread (`scripts/probes/w98-wheels.mjs`, `scripts/probes/w99-tyre-seating.mjs`).
 *
 *  **Why phase and not position.** The three other ways to land the tyre all
 *  cost something this one does not:
 *
 *    · drop the wheel to `ground + apothem` — contact, but the tyre's TOP falls
 *      to 0.6468 with it, and the top is the tyre's only load-bearing number
 *      (see `userData.tyre`). Half the margin, spent on 16 mm.
 *    · drop the whole car 16.6 mm — same loss, and it drags the sill, the arch
 *      and every collider in `crosstown.ts` down with it.
 *    · grow r to `0.34 / cos(π/10)` so the apothem lands at 0.34 — works, but
 *      it is a 5 % bigger wheel, and `ARCH_HW`'s clearance was tuned against
 *      0.34 (see the arch note in `makeCar`).
 *
 *  Half a segment of phase moves NO position and NO dimension. It puts a vertex
 *  at the bottom — and, N being even, another at the top, so the tyre reaches
 *  down by exactly `r` and up by exactly `r`. The gap closes to 0 **and** the
 *  top rises from `r + r·cos(π/N)` to `2r`. `userData.tyre` becomes true in both
 *  directions instead of only across the axis.
 *
 *  The world already contained the proof: the trailer's wheels
 *  (`crosstown.ts`) are the only pair that measured `gap 0.0000`, and the reason
 *  is that they happen to be phased onto a vertex.
 *
 *  **`Math.PI / segs`, derived — never a typed 0.314.** Half a segment is
 *  `(2π/segs)/2`. Change `segs` and the phase follows; a hand-typed constant
 *  would silently go stale, which is the single most expensive habit in this
 *  file (BUILDER-BRIEF §8). */
export function tyreGeo(r: number, width: number, segs: number): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(r, r, width, segs, 1, false, Math.PI / segs);
}

/**
 * A VEHICLE TEXTURE, at this world's filtering. Hoisted to module scope for
 * `fleetWheelMats` below; `makeCar` and `makeBus` both had their own private
 * copy of these four lines and now both delegate to this one.
 */
export function flatTex(m: THREE.Texture): THREE.MeshBasicMaterial {
  m.minFilter = THREE.NearestFilter;
  m.generateMipmaps = false;
  m.needsUpdate = true;
  return new THREE.MeshBasicMaterial({ map: m, side: THREE.DoubleSide });
}

/**
 * THE FLEET'S WHEEL MATERIALS — `[tread, cap, cap]`, in THREE's cylinder order.
 *
 * ── why this is exported, and why it is a TRIPLE rather than two textures ────
 *
 * Item 292, the user: *"[screenshot] fix the wheels on the trailer."* Half of
 * that was the wheels standing 0.113 m proud of the deck, fixed by item 253.
 * The half left was that **the trailer's wheels are the only wheels in the world
 * with no hubcap** — `crosstown.ts` builds that rig, `hubcapTex` lived here as a
 * module-private function, and there was no way across.
 *
 * Exporting the texture alone would not have been enough and would have been
 * the trap: the caller would still have had to know that a wheel wears THREE
 * materials in the order `[side, top, bottom]`, that the tread is
 * `0x101114` with `noLight` set (a black tyre under a sodium lamp is still a
 * black tyre), and that the cap has to go through `flatTex` or it shimmers.
 * Four facts, none of them guessable, all of them already true four times over
 * in this file. So the fleet publishes the answer instead of the ingredients.
 *
 * ── ONE SET, SHARED ──────────────────────────────────────────────────────────
 *
 * Memoised. Every wheel in the world can share these two materials — nothing
 * about a wheel varies per vehicle — and this world already runs ~3,800 draw
 * calls, so handing out fresh materials per wheel would buy nothing and cost
 * state changes. `makeCar` and `makeBus` build their own set per call today and
 * this does not change that; it is the door for callers outside this file.
 */
let FLEET_WHEEL_MATS: THREE.Material[] | null = null;
export function fleetWheelMats(): THREE.Material[] {
  if (FLEET_WHEEL_MATS) return FLEET_WHEEL_MATS;
  const tireM = new THREE.MeshBasicMaterial({ color: 0x101114 });
  tireM.userData.noLight = true;
  const capM = flatTex(hubcapTex());
  FLEET_WHEEL_MATS = [tireM, capM, capM];
  return FLEET_WHEEL_MATS;
}
/** The top face of the hood — the flat panel over the engine, on every kind.
 *  0.94 m: too high to reach from the pavement. A hop gains 0.471-0.558 m
 *  depending on frame time (fp.ts:446's "0.571" is the continuous apex and is
 *  never reached — see crosstown.ts's item-29 block and
 *  scripts/probes/w21-apex.mjs) and `standTop` credits a top from 0.08 m
 *  below it, so 0.14 + 0.551 = 0.69 m is a standing player's guaranteed reach
 *  off the kerb. Which is why on the pickup this is only ever met on the way
 *  DOWN off the cab roof. */
export const HOOD_TOP = BELT + HOOD_T;

/** The SEDAN's boot lid, in the car's own LOCAL frame (front is -z). Same
 *  contract as `PICKUP_BED`/`PICKUP_CAB`: the `trunk` mesh in `makeCar`'s sedan
 *  branch READS these fields rather than restating them, so the standable tier
 *  the world builds from them cannot drift from the panel it describes.
 *
 *  WHY IT IS HOISTED NOW. `crosstown.ts` used to recover this panel by walking
 *  the drawn meshes of ONE car and picking the two whose tops sat just above
 *  the beltline — a good workaround, written when this file was held by another
 *  builder and these numbers were locals. It cannot be applied to a SECOND
 *  sedan without re-walking that car's meshes, and "every sedan carries the
 *  same collider" is exactly what item 202c is for. A constant both the mesh
 *  and the collider read is strictly better than a mesh the collider measures:
 *  there is one number, not two that agree today.
 *
 *  `topY` is the lid's top face — 0.93 m, the one panel on a sedan worth
 *  standing on, and the reason the trailer deck below it exists at 0.50. */
const SEDAN_HALF = CAR_SPEC.sedan.len / 2;
const SEDAN_LID_T = 0.09;
const SEDAN_LID_LEN = SEDAN_HALF - 1.32;
const SEDAN_LID_MID = (SEDAN_HALF + 1.35) / 2;
export const SEDAN_BOOT = {
  /** the lid's own thickness */
  t: SEDAN_LID_T,
  /** the panel's length and centre, in car-local metres */
  len: SEDAN_LID_LEN,
  midZ: SEDAN_LID_MID,
  /** the lid's own FRONT edge — where the rear glass starts to rise. A tier
   *  running any further forward would be a standable shelf inside the cabin,
   *  which is the defect `PICKUP_COWL_Z` is derived to prevent. */
  z0: SEDAN_LID_MID - SEDAN_LID_LEN / 2,
  z1: SEDAN_LID_MID + SEDAN_LID_LEN / 2,
  /** the lid's top face */
  topY: BELT + SEDAN_LID_T,
};

/** The pickup's CAB, in the vehicle's own LOCAL frame (front is -z). Same
 *  contract as `PICKUP_BED`: the `loftCabin` call in `makeCar`'s pickup branch
 *  READS these fields rather than restating the numbers, so the collider the
 *  world builds from them cannot drift from the glass it describes
 *  (BUILDER-BRIEF §8: derive, never retype).
 *
 *  `roofY` is the surface item 29 exists to make reachable. It is most of a
 *  metre above the bed floor — two jumps, not one — which is why the bed WALL
 *  (`PICKUP_BED.railY`, 0.97) is the step between them.
 *
 *  WHY 1.455 AND NOT 1.50, WHICH IS WHAT THIS SHIPPED AT (w33, item 69).
 *
 *  Three builders measured the rail -> roof hop and got three answers. All of
 *  them were looking at the wrong quantity. A HOP IS NOT DECIDED BY HEIGHT. To
 *  land on a tier you must also cross `RADIUS` (0.36 m, fp.ts:87) of ground
 *  horizontally, because `blocked()` keeps padding that tier by RADIUS until
 *  you are over it, and it only stops once your feet clear `maxY - TOP_EPS`:
 *
 *      fp.ts:289   if (c.maxY !== undefined && atY >= c.maxY - TOP_EPS) continue;
 *      fp.ts:469   const atY = this.lastWorldY;     // LAST frame's foot height
 *
 *  So what actually decides the hop is HOW MANY RENDERED FRAMES clear that
 *  threshold. `main.ts:107` clamps dt at 0.05 s, and at the clamp a walk covers
 *  0.165 m per frame — so you need three such frames (0.495 m) to beat RADIUS,
 *  and two (0.330 m) is a miss. The jump (v0 = 4, g = 14, semi-implicit Euler,
 *  fp.ts:549-553) puts the feet at these heights above the take-off surface:
 *
 *      f2 0.295   f3 0.390   f4 0.450   f5 0.475   f6 0.465   f7 0.420   f8 0.340
 *
 *  A rise of 0.53 needs airY >= 0.45, which catches f4, f5 and f6 — THREE
 *  frames, 0.495 m, and it does land. w21 and w22 were right that it works, and
 *  it works deterministically rather than "on a coin flip": IEEE 754 is not
 *  luck. But f4 is 0.44999999999999996 and the threshold is 0.44999999999999996
 *  — the tightest frame clears by EXACTLY ZERO, and it only counts because the
 *  comparison is `>=`. Measured, not argued: raising this constant by 100
 *  NANOMETRES took the climb from 4/4 to 0/4 at CPU throttle x8, frames 3 -> 2
 *  and travel 0.495 -> 0.330 (scripts/probes/w33-roof-frames.mjs).
 *
 *  A surface whose reachability turns on the last bit of a double is not a
 *  design, so the roof comes down to sit in the MIDDLE of a frame band instead
 *  of on its edge.
 *
 *  AND THE GROUND TO CROSS IS NOT RADIUS — IT IS RADIUS PLUS A FRAME. This is
 *  the part that caught a first attempt at 1.455. `blocked()` refuses the whole
 *  step, so a player walking into the cab is not left touching the RADIUS pad;
 *  he is left wherever the last permitted step put him, which is up to one
 *  frame short of it. Measured in the running world, he is held **0.515 m** off
 *  the roof face, not 0.36 — so the crossing needs FOUR frames, not three, and
 *  1.455 (four frames) had a spare of exactly zero all over again.
 *
 *  1.415 gives a rise of 0.445, needing airY >= 0.365, which catches f3 f4 f5
 *  f6 f7 — five frames, 0.825 m of travel. 0.365 sits 0.025 above f8 and 0.025
 *  below f3, as far from both boundaries as the band allows.
 *
 *  The property that buys is DROPPED-FRAME HEADROOM, and it is the thing worth
 *  protecting here: five frames cross the 0.515 m standoff with one whole frame
 *  to spare, so the hop still lands if the engine loses one entirely. At four
 *  it landed with nothing in hand, and at three it depended on the standoff
 *  coming out at the lucky end of its range.
 *
 *  The cab is 85 mm lower than it shipped. That is a change you can see, and it
 *  reads BETTER rather than worse: the greenhouse is now 0.575 m from beltline
 *  to roof, where a real pickup's is 0.55-0.65 — 1.50 was the tall one.
 *
 *  These numbers are copied from fp.ts/main.ts with citations rather than
 *  imported, because `TOP_EPS` (fp.ts:98) and the jump's v0/gravity are module
 *  locals and hoisting them means editing a file this item does not name
 *  (BUILDER-BRIEF §8/§9). The check does NOT depend on that copy:
 *  scripts/w21-roof-climb.mjs measures the frames and the travel in the running
 *  world, so it fails if the physics moves under this comment. */
export const PICKUP_CAB = {
  baseY: BELT,        // y0 — the greenhouse's foot, on the beltline
  roofY: 1.415,       // y1 — the roof plate's top face. NOT a round number: see below
  baseZ0: -1.0,       // zbf — the windscreen's foot
  baseZ1: 0.45,       // zbr — the rear window's foot
  roofZ0: -0.45,      // zrf — the roof plate, front edge
  roofZ1: 0.32,       // zrr — the roof plate, rear edge
  baseHalfW: 0.85,    // wBase
  roofHalfW: 0.74,    // wRoof
};

/** Where, along the pickup's own axis, the windscreen rises past the hood's
 *  top — i.e. the last z at which a box standing at `HOOD_TOP` is still
 *  OUTSIDE the glass rather than inside the cab. Derived from the loft's own
 *  two endpoints, not measured off a screenshot: the screen runs from
 *  (`baseZ0`, `baseY`) to (`roofZ0`, `roofY`), so this is the linear crossing.
 *
 *  It is the seam between the pickup's two collision tiers — hood below,
 *  cab above — and it is derived rather than typed because moving the
 *  beltline (an open request, notes/BLOCKED-H.md) would otherwise leave the
 *  seam behind and put a standable shelf inside the cab. */
export const PICKUP_COWL_Z = PICKUP_CAB.baseZ0
  + (HOOD_TOP - PICKUP_CAB.baseY) / (PICKUP_CAB.roofY - PICKUP_CAB.baseY)
  * (PICKUP_CAB.roofZ0 - PICKUP_CAB.baseZ0);

// ══ ONE COLLIDER PER CarKind ═══════════════════════════════════════════════
//
// THE USER, twice, the second time with the V collision-debug view on and
// diagnosing it himself:
//
//   *"also not all car and object collidable boxes are consistent. some cars
//    have full height others are aligned with the vehicle."*
//   *"truck collision isnt accurate to the truck but the other truck is? it
//    seems odd. seems like all trucks should be one object that are all the
//    same no?"*
//
// He was right and so was his proposed fix. WHAT HE WAS LOOKING AT: there were
// TWO hand-written ONE-INSTANCE special cases in `crosstown.ts` —
//
//     const truck = parkedFleet.find((p) => p.kind === 'pickup');
//     const sedan = parkedFleet.find((p) => p.kind === 'sedan');
//
// — and `.find()` returns THE FIRST MATCH. So exactly one pickup and exactly
// one sedan in the whole world carried the tiered, silhouette-hugging,
// height-capped collider. Every other vehicle got one bare box with no `maxY`
// at all, and `fp.ts:40` makes `maxY` optional, so absent means FULL HEIGHT —
// his sentence word for word. Measured on the built bundle before this landed
// (scripts/probes/w72-car-collider-consistency.mjs): 10 car-shaped groups, ONE
// carrying a `maxY`, FOUR carrying none, FIVE distinct collider signatures.
//
// So the spec lives HERE, next to the panels it is derived from, stated ONCE
// per kind in the car's own local frame, and every caller applies the same one.
// There is no way left to give one instance of a kind a different box from
// another: the two special cases are gone and the sites just ask for the kind.

/** One collision tier, in the car's OWN LOCAL FRAME — front is -z, +x is the
 *  car's right, y is world-up (a car never pitches or rolls when parked).
 *  `maxY` absent means a wall at every height, which is what `fp.ts` means by
 *  an `AABB` with no `maxY` and is deliberate on the parts you must not be able
 *  to stand on. `tag` is not read by `fp.ts`; `__ct.colliders()` serialises it,
 *  which is how the acceptance walks assert against THE ROOF rather than
 *  against "the first collider that happens to have a maxY". */
export interface CarTier {
  tag: string;
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  maxY?: number;
}

/** THE collider for a kind of car — every instance of that kind, everywhere in
 *  the world, is this shape.
 *
 *  The pickup's five tiers and the sedan's two are NOT new: they are the two
 *  hand-written blocks from `crosstown.ts` items 29 and 54, moved here
 *  unchanged so that they apply to every instance instead of to one. They were
 *  correct; they were just applied once each. Every number is read from the
 *  panel constants above rather than retyped, so a tier cannot drift from the
 *  surface it describes.
 *
 *  ⚠ THE TOPS ARE STANDABLE ON PURPOSE. The user jumps on these
 *  (`notes/w13-collider-volume.md`, `notes/w21-car-roof-climb.md`); do not
 *  flatten them, and do not "tidy" the hatch and van into having a first step —
 *  w21 measured why they have none and w29 measured why the tyre route is
 *  impossible rather than merely tight. */
export function carColliderSpec(kind: CarKind): CarTier[] {
  const hl = carHalfLen(kind), hw = CAR_HALF_W;
  if (kind === 'pickup') {
    // tier 1, the hood: nose back to the point where the windscreen rises past
    // the hood's own top. Stopping at PICKUP_COWL_Z is why that constant is
    // derived — a hood tier running to the roof plate would put a standable
    // shelf at 0.94 m INSIDE the cab, under the glass.
    // tier 2, the cab, whose top IS the roof plate.
    // tier 3, the bed floor, exactly as item 1 shipped it.
    // tier 4, the two bed rails — the step from the bed floor to the roof. The
    // wall is only `wallT` thick, which is a hard landing at walking speed, so
    // the band runs from the wall's INNER face out to the collider's own side;
    // the extra is the skin the box already claimed at bed-floor height.
    const railIn = PICKUP_BED.halfW - PICKUP_BED.wallT;
    return [
      { tag: 'pickup-hood', minX: -hw, maxX: hw, minZ: -hl, maxZ: PICKUP_COWL_Z, maxY: HOOD_TOP },
      { tag: 'pickup-cab-roof', minX: -hw, maxX: hw, minZ: PICKUP_COWL_Z, maxZ: PICKUP_BED.z0, maxY: PICKUP_CAB.roofY },
      { tag: 'pickup-bed-floor', minX: -hw, maxX: hw, minZ: PICKUP_BED.z0, maxZ: hl, maxY: PICKUP_BED.floorY },
      { tag: 'pickup-rail-left', minX: -hw, maxX: -railIn, minZ: PICKUP_BED.z0, maxZ: PICKUP_BED.half, maxY: PICKUP_BED.railY },
      { tag: 'pickup-rail-right', minX: railIn, maxX: hw, minZ: PICKUP_BED.z0, maxZ: PICKUP_BED.half, maxY: PICKUP_BED.railY },
    ];
  }
  if (kind === 'sedan') {
    // The body forward of the boot lid stays a PLAIN WALL — no `maxY` — so the
    // nose, the engine bay and the greenhouse behave as every other car does:
    // solid at every height. That absence is asserted by
    // scripts/w29-sedan-climb.mjs, because a boot-lid -> roof hop lands only on
    // a coin flip and a standable roof nobody can reliably reach is a collider
    // nobody meets. It is tagged anyway so the walk can assert "still a wall"
    // against THIS box rather than whichever it finds first.
    return [
      { tag: 'sedan-body', minX: -hw, maxX: hw, minZ: -hl, maxZ: SEDAN_BOOT.z0 },
      { tag: 'sedan-boot-lid', minX: -hw, maxX: hw, minZ: SEDAN_BOOT.z0, maxZ: hl, maxY: SEDAN_BOOT.topY },
    ];
  }
  // The hatch and the van have no flat panel between the pavement at 0.14 and
  // the beltline at 0.84, so there is nothing on them a standing jump can gain
  // and nothing to tier. One box, the body plus its skin, solid at every
  // height — which is what they have always had. The point of this branch is
  // that they now have it CONSISTENTLY, from the same derivation.
  return [{ tag: `${kind}-body`, minX: -hw, maxX: hw, minZ: -hl, maxZ: hl }];
}

/** The kind's tiers placed in the world at `(x, z)` and turned to `yaw`, as
 *  colliders `fp.ts` can use.
 *
 *  AXIS-ALIGNED, ON THE CAR'S DOMINANT AXIS, WHICH IS WHAT EVERY CAR COLLIDER
 *  IN THIS WORLD HAS ALWAYS BEEN. A parked car is drawn within a few degrees of
 *  its kerb — `parkYaw()` jitters it by at most 0.1 rad — and both hand-written
 *  blocks this replaces resolved that the same way: take the SIGN of cos(yaw)
 *  and ignore the rest, because the only question is which world end the bed is
 *  at. Blending the box through the jitter instead would INFLATE it (0.1 rad on
 *  a 2.6 m half-length adds 0.26 m of width), which would change the ground
 *  footprint every car has shipped with and could manufacture the very
 *  trap-band gaps `ct/gap.ts` exists to remove.
 *
 *  The short axis is NOT mirrored, deliberately. Every tier is symmetric across
 *  the car's centre line except the two bed rails, which are a symmetric PAIR —
 *  so the set of boxes is identical either way, and leaving the mapping alone
 *  keeps `pickup-rail-left` naming the same physical rail it has always named
 *  (scripts/stepoff-walk.mjs:175 looks it up by that name).
 *
 *  `site` is an instance label appended to every tag, e.g. `@side`. Two
 *  physical surfaces must not answer to one name: `w21-roof-climb.mjs` and
 *  `w29-sedan-climb.mjs` both build `Object.fromEntries(...)` over the tags, so
 *  a duplicate would silently resolve to whichever was registered last and walk
 *  the harness to a different truck. The SHAPE is shared; the NAME is per
 *  instance, and `tagBase()` below strips the label back off. */
export function carColliderBoxes(
  kind: CarKind, x: number, z: number, yaw: number, site = '',
): (AABB & { tag: string })[] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const longIsZ = Math.abs(c) >= Math.abs(s);
  const nose = longIsZ ? c : s;                 // which way the car's own +z runs
  return carColliderSpec(kind).map((t) => {
    const [lo, hi] = nose >= 0 ? [t.minZ, t.maxZ] : [-t.maxZ, -t.minZ];
    const b: AABB & { tag: string } = longIsZ
      ? { tag: t.tag + site, minX: x + t.minX, maxX: x + t.maxX, minZ: z + lo, maxZ: z + hi }
      : { tag: t.tag + site, minX: x + lo, maxX: x + hi, minZ: z + t.minX, maxZ: z + t.maxX };
    if (t.maxY !== undefined) b.maxY = t.maxY;
    return b;
  });
}

/** The surface name inside an instance-labelled tag: `pickup-hood@side` ->
 *  `pickup-hood`. One place, so a check comparing two instances of a kind and
 *  the world stamping the tags cannot disagree about the separator. */
export function tagBase(tag: string): string {
  return tag.split('@')[0];
}

// ── DOORS ────────────────────────────────────────────────────────────────
//
// A door is an OUTLINE, not a line. What was drawn before was two 1-texel bars
// at FIXED texels 38 and 62 of the flank — fixed, so they landed at a different
// place on every body length — plus two small black rectangles halfway down.
// Nothing tied them to the greenhouse above, and the greenhouse divided its
// glass evenly across its OWN span, so the B-pillar and the shut line under it
// were at different x on every car in the fleet. That is most of why it read
// wrong, and it is why all four kinds looked the same: the flank layout never
// varied at all, so a two-door and a four-door were identical below the glass.
//
// Now there is ONE list of shut-line positions per kind, in car-local metres,
// and both painters convert it through their own mapping — so they cannot
// disagree. `glass` is where the window panes go, in the same metres, which is
// what puts a rear quarter light behind the back door and makes a four-door
// read as a four-door.
interface DoorPlan {
  /** panel joins, front to back — a door lies between consecutive entries */
  shut: number[];
  /** window panes, each [from, to] */
  glass: [number, number][];
}
function doorPlan(kind: CarKind, half: number): DoorPlan {
  switch (kind) {
    case 'sedan':   // four doors, and a quarter light behind the rear one
      // The rear door's trailing shut is at 1.10, NOT 1.40, and the 0.30 m
      // between those two numbers was the whole of the misalignment the user
      // photographed. The panes put the rear pillar at (1.05 + 1.15) / 2 =
      // 1.10; a shut line at 1.40 therefore had no pillar above it, the pillar
      // at 1.10 had no shut below it, and the quarter light at [1.15, 1.35]
      // fell INSIDE the rear door instead of behind it. Moving the shut to the
      // pillar answers both halves of the request — "the glass divider at the
      // SAME x as the shut line below it" and "a rear quarter window behind
      // the back door" — and it is the paint that was wrong, not the glass.
      // Front door 1.20 m, rear door 0.90 m, which is the way round real ones
      // are. The other three kinds already agreed and are left alone.
      return { shut: [-1.0, 0.2, 1.1], glass: [[-0.9, 0.1], [0.3, 1.05], [1.15, 1.35]] };
    case 'hatch':   // two doors: one long door, then a big rear side window
      return { shut: [-0.85, 0.75], glass: [[-0.75, 0.65], [0.85, 1.7]] };
    case 'pickup':  // two doors, short cab, no rear glass at all
      return { shut: [-1.0, 0.45], glass: [[-0.9, 0.35]] };
    case 'van':     // cab doors, then a long panel with a light at the back
      return { shut: [-1.45, -0.15], glass: [[-1.35, -0.25], [0.1, 1.0], [1.2, 2.1]] };
  }
}

/** The body side, rocker to beltline. `arches` are wheel-arch centres in metres
 *  RELATIVE TO THIS FACE'S OWN CENTRE — the pickup's slab stops behind the cab,
 *  so its face is no longer centred on the vehicle and only the front arch
 *  belongs on it (the rear one is painted on the bed skin). */
// `panelH` is the flank's real height in metres, ROCKER to BELT. It is a
// PARAMETER because the arch's height is stated in metres and this canvas is a
// fixed 20 rows tall, so the rows-per-metre it converts through is 20/panelH —
// and that was written as the literal 40, which is only correct while the panel
// is exactly 0.50 m. Raising the beltline is one of the three open options for
// the wheel proportion (notes/BLOCKED-H.md); with the literal in place it would
// have silently shrunk the arch relative to the tyre instead, which is the
// same class of bug as the fixed 10-texel radius that made the arch 40% too
/** ── ONE DENSITY FOR ALL VEHICLE BODYWORK ────────────────────────────────
 *
 *  A's masonry discipline, applied to the fleet: every bodywork canvas is
 *  sized from its panel's real metres at this one density, so a feature stated
 *  in metres is the same size on every panel of every vehicle and nothing is
 *  stretched relative to its neighbour.
 *
 *  32 px/m because it is what the pickup's flank and bed skin already used —
 *  so the vehicle in the user's screenshot does not change density at all, and
 *  the cab/bed seam stays matched. Square texels: the same number across and
 *  up, which is what removes the "stretched" reading.
 */
const PX_PER_M = 32;

// wide on a sedan and about right on a pickup from one line of code.
function bodySideTex(body: string, len: number, wheelZ: number, taxi: boolean, panelH: number,
  arches: number[] = [-wheelZ, wheelZ],
  /** shut lines in car-local metres, and this face's own z origin */
  plan?: DoorPlan, faceZ0 = -len / 2,
  /** ── WHICH FLANK IS THIS? AND WHY THERE HAS TO BE A SECOND TEXTURE ──────
   *
   *  The user: *"the worker doesnt realize they need to confirm the logic
   *  independently per side of the car."* Exactly right, and this is the line
   *  that proves it. A BoxGeometry's two side faces carry UVs that run in
   *  OPPOSITE world directions, so handing one texture to both — which is what
   *  `[sideT, sideT, ...]` did — paints the near flank correctly and the far
   *  one back to front. Measured on the geometry rather than reasoned from
   *  three.js's source, all four kinds agreeing:
   *
   *    -x face:  z = +len*u + faceZ0     u = 0 is the FRONT  <- matches tx()
   *    +x face:  z = -len*u - faceZ0     u = 0 is the REAR   <- reversed
   *
   *  So the +x face needs the same paint with u running the other way. The
   *  mirror is applied at the ONE place every feature's column comes from, so
   *  a feature added later cannot forget it. */
  flip = false): THREE.Texture {
  // ── ONE DENSITY, AND THE CANVAS COMES FROM THE PANEL'S REAL METRES ──────
  //
  // This canvas was a fixed 96 x 20 whatever the panel measured, which is the
  // root of the "texel density is visibly inconsistent" report. Two separate
  // problems came out of that one line:
  //
  //   * ACROSS vehicles, px/m varied with body length — a van's flank was
  //     20.9 px/m against a pickup's 32.0, so the same feature was drawn half
  //     the size on one car and full size on the next.
  //   * WITHIN a panel, 96 across and 20 up over 4.5 m x 0.50 m is 21.3 x 40.0
  //     — texels about twice as tall as they are wide. That anisotropy is the
  //     "stretched" reading, and it is why a 0.38 m arch radius came out 12
  //     texels wide and 15 tall from a single number.
  //
  // A's masonry rule is: derive every canvas from the surface's real metres at
  // ONE density. THE ROUNDING RULE I AM APPLYING, since the question of how the
  // masonry helper rounds is still unanswered: fix the DENSITY and accept a
  // fractional canvas, rounded to whole texels. That way a feature stated in
  // metres is the same size on every panel of every vehicle, and the only cost
  // is that a canvas edge lands up to half a texel off — invisible, and far
  // cheaper than the alternative (fix the canvas, accept a fractional density)
  // which reintroduces exactly the per-vehicle variation being removed.
  //
  // 32 px/m is chosen because it is what the pickup's flank and its bed skin
  // already use, so the vehicle the user photographed does not change density
  // at all and the bed/cab seam stays matched.
  const W = Math.max(8, Math.round(len * PX_PER_M));
  const H = Math.max(4, Math.round(panelH * PX_PER_M));
  return pixTex(W, H, (g) => {
    /** 0..1 along the panel -> this face's texel column, mirrored if this is
     *  the flank whose UVs run backwards */
    const col = (u: number) => Math.round((flip ? 1 - u : u) * W);
    /** car-local metres -> this face's texels */
    const tx = (z: number) => col((z - faceZ0) / len);
    /** a height ABOVE THE ROCKER, in metres -> a row. Every band below used to
     *  be a literal row index that only meant anything while the panel was
     *  exactly 0.50 m and the canvas exactly 20 tall. */
    const yr = (mAboveRocker: number) => Math.round((1 - mAboveRocker / panelH) * H);
    const band = (m0: number, m1: number) => {
      const a = yr(m1), b = yr(m0);
      return [a, Math.max(1, b - a)] as const;
    };
    g.fillStyle = body; g.fillRect(0, 0, W, H);
    // the beltline highlight: the top 75 mm of the panel
    const [byTop, bhTop] = band(panelH - 0.075, panelH);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, byTop, W, bhTop);
    // the rocker shadow: the bottom 100 mm
    const [byLo, bhLo] = band(0, 0.1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, byLo, W, bhLo);
    if (taxi) { // checker band instead of chrome
      const [cy, ch] = band(0.25, 0.35);
      const step = Math.max(2, Math.round(0.19 * PX_PER_M));   // 190 mm squares
      for (let x = 0; x < W; x += step) {
        g.fillStyle = (Math.round(x / step)) % 2 ? '#141416' : '#e8e4d8';
        g.fillRect(x, cy, step, ch);
      }
    } else {
      const [cy] = band(0.28, 0.31);
      g.fillStyle = '#d8dade'; g.fillRect(0, cy, W, Math.max(1, Math.round(0.03 * PX_PER_M)));
    }
    // Shut lines run the FULL height of this face — which is sill to window
    // base, because that is exactly what the flank spans — and each is a PAIR:
    // a dark gap with a highlight down its trailing side, so it reads as two
    // panels meeting rather than as a scratch.
    if (plan) {
      for (const z of plan.shut) {
        const x = tx(z);
        if (x < 1 || x > W - 2) continue;
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, 0, 1, H);
        // the highlight sits down the shut's TRAILING side — which is the
        // other texel column once the face is mirrored, or the two flanks
        // would catch the light from opposite directions
        g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x + (flip ? -1 : 1), 0, 1, H);
      }
      // a handle just under the window line, one per door, set toward the
      // door's trailing edge the way a real one is
      g.fillStyle = '#1a1c20';
      for (let i = 0; i + 1 < plan.shut.length; i++) {
        const a = tx(plan.shut[i]), b = tx(plan.shut[i + 1]);
        const hx = Math.round(b - (b - a) * 0.3);
        // just under the window line, and sized in millimetres rather than in
        // texels so it is the same handle on a van as on a hatch
        const [hy, hh] = band(panelH - 0.13, panelH - 0.06);
        const hw = Math.max(2, Math.round(0.13 * PX_PER_M));
        if (hx > 2 && hx < W - 4) g.fillRect(hx - Math.round(hw / 2), hy, hw, hh);
      }
    }
    // ── wheel arches: REVERTED to the pre-arch paint, deliberately ──────
    //
    // Two attempts at a stepped arch here, and the reason both failed is a
    // proportion this body cannot accommodate:
    //
    //   panel (rocker 0.34 -> belt 0.84)   0.50 m = 20 texel rows
    //   tyre                               0.68 m tall — TALLER than the panel
    //   tyre intrudes into the panel        0.34 m = 14 of those 20 rows
    //
    // So an arch drawn to clear the tyre's top must occupy about 85% of the
    // panel's height. Any coarse staircase across that span comes out as treads
    // 3-4 rows tall and 24-26 texels wide — long flat bands stacked up the
    // flank, which is what shipped and what was reported as stripes painted
    // down the side of the truck. The widths were bounded by the arch radius
    // correctly; the HEIGHT is what has no room, and no redrawing fixes that.
    //
    // So this is back to the original single arc, which the user never
    // complained about — the complaint was the tyre clipping through the panel,
    // not the arch. A wheel that reads as a wheel beats a modelled one that
    // reads as a black bar.
    //
    // What would actually fix it is not paint: either the wheel gets smaller
    // relative to the body (the fleet is stylistically squat — a real sedan's
    // beltline is ~1.1 m against this one's 0.84, which is why the tyre is
    // oversized against the panel), or the flank becomes an alpha-cut plane with
    // the slab narrowed behind it so the tyre is seen THROUGH an opening. Both
    // are body rebuilds and both need a decision that is not mine to take.
    // ── the arch is sized to the WHEEL, in metres ───────────────────────
    //
    // It used to be a fixed 10-TEXEL radius, and a texel is not a length here:
    // this canvas is 96 wide however long the panel is, so px/m varies with the
    // body and 10 texels came out as a different arch on every kind —
    //
    //   sedan  4.5 m panel  21.3 px/m  ->  0.94 m wide
    //   hatch  3.8          25.3       ->  0.79
    //   pickup 3.0 (cab)    32.0       ->  0.63
    //   van    4.6          20.9       ->  0.96
    //
    // against a tyre 0.68 m across. So the arch was 40% too wide on a sedan and
    // about right on the pickup, from the same line of code: the extent was
    // coming from the PANEL, not from the wheel. That is why it read as a band
    // running down the flank on the long bodies and as an arch on the short one.
    //
    // Now the radius is stated in metres and converted per axis, so it is the
    // same arch on every vehicle and it hugs the tyre it belongs to.
    // Both dimensions in METRES, and the HEIGHT is the one that was wrong.
    //
    // The width was fixed last time: 0.38 m half-width against a 0.34 m tyre
    // hugs the wheel, and no longer takes its extent from the panel. But the
    // height was 0.27 m, so the arch topped out at y = 0.34 + 0.27 = 0.61 while
    // THE TYRE'S TOP IS AT 0.68 (0.663 when this was written — see
    // `g.userData.tyre` below; item 252 phased the decagon onto a vertex, which
    // put its top back at the full radius). The tyre poked out above the arch —
    // and since it stands 0.04 m proud of the flank, the disc then covered the
    // arch behind it. What was left to see was a disc on a flat panel above a
    // straight rocker line: "discs against a straight sill", which is the report.
    //
    // 0.38 m of height puts the arch line at 0.72 and so clears the tyre's top by
    // 4 cm (6 cm before item 252), so a dark rim of arch still shows above and
    // around the wheel — the air between the tyre and the arch line. The arch is
    // the one that moved TOWARDS the intent recorded below, not away: the note
    // wanted "wide and shallow", and the rim got 2 cm shallower.
    // In world terms that is an arch 0.76 m across and 0.38 m tall for a 0.68 m
    // tyre: wide and shallow, which is what a wheel arch is. It looks tall in
    // TEXELS only because they are not square here — 21 across the panel per
    // metre against 40 up it.
    // GRAIN THE PANEL, THEN CUT THE ARCH INTO IT — not the other way round.
    // The dither used to run last, which scattered 120 random texels across the
    // arch as well as the body and broke its boundary into mottling: that is
    // the "soft" in the user's "large soft DARK BLOTCH", because a hard edge
    // reads as an arch and a mottled one reads as a stain. The body still gets
    // exactly the same grain; only the arch is now clean-edged.
    dither(g, W, H, Math.round(120 * (W * H) / (96 * 20)));
    const ARCH_HW = 0.38;                      // half-width, m: tyre + 4 cm
    const ARCH_H = 0.38;                       // height above the rocker, m
    const arx = Math.max(3, Math.round(ARCH_HW * PX_PER_M));
    const ary = Math.max(3, Math.round(ARCH_H * PX_PER_M));   // square texels: one number both ways
    // ── the well is NOT the same black as the tyre ───────────────────────
    //
    // It was #0a0b0e against a tyre of #101114 — indistinguishable. So the gap
    // above the wheel, which is the whole point of clearing the tyre's top, read
    // as one dark mass with a hubcap in it: a DISC, not a wheel in an arch.
    //
    // A wheel well in daylight is shadowed body metal, not a hole: dark, but
    // lighter than a tyre and still carrying the car's own colour. Derived from
    // the body so every car's well matches its paint.
    // ── 0.18, NOT 0.34: the well must not be the sill ──────────────────
    //
    // Measured off the painted texture: the rocker shadow is rgba(0,0,0,0.35)
    // over the body = 90,84,58, and the well at x0.34 came out 83,78,52.
    // SEVEN LEVELS APART. They merged into one dark mass across the bottom
    // three quarters of the flank, which is the user's "large soft DARK
    // BLOTCH" — and it broke one of my own probes too, which when asked for
    // the darkest run on the bottom row returned the whole panel.
    //
    // x0.18 puts it at about 62,58,40: clearly a recess against the 90 of the
    // sill, still carrying the body's own hue rather than going flat black,
    // and well clear of the tyre's 16,17,20 — which is the mistake the
    // previous '#0a0b0e' made, indistinguishable from the rubber in front of
    // it. The desk's ruling: the earlier "do not disturb" protected the arch
    // PAINT and was never a licence for the blotch.
    const well = new THREE.Color(body).multiplyScalar(0.18);
    g.fillStyle = `#${well.getHexString()}`;
    for (const wz of arches) {
      const ax = col((wz + len / 2) / len);
      g.beginPath(); g.ellipse(ax, H, arx, ary, 0, Math.PI, 0); g.fill();
    }
  });
}
/** The greenhouse side. Panes are given in CAR-LOCAL METRES and converted with
 *  the same mapping loftCabin uses for its UVs — u = (z - zbf) / (zbr - zbf) —
 *  so a pillar between two panes lands at the same world z as the shut line
 *  painted under it on the flank. Passing a pane COUNT, as this used to, cannot
 *  do that: evenly dividing the cabin's own span has no relationship to where
 *  the doors are. */
function cabinSideTex(glass: [number, number][], zbf: number, zbr: number): THREE.Texture {
  return pixTex(96, 16, (g) => {
    const tx = (z: number) => Math.round(((z - zbf) / (zbr - zbf)) * 96);
    g.fillStyle = '#141820'; g.fillRect(0, 0, 96, 16);
    for (const [z0, z1] of glass) {
      const a = Math.max(1, tx(z0)), b = Math.min(95, tx(z1));
      if (b - a < 3) continue;
      g.fillStyle = '#2e3c4e';
      g.fillRect(a, 2, b - a, 12);
      // the same soft highlight down the leading edge of every pane
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(a + 1, 3, Math.min(4, b - a - 1), 11);
    }
    g.fillStyle = '#d8dade'; g.fillRect(0, 14, 96, 1);
  });
}
/** The nose. Same one density as the flanks — the face is 1.80 m across and
 *  the panel 0.50 m tall, so every feature below is stated in METRES and the
 *  canvas follows, rather than 48x16 standing in for whatever the body is. */
function carFrontTex(body: string, wM = 1.8, hM = 0.5): THREE.Texture {
  const W = Math.round(wM * PX_PER_M), H = Math.round(hM * PX_PER_M);
  const m = (v: number) => Math.round(v * PX_PER_M);
  return pixTex(W, H, (g) => {
    const cx = W / 2;
    g.fillStyle = body; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d8dade'; g.fillRect(0, H - m(0.125), W, m(0.09));   // bumper
    const gw = m(0.75), gh = m(0.16), gy = m(0.125);                    // grille
    g.fillStyle = '#1a1c20'; g.fillRect(Math.round(cx - gw / 2), gy, gw, gh);
    g.fillStyle = 'rgba(255,255,255,0.2)';
    for (let x = Math.round(cx - gw / 2) + 1; x < Math.round(cx + gw / 2); x += m(0.09))
      g.fillRect(x, gy, 1, gh);
    const lw = m(0.26);                                                 // headlamps
    g.fillStyle = '#e8e4c0';
    g.fillRect(m(0.15), gy, lw, gh); g.fillRect(W - m(0.15) - lw, gy, lw, gh);
    dither(g, W, H, Math.round(40 * (W * H) / (48 * 16)));
  });
}
/** The tail, on the same density and stated the same way as the nose. */
function carRearTex(body: string, wM = 1.8, hM = 0.5): THREE.Texture {
  const W = Math.round(wM * PX_PER_M), H = Math.round(hM * PX_PER_M);
  const m = (v: number) => Math.round(v * PX_PER_M);
  return pixTex(W, H, (g) => {
    const cx = W / 2;
    g.fillStyle = body; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d8dade'; g.fillRect(0, H - m(0.125), W, m(0.09));   // bumper
    const lw = m(0.34), lh = m(0.13), ly = m(0.125);                    // tail lights
    g.fillStyle = '#8a1c1c';
    g.fillRect(m(0.11), ly, lw, lh); g.fillRect(W - m(0.11) - lw, ly, lw, lh);
    const pw = m(0.375);                                                // number plate
    g.fillStyle = '#c9c4b0';
    g.fillRect(Math.round(cx - pw / 2), ly + m(0.03), pw, m(0.16));
    dither(g, W, H, Math.round(40 * (W * H) / (48 * 16)));
  });
}
/** A panel seen from ABOVE — a hood, a boot lid, a roof.
 *
 *  The last fixed canvas in the fleet. It was 48 x 48 whatever the panel
 *  measured, over bodies from 1.70 x 0.80 to 1.70 x 1.50 — so 28.2 px/m across
 *  and anywhere from 32 to 60 up, the van's roof coming out at ratio 0.47, the
 *  worst anisotropy left after the flanks were fixed.
 *
 *  `seam` is a FRACTION of the panel's length now, not a row index on a
 *  48-row canvas. The old call sites convert exactly — 40/48, 8/48, 24/48 —
 *  so no paint moves; it just stops meaning a different distance on every
 *  body. Same rounding rule as everything else: fix the density, accept a
 *  fractional canvas.
 */
function panelTopTex(body: string, seam: number, wM: number, hM: number): THREE.Texture {
  const W = Math.max(8, Math.round(wM * PX_PER_M));
  const H = Math.max(8, Math.round(hM * PX_PER_M));
  return pixTex(W, H, (g) => {
    const m = (v: number) => Math.round(v * PX_PER_M);
    g.fillStyle = body; g.fillRect(0, 0, W, H);
    // the sheen down the middle of the panel, inset by a hand's width all round
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(m(0.13), m(0.13), W - 2 * m(0.13), Math.max(2, Math.round(H * 0.25)));
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, Math.round(seam * H), W, 1);
    dither(g, W, H, Math.round(70 * (W * H) / (48 * 48)));
  });
}
function hubcapTex(): THREE.Texture {
  return pixTex(16, 16, (g) => {
    g.fillStyle = '#17181c'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#8a8a92';
    g.beginPath(); g.arc(8, 8, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a3a40';
    for (const [x, y] of [[8, 5], [5, 9], [11, 9], [8, 11]]) g.fillRect(x - 1, y - 1, 2, 2);
  });
}

// the welded greenhouse: base rect (y0) lofted to inset roof rect (y1).
// mats: [glassFront+Rear, roof, sides] via groups. DoubleSide everywhere.
function loftCabin(
  wBase: number, wRoof: number, y0: number, y1: number,
  zbf: number, zbr: number, zrf: number, zrr: number,
  glassM: THREE.Material, roofM: THREE.Material, sideM: THREE.Material,
): THREE.Mesh {
  const b0 = [-wBase, y0, zbf], b1 = [wBase, y0, zbf], b2 = [wBase, y0, zbr], b3 = [-wBase, y0, zbr];
  const t0 = [-wRoof, y1, zrf], t1 = [wRoof, y1, zrf], t2 = [wRoof, y1, zrr], t3 = [-wRoof, y1, zrr];
  const verts: number[] = [];
  const uvs: number[] = [];
  const uOf = (z: number) => (z - zbf) / (zbr - zbf);
  const push = (p: number[], u: number, v: number) => { verts.push(p[0], p[1], p[2]); uvs.push(u, v); };
  const quad = (a: number[], b: number[], c: number[], d: number[], uv: [number, number][]) => {
    push(a, ...uv[0]); push(b, ...uv[1]); push(c, ...uv[2]);
    push(a, ...uv[0]); push(c, ...uv[2]); push(d, ...uv[3]);
  };
  const geo = new THREE.BufferGeometry();
  // group 0: windshield + rear glass
  quad(b0, b1, t1, t0, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  quad(b2, b3, t3, t2, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // group 1: roof
  quad(t0, t1, t2, t3, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // group 2: sides — u follows each vertex's own z (trapezoid shear)
  quad(b0, t0, t3, b3, [[uOf(zbf), 0], [uOf(zrf), 1], [uOf(zrr), 1], [uOf(zbr), 0]]);
  quad(b1, t1, t2, b2, [[uOf(zbf), 0], [uOf(zrf), 1], [uOf(zrr), 1], [uOf(zbr), 0]]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.addGroup(0, 12, 0);
  geo.addGroup(12, 6, 1);
  geo.addGroup(18, 12, 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, [glassM, roofM, sideM]);
}

// ═══════════════════════════════ the bus ══════════════════════════════════
//
// A 30-foot city transit bus. The RTS — the American city bus of this era —
// was built in 30/35/40 ft lengths at 96 or 102 in wide; the 30 is the only
// one that clears the parked cars on a street this narrow, so that is what
// runs this route. Period details, not invented: sliding PLUG doors front
// and rear, a roller destination sign (electronic signs existed by '97 but
// rollsigns were still everywhere), and a painted livery band — full vinyl
// wraps came later. Flat-sided rather than the RTS's famous curved panels:
// at 21 px/m a curve reads as noise, so the curve is implied in the paint.
//
// Doors are on LOCAL +x. The traffic system flips the bus 180° to run the
// other way, which swings local +x to the other side of the road — so the
// doors face the kerb in BOTH directions without any special-casing.
const BUS_LEN = 9.1, BUS_HW = 1.1, BUS_H = 2.35, BUS_Y0 = 0.5;
const BUS_AXLE_F = -2.9, BUS_AXLE_R = 2.6;
const BUS_PX = 21;   // px per metre, matching the cars' 96 px / 4.5 m

function busSideTex(doors: boolean, body: string, band: string, open = false): THREE.Texture {
  const W = Math.round(BUS_LEN * BUS_PX), H = Math.round(BUS_H * BUS_PX);
  return pixTex(W, H, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, W, 3);   // roof edge
    // window band
    const wy0 = 8, wy1 = 26;
    g.fillStyle = '#1b2028'; g.fillRect(4, wy0 - 1, W - 8, wy1 - wy0 + 2);
    for (let x = 6; x < W - 6; x += 13) {
      g.fillStyle = '#33465a'; g.fillRect(x, wy0, 10, wy1 - wy0);
      g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(x + 1, wy0 + 1, 3, wy1 - wy0 - 2);
    }
    // livery band under the glass, then the darker skirt
    g.fillStyle = band; g.fillRect(0, 30, W, 6);
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 30, W, 1);
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 40, W, H - 40);
    // wheel arches at the real axle positions
    g.fillStyle = '#0a0b0e';
    for (const wz of [BUS_AXLE_F, BUS_AXLE_R]) {
      const ax = Math.round(((wz + BUS_LEN / 2) / BUS_LEN) * W);
      g.beginPath(); g.arc(ax, H, 10, Math.PI, 0); g.fill();
    }
    if (doors) {
      // sliding plug doors: front single leaf behind the front axle, rear
      // double leaf ahead of the rear axle. Glazed nearly to the floor.
      for (const [wz, wide] of [[-2.35, 0.95], [1.5, 1.25]] as [number, number][]) {
        const dx = Math.round(((wz + BUS_LEN / 2) / BUS_LEN) * W);
        const dw = Math.round(wide * BUS_PX);
        g.fillStyle = '#20262e'; g.fillRect(dx, 5, dw, 34);
        if (open) {
          // leaves slid back against the jambs, dark saloon and step well
          // showing between them — this is what sells a bus that has stopped
          g.fillStyle = '#0b0d10'; g.fillRect(dx + 2, 7, dw - 4, 31);
          g.fillStyle = '#1d232b'; g.fillRect(dx + 3, 30, dw - 6, 8);   // step well
          const leaf = Math.max(2, Math.round(dw * 0.22));
          for (const lx of [dx + 1, dx + dw - leaf - 1]) {
            g.fillStyle = '#39485c'; g.fillRect(lx, 8, leaf, 28);
            g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(lx + 1, 9, 1, 26);
          }
        } else {
          g.fillStyle = '#39485c'; g.fillRect(dx + 2, 8, dw - 4, 28);
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(dx + 3, 9, 2, 26);
          g.fillStyle = '#20262e'; g.fillRect(dx + Math.round(dw / 2) - 1, 5, 2, 34); // leaf split
        }
        g.fillStyle = '#c9c4b4'; g.fillRect(dx, 5, dw, 1); g.fillRect(dx, 38, dw, 1);
      }
    }
    dither(g, W, H, 90);
  });
}

function busFrontTex(body: string, band: string): THREE.Texture {
  return pixTex(48, 48, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 48);
    g.fillStyle = '#1b2028'; g.fillRect(3, 9, 42, 20);   // windshield
    g.fillStyle = '#33465a'; g.fillRect(5, 11, 38, 16);
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(6, 12, 10, 14);
    g.fillStyle = band; g.fillRect(0, 31, 48, 5);
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(0, 40, 48, 8);   // bumper shadow
    g.fillStyle = '#e8e4c0'; g.fillRect(4, 37, 8, 5); g.fillRect(36, 37, 8, 5); // headlights
    g.fillStyle = '#c9c4b4'; g.fillRect(0, 43, 48, 3);            // bumper
    dither(g, 48, 48, 40);
  });
}

function busRearTex(body: string, band: string): THREE.Texture {
  return pixTex(48, 48, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 48, 48);
    g.fillStyle = '#1b2028'; g.fillRect(6, 8, 36, 15);   // rear window
    g.fillStyle = '#2c3a4a'; g.fillRect(8, 10, 32, 11);
    g.fillStyle = band; g.fillRect(0, 31, 48, 5);
    g.fillStyle = 'rgba(0,0,0,0.35)';                    // engine grille
    for (let y = 26; y < 30; y += 2) g.fillRect(10, y, 28, 1);
    g.fillStyle = '#8a1c1c'; g.fillRect(3, 37, 8, 6); g.fillRect(37, 37, 8, 6);
    g.fillStyle = '#c9c4b4'; g.fillRect(0, 44, 48, 3);
    dither(g, 48, 48, 40);
  });
}

function busRoofTex(body: string): THREE.Texture {
  return pixTex(32, 96, (g) => {
    g.fillStyle = body; g.fillRect(0, 0, 32, 96);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(8, 10, 16, 12);   // roof hatches
    g.fillRect(8, 62, 16, 14);   // a/c hump
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(8, 10, 16, 1); g.fillRect(8, 62, 16, 1);
    dither(g, 32, 96, 50);
  });
}

// the roller sign: a linen roll behind glass, lit from inside
function busRollTex(): THREE.Texture {
  const t = pixTex(80, 14, (g) => {
    g.fillStyle = '#0e0f12'; g.fillRect(0, 0, 80, 14);
    g.fillStyle = '#141519'; g.fillRect(1, 1, 78, 12);
    g.fillStyle = '#d8b048';
    g.font = 'bold 9px monospace';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('42', 4, 7);
    g.font = 'bold 8px monospace';
    g.fillText('CROSSTOWN', 20, 7);
  });
  // 0.26 m tall and carrying LETTERS — the thinnest detailed face on the fleet,
  // so it gets the rest of the §4 prescription even though it has no dither:
  // no mip chain, nothing for the roller text to crawl through at a glance.
  t.minFilter = THREE.NearestFilter;
  return t;
}

/** the block's bus — a Group shaped like the cars so the traffic pool can
 *  drive it without knowing what it is */
export function makeBus(): THREE.Group {
  const body = '#b9b2a2';          // municipal cream, weathered
  const band = '#3f5a52';          // muted transit-authority green
  // ── GOTCHAS §4, APPLIED TO THE WHOLE FLEET AT ONE PLACE ────────────────
  //
  // "textures on back of truck are janky". `pixTex` hands back
  // NearestMipmapNearest, which is right for a big flat wall and wrong for a
  // vehicle: at the grazing angles you see a parked car's flank and tailgate
  // from, the mipmap drops detail into a lower level and the dither in it
  // turns into a crawling checkerboard. That is the same failure that produced
  // three separate "the kerb looks bad" reports before the rule was written
  // down, and the fix there was the same — NearestFilter, so there is nothing
  // to crawl.
  //
  // The bed skin, the tailgate, the bed floor and the bus roll sign each set
  // this by hand already, which is the tell that it belonged one level up: a
  // panel added later would have gone back to mipmapping and nobody would have
  // noticed until it shimmered. Every textured vehicle material is built
  // through `flatT`, so it goes here and cannot be forgotten.
  const flatT = flatTex;      // hoisted to module scope for `fleetWheelMats`
  const darkM = new THREE.MeshBasicMaterial({ color: 0x0e0f12 });
  darkM.userData.noLight = true;
  const g = new THREE.Group();

  // one tall slab carries the whole body; the paint does the shaping
  const sideDoors = flatT(busSideTex(true, body, band));
  const sideOpen = flatT(busSideTex(true, body, band, true));
  const sidePlain = flatT(busSideTex(false, body, band));
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(BUS_HW * 2, BUS_H, BUS_LEN),
    [sideDoors, sidePlain, flatT(busRoofTex(body)), darkM,
      flatT(busRearTex(body, band)), flatT(busFrontTex(body, band))],
  );
  shell.position.y = BUS_Y0 + BUS_H / 2;
  g.add(shell);

  // roof cap, slightly inset — breaks the silhouette so it isn't one brick
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(BUS_HW * 2 - 0.16, 0.12, BUS_LEN - 0.5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(body).multiplyScalar(0.94) }),
  );
  cap.position.set(0, BUS_Y0 + BUS_H + 0.05, 0);
  g.add(cap);

  // the roller sign, above the windshield
  const roll = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.26, 0.06), flatT(busRollTex()));
  roll.position.set(0, BUS_Y0 + BUS_H - 0.30, -BUS_LEN / 2 - 0.02);
  g.add(roll);

  // wheels: front axle well forward, rear axle set back, as on a real bus
  const tireM = new THREE.MeshBasicMaterial({ color: 0x101114 });
  tireM.userData.noLight = true;
  const capM = flatT(hubcapTex());
  const busFront: THREE.Mesh[] = [];
  for (const wx of [-BUS_HW + 0.06, BUS_HW - 0.06]) for (const wz of [BUS_AXLE_F, BUS_AXLE_R]) {
    // tyreGeo, not a bare CylinderGeometry: the bus floated 21.5 mm for the
    // same reason every car did — a 10-gon laid on its side stands on a flat.
    const w = new THREE.Mesh(tyreGeo(0.44, 0.28, 10), [tireM, capM, capM]);
    // YZX: the steer angle must turn the wheel about its own VERTICAL, after
    // the cylinder has been laid on its side — with the default XYZ order the
    // Y rotation would apply first and steer about the tilted axle instead.
    // At steer 0 this is the same matrix as the plain rotation.z it replaces.
    w.rotation.order = 'YZX';
    w.rotation.set(0, 0, Math.PI / 2);
    w.position.set(wx, 0.44, wz);
    g.add(w);
    if (wz === BUS_AXLE_F) busFront.push(w);
  }
  g.userData.wheelbase = BUS_AXLE_R - BUS_AXLE_F;   // 5.5 m
  g.userData.steer = (a: number) => { for (const w of busFront) w.rotation.y = a; };
  g.userData.halfLen = BUS_LEN / 2;   // the traffic collider is longer for this one
  g.userData.laneX = 1.35;            // hugs the centre line to clear parked cars
  g.userData.speed = 6.4;             // and it is slower than the cars
  // the kerb-side door panel swaps to a leaves-open version while it stands
  // at the stop. Front door is at local z = -2.35, which is what the sim
  // lines up with the flag pole.
  g.userData.doorZ = -2.35;
  let shown = false;
  g.userData.setDoors = (open: boolean) => {
    if (open === shown) return;
    shown = open;
    (shell.material as THREE.Material[])[0] = open ? sideOpen : sideDoors;
  };
  return g;
}

/** Which corner. Front is -z (the model is built nose-first), and with forward
 *  -z and up +y the LEFT side is -x — so 'fl' is (-x, -z). */
export type Corner = 'fl' | 'fr' | 'rl' | 'rr';

/** A car that is not just parked. Everything here is OFF by default and every
 *  option is additive: with no options this function builds exactly the meshes
 *  it always did, in the same order. That is deliberate rather than tidy —
 *  three.js burns four `Math.random()` calls per object in `generateUUID`, so a
 *  single extra mesh re-grains every unseeded texture painted after it and the
 *  whole world's fingerprint moves (GOTCHAS §1). A lot full of jacked cars must
 *  not be able to change the pigeons. */
export interface CarState {
  /** Bonnet up on its hinge, with a dark engine bay underneath. */
  hood?: boolean;
  /** Corners with no wheel fitted. */
  wheelsOff?: Corner[];
  /** That corner up on a jack: wheel off, and the body tilted onto the other
   *  three. Implies `wheelsOff`. */
  jack?: Corner;
  /** Off the road for good: all four wheels off, body down on block stacks. */
  blocks?: boolean;
}

export function makeCar(kind: CarKind, colorIdx: number, taxi = false, state: CarState = {}): THREE.Group {
  let hoodPanel: THREE.Mesh | null = null;
  const body = taxi ? '#c9a12e' : CAR_COLORS[colorIdx % CAR_COLORS.length];
  // ── GOTCHAS §4, APPLIED TO THE WHOLE FLEET AT ONE PLACE ────────────────
  //
  // "textures on back of truck are janky". `pixTex` hands back
  // NearestMipmapNearest, which is right for a big flat wall and wrong for a
  // vehicle: at the grazing angles you see a parked car's flank and tailgate
  // from, the mipmap drops detail into a lower level and the dither in it
  // turns into a crawling checkerboard. That is the same failure that produced
  // three separate "the kerb looks bad" reports before the rule was written
  // down, and the fix there was the same — NearestFilter, so there is nothing
  // to crawl.
  //
  // The bed skin, the tailgate, the bed floor and the bus roll sign each set
  // this by hand already, which is the tell that it belonged one level up: a
  // panel added later would have gone back to mipmapping and nobody would have
  // noticed until it shimmered. Every textured vehicle material is built
  // through `flatT`, so it goes here and cannot be forgotten.
  const flatT = flatTex;      // hoisted to module scope for `fleetWheelMats`
  const bodyM = new THREE.MeshBasicMaterial({ color: new THREE.Color(body) });
  const glassM = new THREE.MeshBasicMaterial({ color: 0x1c2836, side: THREE.DoubleSide });
  const darkM = new THREE.MeshBasicMaterial({ color: 0x0e0f12 });
  // Dark glass under a sodium lamp stays dark glass; rubber stays black.
  // Flag them so the lamplight registry skips them outright — a warmed
  // greenhouse reads as a brown slab, which is not a lighting effect.
  glassM.userData.noLight = true;
  darkM.userData.noLight = true;
  const g = new THREE.Group();

  const spec = CAR_SPEC[kind];
  const half = spec.len / 2;

  // ── the body slab: rocker to beltline ───────────────────────────────────
  //
  // On the PICKUP it STOPS at the back of the cab. It used to run the whole
  // length, and that one fact is why two separate requests for a deeper bed
  // failed to land: the tub's floor was nested INSIDE this solid box (floor top
  // 0.645 against a slab top of 0.84), so what you actually saw as the bed
  // floor was this slab's top face — plain body colour, 0.13 m below the rail.
  // Lowering the buried floor from 0.77 to 0.62 moved a surface nobody could
  // see. A bed floor has to sit BELOW the beltline, so the body cannot be solid
  // there; the bed is built as a real open tub below.
  // 0.89 AND 0.84 WERE BELT IN DISGUISE. The hood slab's centre was typed as
  // 0.89, meaning "the belt plus half of its own 0.1 thickness", and the
  // greenhouse's base as 0.84, meaning "the belt" — in all four kinds. Raising
  // the beltline is the fix I recommend for the wheel proportion
  // (notes/BLOCKED-H.md); with those literals in place it would have left the
  // hood BURIED 0.05 m inside the slab and the greenhouse floating clear of it,
  // on every vehicle. Found by actually trying BELT = 0.94 and noticing the hood
  // apex did not move, which is also the blind spot scripts/carstate.mjs had.
  const BED_Z0 = PICKUP_BED.z0;                         // bed front, behind the cab
  // ROCKER/BELT/HOOD_T/HOOD_TOP are module-scope now, so the world's collider
  // builder can read the SAME numbers this mesh is positioned from.
  const slabLen = kind === 'pickup' ? half + BED_Z0 : spec.len;
  const slabZ = kind === 'pickup' ? (BED_Z0 - half) / 2 : 0;
  const plan = doorPlan(kind, half);
  // only the front arch is on the cab body once the slab is short
  const archZ = kind === 'pickup' ? [-spec.wheelZ - slabZ] : [-spec.wheelZ, spec.wheelZ];
  const sideOf = (flip: boolean) => flatT(bodySideTex(body, slabLen, spec.wheelZ, taxi,
    BELT - ROCKER, archZ, plan, slabZ - slabLen / 2, flip));
  // ONE TEXTURE PER FLANK, not one texture twice. Material order on a
  // BoxGeometry is [+x, -x, +y, -y, +z, -z], and it is the +x face whose UVs
  // run rear-to-front, so that is the one that gets the mirrored paint.
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, BELT - ROCKER, slabLen),
    [sideOf(true), sideOf(false), bodyM, darkM,
      flatT(carRearTex(body)), flatT(carFrontTex(body))],
  );
  slab.position.set(0, (ROCKER + BELT) / 2, slabZ);
  g.add(slab);

  // the roof is sized per CABIN now, so it cannot be one shared material
  const roofOf = (wM: number, hM: number) => flatT(panelTopTex(body, 0.5, wM, hM));
  const hoodM = (seam: number, wM: number, hM: number) =>
    [bodyM, bodyM, flatT(panelTopTex(body, seam, wM, hM)), bodyM, bodyM, bodyM];

  if (kind === 'sedan') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, half - 0.9), hoodM(40 / 48, 1.7, half - 0.9));
    hood.position.set(0, BELT + 0.05, -(half + 0.95) / 2 + 0.02);
    hoodPanel = hood; g.add(hood);
    // Every number here is READ from SEDAN_BOOT rather than typed twice — the
    // world builds this lid's standable collider from that same object
    // (carColliderSpec above), exactly as the pickup's cab reads PICKUP_CAB.
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.7, SEDAN_BOOT.t, SEDAN_BOOT.len),
      hoodM(8 / 48, 1.7, SEDAN_BOOT.len));
    // BELT plus half the lid thickness, same disguise as the hood
    trunk.position.set(0, BELT + SEDAN_BOOT.t / 2, SEDAN_BOOT.midZ);
    g.add(trunk);
    g.add(loftCabin(0.81, 0.74, BELT, 1.46, -1.0, 1.4, -0.35, 0.9, glassM, roofOf(1.48, 1.25), flatT(cabinSideTex(plan.glass, -1.0, 1.4))));
  } else if (kind === 'hatch') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, half - 0.75), hoodM(40 / 48, 1.7, half - 0.75));
    hood.position.set(0, BELT + 0.05, -(half + 0.8) / 2 + 0.02);
    hoodPanel = hood; g.add(hood);
    // no trunk: the rear glass slopes all the way to the tail
    g.add(loftCabin(0.81, 0.72, BELT, 1.44, -0.85, half - 0.15, -0.25, half - 0.95, glassM, roofOf(1.44, half - 0.7), flatT(cabinSideTex(plan.glass, -0.85, half - 0.15))));
  } else if (kind === 'pickup') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, HOOD_T, 1.5), hoodM(40 / 48, 1.7, 1.5));
    hood.position.set(0, HOOD_TOP - HOOD_T / 2, -half + 0.85);
    hoodPanel = hood; g.add(hood);
    // short cab, near-vertical rear window. Every number here is READ from
    // PICKUP_CAB rather than typed twice — the world builds the cab's
    // standable collider from that same object (crosstown.ts, item 29).
    const K = PICKUP_CAB;
    g.add(loftCabin(K.baseHalfW, K.roofHalfW, K.baseY, K.roofY, K.baseZ0, K.baseZ1, K.roofZ0, K.roofZ1,
      glassM, roofOf(1.48, 0.77), flatT(cabinSideTex(plan.glass, K.baseZ0, K.baseZ1))));
    // ── THE BED: a real open tub, floor BELOW the beltline ────────────────
    //
    // Rebuilt rather than nudged, because the bed has now been asked about
    // twice and the reason both previous passes failed is structural, not a
    // number: the slab ran solid through here, so the tub's floor was inside
    // it and the visible "floor" was the slab's body-coloured top face, 0.13 m
    // under the rail. Now the slab stops at the cab (see above) and the bed is
    // a genuine box: skin, floor, headboard, tailgate.
    //
    //   rail top   0.97   unchanged — a real pickup's rail sits near the base
    //                     of the cab glass, and a playtest already rejected it
    //                     standing proud of the beltline
    //   floor top  0.50   so the inside is 0.47 m deep, which is a 1997
    //                     half-ton bed, and lands just above the axle line
    //   skin       0.34 … 0.97 — the outer wall now spans rocker to rail, so
    //                     it carries the body side art the slab used to
    const RAIL_T = PICKUP_BED.railY;
    const FLOOR_T = PICKUP_BED.floorY;  // the floor's TOP surface
    const WALL_T = PICKUP_BED.wallT, GATE_T = PICKUP_BED.gateT;
    const HW = PICKUP_BED.halfW;        // body half-width — the slab is 1.8 wide
    const SKIN_H = RAIL_T - ROCKER;     // 0.63 m of outer wall
    const wallLen = (half - GATE_T) - BED_Z0;
    const bedMidZ = BED_Z0 + wallLen / 2;
    // Painted at the same texel density as the cab slab beside it (that face is
    // 96 texels over slabLen, and 20 over its 0.5 m), so the bed's paint is not
    // finer or coarser than the cab's.
    const PPM_X = PX_PER_M, PPM_Y = PX_PER_M;   // one density, square texels
    const skinW = Math.round(wallLen * PPM_X), skinH = Math.round(SKIN_H * PPM_Y);
    const yRow = (worldY: number) => Math.round((RAIL_T - worldY) * PPM_Y);
    // ── ONE SKIN PER WALL, for the reason the flank needed one per face ────
    //
    // This had the same fault the doors did and on the vehicle the user
    // actually photographed: `outM` was a single texture handed to the +x wall
    // and the -x wall both (and to both faces of the tailgate), so the rear
    // arch sat at the right place on one side of the truck and mirrored about
    // the bed's centre on the other. Same cause as `[sideT, sideT]`, same fix
    // — the +x face gets its own paint with the long axis reversed.
    const bedSkin = (flip: boolean) => pixTex(skinW, skinH, (g2) => {
      g2.fillStyle = body; g2.fillRect(0, 0, skinW, skinH);
      // the same three lines the cab slab carries, at the same WORLD heights,
      // so they run on across the seam instead of stepping at it
      g2.fillStyle = 'rgba(255,255,255,0.22)'; g2.fillRect(0, 0, skinW, 2);        // rail cap
      g2.fillStyle = 'rgba(255,255,255,0.18)'; g2.fillRect(0, yRow(0.84), skinW, 3); // beltline
      g2.fillStyle = '#d8dade'; g2.fillRect(0, yRow(0.64), skinW, 1);              // chrome strip
      g2.fillStyle = 'rgba(0,0,0,0.35)'; g2.fillRect(0, yRow(0.44), skinW, skinH - yRow(0.44)); // rocker
      // the rear wheel arch, one ellipse — same reversion as the cab flank's,
      // for the same reason. See the note there.
      // same fix as the cab flank's: radius in METRES, converted with this
      // face's own px/m, so the bed's arch matches the cab's instead of being
      // whatever 10 texels happens to mean on a 1.8 m panel
      // THE WELL IS NOT BLACK — it is shadowed body metal, the same rule and the
      // same multiplier the cab flank uses. This was '#0a0b0e' and the cab was
      // fixed to `body * 0.34` without it, so a pickup carried TWO different
      // arches: a shadowed one on the cab and a near-black one on the bed. On a
      // dark car nobody sees the difference; on the tan pickup — the vehicle the
      // user was pointing at — the bed arch reads as a hard black rectangle
      // stamped on the side, which is their words for it exactly: "The arch is
      // a black RECTANGLE, not an arch."
      // same 0.18 as the cab flank — a pickup carrying two different well
      // tones is exactly the fault that produced "a black RECTANGLE, not an
      // arch" the first time round. (bodyC is declared BELOW this painter.)
      g2.fillStyle = `#${new THREE.Color(body).multiplyScalar(0.18).getHexString()}`;
      const au = (spec.wheelZ - bedMidZ + wallLen / 2) / wallLen;
      const ax = Math.round((flip ? 1 - au : au) * skinW);
      g2.beginPath();
      // same two metres as the cab flank's, in this face's own density
      g2.ellipse(ax, skinH, Math.max(3, Math.round(0.38 * PPM_X)), Math.max(3, Math.round(0.38 * PPM_Y)), 0, Math.PI, 0);
      g2.fill();
    });
    const bedSkinL = bedSkin(false), bedSkinR = bedSkin(true);
    // GOTCHAS §4 — see the liner below
    bedSkinL.minFilter = THREE.NearestFilter;
    bedSkinR.minFilter = THREE.NearestFilter;
    // The tailgate IS the back of the truck now, so it carries the tail lights
    // and the step bumper. Painted symmetrically and, unlike before, nothing is
    // coplanar with it — the slab's rear face is 1.8 m forward, behind the
    // headboard. The asymmetric lights the user saw were two symmetric painted
    // lights inside a z-fight, not a texture fault (GOTCHAS §6).
    const gateW = Math.round(HW * 2 * PPM_X), gateH = skinH;
    const bedRearT = pixTex(gateW, gateH, (g2) => {
      g2.fillStyle = body; g2.fillRect(0, 0, gateW, gateH);
      g2.fillStyle = 'rgba(255,255,255,0.22)'; g2.fillRect(0, 0, gateW, 2);        // rail cap
      // CENTRED, and centred by construction rather than by two fractions that
      // nearly agree. 0.42 and 0.16 of a 58-wide gate put the latch on texel 28
      // of a canvas whose centre is 29 — one texel off, which a mirror test
      // finds and the eye reads as "the back of the truck is not symmetrical".
      // The lights either side were symmetric all along; this was the odd one.
      g2.fillStyle = 'rgba(0,0,0,0.3)';                                           // latch
      // …and the width must share the canvas's PARITY or it cannot be centred
      // at all: 0.16 of a 58-wide gate is 9 texels, and a 9-wide feature on an
      // even canvas always lands half a texel off — the mirror test sees three
      // texels of asymmetry and no amount of re-centring fixes it. Round the
      // width to even so the two halves can actually match.
      const latchW = Math.round(gateW * 0.16 / 2) * 2;
      g2.fillRect(Math.round((gateW - latchW) / 2), yRow(0.72), latchW, 3);
      const lw = Math.max(3, Math.round(gateW * 0.17)), lh = 4;
      g2.fillStyle = '#8a1c1c';
      g2.fillRect(Math.round(gateW * 0.07), yRow(0.58), lw, lh);
      g2.fillRect(gateW - Math.round(gateW * 0.07) - lw, yRow(0.58), lw, lh);
      g2.fillStyle = '#d8dade'; g2.fillRect(0, yRow(0.44), gateW, 3);             // step bumper
    });
    bedRearT.minFilter = THREE.NearestFilter;
    const bodyC = new THREE.Color(body);
    const outL = flatT(bedSkinL), outR = flatT(bedSkinR);
    const rimM = new THREE.MeshBasicMaterial({ color: bodyC.clone().multiplyScalar(1.16) });
    // ── the liner: NEAR-BLACK, and that is the point ───────────────────────
    //
    // It used to be the body colour scaled by 0.6, which on this palette is
    // #6d6646 against a #8a825a body — to the eye, the same green, which is
    // most of why the bed read as a pressed dish. Nothing in this world casts
    // a shadow, so the darkness of a cavity has to be PAINTED or it does not
    // exist. Flagged noLight for the same reason the glass is: a sodium lamp
    // warming the inside of a bed to amber is not a lighting effect.
    const linerM = new THREE.MeshBasicMaterial({ color: 0x16171a });
    linerM.userData.noLight = true;
    // ribs front-to-back, deliberately COARSE: this is a near-horizontal face
    // read at a grazing angle, which is the tailgate's own problem (GOTCHAS
    // §4). Wide bands, no dither, NearestFilter.
    // ── THE BED FLOOR JOINS THE FLEET'S ONE DENSITY ────────────────────
    //
    // This was the last surface not at PX_PER_M: 16.2 x 16.1 px/m, square so
    // nothing was stretched, but HALF the resolution of the walls standing
    // either side of it — so a rib was twice the size of any feature next to
    // it. Ruled to 32 with the ribs redrawn.
    //
    // The ribs are stated in METRES now, which is the whole point: the pitch
    // is a property of the truck, not of the canvas, so doubling the density
    // must not halve the number of ribs. 0.50 m pitch, a 0.19 m lit face and a
    // 0.06 m shadow line — the same numbers the 16 px/m version drew (8, 3 and
    // 1 texels), now written so they cannot drift again.
    const inW = HW * 2 - WALL_T * 2;
    const RIB_PITCH = 0.5, RIB_LIT = 0.1875, RIB_DARK = 0.0625;
    const floorT = pixTex(Math.round(inW * PX_PER_M), Math.round(wallLen * PX_PER_M), (g2) => {
      const W = Math.round(inW * PX_PER_M), H = Math.round(wallLen * PX_PER_M);
      const m = (v: number) => Math.max(1, Math.round(v * PX_PER_M));
      g2.fillStyle = '#16171a'; g2.fillRect(0, 0, W, H);
      for (let x = m(0.0625); x < W; x += m(RIB_PITCH)) {
        g2.fillStyle = 'rgba(255,255,255,0.07)'; g2.fillRect(x, 0, m(RIB_LIT), H);
        g2.fillStyle = 'rgba(0,0,0,0.35)'; g2.fillRect(x + m(RIB_LIT), 0, m(RIB_DARK), H);
      }
    });
    floorT.minFilter = THREE.NearestFilter;
    const floorM = flatT(floorT);
    floorM.userData.noLight = true;
    const floor2 = new THREE.Mesh(
      new THREE.BoxGeometry(inW, 0.05, wallLen),
      [linerM, linerM, floorM, darkM, linerM, linerM]);
    floor2.position.set(0, FLOOR_T - 0.025, bedMidZ);
    g.add(floor2);
    // side walls: outer face flush with the slab's own side plane at ±0.9 (they
    // used to stand at ±0.85, a 5 cm step in the body line), inner face liner
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_T, SKIN_H, wallLen),
        // the OUTBOARD face of each wall carries the skin: -x for the left
        // wall, +x for the right one, and only the +x one is mirrored
        s < 0 ? [linerM, outL, rimM, darkM, linerM, linerM]
          : [outR, linerM, rimM, darkM, linerM, linerM],
      );
      wall.position.set(s * (HW - WALL_T / 2), (ROCKER + RAIL_T) / 2, bedMidZ);
      g.add(wall);
    }
    // ── THE WHEEL WELL IS A BOX, NOT A HOLE ────────────────────────────────
    //
    // The user, with the diagnosis attached: "the tyre penetrates through into
    // the bed cavity, so looking down into the bed you can see the wheel inside
    // the truck… you cut an arch into the outer panel but did not build a WELL.
    // A real wheel well is a box: an outer arch, an INNER WALL that separates
    // the tyre from the load space, and a top that closes it."
    //
    // Exactly right, and the arithmetic agrees. The bed's side wall spans x
    // 0.74…0.90. The rear tyre spans 0.70…0.94 and tops out at 0.68 (0.663 when
    // this was written; item 252) against a bed floor at 0.50 and a WELL_TOP of
    // 0.72, which it still clears by 4 cm. So the tyre passes clean through the
    // wall, pokes 4 cm
    // into the cavity and stands 16 cm proud of the floor. On a sedan that is
    // hidden inside a closed body; on an open bed it is in plain sight.
    //
    // Inner wall plus lid, per rear wheel. The lid's top face at 0.76 IS the
    // hump a real pickup has over its rear wheels — free, once the well is a
    // box. All liner-dark, because every face of it that anyone can see is seen
    // from inside the bed, and the floor's darkening is what the user asked for
    // and likes.
    const WELL_IN = 0.66, WELL_TOP = 0.72, WELL_LID = 0.04;
    for (const s of [-1, 1]) {
      const inner = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, WELL_TOP - FLOOR_T, 0.86), linerM);
      inner.position.set(s * (WELL_IN + 0.02), (FLOOR_T + WELL_TOP) / 2, spec.wheelZ);
      g.add(inner);
      // The lid's TOP face is the bed floor continuing over the well, so it takes
      // the floor's own ribbed material — index 2 is +Y, the same slot floor2
      // uses. All liner-dark made the hump vanish into the floor it rises out
      // of; the ribs are what make it read as the floor STEPPING UP, which is
      // the thing the user says is the most recognisable part of a pickup bed.
      // ── THE LID STOPS AT THE WALL'S INNER FACE, NOT AT THE BODY SIDE ─────
      //
      // This is the black stripe on the back of the truck, and it was mine.
      // The lid was `HW - WELL_IN` wide and centred at (WELL_IN + HW) / 2, so
      // it ran from x 0.66 out to 0.90 — THROUGH the 0.16 m bed wall, with its
      // outer face landing exactly on the wall's outer skin at ±0.90. Two
      // surfaces in one plane, one of them liner-dark: a z-fight 4 cm tall and
      // 0.86 m long sitting in the body side above the rear wheel, which reads
      // as a black stripe painted down the flank.
      //
      // GOTCHAS §6, and the headboard eight lines below says so in as many
      // words — it "sits BETWEEN the walls so its sides are not coplanar with
      // their outer faces". The lid has to obey the same rule: it closes the
      // top of the well, and the well ends where the wall begins.
      const lidW = (HW - WALL_T) - WELL_IN;          // 0.66 -> 0.74, inside the wall
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(lidW, WELL_LID, 0.86),
        [linerM, linerM, floorM, linerM, linerM, linerM]);
      lid.position.set(s * (WELL_IN + lidW / 2), WELL_TOP + WELL_LID / 2, spec.wheelZ);
      g.add(lid);
    }

    // headboard, sealed against the back of the cab. Sits BETWEEN the walls so
    // its sides are not coplanar with their outer faces (GOTCHAS §6).
    const head = new THREE.Mesh(new THREE.BoxGeometry(inW, SKIN_H, 0.1),
      [linerM, linerM, rimM, darkM, linerM, linerM]);
    head.position.set(0, (ROCKER + RAIL_T) / 2, BED_Z0 + 0.05);
    g.add(head);
    // tailgate closes the end: the walls stop at half - GATE_T so the two ABUT
    // instead of overlapping
    const gate = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, SKIN_H, GATE_T),
      [outR, outL, rimM, darkM, flatT(bedRearT), linerM]);
    gate.position.set(0, (ROCKER + RAIL_T) / 2, half - GATE_T / 2);
    g.add(gate);
  } else { // van
    // tall box greenhouse, stub hood, near-vertical everything
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.8), hoodM(40 / 48, 1.7, 0.8));
    hood.position.set(0, BELT + 0.05, -half + 0.5);
    hoodPanel = hood; g.add(hood);
    g.add(loftCabin(0.85, 0.8, BELT, 1.78, -half + 0.85, half - 0.1, -half + 1.35, half - 0.2, glassM, roofOf(1.6, 2 * half - 1.55), flatT(cabinSideTex(plan.glass, -half + 0.85, half - 0.1))));
  }

  if (taxi) {
    const signT = pixTex(32, 12, (g2) => {
      g2.fillStyle = '#141416'; g2.fillRect(0, 0, 32, 12);
      g2.fillStyle = '#f2c94a'; g2.font = 'bold 8px monospace';
      g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText('TAXI', 16, 7);
    });
    signT.minFilter = THREE.NearestFilter;   // 0.18 m tall with letters on it — see busRollTex
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.24), flatT(signT));
    sign.position.set(0, 1.55, -0.1);
    g.add(sign);
  }

  // wheels
  const tireM = new THREE.MeshBasicMaterial({ color: 0x101114 });
  tireM.userData.noLight = true;
  const capM = flatT(hubcapTex());
  const front: THREE.Mesh[] = [];
  // ±0.82 — the pre-arch position, restored. Yes, 0.24 m of tyre centred there
  // puts its outer sidewall at 0.94 against a flank at 0.90, so 0.04 m stands
  // proud. That sliver is also the only reason the wheel reads as a circle at
  // all, because the flank is opaque: moving it inboard to 0.72 stopped the
  // poking and buried the wheel, which was worse. See the arch note above.
  // Which corners are bare. `jack` implies its own corner; `blocks` means all
  // four. Empty for a normal car, so the loop below adds the same four meshes
  // in the same order it always has.
  const off = new Set<Corner>(state.wheelsOff ?? []);
  if (state.jack) off.add(state.jack);
  if (state.blocks) for (const c of ['fl', 'fr', 'rl', 'rr'] as Corner[]) off.add(c);

  for (const wx of [-0.82, 0.82]) for (const wz of [spec.wheelZ, -spec.wheelZ]) {
    const corner = `${wz < 0 ? 'f' : 'r'}${wx < 0 ? 'l' : 'r'}` as Corner;
    if (off.has(corner)) continue;
    // tyreGeo phases the decagon onto a VERTEX so `y = 0.34` is real contact.
    // The hub stays at the radius, where it always was; only the polygon turned.
    const w = new THREE.Mesh(tyreGeo(0.34, 0.24, 10), [tireM, capM, capM]);
    // see makeBus: YZX so steering turns the wheel about its own vertical.
    // Front is -z (the whole model is built nose-first, see the file header).
    w.rotation.order = 'YZX';
    w.rotation.set(0, 0, Math.PI / 2);
    w.position.set(wx, 0.34, wz);
    g.add(w);
    if (wz === -spec.wheelZ) front.push(w);
  }
  // The paint, published rather than left to be guessed at: scripts/carstate.mjs
  // needs it to prove the engine bay is NOT body-coloured, and inferring it as
  // "the commonest colour on the car" picks the tyre black off the four wheels.
  g.userData.body = body;
  // THE BODY'S OWN DIMENSIONS, for the same reason. carstate.mjs opened with
  // `const ROCKER = 0.34, BELT = 0.84, HOOD_TOP = 0.94, TYRE_R = 0.34` — its own
  // copy of four numbers that live here, in two places in that file, used in
  // twelve assertions. Raising the beltline is the fix I recommend for the wheel
  // proportion (notes/BLOCKED-H.md), and it would have left every one of those
  // comparing against a stale sill: the probe guarding the change would have
  // been the thing broken by it. dd5ecde4 hit exactly this and called it "my
  // harness was carrying a stale width".
  g.userData.rocker = ROCKER;
  g.userData.belt = BELT;
  g.userData.hoodTop = HOOD_TOP;         // the hood slab sits ON the belt, HOOD_T thick
  /** The wheel's RADIUS, and since item 252 its true half-height in **both**
   *  directions: the tyre's bottom is at `hub − 0.34` and its top at
   *  `hub + 0.34 = 0.68`.
   *
   *  **THIS DOCSTRING USED TO SAY 0.6634 AND THAT WAS RIGHT AT THE TIME.** w28
   *  measured it and was correct: the wheel is a DECAGON, not a circle, and it
   *  was phased so that laying it on its side stood it on one of its FLATS —
   *  reaching only `0.34·cos(π/10) = 0.3234` above and below the hub. Four
   *  comments in this file said 0.68 and w28 was right to correct them.
   *
   *  What nobody noticed for another week is that the same fact meant the tyre
   *  never touched the road: seated at `ground + 0.34` for a circle, a
   *  flat-bottomed decagon floats `0.34 − 0.3234` = **16.6 mm**, on all four
   *  wheels of every vehicle on the block. That is what the user saw
   *  (*"fix the wheel on this cheap car"*). `tyreGeo` now phases the polygon
   *  onto a vertex, so the flat is gone from the bottom **and** from the top and
   *  `0.68` is real. Do not "correct" this back to 0.6634 without re-reading
   *  `tyreGeo`; the number changed because the geometry did.
   *
   *  Why the top is worth a docstring at all: it is the candidate first step for
   *  a sedan/hatch/van climb route (`notes/w21-car-roof-climb.md`,
   *  `notes/w28-car-climb-route.md`) against a guaranteed standing reach of
   *  0.551. **Neither shipped climb route actually uses it** — w29's own header
   *  records that the tyre route proved impossible and the sedan climbs the
   *  trailer deck instead — so the margin is headroom for a route that is not
   *  built, not a live constraint. The phase fix moves it the helpful way
   *  regardless: 0.6634 → 0.68.
   *
   *  Measured by `scripts/probes/w28-tyre-top.mjs` (prediction vs world, all
   *  four kinds) and `scripts/probes/w99-tyre-seating.mjs` (contact, both
   *  signs, with a self-test). */
  g.userData.tyre = 0.34;
  /** WHAT KIND OF CAR IS THIS? `makeCar` took the answer and dropped it, so
   *  nothing at runtime could ask — a probe had to identify vehicles by their
   *  geometry, and every caller that wanted a per-kind collider had to know the
   *  kind from its own call site instead of from the object. One line, and it
   *  is the enabler `carColliderSpec` needs at every site. */
  g.userData.carKind = kind;
  /** Half the collider's length for this kind. `ct/traffic.ts` reads exactly
   *  this off the group (`userData.halfLen ?? 2.5`) to size a moving vehicle's
   *  box, to space one car behind another, and to decide whether it is short
   *  enough to take the corner — and until now only `makeBus` set it, so every
   *  CAR fell through to that hard-coded 2.5 whatever kind it was. A hatch was
   *  driving inside a 5 m box and a pickup inside one 0.2 m short of it. */
  g.userData.halfLen = carHalfLen(kind);
  g.userData.wheelbase = spec.wheelZ * 2;
  g.userData.steer = (a: number) => { for (const w of front) w.rotation.y = a; };

  // ── not-just-parked: hood up, on a jack, up on blocks ────────────────────
  //
  // Everything below is skipped entirely unless asked for. See CarState.
  if (state.hood && hoodPanel) {
    // Swing the panel about its REAR edge, which is where the hinge is on all
    // four kinds — the hood is built butted up to the windscreen base, so
    // rotating the nose end up moves it away from the glass, not into it.
    const L = (hoodPanel.geometry as THREE.BoxGeometry).parameters.depth;
    const py = hoodPanel.position.y, hinge = hoodPanel.position.z + L / 2;
    hoodPanel.geometry.translate(0, 0, -L / 2);          // origin to the hinge
    hoodPanel.position.set(hoodPanel.position.x, py, hinge);
    hoodPanel.rotation.x = 0.95;                          // ~54°, nose end up

    // A RAISED HOOD OVER BODY-COLOURED METAL IS THE TRUCK BED BUG AGAIN. The
    // slab runs the full length under the bonnet with its top face at BELT, so
    // opening the hood on its own just exposes more green — the same "surface
    // nobody could see" that made two deep-bed requests fail. The bay has to
    // be near-black for the opening to read as a hole, because an unlit world
    // has no shadow of its own to darken it.
    const bayM = new THREE.MeshBasicMaterial({ color: 0x14161a });
    bayM.userData.noLight = true;                         // a lit engine bay reads as a brown tray
    const z0 = hinge - L + 0.06, z1 = hinge - 0.06;
    const bay = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.07, z1 - z0), bayM);
    bay.position.set(0, BELT - 0.02, (z0 + z1) / 2);      // top 0.01 above the slab: a lip of body colour shows all round
    g.add(bay);

    // Coarse lumps only. This is a small area seen from above at a grazing
    // angle — GOTCHAS §4 — so: three big shapes, no dither, no fine trim. The
    // round air cleaner is what makes it read as an engine at three metres.
    const engM = new THREE.MeshBasicMaterial({ color: 0x35383e });
    const capM2 = new THREE.MeshBasicMaterial({ color: 0x1d1e22 });
    engM.userData.noLight = true; capM2.userData.noLight = true;
    const zc = (z0 + z1) / 2;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.17, Math.min(0.62, (z1 - z0) * 0.55)), engM);
    block.position.set(0, BELT + 0.07, zc);
    g.add(block);
    const air = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 10), capM2);
    air.position.set(0, BELT + 0.19, zc);
    g.add(air);
    const batt = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.15, 0.32), new THREE.MeshBasicMaterial({ color: 0x2b2a1c }));
    (batt.material as THREE.MeshBasicMaterial).userData.noLight = true;
    batt.position.set(0.6, BELT + 0.06, z1 - 0.24);
    g.add(batt);
    g.userData.hoodOpen = true;
  }

  if (state.jack) {
    // A car on a jack TILTS. Without that it reads as a car with a wheel
    // missing parked next to a stand. The tilt has to apply to the whole body
    // and not to `g`, whose rotation.y belongs to the caller — so the body
    // moves into an inner group, which is also why this is opt-in only.
    const sx = state.jack[1] === 'l' ? -1 : 1, sz = state.jack[0] === 'f' ? -1 : 1;
    const body = new THREE.Group();
    for (const c of [...g.children]) body.add(c);         // copy: add() mutates g.children
    // 0.10 m of lift across a 1.64 m track and a wheelbase of spec.wheelZ*2.
    body.rotation.z = -sx * 0.061;
    body.rotation.x = sz * (0.10 / (spec.wheelZ * 2));
    // The lift must leave the two GROUNDED wheels touching down exactly as the
    // rest of the fleet does. THE TILT IS DELIBERATE AND IS NOT WHAT MOVED HERE;
    // only the reference did.
    //
    // ⚠ THIS VALUE WAS DERIVED FROM A DEFECT THAT NO LONGER EXISTS. It used to
    // read 0.022, and the comment underneath it explained why: *"every road
    // wheel in the world floors 0.017 m above the ground under it (80 of 88 on
    // the block, one figure, no spread), so 0.017 IS contact here"*. That was an
    // honest reading of the world at the time — but the 0.017 was item 252's
    // bug, not a convention, and `tyreGeo` has now taken it to 0.000. Left
    // alone, 0.022 would have held the jacked car's two grounded wheels 8.4 mm
    // in the air against a fleet that had just come down to the road: the
    // classic marooned constant, still correct arithmetic against a thing that
    // moved.
    //
    // So it is re-derived against the new reference — and derived from a
    // MEASUREMENT, which took two goes. The first attempt read "8 mm proud" out
    // of the comment above and subtracted it, giving 0.0136; w99-tyre-seating
    // then measured the grounded pair at **−7.2 mm, sunk into the tarmac**. That
    // 8 mm was itself stale — it described an abandoned trial at lift 0.03, and
    // the shipped 0.022 actually left the pair 0.6 mm proud of the fleet
    // (+0.0172 against +0.0166). Reading it as current turned a 1.2 mm
    // correction into an 8.4 mm one. The measured figure is 1.2 mm:
    //
    //     0.022 − 0.0012 = 0.0208     grounded pair → gap 0.0000, both corners
    //
    // AND THE JACKED CORNER COMES RIGHT AS A CONSEQUENCE. It used to stand
    // 0.1171 m proud where the line above says the design is "0.10 m of lift";
    // the extra 17 mm was the float, counted twice. It now measures ~0.0993 —
    // the documented intent, reached for the first time. The tilt angles are
    // untouched; nothing here levels the car.
    //
    // `scripts/probes/w99-tyre-seating.mjs` fails if this goes stale again: the
    // grounded pair is measured as part of the fleet, so a wrong lift shows up
    // as SINK or FLOAT rather than hiding behind the jacked corner.
    body.position.y = 0.0208;
    g.add(body);

    const jm = new THREE.MeshBasicMaterial({ color: 0x24262a });
    jm.userData.noLight = true;
    const jx = sx * 0.74, jz = sz * (spec.wheelZ - 0.35);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.24), jm);
    base.position.set(jx, 0.02, jz);
    g.add(base);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.30, 0.09), jm);
    post.position.set(jx, 0.19, jz);
    g.add(post);
    g.userData.jack = state.jack;
  }

  if (state.blocks) {
    // Sitting on stacks, not floating: three courses of 0.11 reach 0.33, and
    // the rocker is at ROCKER = 0.34, so the top course touches the sill.
    const bm = new THREE.MeshBasicMaterial({ color: 0x6e6862 });
    for (const bx of [-0.74, 0.74]) for (const bz of [spec.wheelZ, -spec.wheelZ]) {
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.24), bm);
        b.position.set(bx, 0.055 + i * 0.11, bz);
        g.add(b);
      }
    }
    g.userData.onBlocks = true;
  }

  return g;
}
