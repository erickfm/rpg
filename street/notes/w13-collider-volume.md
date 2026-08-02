# w13 — item 1: collider height/rotation (height done, rotation not started)

**Root cause (one line):** `fp.ts:9`'s `AABB` carried `{minX,maxX,minZ,maxZ}`
and nothing else, so every collider in the world — a car, a bollard, the
bodega's own walls — was a footprint extruded to infinite height, which is
why nothing could ever be stood on top of and why a diagonal wall could only
ever be faked as a staircase of small axis-aligned boxes.

## What changed, in the four committed stages the item asked for

1. **`fp.ts`: `AABB` gains optional `minY`/`maxY`.** Unread by anything at
   this commit — every existing `ctx.obstacle`/`solid` call omits them, so
   every collider behaves exactly as before. `minY` is reserved for headroom
   (walking under something) and nothing implements it yet — no real report
   needs it today, and a guessed mechanism is worse than none.
2. **`fp.ts`: the floor picker and the collision test both became
   height-aware, still with zero live effect.** `blocked()`/`escapeFrom()`
   take an optional `atY` — "where your feet actually are right now",
   tracked frame to frame in a new `lastWorldY` field — and a collider with a
   real `maxY` stops walling you off once `atY` is at or above it. Every
   caller that omits `atY` (`stand()`, both its own call sites) gets exactly
   the old always-blocked behaviour, which is what keeps "get up from a
   seat" from ever placing you on a car roof. `update()`'s floor pick now
   also asks `standTop()`: the highest standable collider top under you that
   you are *already* at or above (never a teleport-up). No collider anywhere
   sets `maxY` yet at this commit, so `c.maxY !== undefined` is false
   everywhere and every new branch is dead code — proven with `scenedump`,
   textures/structure byte-identical before/after both stages.
3. **One object made standable and walked onto: the parked pickup's open
   bed.** `crosstown.ts` splits the truck's single collision box (cab + bed)
   into two, after `settleParking()` runs (see "why after settle" below):
   the cab is untouched (still a full-height wall), the bed is now a wall
   below `PICKUP_BED.floorY` (0.50 m) and standable at or above it. Every
   other parked car — sedan, hatch, van wherever one appears — is completely
   untouched: one box, no `maxY`, exactly as it always drew.
4. **The false alarm named in the item, fixed:** `ct/gap.ts`'s
   `trapAgainst()` was flagging the bodega's own 45° chamfer staircase as a
   red trap corridor against itself. Root cause and fix below.

## Why the bed floor, not a hood or a roof

`PICKUP_BED.floorY` (0.50 m) is the one flat surface on the whole fleet
under the jump's own apex (~0.57-0.62 m from flat ground, measured — see
`fp.ts`'s own jump-tuning comments). Everything else solid in the world is
taller: the sedan's door line (`BELT` 0.84 m), every hood (0.94 m), every
roof (1.4-1.8 m), the dumpster (top at 1.24 m). **I did not retune the
jump.** Reaching those needs either a taller jump (a separate, tested,
already-tuned system — `scripts/jump-walk.mjs`'s whole spot list depends on
the current apex staying in its 0.45-0.8 m band) or a genuinely intermediate
step, and this item is about collider *shape*, not movement feel. Queued
below.

## Why the split happens after `settleParking()`, not before

`crosstown.ts`'s parking pass places each car, then a second pass
(`settleParking()`, right before this) re-nudges every parked car against
the *finished* world and moves the car's box in place if it still traps
against something registered later (the park, the car lot, an interior).
That second pass's own gap check is `others = colliders.filter(b => b !==
p.cb)` — it excludes the truck's own box **by reference**. A bed box
registered before that loop ran would be a *second* object at the same
position, not excluded by that filter, and the truck would read as trapped
against its own tailgate. So the split happens strictly after settling, by
mutating `p.cb` down to cab-only and pushing a new bed box straight onto
`colliders`/`citAvoid` (not `carColliders` — `colliders` was already spread
from it above, so pushing there wouldn't reach `FPRig`).

The rotation used for the split (`Math.cos(ry) >= 0 ? 1 : -1`, deciding
which world end is the bed) matches how every OTHER car collider in this
file already treats rotation — not at all, beyond picking a side. Real
oriented-box math is the rotation stage the item explicitly allows deferring
if height alone is enough for one item; I judged it was, and said so.

## `ct/gap.ts`'s false alarm — root cause and fix

**Root cause:** `trapAgainst()` checks a collider against *every* other one
in the list, not just its immediate neighbour. The bodega's chamfer is 8
abutting bands (`ct/bodega-corner.ts`, `BAND=0.25`, `CHF=WALK=2.0`).
Consecutive bands are flush — 0 m separation, correctly never flagged — but
two bands three or four steps apart in the *same* staircase, with solid
bands from that same wall standing in every metre between them, measure a
bare two-box separation of 0.5-0.75 m by the plain overlap-then-subtract
test, which lands inside the 0.40-0.95 m trap band. More bands (a finer,
better-looking chamfer) means more such pairs — which is why the corner lit
up worst exactly where the geometry was best, not worst.

**Fix:** before reporting a corridor as a trap, ask whether the exact gap
*rectangle* is already covered by other colliders reaching fully across its
far axis — as an **interval union**, not "does any single box cover it",
because the staircase fills a multi-band gap with several bands and no one
of them spans it alone.

**Verified**, not just argued: `corridorRect`/`corridorFilled` were run
against a script (`/tmp/gap-test.mjs`, not committed — a throwaway, see
below) that rebuilds the bodega's real 8-band staircase from
`ct/bodega-corner.ts`'s own constants. The pre-fix function reported **all 8
bands as false traps**; the fix reports **zero**, and a genuine 0.6 m gap
between two unrelated boxes — with or without a partial, non-spanning filler
nearby — is still caught by both. I did not commit that script since it
duplicates the bodega's own constants rather than importing them (a citation
copy, not a derivation) and this project's convention is committed scripts
that run against the live world, not synthetic unit fixtures; if a
permanent regression test is wanted, `notes/` or the desk should say where
vitest-style tests belong here — I found no existing pattern in this repo to
follow (`find . -iname '*.test.ts'` is empty).

`ct/debug-collision.ts` also got a real fix while I was in there: its box
height comment claimed "colliders carry no Y at all" (now false), and a
collider with a real `maxY` is now drawn at its own height in the `V`
overlay instead of the generic 2.4 m wall — so the one standable object
reads as one when you look at it.

## Verified, my own

- **Walked it, not screenshotted.** `scripts/w13-bed-check.mjs` (committed):
  warps next to the truck, walks flush against it (blocked, exactly like any
  other car), jumps, steps forward while still rising, and asserts the floor
  picker settles feet at exactly `0.500` — the collider's own `maxY` — then
  walks off the edge and confirms it drops back to `0.000`. Run against
  **both dev (:4198) and the built preview bundle (:4197)**; both pass.
- `scripts/jump-walk.mjs` — every required jump still lands on the floor it
  left, apexes still in band, on both dev and the built bundle.
- `scripts/interiors-walk.mjs bodega` — **26/26**, including the chamfer
  room the trap fix touches. `scripts/interiors-walk.mjs diner` — **26/26**,
  a non-chamfer room, as a general regression check on `fp.ts`. I did **not**
  run the full 12-room sweep: the one time I did, it did not finish inside
  ten minutes (it tests many approach angles per room, most of them
  unrelated to anything this item touches) and BUILDER-BRIEF §3/the w13
  brief are explicit that a slow run should be made smaller, not
  backgrounded and waited on. Two rooms, one of them the chamfer room the
  fix is *for*, is what I verified; the desk should run the rest if it wants
  full coverage.
- `scripts/bugsweep.mjs` — **0 STATION MISS**, no new console errors, on
  both dev and the built bundle (93 shots each).
- `npm run fp before`/`after` at every stage — **textures and structure
  byte-identical** every time (8351 objects, 1450 textures, same hash), the
  only diffs the documented noise floor (chase-light tints, pigeons drifting
  under 5 cm).
- Toggled the `V` collision overlay programmatically
  (`window.__ct.debugCollision(true)`) — no console errors, on.
- `npx tsc --noEmit` and `npm run build` both clean throughout.

## What I converted and what I did not

**Converted:** one collider (the pickup's bed) out of the whole world. The
mechanism (opt-in `maxY`, height-aware `blocked()`, `standTop()`) is general
and ready for more, but I did not widen it further — the item's own stage
order says stop after proving one object and report, not silently keep
going into "how many other things become standable" without the desk
weighing in on which ones matter.

**Not converted, and why:**
- **Every other car** (sedan, hatch, van) — real, taller flat tops exist
  (hoods, roofs) but none is reachable with the jump as currently tuned; see
  "why the bed floor" above. Converting them today would add dead-code
  `maxY` values nobody could ever stand on, which is worse than not adding
  them.
- **The bodega's 45° chamfer itself** — still 8 axis-aligned bands, not one
  oriented or segment collider. That is the item's explicitly separate
  rotation stage, not done here. The false trap it produced IS fixed
  (above), but the staircase shape remains.
- **Rotation generally.** Every OTHER car collider in the file still ignores
  yaw entirely (a fixed-width box at any angle) — unchanged, as it always
  has been. The bed split's own rotation handling is a two-value
  approximation (which end is the bed), not real oriented-box math, and I
  said so in the code rather than calling it more than it is.

## Queued for whoever picks up rotation next

1. **A real oriented-box or segment collider type**, so the bodega corner
   (and any future canted wall) can be ONE collider instead of a staircase —
   this is item 1's own explicitly-deferred half.
2. **A taller reachable surface on a car** (a hood, at 0.94 m) needs either
   a taller jump — a separate, already-tuned, already-tested system, not
   something to change as a side effect of a collider-shape item — or an
   intermediate step (the bed already gets you partway up a pickup; from
   there the cab roof at ~1.4-1.5 m might be one more short hop away, not
   measured).
3. If a permanent regression test belongs in this repo for `gap.ts`'s
   interval-union fix, `notes/` should say where vitest-style tests live —
   I found no existing pattern to extend and did not want to invent a new
   testing convention as a side effect of this item.

## Derived, not copied

`PICKUP_BED` (`ct/cars.ts`) is a genuine hoist, not a citation copy: the
mesh's own `BED_Z0`/`FLOOR_T`/`GATE_T`/`HW` locals in `makeCar`'s pickup
branch now *read* `PICKUP_BED.z0`/`.floorY`/`.gateT`/`.halfW` rather than
restate the same four numbers a second time — verified with `scenedump`
that the hoist alone changed nothing (textures/structure identical). The
`corridorRect`/`corridorFilled` gap-fix constants (the `1e-6` epsilons) are
plain floating-point tolerances, not measurements of anything in the world.
