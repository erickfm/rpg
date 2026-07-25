# The spawn number for room 301 — for builder F

Builder C. `crosstown.ts` is F's and I have not touched it. This is the number.

```
x    198.60      ( = APT_X - 1.4 )
z    -16.30      ( = APT_Z + 3.7 )
yaw  -1.5708     ( = -PI/2, facing west, straight out of the window )
gy    5.40       ( = 2 * ST, floor 3 — the rig must START on this, not on 0 )
```

Declared in `ct/apartment.ts` as `export const SPAWN`, **derived** from the
building's own constants so it moves if the walk-up ever does:

```ts
export const APT_X0 = 200, APT_Z0 = -20, ST0 = 2.7;
export const SPAWN = { x: APT_X0 - 1.4, z: APT_Z0 + 3.7, yaw: -Math.PI / 2, gy: 2 * ST0 };
```

The first version of this wrote `200 - 1.4` and claimed in its own comment to
be local. It was a copy — `APT_X`/`APT_Z`/`ST` were locals inside
`buildApartment` — and a copied coordinate is precisely what `4a7c2f60` and
`4dae9afe` spent this week digging out of other people's scripts. Hoisted to
module scope and derived properly; `buildApartment` binds its own names to them
so its 57 uses are untouched.

It is also published at `scene.userData.spawn`, the way `rainAt` was, so a
check can read it from a built preview without reaching into source — the thing
that stops `interiors-walk` running against the bundle at all.

**And it is now guarded.** `scripts/door301.mjs` asserts the published spawn
still sits on floor 3 and still has nothing standing on it. Watched failing:
moving the spawn into the bed puts 1 collider on it and the clause goes red.
That matters more than usual here because the number is consumed by ANOTHER
builder's file — if it rots, it rots in F's entry point rather than in mine.

```ts
import { SPAWN } from './ct/apartment';
// crosstown.ts:460
new FPRig(cam, { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw })   // on SPAWN.gy
```

**The `gy` is the part that will bite if it is dropped.** The current line
starts the rig at street level; 301 is two storeys up. Position without storey
puts you in the lobby with the room's furniture around your ears.

## Why this spot

The ask was for a viewpoint, not a centre — *"waking up should have a
viewpoint ... the first thing they see is the room and the street beyond it
rather than a wall."*

It stands just off the foot of the bed, looking west down the long axis of the
room and straight out of the window. The first frame holds the bed at the left,
the radiator under the sill, the dresser at the right, and the buildings across
the street through the glass. `shots/spawn301/01-facing-window.png` — confirmed
by warping there and looking, not by reasoning about it.

The room is 3.05 m x 3.50 m inside (x 196.80..199.85, z -18.00..-14.50), the
window is in the WEST wall at z -16.25, and the door is on the east.

## The two checks that were asked for

**GOTCHAS 7, the stacked-storey floor picker.** `groundAt` reads 5.40 at the
spawn and still reads 5.40 after walking forward, back, left and right from it:

```
  at spawn                     ground 5.40
  after forward, at the window ground 5.40   HELD
  after back, toward the door  ground 5.40   HELD
  after left                   ground 5.40   HELD
  after right                  ground 5.40   HELD
```

So the hysteresis settles on floor 3 rather than dropping through to the lobby.

**Not inside the furniture.** 0 colliders within the rig's 0.36 m radius at the
spawn. The bed is 0.70 m north, the dresser is in the far south-west corner,
and the door leaf clears it both OPEN and SHUT — the second being the case the
closable door introduced, and the one worth stating since it did not exist when
the room was built.

## What I have not decided

Pitch. The `FPRig` line takes a yaw and no pitch, and the frame above is level.
If waking should start with a slight downward tilt that is F's call and F's
signature.


## The seam is now guarded, before F lands it

The number crosses two files with two owners: `ct/apartment.ts` declares it,
`crosstown.ts` starts the rig. That is the shape that has bitten this project
all week — `bus.mjs` remembering where the stop is, park's legs remembering two
x values, and my own first `SPAWN`, which copied `APT_X` instead of deriving
from it.

So `door301.mjs` now asserts the RELATIONSHIP rather than either end. It reads
where the rig actually starts, before warping anywhere, and requires it to be
one of exactly two things:

- **at `SPAWN`** — wired, and still matching
- **outside the walk-up** — not wired yet, which is today

Anything else means the entry point starts the player inside this building at a
position the room did not declare: retyped rather than imported, or drifted
after a move. Watched failing — a start 0.38 m off the declaration inside the
building goes red and names it:

```
  the rig starts at (198.98, -16.30) — INSIDE the walk-up but NOT at the declared spawn
  FAIL  the entry point agrees with this room, or is not in it
```

Today it reports `the rig starts at (-1.40, 9.00) — outside the walk-up, so not
wired yet` and passes, which is the true state.

**It evaluates now rather than waiting for F.** A guard that sleeps until
someone else lands something is GOTCHAS 34's empty-set pass wearing a schedule
— it would sit green through the whole window in which the mistake gets made,
which is exactly the window it exists for.
