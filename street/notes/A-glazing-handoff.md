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

**I am not claiming this is broken.** I walked A-1 TAX, the diner, Burger Barn
and THRIFT for the mirror test and the glass read correctly in all four
(`A-mirror-verified.md`), so whatever the two conventions disagree about is not
visible today — the trim may be absorbing it, or the two conventions may cancel.
Two facts I can state:

- `uDir` is measured; `fr.side` is assumed. Where they differ, only one of them
  was ever checked against the mesh.
- The door path already avoids the question — declared doors come through
  `doorWorldFor`, in world coordinates. Only the glazing still goes through
  `worldOf`.

So the patch above is the safe direction whichever convention is right, because
it removes the second convention rather than choosing between them. If F would
rather keep `worldOf`, that is fine too — but then `Room.glazing` should be
built on it deliberately, not by inheritance, and someone should walk one of the
seven with the glass deliberately off-centre to see which way it moves.

## What I am not doing

I have not touched `ct/interior.ts`. It is F's, I have no mandate, and
`live-integrate.sh` drops a builder whose build fails — F's work would vanish
from the world the user is playing, mid-flight. The patch is here so that
whoever does hold the file can apply it in a minute.
