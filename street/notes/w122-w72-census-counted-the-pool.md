# w122 — item 294: w72's census was counting the traffic pool as the lot

**Commit `c730a3a04`.** Files: `scripts/probes/w72-car-collider-consistency.mjs`
(named by the item), `scripts/canfail.mjs` (**not** named — the item's own DONE
WHEN asks for a canfail case, which can only live there).

## Root cause, one line each

**The rule:** rule 4 required the lot's cars to carry *"one box, all
identical"* — the blanket `2.8 x 4.0` box that **item 231 deliberately
replaced** with each kind's real turned tiers. It was red for doing its job.

**The census:** the row blamed
`!r.parts.some(q => q.tag !== '(untagged)')`, and that is true but **not
sufficient**. `ct/traffic.ts` parks an idle vehicle's collider as a
**degenerate POINT** at `(999, 999)`, and item 242 moved the idle **mesh**
there too — so each of the 5 idle pool cars sat *inside* all **20** point-boxes
in the world, and the `inside` clause handed every one of them all twenty.
Fixing only the tag filter would have left that intact.

**And it had blinded rule 1.** `bare` — vehicles carrying no collider, which is
the `ct/lot.ts` hood-up bug that once shipped a car you could walk through —
went to **zero and could never fire again**, because every idle car now "had"
twenty colliders. Watched: `MUTATE=drop` now reports `sedan PLACED at
26.37,-106.82 carries no collider at all`; before this change it could not.

## What the world actually contains (measured, `probes/w122-item294-census-facts.mjs`)

| | |
|---|---|
| tagged vehicles | **22** |
| on the streets | **6** — 2 sedan, 2 pickup, 2 hatch, all cardinal |
| in the used-car lot | **11** — 4 sedan, 2 pickup, 3 hatch, 2 van, turned 24–33° |
| lot colliders | **23**, tagged `<kind>-<surface>@lot<bay>` across **11 bays** |
| idle in the traffic pool | **5**, at `(999, 999)`, no collider |
| degenerate sentinel boxes | **20** — and only **6** belong to vehicles |

That last row is why the old rule 1 (`bare.length > sentinels`) had **fourteen
boxes of slack**: `ct/tenancy.ts:1073` and `ct/apartment.ts:313` park their own
caps on the same sentinel. It is a two-sided statement about the vehicles now —
**a vehicle carries a collider if and only if it is not at `IDLE_XZ`**.

The desk's figures were right: sedan 6, pickup 4, hatch 5, van 2, 23 tagged
colliders, 11 lot cars.

## The rule now

> **Every kind has one shape across every instance — street and lot in one
> population.**

17 placed vehicles, each held to `__ct.carSpec(kind)` by exact shape equality
(no tolerance to hide in), plus lot bookkeeping: one car per bay, no orphan bay,
no two bays landing on one car, worst box-to-car fit **0.668 m** against a 1.0 m
bar, floor of 8 cars.

## Watched red — five mutations, four runtime and one in source

| | |
|---|---|
| `MUTATE=flatten` | pickup roof full height → 2 fails |
| `MUTATE=stretch` | hatch body 0.5 m long → 3 fails |
| `MUTATE=drop` | side-street sedan loses its collider → `PLACED … carries no collider at all` |
| `MUTATE=lotshrink` (new) | one lot sedan 20% shorter → 2 fails |
| **`canfail lot-tier-shrunk`** (new) | **`ct/lot.ts` itself**, bay 0 only → **CAUGHT**, *"every mutated file restored byte-for-byte"* |

The canfail case shrinks **only `b === 0`**. A mutation that shrank every sedan
would leave one shape across all six and sail through the rule it is aimed at —
the same trap `lot-colliders-unturned` records for the aisle floor.

Cross-checked against item 231's own probe on the same world:
`w118-item231-lot-colliders.mjs` → *all lot collider checks pass*, aisle walked
both ways, 0 stalls.

## Found and NOT fixed

- **`w72` is still not registered in `checks.mjs`** — it lives in `probes/`, so
  nothing runs it by default and it went red on mainline unnoticed. The item did
  not ask for that and I did not do it. Its runtime is ~9 s; registering it
  would be one row.
- **A traffic-pool vehicle that is OUT on the block carries one untagged
  `vehicleBox`, not its kind's spec.** That is a third regime and arguably the
  same user sentence again, but it is a moving box and item 231/202c never
  covered it. The check reports such a car as `street` today; it is not judged
  against the spec, and nothing asserts it. Worth a row if the user ever sees a
  moving car's collision misfit its body.
- **Lot bay 2 has no car** (`ct/lot.ts:1964`, `if (b === 2) continue;` — a bay
  sold this morning). Deliberate, not a gap.

## Derived vs copied

`CAR_SKIN` and `IDLE_XZ` are copied with line citations (BUILDER-BRIEF §8's
sanctioned fallback — this is a browser probe and both are TypeScript module
constants). Everything else is read off the world: the spec from
`__ct.carSpec`, the bay labels from the colliders' own tags, the populations
from what the traverse found.
