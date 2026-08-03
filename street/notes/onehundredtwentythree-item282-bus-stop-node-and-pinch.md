# Item 282 — the node was the bench's OLD z, and git proves it

**Worker onehundredtwentythree, 2026-08-03.** Port **4194**, built bundle.
Row's numbers stamp ⟨12:25⟩ was over an hour old, so everything below was
re-measured. **Item 269 was not touched.**

---

## 1. The drift is proven, not inferred

```
git show 7c93e47ad:street/src/proto/ct/props.ts  →  const STOP_Z = -33.5, BENCH_Z = -36.6;
```

`7c93e47ad` is the commit that *created* `ct/crowd-net.ts`, and it wrote
`N('e-bench', EAST_X, -36.6, 'bench')`. **The −36.6 was the bench's own z,
verbatim and correct on the day.** `114675e62` ("The bus bench faces the road,
sits at the kerb, and stands beside its pole") moved the bench to −35.0; the
graph did not follow. So the world's **only** `act: 'bench'` node has stood
**1.60 m down-street of the bench** ever since. The row called it right.

The file's own prose was stale too — line 185 still read *"the bench is where
ct/props.ts stands it (BENCH_Z = -36.6)"*. Fixed in the same commit.

## 2. Where the node went, and why not on the walk lane

`props.ts:3122` already answers "where do you stand at this bench": both its
seat spots carry `approach: { x: BENCH_MAX_X + 0.42, z: BENCH_Z }`. The node now
uses **that same point**, so a walker sent to the bench stands exactly where the
player is offered *"sit at the stop"*.

**It deliberately does NOT sit on `EAST_X`.** Every other east node does, but the
walk lane is `ROAD_HALF + 1.0 = 6.00` and a walker's footprint is ±0.28
(`ct/crowd.ts:504`) — so a node there **at the bench's z is 0.011 m inside the
bench's collider**. The graph would be telling people to stand in the furniture,
and `scripts/crowd-net.mjs`'s third assertion exists for exactly that. The new
point (6.151, −35.0) clears the bench by 0.140 m and the shopfronts by 0.449 m.

### ⚠ The three constants are CITED COPIES, not imports — a declared gap

`BENCH_Z`, the bench's outer reach and the 0.42 standing offset are **function
locals inside `buildProps()`** (`ct/props.ts:2806`, `:3093`, `:3122`). Publishing
them is not an `export` keyword: it is hoisting bench geometry to module scope in
`props.ts`, plus a new `crowd-net → props` import edge into a module that
documents its own edges precisely because of GOTCHAS §28. **`props.ts` is not
named by this item**, so BUILDER-BRIEF §8's fallback applies — copy with a
line-number citation and queue the hoist. **Follow-up: hoist the 42 stop's
geometry to a shared owner and delete the three copies in `crowd-net.ts`.**
Every copied value was checked against the built world's collider rather than
read out of the source and trusted.

## 3. Can the crowd pin at the stop? **No — and here is the geometry**

`scripts/probes/w123-item282-stop-geometry.mjs`, deterministic off the collider
list, no clock and no camera. Both anchors agree **ROAD_HALF = 5.000** (the
bench face at `ROAD_HALF + 0.07`, the flag pole at `+0.23`).

| | corridor a centre may occupy at the bench | free width |
|---|---|---|
| walker, r 0.28 | **6.011 … 6.600** | 0.589 m |
| player, r 0.36 | **6.091 … 6.520** | 0.429 m |

The physical gap is **1.149 m** either way — the 1.15 m pinch the row names.

| line | walker | player |
|---|---|---|
| `crowd-net`'s walk lane `EAST_X` 6.00 | **blocked by 0.011 m** | **blocked by 0.091 m** |
| `ct/crowd.ts` citizen lane 6.05 | clears | blocked by 0.041 m |
| citizen lane 6.22 | clears | clears |
| citizen lane 6.39 | clears | clears |

**The row's 0.091 m is confirmed exactly.** Two corrections to its framing:

- It is **not** "a problem the crowd does not share". The crowd-net walk lane is
  inside the bench for a walker too — by **11 mm**. What saves the crowd is that
  its *citizens* walk `ROAD_HALF + 1.05 + (i%3)·0.17` (`ct/crowd.ts:467`), i.e.
  6.05 / 6.22 / 6.39, and **all three clear**.
- So the answer to *"can the crowd pin there at all"* is **no, by construction**:
  at the tightest slice a walker still has 0.589 m of centre positions, and every
  lane it is ever assigned lies inside that. No sampling window is needed for
  that claim, which is why it is the part I would trust in six weeks.

## 4. The wider sample north of the bench — reported, NOT enshrined

`scripts/probes/w123-item282-wider-sample.mjs`, 600 s, player stood at the stop:

```
2536 ticks, 15216 person-samples
  in the stop's stretch (z -42..-28, east walk):  50   (0.3% of all)
  NORTH of the bench (z > -35)                 :  28   (56.0% of the stretch)
  stationary in the stretch: 50    north of the bench: 28
  highest jam: 0.00 in the stretch, 0.00 north of the bench   (pin threshold 2.0)
  PINNED (jam >= 2.0): 0 and 0
```

A 300 s run gave 51 / 29 / 0 — i.e. the same handful of people.

**THE HONEST LIMIT, and it is a real one.** Item 276's author flagged that only
**6.9%** of its samples were north of the bench. The *share* is now **56.0%** —
but of a tiny absolute base, and **all 50 of those samples are stationary**, so
this is a couple of people standing at the bench rather than a wide sample of
people walking *through*. It corroborates "0 pinned" and it does not
independently establish it. **The geometry in §3 is what establishes it.**

**Per BUILDER-BRIEF §10a this measurement is NOT committed as a check.** A
600-second window whose result depends on who happened to route past is the
"needs N runs to mean anything" case the rule names. The probe is committed so
the number can be reproduced; nothing asserts on it.

## 5. What I did not do

- **No standing check was added for the node's position, deliberately.** There is
  no `__ct` hook for the crowd-net graph, and adding one means `crosstown.ts` —
  not named by this item. The geometry probe computes the expected point the same
  way the source does, so the two can be compared by hand, but nothing guards it
  automatically. **That is a declared gap, not an oversight.**
- **`scripts/crowd-net.mjs` reports 2 failures and they are PRE-EXISTING.**
  `stepped off the kerb away from a crossing` and `lingered in the roadway` —
  both at **x 10.6, z ≈ −98.3**, the side street, ~63 m from the stop. Baselined
  properly: I stashed this change, rebuilt, and re-ran — identical two failures.
- **Item 269 untouched.** The pinch itself is deferred at the user's instruction
  (*"leave the sidewalk bus stop alone for now"*) and nothing here moves furniture.
- **`ct/props.ts:3086`'s comment says the lamp poles "block to x ≈ 6.11" and an
  earlier one says "the wall bites at 6.34".** Measured, the shopfront face on
  this stretch is at **6.88**, so the second figure is 0.54 m out. Not mine, not
  load-bearing for anything I changed, worth a one-line correction some day.
- I was asked to wrap up mid-item and did; I would have liked a sample driven by
  walkers actually routed through the stretch rather than by whoever wandered in.
