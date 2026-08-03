# item 126 — the diner geometry DOES allow access; the failing check faces the wrong way

Worker ninetynine, 2026-08-03. Port **4560**, built bundle, build `03ad39a90`.
**I changed no world code.**

> *"its fine if the diner seat isnt reachable from one side. just make sure
> geometries allow for access."*

**They do. All 13 diner seats. Zero denied.** And the check that says otherwise
is measuring its own approach angle.

## What the diner actually has

7 counter stools + 6 booth seats, selected **by room** (inside the diner's own
footprint from `__ct.roomDims()`, x 754.6…765.4, z −3.5…3.5) and never by label
— `'sit at the counter'` is not unique to this room and a label filter would
have walked somebody else's furniture.

`scripts/probes/w99-item126-diner-seats.mjs`, legal standing approaches of 16
around each trigger:

```
  7x sit at the counter   11/16   nearest legal stand 0.55 m
  1x take a booth seat     9/16   nearest legal stand 0.64 m
  4x take a booth seat     5/16   nearest legal stand 0.64 m
  1x take a booth seat     4/16   nearest legal stand 0.64 m

  seats with NO legal approach: 0
```

Every booth's legal arc is 225°–315° — **the aisle side, and only the aisle
side.** That is precisely the one-sided access the user said he was fine with.
The counter stools are open on 11 of 16.

## And they are not merely approachable — I sat on all six

`scripts/probes/w99-item126-booth-prompt.mjs` stands on each booth's standing
point, sweeps the facing through 12 angles, and presses [E]:

```
  booths offering "take a booth seat":  7, 7, 7, 8, 9, 10  of 12 facings
  [E] -> seated, distance from the intended seat: 0.00 m on all six
  booths denied at EVERY facing: 0 of 6
```

Held keypress, not `press('e')` — BUILDER-BRIEF §5.

## ⚠ THE FAILING CHECK IS A FIXED-YAW ARTIFACT, AND THE PROOF IS 5/5

`scripts/seats-walk.mjs` fails five of the six booths:

```
  FAIL seat 76/219 "take a booth seat" @ 759.21,2.02
       no "take a booth seat" prompt from the one standable point
       (759.03,1.36); got "[E] sit at the counter"
```

**It approaches every seat at yaw 0.** `pickSpot` has an aimed tier that reaches
6 m, so a player standing beside a booth but *pointed at the back counter* is
offered the counter. A customer walking up to a booth looks at the booth.

The corroboration is exact, and it is why I am confident rather than merely
plausible: **the one booth that PASSES seats-walk is the seat at 764.48 — and it
is the only one of the six that offers "booth" at yaw 0.** The other five do not
list yaw 0 among their offering facings, and those five are exactly the five that
fail. 5/5, no exceptions.

Proximity cannot be what chose the counter, either: from (759.03, 1.36) the booth
is **0.68 m** away and the nearest counter stool **2.37 m** — outside the
counter's own reach of `0.62 + 0.15`. So this is the aimed tier, not the
documented "nearest live spot wins" proximity rule.

**Not fixed, because item 126 names "the diner seating geometry" and this is
`scripts/seats-walk.mjs`** (BUILDER-BRIEF §9 — report the file the item does not
grant). The fix is one line: approach facing the seat,

```js
const yaw = Math.atan2(s.pose.x - stand.x, -(s.pose.z - stand.z));
```

instead of the constant 0. **Worth a row.** It reports 109 failures over 219
seats right now, and the diner shows at least 5 of those are the harness. The
same artifact will be inflating the count anywhere a seat sits near another
[E] spot — which, given "110/219 seats sit, lock, and stand clear", is worth
knowing before anyone acts on that number.

## ⚠ TWO OF MY OWN PROBES LIED FIRST, AND THE POPULATION FLOOR IS WHY I NOTICED

1. **`roomDims()` entries are a CENTRE AND A SIZE, not a box.**
   `ct/interior.ts:320` returns `{ id, w, d, cx, cz, y, door, belt }`. I read
   `x0`/`x1` off it, got `undefined`, every comparison was false, and the seat
   list came back **empty**. The population floor turned that into `exit 3 —
   measuring nothing` instead of a cheerful PASS over zero seats.
2. **A seat record has no top-level `x`/`z`.** It is
   `{ pose: {x,z,yaw,h}, at: {x,z}, r, label }` — `pose` is where you end up,
   `at` is the standing spot. Same empty-set failure, caught the same way.
3. **THE ONE THAT WOULD HAVE COST SOMEBODY A DAY.** With the approach ring
   sampled at `r − RADIUS` — 0.26 m for a stool — every sample sat *inside the
   stool*, whose collider pads to 0.53 m against a 0.36 m body. It reported
   **13 of 13 seats with NO ACCESS AT ALL**, every registered spot BLOCKED. A
   total catastrophe in a room the user describes as merely awkward from one
   side is the probe indicting itself. Reach is `r + TOUCH_MARGIN`, and
   **TOUCH_MARGIN is 0.15** (`fp.ts:778`) — *not* `REACH_MARGIN` 0.6
   (`fp.ts:771`), which is unused for a standing player and whose own docstring
   records five harnesses still comparing against the wrong one of the two.

## Not mine, noticed, worth queueing

- **`seats-walk.mjs` exits 1 with 109/219 failures** and the tail includes
  `"sit at the blackjack table"` ×4 giving `seated prompt should be "stand up",
  got null` and `"sit at the computer"` ×2 with a seated eye 0.14 m low. Those
  are outside the diner and I did not investigate them. Given the yaw artifact
  above, **nobody should quote 109 as a defect count until the harness is
  fixed.**
- The diner booths sit behind a documented dispatch history in
  `seats-walk.mjs:131-147` (back-to-back booths 0.67 m apart, overlapping
  triggers, "nearest live spot wins"). That fix is holding — my [E] test landed
  on the intended seat 6/6 at 0.00 m, so no booth is stealing its neighbour's
  press.
