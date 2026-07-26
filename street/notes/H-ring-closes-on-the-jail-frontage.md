# The ring closes on foot — the edge is back, as pavement

**H, `ct/crowd-net.ts`.** O's jail landed the ground change this was waiting on,
and flagged the graph side to me rather than touching it. Correct call, and this
is the graph side.

## The order that mattered

Earlier tonight I deleted the `s-east → ne-corner` edge because it ran ten
metres up the carriageway and the user did not want it painted as a crossing. I
wrote into the file: *"ground change first, graph change second, in that order.
Do not re-add it."* O built a west-facing frontage at x 57 with **1.89 m of real
walk** at its foot, continuous the whole height of the closed end. So the
condition is met and the edge returns — **as pavement, not as a crossing.**

## What I added

Two nodes at `SIDE_X1 + IN` (x 56) — `se-jail`, `ne-jail` — and three ordinary
`road: false` edges: out along z −109, north up the frontage, back in along
z −97. **Derived by the file's own rule** (one metre in from the kerb, on the
other side), so it follows the street if the street moves.

## Measured, and the measurement that actually matters

```
  s-east -> ne-corner    2 hops   12.0 m   1 road hop   <- the original fault
                         9 hops  105.6 m   1 road hop   <- with the stubs, round the junction
                         4 hops   16.0 m   0 road hops  <- now, round the frontage
```

**"Zero road-flagged hops" is the weaker claim.** It only says nobody labelled
the path a crossing — and the edge I deleted was unflagged *and* in the road.
So `scripts/H-eastend-onfoot.mjs` samples the whole route every 0.5 m and reads
the ground: **35 points, 0 on carriageway.** The kerb is unambiguous — the
carriageway band z −98…−108 reads `groundAt` **0** out to x 55 and **0.14** from
x 55.5 — so x 54 was road and x 56 is not.

**No regression:** 6588 walker samples over 200 s, 403 in the carriageway, all
inside a marked crossing, **0 outside**.

**Reachability from real origins** (`scripts/H-eastend-reach.mjs`): 18
origin→destination pairs from w-diner, n-bodega and e-bench to all six east-end
nodes, all routing, and **every road hop on every one is a junction crossing**.
`n-bodega → se-jail` is 59.3 m with zero road hops, which was impossible before.

## One thing I will not claim, and nearly did

**No walker was observed on the new leg in 200 s.** That is not evidence of
anything. The world runs **six walkers**; ~15% of trips are long-range and 2 of
~14 act-nodes are at the east end, so the expected number of east trips in that
window is about **0.6**. I had a probe, a clean zero, and a tempting headline —
"nobody walks the east end" — and it would have been wrong.

Worse, my first version of that probe folded the entire main-street crowd into
the `x<20` bucket, so its band table was meaningless while looking authoritative.

**At this density, traffic counts cannot answer a routing question.** Routing is
deterministic; that is what I measured instead.

## For the desk

If pedestrian presence at the east end is wanted as a *visible* thing rather
than a reachable one, that is a **density or destination-weighting** decision,
not a graph one — the graph now offers the route from everywhere I tested. Six
walkers is the constraint. Not changing it on my own initiative: the 0.85 local
radius and the 0.75 errand bias are both documented as tuned twice, and the
comment says which direction each failure went.

— H
