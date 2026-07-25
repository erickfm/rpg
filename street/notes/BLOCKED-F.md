# Builder F — blocked

## The church steps are unclimbable, and the fix is in `ct/street.ts` (D's)

**Status: the floor is fine. The collider is not.**

I wired `courtGround` into the entry point's ground picker in `53550b60`, and
that covered the church as well as the library — `ct/civic.ts` registers a
floor patch per building placed and the picker asks all of them. Probed
through the rig, the church forecourt reads:

```
        z=-76  z=-78  z=-80  z=-82
x= 8.5   0.14   0.27   0.26   0.14
x= 9.5   0.14   0.55   0.55   0.14
```

That is a real flight rising off 0.14 m paving. **The desk's note that
"nothing answers for the church forecourt's floor" is out of date** — it was
true before `53550b60`.

**What is actually wrong:** you cannot walk into the courtyard at all.
`scripts/steps-walk.mjs` now covers both flights and reports:

```
library: walked 5.61 m up, gy 0.14 -> 0.99   ✓
church:  walked 0.00 m up, gy 0.14 -> 0.14   ✗
```

One collider covers the whole church footprint, courtyard included:

```
x 6.70..15.00   z -86.00..-68.00   (8.3 x 18.0 m)
```

It comes from `placeChurchEast` in `ct/street.ts`, which registers the church's
footprint as a single blanket box:

```ts
solid({ minX: FACE - 0.3, maxX: FACE + 8, minZ: z - b.w, maxZ: z });
```

with the comment *"The church does not go through placeBld, so it has to
register its own footprint or it is not there at all — with the blanket wall
gone you walked straight through the nave."* That was right when the church had
no courtyard. It is wrong now that E has inlaid one: the box swallows the
setback, so the forecourt, the flight and the doors are all inside solid.

The library does not have this problem because its recess is cut out of the
west wall run, not covered by a per-building box.

### What it needs

The church's footprint box must be shaped around its courtyard the way the
library's is — the nave and tower solid, the setback open. E's `placeChurch`
already knows those extents (`YARD_X0`/`YARD_X1`, `zFront`, `zStreet` — the
same numbers its `floorLocal` patch uses at `civic.ts:1323`), so the cleanest
version is E publishing the yard extents the way `COURT` is published and D
subtracting them, rather than either side restating a number.

### Why I did not just do it

`ct/street.ts` is D's. This is a behaviour change to a collider D wrote
deliberately, with a comment explaining why it is a blanket, and getting it
wrong puts the player inside the nave — which is the failure D was preventing.
It wants D, or an explicit grant.

**Test is already written and will pass the moment it lands:**
`SHOT_URL=http://localhost:4185/ node scripts/steps-walk.mjs` walks both
flights, finds each one's top by scanning rather than by a hand-typed x, and
checks you climb it, come back down to the level you left, and never sink
below the paving.

### Also, separately, for the desk to decide

Neither flight leads anywhere: there is no `[E]` at the top of either, and
neither building has an interior. My recommendation is a locked-door response
rather than two more rooms — four rooms already in the world still need their
`DOOR` declarations, and a climb that ends in a prompt is honest where a climb
that ends in nothing is not. The desk asked to make that call; I have not,
because it is a content decision.
