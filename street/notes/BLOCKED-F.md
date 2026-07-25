# Builder F — blocked

## CORRECTION: the church steps are NOT blocked. I was wrong.

An earlier version of this note said a blanket collider in `ct/street.ts` made
the church forecourt unreachable and that the flight could not be climbed at
all. **That was wrong, and it was wrong because I generalised from a single
sampled point.** I probed `(8.5, -79)`, found it inside
`placeChurchEast`'s footprint box, and concluded the whole setback was solid.

Measured properly, over the whole forecourt:

```
CHURCH  forecourt: maxGy 0.55, 114 raised cells, 60 of them STANDABLE
LIBRARY forecourt: maxGy 0.99, 238 raised cells, 156 of them STANDABLE
```

And walked, in `scripts/steps-walk.mjs`:

```
library: walked 5.60 m up, gy 0.14 -> 0.99, and back down to 0.14
church:  walked 2.67 m up, gy 0.14 -> 0.55, and back down to 0.14
```

**Both flights climb.** The church's is reachable in a band around
`z = -78 … -81`, walking `+x` from the pavement.

`courtGround` already covers the church — `ct/civic.ts` registers a floor patch
per building placed and the picker asks all of them, so wiring it in `53550b60`
covered both buildings at once. There is no missing per-site registry behind
this particular symptom.

## What IS still wrong, and it is smaller

The church flight stops at **gy 0.55** where the library reaches **0.99**. Of
the 114 raised cells in the forecourt, 54 are not standable — the upper part of
the flight and the landing at the doors. That upper section is inside
`placeChurchEast`'s footprint box in `ct/street.ts`:

```
x 6.70..15.00   z -86.00..-68.00
solid({ minX: FACE - 0.3, maxX: FACE + 8, minZ: z - b.w, maxZ: z });
```

So you climb most of the flight and stop short of the doors, rather than being
unable to start. The box wants shaping around the setback the way the library's
recess is cut out of the west wall run. E's `placeChurch` already knows the
extents (`YARD_X0`/`YARD_X1`, `zFront`, `zStreet` — the numbers its own
`floorLocal` patch uses), so the clean version is E publishing them the way
`COURT` is published and D subtracting them.

`ct/street.ts` is D's and the box is deliberate — its comment records that a
missing one let you walk through the nave — so it wants D or a grant.

**Test is written and covers both flights:**
`SHOT_URL=http://localhost:4185/ node scripts/steps-walk.mjs` finds each
flight's top by scanning, climbs it, comes back down, and checks nothing sinks
below the paving. It will report the church reaching 0.99 the moment the box is
reshaped.

## Still needing a decision from the desk

Neither flight leads anywhere: no `[E]` at the top of either, and neither
building has an interior. My recommendation remains a locked-door response
rather than two more rooms. That is a content call and I have not made it.
