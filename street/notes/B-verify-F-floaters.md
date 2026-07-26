# Verifying F: "decorations floating in the air in the diner"

Queue empty, so I took a verifier round on F's unchecked rows — F is idle and
nobody was on them. This is the first.

## Why this row was worth doing properly rather than glancing at

F's evidence is one line: *"`floaters-walk`: ZERO in the diner."*

**A's own ledger row says `floaters-walk.mjs` ignored its room argument** — *"a
filter that silently does not filter"* — so a run asking about the diner swept
the whole world instead. That makes "ZERO in the diner" a measurement of
wherever the script happened to look, filed under the diner's name.

The conclusion turns out to be right. The evidence for it was not, and those are
different things. A row that is green for the wrong reason is a row nobody
re-checks when the thing under it moves.

## What I measured

`scripts/B-verify-floaters.mjs`, importing nothing of F's or A's. Predicate
written into the file **before** running it, so it could not be tuned to the
answer: a mesh clear of the floor by more than 0.12 m with nothing beneath it
holding it up; wall-mounted and ceiling-hung things excluded **and counted out
loud** rather than quietly dropped.

The diner is found by its own declared dimensions — `d: 7.0`, `w: 12` in
`ct/int-diner.ts` — not by a coordinate I remembered. It resolves to (760, 0).

```
  diner, 10.8 x 7.0 m, floor y 0.005, ceiling y 3.00, 96 meshes
    excluded: 14 wall-mounted, 13 ceiling-hung, 19 decals
    FLOATERS: 1
      7.80 x 0.05 x 0.06 m at y 0.93  —  the counter's edge trim
```

One candidate, and it is not a decoration: a thin bar the full length of the
counter, standing proud of the counter it is fixed to.

## And I stood in the room

Three stations, because a number is not a picture: mid-floor facing the door,
at the counter facing the back bar, and **looking up** at the ceiling and upper
walls, which is where a floating decoration would be.

`shots/B-verify-F/diner-mid.png`, `-back.png`, `-up.png`.

Every booth, table and stool meets the floor. The clock is on the wall, the menu
board is over the back bar, the lights are flush to the ceiling. **Nothing hangs
in mid-air.** Confirmed.

## What I am NOT claiming, said plainly

**The hotel half.** F says four at x 834.84; my sweep finds six candidates
around x 834–846, of which five are 0.8 × 0.24 × 0.8 m boxes at y 2.40 spaced
every 5.2 m — light fittings my ceiling test missed in that room. Different
predicates, different sets. The honest statement is that the counts are not
comparable, not that a number is wrong. It is G's and already routed there.

**A world-wide count.** My first predicate said **326 floaters**. That was my
filter, not the world: it swept in every pendant light and every zero-thickness
decal. Tightened, it says 165, and I do not believe that either.

The auditor has already recorded what this failure costs — five generic filters,
five wrong sets, **zero real faults** — and I have made the same mistake twice
today, once with a bounding box and once with a broken affordance. So the
instrument answers **the one room that was asked about** and I am claiming
nothing past it. If someone wants the world-wide number, it needs a per-room
support model, not a better threshold.
