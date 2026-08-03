# Item 231 — the lot's colliders, and the tradeoff that turned out not to exist

**Worker onehundredeighteen, 2026-08-03. Port 4740. Verified on the BUILT
bundle.** Files: `src/proto/ct/lot.ts` (the item's own), `scripts/canfail.mjs`,
two probes in `scripts/probes/`.

---

## Root cause, in one line

The lot registered **one hand-written box per car** — `x ± 1.4, z ± 2.0`,
untagged, full height, square to the world — instead of the car's kind's
declared collider, because the dominant-axis `carColliderBoxes()` cannot express
a car raked 31.5°, and nothing else could either until `AABB.rot` existed.

## The headline: there was never a tradeoff to make here

The row, `notes/w81-item202c-car-colliders.md` and the source comment all agree
that the lot's under-sized box **buys aisle width**:

> *"A 1.8 x 4.6 car at 0.55 rad has a 3.9 x 4.9 bounding box, which from NORTH_Z
> would reach 0.5 m past the aisle edge, so this is deliberately tighter than the
> true footprint: you can brush a wing, and in exchange the 6.8 m you can see
> down stays 6.8 m you can walk down."*

**Every word of that is true of a BOUNDING box, and none of it is true of the
car.** A 3.9 × 4.9 axis-aligned box is what you need to *contain* a raked car,
and most of it is empty corner. The turned rectangle is 2.1 × 5.2 and sits where
the car actually is.

**Measured, with every kind's full declared spec at its real angle and no clamp
of any kind: the aisle between the rows is 7.52 m** — against the **6.8 m** the
lot is authored around and the **8.00 m** the old under-sized box left. The
promise in that comment is kept without paying for it.

## What changed

`ct/lot.ts` now emits `carColliderSpec(it.kind)`'s tiers, placed at the car's own
yaw with `rot`, tagged `<tier>@lot<bay>`. That is item 202c's one-spec-per-kind
reaching the last place in the world it had not.

`rot` is honoured by all three consumers, checked before relying on it:
`fp.ts` (`inFrame`/`outOfFrame`), `ct/gap.ts` (the trap-band rule) and
`ct/debug-collision.ts` (**the V overlay the user filed this from**).

## Measured, before → after

| | before | after |
|---|---|---|
| car-tagged lot colliders | 0 | **23** |
| bays with their own collider set | 0 | **11 / 11** |
| distinct footprints in the lot | 1 (every car identical) | **10** |
| turned to the car's real angle | no | **11 / 11** |
| aisle between the parked rows | 8.00 m | **7.52 m** (authored 6.8) |
| narrowest clear span anywhere in the aisle | 5.40 m | **5.85 m** (wider) |
| back-corner bays' reach toward the aisle | 2.000 m | **1.939 m** (less) |
| aisle walked E, longest stall / distance | 0.0 s / 17.2 m | 0.0 s / 17.2 m |
| aisle walked W, longest stall / distance | 0.5 s / 32.0 m | 1.0 s / 32.0 m |

**The corners got better, which was the part I expected to have to defend.**
They stand 1.3 m off the aisle band and the OLD box already crossed it by 0.70 m;
at the rake they actually sit at (65.9°) their turned boxes reach *less* far.

**And the user's sentence is now literally true**, from
`w72-car-collider-consistency.mjs`: **sedan 1 shape across 6 instances, pickup 1
across 4, hatch 1 across 5, van 1 across 2.** A lot pickup is a street pickup.

## The DONE WHEN clauses

1. **colliders derived from their kind at their real angles** — yes, 11/11, exact
   declared shapes, `rot` = the car's own yaw.
2. **the 6.8 m aisle still walkable, width reported** — **7.52 m** between the
   rows, walked both ways with stalls of 0.0 s and 1.0 s. Narrowest span
   anywhere in the aisle **5.85 m**, up from 5.40.
3. **jacked cars handled** — see below.
4. **no moving vehicle uses a default half-length** — **confirmed already fixed
   by 202c**, not re-fixed. `makeCar` stamps `userData.halfLen` per kind
   (`cars.ts:1545`), `makeBus` at `:1056`; measured **0 vehicles in the world**
   fall back to `traffic.ts`'s `?? 2.5`. The fallback is now dead code in four
   places, which is worth a follow-up but is not a defect.

### Jacked cars, honestly

`makeCar` tilts a jacked body **inside its own inner group**, so `ct/lot.ts`
cannot see the tilt and a height *cap* on such a car would sit ~0.10 m low.
Today's jacked bay is a **hatch**, whose spec is a full-height wall with no cap
at all, and the blocks bay is a **sedan** whose body does not move (it loses its
wheels and gains block stacks). **So there is no cap here to be wrong** — a fact
about the current stock list, not a guarantee, so the probe **asserts** it: it
fails if a jacked bay ever draws a kind with a capped tier. Doing better needs
the tilt exported from `ct/cars.ts`, which item 231 does not name.

## Two things I got wrong

1. **I clamped the pickup and van** to hold the old 8.00 m, and
   `w72-car-collider-consistency.mjs` caught the cost: a lot pickup came out
   **0.194 m shorter** than a street pickup — *"seems like all trucks should be
   one object that are all the same no?"* re-created in a new place. Removing
   the clamp made the collider exact **and** left 7.52 m of aisle. **The probe I
   did not write is the one that found it.**
2. **My first negative case SLEPT.** It mutated the clamp, and the probe asserted
   a **floor** on aisle width (≥ 6.8 m) against a real 7.52 — 0.72 m of slack.
   The mutation put the whole south row's noses into the aisle and moved the
   number 0.16 m, so it stayed green. Replaced with a two-sided **range** plus an
   explicit turned-collider assertion. **A floor with slack in it is not a
   guard** — this is the brief's "every check asserts a floor, never a ceiling"
   in miniature.

Two smaller ones: my first census read **the traffic pool at the (999, 999)
sentinel** and reported 5 cars, missing all 11 (w81's documented trap, and
GOTCHAS 79b's cousin); and my corner-reach line reported **10.86 m** because
**for a turned box `minZ`/`maxZ` are extents in the box's OWN frame, not world
coordinates** (`ct/gap.ts:35` says so outright).

## Negative case

`canfail.mjs` case **`lot-colliders-unturned`** — drops `rot` from the lot's
boxes, which is the exact mistake w81 warned the next worker off and the most
likely way this gets "simplified" back to broken.

Measured: **11 of 11 bays unrotated, aisle 7.52 → 7.22 m, narrowest span
5.85 → 5.27 m. CAUGHT, exit 1**, green pre-pass, files restored byte-for-byte.

## Verification

| | |
|---|---|
| `w118-item231-lot-colliders.mjs` | 17/17 OK, **exit 0** |
| `canfail.mjs lot-colliders-unturned` | **CAUGHT**, exit 0 |
| `w21-roof-climb.mjs` / `w29-sedan-climb.mjs` / `stepoff-walk.mjs` | **exit 0** each |
| `side-walk.mjs` | **exit 0** |
| `npx tsc --noEmit` | exit 0 |
| `health.mjs` | `WORLD OK`, exit 0 |
| `bugsweep.mjs` | **0 STATION MISS, 0 COVERAGE**, exit 0 |

**Looked at**, V overlay, same camera before and after
(`shots/w118-lot-V-north-row{,-BEFORE}.png`, `shots/` is gitignored). My verdict:
the lot boxes now follow each car's rake instead of sitting square to the world,
and **the red trap boxes are identical in both shots** — the red around the
office frontage and the centre car is pre-existing and not something this change
introduced.

## FOUND, NOT FIXED — for the desk

1. **`scripts/probes/w72-car-collider-consistency.mjs` is now RED on one
   assertion, and it is stale BY DESIGN.** w81 wrote it to hold the lot to its
   old rule — *"one box per car, all identical — so a drift there fails rather
   than hiding"* — and item 231 is that drift, deliberately. Its remaining
   failure is `a lot car carries more or fewer than the one box ct/lot.ts
   registers`. **It also has a real bug: its lot census reads the TRAFFIC POOL,
   reporting "THE LOT'S 5 CARS" with 0×0 boxes** — 5 is the pool count and the
   lot has 11, so that section has been measuring the wrong objects. Not fixed:
   the file is not named by item 231 (BUILDER-BRIEF §9). **The rest of that probe
   now passes and is the strongest evidence this item worked**, so it is worth a
   small row rather than being left red.
2. **`ct/traffic.ts`'s `userData.halfLen ?? 2.5` fallback is dead** in four
   places (`:331, :366, :367, :420, :434`) — 0 vehicles rely on it. Deleting the
   `?? 2.5` would turn a silent wrong answer into a type error.
3. **`ct/cars.ts` does not export the jack tilt**, which is why the jacked-car
   height case above is asserted rather than handled.
