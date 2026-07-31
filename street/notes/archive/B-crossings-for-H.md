# For H: the paint has moved. Here is exactly where it is now.

The user asked for the side street's east-end crossing to go
(`shots/user-remove-crosswalk.png`) and for crossings on the bodega junction
instead (`shots/user-add-crosswalks-junction.png`). Both have landed. The desk
is routing you the other half — making the walkable graph use them.

**The half that matters to you, said first:** the paint is off the east end and
**your graph edge there is still live**. `ct/crowd-net.ts` links `s-east`
(54, −109) to `ne-corner` (54, −97) as a `road` edge, ten metres of carriageway
at a dead end, and there is now nothing on the ground marking it. That is your
original finding back again and now invisible, which is worse than before. The
desk's ruling was to close the ring another way rather than cross there.

## Where the crossings are, in world coordinates

Measured off the built meshes, not off the call that made them.

```
  A   across the MAIN street, walked EAST-WEST
      x -5.00 … 5.00      the full carriageway, kerb to kerb
      z -91.50 … -88.90   2.60 m of painted band
      centre line z = -90.20

  B   across the SIDE street, walked NORTH-SOUTH
      x  9.30 … 11.90     2.60 m of painted band
      z -108.00 … -98.00  the full carriageway, kerb to kerb
      centre line x = 10.60
```

## The kerb is dropped at all four ends

This is the part your walkers care about, and it is measured rather than
claimed: the kerb top reads **0.0132 at each crossing end against 0.1100 three
metres away**. Four pedestrian ramps, registered from the same four numbers the
paint is laid from, so they cannot drift apart.

```
  A west end   (-5.00, -90.20)
  A east end   ( 5.00, -90.20)
  B north end  (10.60, -98.00)
  B south end  (10.60, -108.00)
```

Those are the points a route should meet the kerb at. **Anywhere else on the
junction, the kerb is at full height** — stepping off it is a drop, not a ramp.

## Why they are set back from the corner, in case it looks odd on the graph

Your two existing crossing edges run to the corner nodes: `crossMain` links
`n-corner` (6, −97) to `w-corner` (−6, −97), and the side-street one links
`n-bodega` (8.7, −97) to `s-win1` (6, −107). Both sit **inside the corner
radius**, and the paint deliberately does not.

The bodega return is a **3.5 m radius**, so the kerb is not parallel to anything
until **z = −94.5** on the main street and **x = 8.5** on the side street. A
crossing laid against a curve has one end square and the other splayed, which is
why real junctions set them back. Crossing A is additionally clear of the
**catch basin at (5, −92.5)**, whose casting runs z −93…−92 — the window south
of it is only a metre wide, so A had to go north of it.

So the graph nodes will want to move outward a few metres to meet the paint,
rather than the paint moving in to meet the graph. **The ramps are the
constraint**: they are where the kerb can actually be stepped off.

## The bunching problem may fall out of this

You have reported twice that people bunch and get stuck at a crossing, and the
cause you named was that each crossing is a single edge between a single pair of
nodes, so every trip across funnels through one point. `CROSS_HALF` at 1.3 m was
the lateral allowance you gave it.

Both crossings are **2.60 m of painted band**, which is 1.3 m either side of the
centre line — the same number. So the width you already allow now has paint
under it for its whole span, and a walker straying to the edge of its lane is
still on the crossing rather than beside it.

## One thing I did not do

The east end's kerb ramps went with the paint (`KRAMP[2]` and `[3]` are false
now), so the kerb there is continuous again. **If your other-way-to-close-the-
ring turns out to need a legal crossing at the east end after all, say so and I
will put them back** — it is two booleans. I removed them because my own comment
in the file said they existed only for that crossing, and a dropped kerb serving
nothing is a dip in a kerb the user has separately complained about being
discontinuous.
