# F — the bodega decor brief is finished, and the church item is stale

## The bodega

The user's three-part brief is now complete. Item (2), the blank grey slab in
the entrance view, landed last session. This session closed (1) and (3).

**(1) "THE SHELVES ARE A COLOUR CHART."** The fix that mattered was HEIGHT.
The old draw gave every item the full 7 px of shelf, so each shelf rendered as
one continuous band and the colours read as a chart no matter how many of them
there were. Goods that stop at different heights break the band before
anything else is even noticed. Then the rest of the user's list: gaps where
stock has sold (one slot in six), items pushed back (darker, inset) and pulled
forward, a few turned around to plain card, and white price ticks along every
shelf edge.

Scale was checked rather than assumed — GOTCHAS 5. The face repeats 64 px over
2.4 m, so items land at 0.12–0.27 m. Cans and boxes, not crates.

**The end caps**, which I graded myself down for in the previous commit, are
rebuilt. A mesh dump from the entry point puts the two of them **1.11 m** from
where you stop walking in, flanking the aisle — the most-seen face in the shop.
They drew ONE full-width colour per row, a 0.5 × 0.22 m slab, seven stacked:
banding. Now a promo stack, two or three cases across per row, uneven heights,
gaps, and a hand-lettered price card taped over the top.

**(3) The decor list.** Four were already built — coffee station, cigarettes
and lottery behind the counter, the bell, the cat. The four that were not:

- `ICE COLD 2/$3` taped to the cooler glass, positioned off the cooler plane
- the lottery machine, floor-standing by the door where the queue forms
- the radio on the counter behind the register
- a `MARINO FOODS` calendar on the side wall, clear of the cigarette rack

Every position is derived from the surface it sits on, never typed. The diner's
wall props floated because they were typed, and the COFFEE card in this same
room hung 0.575 m over its bench for the same reason. `floaters-walk`: nothing
below 1.4 m has air under it.

### Graded, because the method is the point

Shot from a player's eye and read, not glanced at. The first counter shot
showed my radio with two antennae at the same tilt — a pair of grey sticks
lying on the counter rather than a radio. One antenna now.

**Open, and I am not claiming it either way:** a dark angular shape sits
centre-left in `shots/f-bodega-counter2.png`. I dumped every mesh within 3.2 m
to identify it. The keeper is NOT it — his sprite is feet-anchored, so the
`y = 0` the dump reports is correct, not a figure sunk into the floor. Most
likely the counter or the register at close range, but I did not prove it, so
it stays open rather than being written up as fixed.

bodega 25/25 throughout.

## The church item in my queue is already done — please strike it

> *"church i still cant walk into i cant walk up the stairs or go in, same as
> library."*

Both halves now pass, and I verified by walking rather than reading:

    church: paving 0.14 at the kerb, 0.55 at the doors
    church: walked 2.73 m up, gy 0.14 -> 0.55
    church: walked back down, gy 0.55 -> 0.14

The queue says nothing answers for the church forecourt's floor. Something
does: E's `floorLocal` pushes the church yard picker into `FLOORS`,
`courtGround` iterates `FLOORS`, and `courtGround` is registered through
`ctx.ground` at `civic.ts:134` with `COURT.climbable` set true in the entry
point. The queue text predates that.

The other half — *"do not leave a flight of steps that leads to nothing"* — is
covered too: the church interior exists and `interiors-walk church` is 25/25,
which walks in through the door and back out.
