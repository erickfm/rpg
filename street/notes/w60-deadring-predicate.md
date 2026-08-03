# w60 — item 98, the door dead ring: the prescribed predicate is unsafe

**I released this item back to TODO rather than half-do it.** `fp.ts` is the
world's selection resolver — every door, every seat, every machine — and it
carries two standing guards (`w40-bed-vs-door.mjs`, `seats-walk`) plus a
composition risk with item 85 that the item says *"neither builder could prove;
you must."* That is more than I could verify to the standard the rest of my
session met, and an unverified change here is worse than none.

**But the item's prescribed fix is wrong, and finding that out is cheap.** This
note exists so the next builder starts from here instead of from zero.

## The diagnosis is right. The prescription is not.

Item 98 says, in bold:

> *"The predicate that works is `d * Math.sin(offAxis) < s.r` — perpendicular
> distance to the aim ray — contiguous on all 40 modelled lanes."*

The corridor idea is right — a constant angle is a cone, and a cone pinches shut
as you arrive, which is the dead ring. **But that expression, written into
`fp.ts:937` as it stands, offers everything BEHIND the player.**

`offAxis` at `fp.ts:930` is `Math.abs(Math.atan2(cross, dot))`, so it ranges over
**0 … π**, not 0 … π/2. And `sin(π) = 0`. Running the real expression against the
real `offAxis`:

```
facing +z, spot radius 1.05
  dead ahead, 3 m            offAxis    0.0 deg   lateral 0.000   -> looked = true
  3 m ahead, 0.9 m left      offAxis   16.7 deg   lateral 0.900   -> looked = true
  90 deg to the left         offAxis   90.0 deg   lateral 3.000   -> looked = false
  DIRECTLY BEHIND, 3 m       offAxis  180.0 deg   lateral 0.000   -> looked = TRUE
  BEHIND, 5 m, 0.5 m off     offAxis  174.3 deg   lateral 0.500   -> looked = TRUE
  BEHIND, 20 m               offAxis  180.0 deg   lateral 0.000   -> looked = TRUE
```

A spot **twenty metres directly behind you** passes. The predicate does not
describe a corridor in front of the player; it describes an infinite
**double-ended** cylinder through him, and the backward half is unbounded except
by `d < reach`.

**This is the exact bug the previous round was fought to close.** `fp.ts:909-914`:

> *"Tightening the look cone from 35.5° to 15° halved the median off-axis angle
> but left 43% of winners more than 15° off his aim, and the worst sample in 264
> was a spot **180° behind him**."*

and the user's words behind it, *"i feel like i select stuff without even looking
at it."* Applying item 98 verbatim re-opens that, world-wide, for every spot in
reach. It would also be invisible to the two checks the item names — both walk
*toward* doors, so neither has a leg that stands with its back to one.

## What the predicate should be

The missing half is a front-hemisphere guard: the AXIAL component must be
positive, not merely the lateral one small.

```ts
// lateral offset from the aim ray, and only ahead of the player
const ahead = fx * dx + fz * dz;                 // the dot product offAxis already uses
const looked = d < reach && ahead > 0 && d * Math.sin(offAxis) < s.r;
```

`ahead` is already computed inside the `atan2` on line 930 and should be lifted
out rather than recomputed, so the two can never disagree about which way the
player is facing.

## What still has to be proved, and what I would watch

1. **The close-range end.** `d * sin(offAxis) < r` is *permissive* near the spot:
   at `d = 0.6` with `r = 1.05`, every heading up to 90° passes. So `looked`
   becomes nearly always-true at arm's length.
2. **That is exactly where item 85 lives.** 85's facing gate is `looked` itself
   (`fp.ts:856`, *"the gate is `looked` itself — the SAME `lookTolerance` cone"*).
   If `looked` is almost always true within a metre, **the facing gate stops
   gating**, and the bed-vs-door case 85 was written for comes back — the near
   tier ranks by distance alone, and the bed is nearer. `w40-bed-vs-door.mjs`
   is the check for precisely this, and it is why the item insists both suites
   run. My reading is that this, not the dead ring, is the hard half of the item.
3. `RADIUS`/`onIt` (tier 1) is unaffected either way — standing *in* a spot does
   not consult aim at all.

## Also worth knowing before starting

- `lookTolerance` is **exported** and the item says item 112 touches the same
  file — check nothing else consumes the cone's shape before changing it.
- The item's own proof that the dead ring's outer edge does not move with radius
  (3.84–3.89 m for r = 1.05 … 1.80) is sound and does not need redoing.

## Status

Item 98 released to TODO with `./scripts/claim.sh --release 98 w60`. **No change
was made to `src/proto/fp.ts`.** The finding above is the whole of the work.
