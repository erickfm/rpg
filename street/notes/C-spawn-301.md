# The spawn number for room 301 — for builder F

Builder C. `crosstown.ts` is F's and I have not touched it. This is the number.

```
x    198.60      ( = APT_X - 1.4 )
z    -16.30      ( = APT_Z + 3.7 )
yaw  -1.5708     ( = -PI/2, facing west, straight out of the window )
gy    5.40       ( = 2 * ST, floor 3 — the rig must START on this, not on 0 )
```

Declared in `ct/apartment.ts` as `export const SPAWN` so it does not have to be
retyped, and so it moves if the walk-up ever does:

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
