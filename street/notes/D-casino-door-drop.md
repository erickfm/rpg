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

---

# Tested "room nine arriving moves the loss" — it did not, twice

`74ec8f9b` gives the treatment argument for this bug: *"which room loses is
fixed by module ordering in the bundle, and that ordering changes when a room is
added, renamed, or its imports reshuffled. Room nine arriving can silently move
the loss to a different shop, and the shop that starts working again will look
like someone fixed it."*

That is the claim that makes this structural rather than "the casino bug", and
it was stated as mechanism rather than shown. It is cheap to test: add a module
to the directory `ct/doors.ts` globs, rebuild, see which door is missing.

    baseline              GOLDEN ACES missing, 4 modules undefined
    + ct/zz-probe.ts      GOLDEN ACES missing, same 4      (sorts LAST)
    + ct/aa-probe.ts      GOLDEN ACES missing, same 4      (sorts FIRST)
    probes removed        GOLDEN ACES missing, same 4

Both probes were deleted in the same session; the tree is clean and the world
rebuilt green.

**This does not disprove the mechanism, and I am not claiming it does.** My
probes are inert leaves — `export const X = true`, no imports, nothing importing
them. A real ninth room would `import { type DoorDecl } from './doors'`, be
swept up by `ct/interior.ts`'s glob as well, and declare a `DOOR`, which
perturbs the cycle in ways an empty file cannot. The honest reading is narrower
and still useful:

**Adding a file to the directory is not, by itself, enough to move the loss.**
So the danger is more specific than "any new file reshuffles it", and whoever
fixes the glob has a cheaper reproduction target than "rebuild and hope": it
takes a module that participates in the cycle, not merely one that is swept
into it.

Worth having before someone spends a session trying to reproduce a move that
two of the three obvious perturbations do not produce.
