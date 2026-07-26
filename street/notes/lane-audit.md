# Sidewalk lane audit — the whole block

> *"in general we should not encroach the already cramped sidewalk"*

**Headline: the lane holds. No fixture anywhere on the block leaves less than
1.15 m, and 97.5% of it is clear at 1.40 m or better.** The desk's worry —
"a lot of new furniture has landed today from five different builders who cannot
see each other's work" — is not borne out by measurement.

## Method

Player capsule **0.72 m** across (`RADIUS 0.36`). GOTCHAS §9: the 2 m lane is
sacred. At every 0.25 m along each lane I take the nominal walk band, subtract
every collider crossing it, and keep the **largest continuous free run** — not
"does a thing touch the walk", but "how much unbroken width is left to walk
through". 1380 samples per population, four lanes:

| lane | band | extent |
|---|---|---|
| west walk | x −7.25…−5.25 (2.00 m) | z −108…15 |
| east walk | x 5.25…7.25 (2.00 m) | z −96…15 |
| side st north | z −97.75…−96.25 (**1.50 m**) | x 8…56 |
| side st south | z −110.25…−108.25 (2.00 m) | x −6…56 |

**Note the side street north is only 1.50 m wide to begin with** — it starts
below the sacred 2 m, before anything is placed on it.

## Two populations, and why they must not be conflated

364 colliders, of which **12 are people**. `crowd.ts:153` makes every citizen
solid with a box that **follows them**, and the author sized it deliberately:

    // ±0.25, not ±0.30: bodies read the tiniest bit too wide to slip past.
    // With the rig's 0.36 m radius that puts the gap needed to squeeze by a
    // person at 0.61 m instead of 0.72 m.

My first scan mixed them in and produced six "impassable" pinches at 0.63 m,
spaced ~16 m apart. That spacing is `crowd.ts`'s own `const z = 4 - i * 16`.
They were pedestrians, caught mid-stride, and a second run put them elsewhere.
**A pinch caused by a person is transient; a pinch caused by a fixture is
permanent, and only the second is what the user's rule is about.**

## FIXTURES — the user's rule

| band | samples | % |
|---|---|---|
| IMPASSABLE <0.72 | 8 | 0.6% |
| URGENT 0.72–0.80 | **0** | 0.0% |
| PROBLEM 0.80–1.00 | **0** | 0.0% |
| tight 1.00–1.40 | 26 | 1.9% |
| clear ≥1.40 | 1346 | **97.5%** |

**All 8 impassable samples are one object** — `x −7…7, z 14.2…20.2`, the
street's closed north end cap, which is the world boundary and not encroachment.
My scan range simply ran 1 m past the end of the street. Excluding it, **nothing
on the block is impassable and nothing is even under 1.00 m.**

### Every fixture under 1.40 m, ranked

| clear | what | where | owner |
|---|---|---|---|
| **1.15 m** | **Tony's Pizza bus bench**, 1.80 m long, at the kerb (`x 5.07…5.73`) | east walk z −35.8…−34.3, 1.8 m long | `props` |
| 1.15 m | building line on the narrow side street | side st north x 45.0 | `vice` |
| 1.15 m | lamp post | east walk z −93.0 | `props` |
| 1.19 m | building facing | side st north x 9.8…10.3 | `street` |
| 1.20 m | lamp post | side st north x 20.0 | `props` |
| 1.22 m | building facing | side st north x 10.8…11.3 | `street` |
| 1.27 m | untagged mass 1.21 × 5.15 × 2.75 | side st north x 13.5, x 31.5 | — |
| 1.33 m | lamp post | east walk z −51.0, −23.0; west walk z −65.0; side st south x 34.0 | `props` |

Lamp posts are a 0.14 m column on a 0.28 × 0.28 base (`lampPart: "halo"`) and
cost 1.20–1.33 m wherever they stand. The **bus bench is the single tightest
fixture on the block** at 1.15 m, and it is still 0.43 m wider than the player.

**Nothing needs routing.** Every instance clears the 1.00 m threshold the desk
set as "a problem". I am reporting the ranking so the next thing placed near the
bench or on the 1.5 m side street is placed knowing what is already there.

### The instrument is not simply failing to see

GOTCHAS §34 — a check can pass having found nothing. The same scan, unchanged,
reported **0.63 m** for pedestrians and **0.25 m** for the end cap. It registers
narrow gaps when narrow gaps exist, so "97.5% clear" is a measurement and not a
silent no-op.

## Should this be a permanent test rather than an audit?

**Yes** — and it is nearly written; `scripts/laneaudit.mjs` already computes the
minimum clear width per lane. Builder A owns `scripts/**` and would only need to
assert it. But two exclusions decide whether it is useful or muted within a week:

1. **It must exclude people, or it will flap.** Citizens move every frame. My
   own two runs disagreed — 0.63 m in one, clear in the next. A lane assertion
   that includes them fails randomly, and a randomly-failing test gets ignored.
   Filter on the exact ±0.25 footprint, or better, have `crowd.ts` tag its boxes.
2. **It must clip the lane to the walkable street, or it fails on the world's
   own boundary.** The end cap at z 14.2 is not encroachment.

Suggested assertion: fixtures only, **fail under 1.00 m, warn under 1.20 m**.
That puts today's worst case (the bus bench at 1.15 m) in the warn band, which is
right — it is not a bug, but it is the place with least room to give.

## What this audit did NOT cover

- **Overhead clearance.** Everything here is a plan-view (xz) measurement, because
  colliders are xz AABBs. A projecting fascia, blade sign or awning that a player
  walks *under* cannot be seen by this method at all. If the concern about
  "fascias and stallrisers standing proud" is about head height rather than
  footprint, that is a different scan and this one says nothing about it.
- **The park interior.** The west walk beside the park is measured, but the park's
  own paths are not a 2 m lane and were out of scope here.
