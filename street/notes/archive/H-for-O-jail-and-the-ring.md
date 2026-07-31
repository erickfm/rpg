# For O — the jail site and the walkable ring, and what I need from its frontage

**H, `ct/crowd-net.ts`.** The desk copied me because the jail (x 57, z −96…−110)
lands on exactly the end I have just closed. **It does not undo my work — it is
what makes the closure permanent instead of a workaround.** Numbers below so you
can place the frontage without guessing at my graph.

## What I just did, and why it matters to you

The walk network used to have an edge straight up the closed east end,
`s-east (54, −109)` → `ne-corner (54, −97)`. **The side street's asphalt spans
z −98…−108, so that edge crossed ten metres of carriageway.** The user did not
want it painted as a crossing, so I removed the edge. Those two nodes are now
**dead-end stubs**.

## The three numbers you need

- **The walk centreline at the east end is x = 54.** It is derived, not placed:
  `EEND_X = SIDE_X1 − IN` with `IN = 1.0`, so the side street's east extent is
  **x = 55** and the walk sits one metre in from it.
- **My two stub nodes are `s-east` (54, −109) and `ne-corner` (54, −97).**
  Both stand on pavement already — south of the asphalt and north of it
  respectively.
- **The carriageway between them is z −98…−108.** That gap is the whole problem.

## What would let me close the ring properly

**If the jail's frontage carries a footway in front of it — a walkable strip at
about x 54, running the full z −97…−109 — then I re-add the edge as an ORDINARY
PAVEMENT EDGE, not a crossing.** The ring closes on foot, nobody steps into the
road, and no paint is needed anywhere. That is the outcome the desk and I both
wanted and could not justify before, because adding pavement purely to justify a
graph node is backwards. **A jail is a reason.**

**The rule, and I have written it into the file so it cannot be lost:** *ground
change first, graph change second, in that order.* I will not re-add that edge
speculatively. Tell me when a footway exists and what its x is, and it is a
one-line change on my side.

## What I need to know either way

1. **Does the frontage get a footway, or does the building meet the road?** If it
   meets the road, the stubs stay stubs and that is correct — a dead end is a
   dead end.
2. **Where is the door?** Give me a world (x, z) and I will put a node on it with
   `act: 'door'`, which is what makes walkers actually go there instead of
   turning round at an arbitrary end-of-walk. Today the two stubs are somewhere
   walkers can reach and have no reason to visit.
3. **Does the building change the road's east extent?** If the asphalt is
   shortened, `SIDE_X1` moves and my whole east end follows it automatically —
   every coordinate above is derived from it. I just need to know it changed.

## One caution from my side

The jail spans z −96…−110, which is **taller than the carriageway gap** — it
fronts both stubs. So a single footway down its face reaches both, and the ring
closes with one edge rather than two. Worth knowing before the frontage is
broken into segments.

— H
