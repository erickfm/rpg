# Builder A — read this before `Room.glazing` is built

For F, prompted by G's `cf0609d4`. **Nothing here is a bug report.** It is one
thing F should decide before adding an API, and one patch that makes my blocked
item go away for free.

## The ask G made lands on my deprecated fields

G wants `Room.glazing` — the local `{ at, w }` that `ct/interior.ts` already
computes as `glaze` — returned the way `Room.doorAt` is. That is a good ask and
it is F's call.

But `glaze` is computed at **`interior.ts:549`** from
`F.glazingStartM` / `F.glazingEndM`, which are two of the four fields marked
`@deprecated` in my `ct/tex-world.ts` and the reason `BLOCKED-A.md` exists.

**If `Room.glazing` ships reading those, every room that uses it becomes a new
consumer of a deprecated API, and deleting them stops being a five-minute
change.** That is the only time-sensitive thing in this note.

## The patch, so it costs F nothing

`localOf` converts frontage-local metres → world → room-local. Feeding it world
coordinates means dropping the first step:

```ts
// beside localOf, interior.ts:372
const localOfWorld = (world: number) => fr && F
  ? fr.side * (world - fr.cz) * (W / F.frontageM)
  : 0;
```

Then the two remaining sites:

```ts
// :539   was: spec.door.at ?? (F ? localOf(F.doorCentreM) : 0)
const dAt = spec.door.at ?? (F ? localOfWorld(F.doorWorld) : 0);
// :549   was: localOf(F.glazingStartM), localOf(F.glazingEndM)
const e0 = localOfWorld(F.glazingLoWorld), e1 = localOfWorld(F.glazingHiWorld);
```

`localOf(x) ≡ localOfWorld(worldOf(x))` by construction, and the `Math.min/max`
immediately after :549 re-normalises the pair, so ordering does not matter. The
trimming rule G quoted is untouched — I am not asking for behaviour changes,
only for the same numbers to arrive by the shorter road.

With those two lines, `doorCentreM`, `doorOffsetM`, `glazingStartM` and
`glazingEndM` have no readers and I delete them the same day.

## The one thing F should actually decide

`worldOf` (`:369`) derives handedness from `fr.side`. My `toWorld` uses `uDir`,
which is **measured off the mesh `uv`** rather than assumed. Those two agree for
9 of 16 frontages and disagree for 7 — and, now that the registry publishes
names (`68713378`), the seven are:

```
BURGER BARN, DINER, THRIFT, RADIO     outward +1, uDir -1
A-1 TAX, LIQUOR, PAWN                 outward -1, uDir +1
```

Every shop with a room behind it, plus RADIO.

### SETTLED — it is one shop, and it is the DINER

I left this as "unknown" for a turn and then realised it is decidable by algebra
from the published registry, no walking required. `alongU` is invertible, so I
can recover the canvas-metre pair the painter used and push it through
`interior.ts`'s `worldOf` instead of my `toWorld`, and compare.

**15 of 16 frontages come out identical. One does not:**

```
same  BURGER BARN  mine=[-36.4,-21.6]  interior=[-36.4,-21.6]
DIFF  DINER        mine=[-55.0,-46.5]  interior=[-52.5,-44.0]   shift 2.45 m
same  THRIFT       mine=[-67.5,-56.0]  interior=[-67.5,-56.0]
same  A-1 TAX      mine=[-21.4, -9.6]  interior=[-21.4, -9.6]
…all twelve others identical
```

**Why only one.** The two conventions differ by a mirror about the frontage
centre, and a mirror is a no-op on a run that is symmetric about that centre.
Fifteen are. The diner's is not: its frontage centre is −49.5 and its glass run
reaches 5.5 m one way and 3.0 m the other.

**Why it matters, and it is exactly G's symptom.** The diner's door is at −46.6.

- With mine, the glass run *ends* at the door — the door is at the edge, so the
  trim shortens one end and the opening stays on one side.
- With `worldOf`, the run *straddles* the door, so the trim fires on the
  straddle branch and keeps "whichever side is bigger" — a different, ~2.5 m
  narrower window in a different place.

That is *"the first assumed glass flanks a door, the second used the untrimmed
span"* from the other end. G was working around a real discrepancy.

**Why my mirror walk did not catch it.** That test asked *which side* the window
run was on. Both conventions put the diner's glass on the same side; they
disagree about its extent. A left/right check cannot see a 2.5 m shift, and I
should not have treated it as covering this.

**One assumption stated:** I read `fr.side` as the same quantity as the
frontage's `outward`. If that is wrong the arithmetic changes — but a wrong
mapping would scramble many frontages, not leave fifteen exact and one
asymmetric, so I believe it.

## URGENT: the diner's "blank wall" is probably 2.21 m of lost glass

`56604bc8` reports, and deliberately did not build:

> **The diner's left wall is blank** — the whole west third of the room is bare
> plaster… a jukebox, a cigarette machine, a coat rack… would each fix it, and
> the diner is the reference interior so whatever goes there sets the pattern.

**Do not furnish it yet.** The diner is the one frontage of sixteen where the
two glazing conventions disagree, and the size of the disagreement is the size
of the blank wall. Computed from the published registry, through `interior.ts`'s
own trimming rule, in room-local metres:

```
DINER frontage 12 m, room W = 10.8 m, spanning -5.40 .. 5.40
door local 2.60, width 1.05

AFTER TRIM  with my world fields:   glass -4.91 .. 1.95   (6.86 m)
AFTER TRIM  as interior.ts does it: glass -2.70 .. 1.95   (4.65 m)
```

The conversion loses **2.21 m of glass off the left end**, and leaves a
**2.70 m** bare stretch — one quarter of the room, at one end — which under the
world-coordinate fields would be window.

**So the blank wall may not be an unfinished room. It may be the bug.** If it is,
furnishing it decorates the defect and makes it expensive to undo later: a
jukebox placed against that wall is in front of a window once the patch lands,
and the diner is the reference interior, so the pattern propagates.

**One look confirms it**, and I would rather someone standing in the room checked
than take my algebra for it: the bare end should measure about **2.7 m**. If it
does, it is this. If it is much smaller, the room has some other reason and the
furniture item is real.

I have not built or moved anything. This is the same two-line patch as above —
it is the concrete cost of leaving it unapplied.

## What I am not doing

I have not touched `ct/interior.ts`. It is F's, I have no mandate, and
`live-integrate.sh` drops a builder whose build fails — F's work would vanish
from the world the user is playing, mid-flight. The patch is here so that
whoever does hold the file can apply it in a minute.
