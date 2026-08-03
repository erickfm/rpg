# w81 — item 202c: ONE collider per CarKind

The user, twice, the second time with the V collision-debug view on and
diagnosing it himself:

> *"also not all car and object collidable boxes are consistent. some cars have
> full height others are aligned with the vehicle. i love the car with the
> trailer thing btw keep that tysm."*
>
> *"truck collision isnt accurate to the truck but the other truck is? it seems
> odd. seems like all trucks should be one object that are all the same no?"*

**He was right, his proposed fix was the right one, and it is now the way the
world works.** Port 4370, `vite preview` over `dist/`.

## Root cause, in one line

`.find()` returns the FIRST match — so of the world's four pickups and six
sedans, exactly one of each got the tiered, silhouette-hugging, height-capped
collider, and every other vehicle got a bare box with no `maxY`, which `fp.ts`
reads as full height.

```
crosstown.ts:845   const truck = parkedFleet.find((p) => p.kind === 'pickup');
crosstown.ts:1014  const sedan = parkedFleet.find((p) => p.kind === 'sedan');
```

w72 found this and released the item rather than land half of it, because the
fix needed four files the row did not name. Its handoff
(`notes/w72-car-colliders-released.md`) is why none of it had to be re-derived.

## What changed

| file | change |
|---|---|
| `ct/cars.ts` | `carColliderSpec(kind)` states the tiers ONCE per kind, in the car's own local frame, next to the panel constants they derive from. `carColliderBoxes()` places them at a yaw. `CAR_SKIN` (0.15), `CAR_HALF_W` and `carHalfLen()` replace the `carHalf` table. `SEDAN_BOOT` hoisted the way `PICKUP_CAB` already was. `makeCar` stamps `userData.carKind` and `userData.halfLen`. |
| `crosstown.ts` | both `.find()` blocks — about 180 lines — replaced by one loop over `parkedFleet`. Publishes `__ct.carSpec(kind)`. |
| `ct/sidestreet.ts` | same spec, tags labelled `@side`. |
| `ct/traffic.ts` | **untouched, and it did not need to be** — see below. |
| `ct/lot.ts` | **untouched, deliberately** — see "found, not fixed". |

**Not one tier's shape moved.** The pickup's five tiers and the sedan's two are
w21's and w29's own numbers, relocated. `w21-roof-climb.mjs`,
`w29-sedan-climb.mjs` and `stepoff-walk.mjs` are green without an edit, which is
the strongest evidence available that the shapes are byte-for-byte what they
were.

### The second hand-typed table, which was the size defect

`carHalf = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 }` was written out
**identically in two files** (`crosstown.ts:516`, `sidestreet.ts:122`). Every
entry is exactly `CAR_SPEC[kind].len / 2 + 0.15`. Nothing tied the table to the
model, which is why the shipped boxes were 0.18–0.29 m longer than the bodies
they wrapped. Both tables are gone; `carHalfLen()` is the derivation and
`CAR_SKIN` is now the only number anyone types.

`ct/traffic.ts` was reading `userData.halfLen ?? 2.5` and **only `makeBus` ever
set it**, so every car in the moving fleet drove inside a 5 m box whatever kind
it was. `makeCar` sets it per kind now (4.1–5.2 m), from the same derivation.

### Two physical surfaces must not answer to one name

Tiers are tagged `pickup-hood`, and the side street's are `pickup-hood@side`.
This is not decoration. `w21-roof-climb.mjs:35`, `w29-sedan-climb.mjs:37` and
`stepoff-walk.mjs:57` all build `Object.fromEntries(...)` over the tags, so a
duplicate silently resolves to whichever was registered last — and the side
street's truck lies along **x** where the main street's lies along **z**, so
w21 would have walked to a truck whose entire axis convention is rotated 90°,
and reported a broken world. The SHAPE is shared; the NAME is per instance.

## Verified

- **`scripts/probes/w81-side-truck-climb.mjs` — the side street truck, WALKED.**
  It never had a walk. Road → bed floor 0.500 → bed rail 0.970 → **cab roof
  1.415** → hood 0.940 → street, on the first attempt; still a wall on foot
  (stopped at z −97.68 outside a box spanning −100.17…−98.07); and off the roof
  **4/4 ways**. Every axis is derived from the colliders, so the file works on
  either street.
- **`scripts/w21-roof-climb.mjs` PASS** — and it still walked the MAIN street
  truck (x −3.92), which is the `@side` labelling doing its job. Hop margin
  1 spare frame at the dt clamp, unchanged.
- **`scripts/w29-sedan-climb.mjs` PASS**, **`scripts/stepoff-walk.mjs` PASS**
  (all six step-offs, kerb untouched at 0.140 m).
- **`npm run sweep`: 96 shots, 0 STATION MISS, 0 COVERAGE, 0 console errors.**
  `node scripts/health.mjs`: WORLD OK. `npx tsc --noEmit`: clean.
- **Looked at**, through the V overlay the user filed this from:
  `shots/w81-main-truck-V.png`, `shots/w81-side-truck-V.png`,
  `shots/w81-side-sedan-V.png`. My verdict: the boxes hug the silhouettes; the
  boot-lid tier stops at the boot, the cab box stops at the roof, and nothing
  towers above its own car any more.

### The ground footprint did not move, and that is the safety argument

A kind's tiers tile its length end to end (nose … cowl … bed front … tail) and
the bed rails lie inside that, so **the union of every tier is exactly the box
`nudgeClear` was run against**. That is what makes it safe to split a box after
the trap-band rule has already run, and it is why the 2 m lane past a parked car
is unchanged at ground level to the millimetre. The probe asserts the union
against the drawn body on every cardinal-parked car: measured over-size is
0.18–0.30 m against a 0.30 m allowance (0.15 per side).

## The probe: it could not have verified this, and now it can

`scripts/probes/w72-car-collider-consistency.mjs` measured the defect well and
**could not have caught the fix failing**, for three reasons, all now fixed:

1. **It always exited 0.** It printed `1 kind(s) have instances that do NOT
   agree` and returned success.
2. **It identified vehicles by geometry**, because nothing tagged them — so it
   dropped, silently, every car turned off a cardinal (the lot's 11, whose
   bounding box fails a `short < 2.5` filter) and the main street's sedan (whose
   trailer fails a `long < 5.6` one). **10 of 22 vehicles were being measured.**
3. **It compared world AABBs.** Two identical cars parked at 90° to each other
   have different world boxes and the same collider.

It now censuses by `userData.carKind` (22 vehicles, nothing skipped silently),
compares **shape** — (long, short, maxY) — against the kind's **declared spec**
via the new `__ct.carSpec`, and carries population floors on every assertion.

**Comparing against the spec rather than instance-against-instance matters
twice**: two instances wrong the same way used to read green, and instance
comparison cannot tell a tier of the KIND from something hitched to one
particular car. The sedan's trailer is reported as an **attachment**, not a
disagreement, which is also why it is deliberately not in
`carColliderSpec('sedan')` — folding it in would hitch a flatbed to every sedan
in the world.

**Three negative cases, each of which must fail, and does:**

```
MUTATE=flatten   pickup-cab-roof@side goes full height   → FAIL (2 shapes)   exit 1
MUTATE=stretch   hatch-body@side grows 0.5 m             → FAIL (over-size)  exit 1
MUTATE=drop      the side street sedan loses its box     → FAIL (uncollidered) exit 1
clean run                                                → PASS              exit 0
```

**And the idle traffic pool is not filtered out by `visible`** — GOTCHAS 79's
trap. Six pool vehicles sit at the origin with their colliders parked at the
x = 999 sentinel. The probe counts every vehicle carrying no collider and fails
if any of them **has been placed**, which is the real bug that class hides
(`ct/lot.ts` once shipped a hood-up car with no collider at all).

> One number in that file was wrong on the first cut and worth recording:
> counting the sentinel as `minX >= 900` returns **142**, because the interiors
> belt sits out past x 600. The pool parks a degenerate POINT — `minX === maxX
> === 999` — and counting that gives 20.

## FOUND, NOT FIXED — for the desk to queue

**`ct/lot.ts:1986` gives all 11 used-car-lot cars the identical untagged box,
`x ± 1.4, z ± 2.0`, full height, whatever kind of car it is and whatever angle
it sits at.** That is the other half of the user's first sentence and it is
still true. Measured: a `4.0 × 2.8` box on bodies of `4.18–5.12 × 3.23–4.10`
(world AABB at 24–32° of yaw) — i.e. the collider is **1.12 m SHORTER than the
pickup it wraps**.

**I left it alone on purpose and this is the reason, not an omission.** The
source says why at `ct/lot.ts:1980`: *"deliberately tighter than the true
footprint: you can brush a wing, and in exchange the 6.8 m you can see down
stays 6.8 m you can walk down."* Adopting the street's spec there trades
collider accuracy for aisle width, which is a decision with a playtest in it and
not a refactor. Two further reasons it is not a like-for-like swap:

- **the lot's cars are turned 24–32°**, and `carColliderBoxes` is
  dominant-axis, as every car collider in this world has always been. Applied at
  31° it would produce a box aligned to the wrong axis — worse than what is
  there. Doing it properly means `AABB.rot` (which `fp.ts:43` supports and the
  bodega chamfer already uses), not the existing mapping.
- **lot cars are jacked, on blocks and hood-up** (`NOT_PARKED`), so a stock
  kind's tier heights are wrong for several of them by construction.

**Recommended smallest step, if the desk wants one:** keep the footprint exactly
as it is — so the aisle cannot move by a millimetre — and give the box the
kind's own roof height as `maxY`. That answers *"some cars have full height"*
for the lot, is unreachable from the ground so nothing becomes standable, and
needs a `CAR_ROOF_Y` table hoisted out of `makeCar`'s four `loftCabin` calls
(sedan 1.46, hatch 1.44, pickup `PICKUP_CAB.roofY` 1.415, van not yet read).
The probe holds the lot to its own rule meanwhile — one box per car, all
identical — so a drift there fails rather than hiding.

## Also found, not fixed

- **`ct/traffic.ts` still hard-codes the moving box's half-WIDTH as `1.15`**
  (`traffic.ts:306-307`) where every parked box uses `CAR_HALF_W` = 1.05. It is
  a deliberate driving margin rather than a copy of a body dimension, so I left
  it; but it is the last vehicle dimension in the world not derived from
  `CAR_SPEC`.
- **Moving vehicles carry one box, not the kind's tiers.** Deliberate: a vehicle
  mid-corner has no dominant axis, so the per-tier mapping would jump
  discontinuously through a turn. Doing it properly needs a rotating-AABB per
  tier. Worth noting that the traffic pool contains **no pickup**, so none of
  the user's reported symptom lives there.

## One thing about this row that was right

The row said `.find()` was the whole bug, that `makeCar` does not tag its kind,
and that the two blocks were the correct spec applied once each. **All three
held up exactly.** w72's handoff saved this item most of its cost.
