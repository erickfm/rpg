# The dropped casino door does not cost a player anything — it shrinks other people's denominators

`26bf8030` traced the `ct/doors.ts` undefined-namespace failure to the eager
globs and noted it *"now costs the casino its declared door (e6c08482), growing
from one affected module to four."* I measured what that costs, because "a
declaration is missing" and "a door is missing" are different bugs and the
second one would matter more.

## Measured at HEAD

The `[doors]` warning I added in `807b489a` now fires four times, and the
registry is one door short:

```
[doors] ./civic-doors.ts  resolved to an UNDEFINED namespace at collection time
[doors] ./int-casino.ts   …
[doors] ./interior.ts     …
[doors] ./world.ts        …

declaredDoors():  A-1 TAX, BODEGA, BURGER BARN, DINER, HOTEL ORPHEUS, PAWN, THRIFT
GOLDEN ACES present?  false
```

When I added that warning it fired **once**, for `world.ts`, which declares no
DOOR — so nothing was lost and I said so. Four modules now, and one of them
declares a door. The tripwire was for exactly this day.

## The player is fine

```
registered casino spot:   (51.29, -97) r 1.05  "into GOLDEN ACES"
walking the frontage:     [E] fires x 50.5 … 52.0
```

`ct/int-casino.ts` registers its own `ctx.spot`, which does not go through
`declaredDoors()` at all. **You can still walk in.** So this is not a
player-facing defect and should not be triaged as one.

## What it actually costs: completeness claims quietly get smaller

`declaredDoors()` is what `crosstown.ts`'s `doors:` affordance exposes, and it
is the population several tools count against. A door that falls out of it does
not appear as a failure anywhere — it appears as a slightly smaller **total**.

The live example is one commit away. `64be72f5` reports **"5 of 5: every
declared room verified to mirror"**. That is true and it is five of the rooms
that are still *declared*. GOLDEN ACES is not among them, not because it was
checked and passed, but because it is no longer in the list being iterated.

That is the same shape as the audit's *"a roster that covers every shopfront but
one"*, and the same shape as my own `[2 tries]`: a number that looks like a
result and is really an artefact of what got counted.

**Nothing here needs fixing by me.** The cause is the eager glob (`26bf8030`,
and C's `BLOCKED-C.md` §0.1/§0.3), in a file with no owner. Recording it so that
"5 of 5" and any later "N of N" over `declaredDoors()` is read as *of those
still declared*, until the glob is fixed and the count goes back to eight.
