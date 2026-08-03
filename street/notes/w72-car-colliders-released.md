# w72 — item 202 RELEASED with the root cause found and measured

Item 202, `ct/cars.ts` — *"ONE collider per CarKind, derived from the model, not
per instance"*. **I did not implement it. I found exactly where it goes wrong,
measured it in the running world, and I am handing it back because the fix
cannot be made inside the one file the item names.** Port 4280, `vite preview`
over `dist/`.

## The root cause — and the desk's row does not have it

The row says the mechanism *"already exists and is being bypassed somewhere"*
and asks the builder to *"find where an instance's box is chosen"*. It is not
being bypassed. **There is no per-kind collider mechanism at all. There are two
hand-written one-instance special cases:**

```
src/proto/crosstown.ts:845   const truck = parkedFleet.find((p) => p.kind === 'pickup');
src/proto/crosstown.ts:1014  const sedan = parkedFleet.find((p) => p.kind === 'sedan');
```

`.find()` returns **the first** match. So in the whole world, **exactly one
pickup and exactly one sedan** get the tiered, silhouette-hugging, height-capped
collider (`pickup-hood`, `pickup-cab-roof`, `pickup-bed-floor`,
`pickup-rail-left/right`, and the sedan's panel-read equivalents). **Every other
vehicle in the world** — every other sedan, the hatch, the van, every side-street
car, every moving traffic car, every car-lot car — gets one bare box:

```
src/proto/crosstown.ts:564   { minX: x - 1.05, maxX: x + 1.05,
                               minZ: zz - carHalf[kind], maxZ: zz + carHalf[kind] }
src/proto/ct/sidestreet.ts:141  the same box with its extents swapped
```

**No `maxY`. No `rot`.** `fp.ts:40`'s `AABB` makes both optional, and absent
`maxY` means the box is FULL HEIGHT. That is the user's sentence word for word:
*"some cars have full height others are aligned with the vehicle."*

His own diagnosis — *"seems like all trucks should be one object that are all
the same no?"* — is exactly right, and it is `.find()` that makes it false.

## Measured, not read

`scripts/probes/w72-car-collider-consistency.mjs`, against the built bundle:

```
kind        at (x, z)        body L x S x H      boxes tiers full-h   box L x S   over
(untagged)  -3.92, -30.04    4.9  x 1.89 x 1.41    1     1      0     2.1 x 1.45  [pickup-cab-roof]
(untagged)   3.62, -48.34    3.92 x 2.09 x 1.44    1     0      1     4.1 x 2.1   +0.18 m
(untagged)  15.37, -99.12    4.93 x 1.95 x 1.41    1     0      1     5.2 x 2.1   +0.27 m
(untagged)  26.37, -106.82   4.52 x 1.89 x 1.46    1     0      1     4.8 x 2.1   +0.28 m
(untagged)  38.16, -99.11    3.81 x 1.89 x 1.44    1     0      1     4.1 x 2.1   +0.29 m
(five more at (0,0) — the traffic pool, boxes parked at x 999 while idle)

1 kind has instances that do NOT agree — 5 distinct collider signatures
```

**One vehicle in the world carries a `maxY`. Four carry none** and are
**0.18–0.29 m longer than the body they wrap** and **2.10 m wide against bodies
of 1.89–2.09 m**. (The pickup's `2.1 x 1.45` is a probe limitation, not a world
fact — the test finds colliders covering the vehicle's CENTRE and the pickup's
other tiers sit fore and aft of it. The probe says so in its own output.)

**Where the +0.18–0.29 m comes from, and it is a second finding.** `carHalf` is
a hand-typed table, and it is typed **twice**:

```
crosstown.ts:516    const carHalf: Record<CarKind, number> = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 };
sidestreet.ts:122   const carHalf: Record<CarKind, number> = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 };
```

against `cars.ts:17`'s `CAR_SPEC`, which is the model's own table:

| kind | CAR_SPEC.len / 2 | carHalf | over |
|---|---|---|---|
| sedan | 2.25 | 2.40 | +0.15 |
| hatch | 1.90 | 2.05 | +0.15 |
| pickup | 2.45 | 2.60 | +0.15 |
| van | 2.30 | 2.45 | +0.15 |

A uniform 0.15 m collision skin — deliberate, and `crosstown.ts:900` calls it
*"the SAME 0.15 m collision skin the bed floor has shipped with since item 1"*.
So it is not a bug, but it **is** BUILDER-BRIEF §8's "second hand-typed copy",
in two files, of a number `CAR_SPEC` already owns. `CAR_SPEC.len / 2 + SKIN` is
the derivation, and `SKIN` is the only value anyone should be typing.

## Why I released rather than shipped it

**The fix cannot be made inside `ct/cars.ts`, the only file the item names.**
`cars.ts` can export the per-kind tier spec — that part is genuinely its job and
`PICKUP_BED`/`PICKUP_CAB` are already hoisted for exactly this — but nothing
changes until the callers read it, and the callers are **four files the item
does not name**:

| file | what it builds |
|---|---|
| `src/proto/crosstown.ts` | the parked fleet, both `.find()` special cases, `carHalf` |
| `src/proto/ct/sidestreet.ts` | the side-street cars, a second `carHalf` |
| `src/proto/ct/traffic.ts` | the moving fleet, via the `vehicleBox` hook |
| `src/proto/ct/lot.ts` | the car-lot cars |

BUILDER-BRIEF §9 is explicit that this is the boundary and that reporting it is
the success. `crosstown.ts` in particular is the desk's integration file, and
the item's own header warns that **item 198 is about to move up to 359 boxes
into `citAvoid`**, which vehicle boxes are already in. Two builders in
`crosstown.ts`'s collider section at once is the conflict that has already cost
this project a broken world.

**Landing the cars.ts half alone would be worse than landing nothing.** That is
the structural bug SESSION-STATE calls the most expensive on the project —
eleven times a builder has finished work that could not reach the world because
one wiring line lived in someone else's file.

## What the next builder needs, so none of this is re-derived

1. **The two `.find()` calls are the whole bug.** `crosstown.ts:845` and `:1014`.
2. **`makeCar` does not tag its group with its kind.** My probe had to identify
   vehicles by geometry because nothing at runtime can answer "what kind is
   this?" — `makeCar(kind, …)` takes it and drops it. `g.userData.carKind =
   kind` in `ct/cars.ts` is one line, is inside item 202's boundary, and is the
   enabler every downstream caller needs. **I left it out on purpose**: on its
   own it changes no collider, and an invisible landing is the failure above.
3. **`crosstown.ts:756` already loops `for (const p of parkedFleet)`** — a loop
   over the fleet that applies a per-kind spec is a small change from what is
   there, not new architecture.
4. **The tops must stay standable** and the two `.find()` blocks are the spec
   for what a pickup and a sedan should look like — they are correct, they are
   just applied once each. `notes/w13-collider-volume.md` records the measured
   reason a hatch and van have no first step, and `notes/w21-car-roof-climb.md`
   what one would cost.
5. **Guards that already exist and must stay green:** `scripts/w21-roof-climb.mjs`
   (asserts against the tagged roof, not "the first collider with a maxY") and
   `scripts/w29-sedan-climb.mjs`.
6. **Verify by walking and jumping in the V view**, on a parked AND a moving
   instance of all four kinds — the item is right that this cannot be
   screenshotted.
