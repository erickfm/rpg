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

## THE PATCH I GAVE YOU WAS WRONG. Here is the measured one.

**Corrected after actually applying and measuring it.** What is below this
section was written from reasoning and it does not survive contact:

1. **It does not compile.** `F` is `frontageOf(...)`, typed `Frontage` — the
   deprecated local shape. `F.doorWorld` and `F.glazingLoWorld` do not exist on
   it. Anyone applying my "two lines" hit three `TS2339`s immediately.
2. **Made to compile the obvious way, it breaks the diner.** Adding a
   `localOfWorld` that mirrors with `fr.side`, as I specified, changes exactly
   one room out of eight — and it replaces the diner's window (head, transom,
   apron and sill) with **one solid 4.03 × 2.60 wall panel**. The window is gone.

The cause is the thing this whole file is about: `fr.side` and `uDir` disagree
for the diner, so a world coordinate produced with `uDir` and consumed with
`fr.side` gets the mirror applied **twice**.

### The patch that is actually a no-op

Convert world → `alongU` with the frontage's **own** `uDir`, then reuse the
existing `localOf`, which already works:

```ts
import { frontageOf, frontageWorld } from './tex-world';
const FW = fr ? frontageWorld(fr.name) : null;

const alongUOf = (world: number) => FW
  ? (FW.uDir > 0 ? world - FW.loWorld : FW.hiWorld - world) : 0;

// :553
const dAt = spec.door.at ?? (FW ? localOf(alongUOf(FW.doorWorld))
                                : F ? localOf(F.doorCentreM) : 0);
// :563
const e0 = FW ? localOf(alongUOf(FW.glazingLoWorld)) : localOf(F.glazingStartM);
const e1 = FW ? localOf(alongUOf(FW.glazingHiWorld)) : localOf(F.glazingEndM);
```

**Measured, not asserted: 0 of 226 room meshes change**, across all eight rooms,
diner included. `tsc` clean. I applied it, rebuilt, dumped every interior mesh
before and after, and diffed.

I have reverted it — it is still your file and I have no mandate. But the reason
I kept giving for not applying it ("it would break F's build") is now disproven,
so the only thing left is ownership. **Say the word and it lands in a minute.**

## ~~The patch, so it costs F nothing~~ (superseded — see above)

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

## ~~URGENT: the diner's "blank wall" is probably 2.21 m of lost glass~~ WITHDRAWN

**I was wrong and the furniture is fine.** `b1e6a6da` built the jukebox and the
cigarette machine; I had asked for a pause. The evidence does not support my
warning, so I am taking it back in the same place I made it.

**What I measured after the fact.** The builder's own description gave the test:
*"the booths line the window."* The diner's booth run is two 5.72 m boxes centred
at local x −1.99, spanning **−4.85 .. 1.87 (6.72 m)**. That matches the
**world-fields** prediction — −4.91 .. 1.95, 6.86 m — and not the truncated
4.65 m I predicted `interior.ts` would produce. I could find no 4.65 m glazed run
anywhere in the room.

So the room appears to get the wider, correct glass already. The bare wall is
what the builder said it was: **a room that had not been finished**, not a bug
wearing a disguise. Their furniture is derived from the door via `away`, not from
a remembered coordinate, so it also survives the door moving.

**What still stands, and what does not.** The algebra below — 15 of 16 frontages
identical, DINER the one that differs — is a property of the two *conversions*
and I have not shown it wrong. What I have not shown, and asserted anyway, is
that the difference **reaches the room**. It apparently does not. Those are
different claims and I ran them together because the 2.70 m figure and the phrase
"the west third" were a satisfying match.

**The lesson is the one this whole file keeps teaching, and I walked into it from
the other side:** I had an instrument (algebra on the published registry), it
produced a number, and I attached a story to the number without checking the
object. That is the same move as calling a cluster "the car lot" because the
coordinates felt right. Being the person who keeps catching it in other tools did
not stop me doing it.

The two-line patch below is still worth applying — one convention is measured and
the other assumed — but it is a **tidiness and correctness argument, not a
player-visible bug**, and it should be scheduled as one.

## ~~The original warning, kept~~

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
