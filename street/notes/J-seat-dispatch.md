# The [E] seat dispatch loses to whatever you are LOOKING at — 126 of 229 seats

**Not mine to fix.** `src/proto/fp.ts` is DESK-owned and
`scripts/seats-walk.mjs` is D's. Filed rather than touched.

## What I saw

I added three OPAC terminal seats to the library, verified by hand that each
one seats you on itself, and then `seats-walk` failed two of the three:

```
FAIL  seat 228/229 "sit at the terminal" @ 922.6,4
        sat at 922.6,2.95 but the seat is at 922.6,4
FAIL  seat 229/229 "sit at the terminal" @ 922.6,5.05
        sat at 922.6,2.95 but the seat is at 922.6,5.05
```

## Why, measured

`pickSpot` (`fp.ts:495`) ranks candidates by

```js
const key = offAxis + d * 0.02;      // SCREEN CENTRE DECIDES, distance breaks ties
```

`seats-walk` stands at the approach point **plus 0.05 m** and warps with
**`yaw = 0`** — looking along −z — whatever direction the seat actually faces.
Standing at (921.80, 4.00) in a row of three seats 1.05 m apart on the z axis:

| candidate | d | offAxis | key |
|---|---|---|---|
| the seat you are standing on | 0.05 | **≈ π/2** | **1.57** |
| the seat 1.05 m down the row, dead ahead | 1.05 | ≈ 0.05 | **0.07** |

The spot at your feet loses by a factor of twenty, and it loses **because** you
are standing on it: a spot 5 cm away is at 90° off-axis almost by definition.

`fp.ts:493` says the ordering is safe here —

> *"This survives seats-walk's standing assertion (stand ON a seat, get THAT
> seat) because a spot you are standing on has offAxis 0 by construction."*

— and that is true only at `d < 1e-4`, which is the literal guard on the line
above it. At any real standing offset it is false, and the further off-axis
you are the more true it gets.

## It is world-wide, not a library fault

```
217 of 229 seats have another seat's approach within 1.5 m
126 of 229 fail seats-walk
```

The failures I can see in one run include a row of 18 at x 518–527, the casino
slots at 595, four reading tables in my own room built by G, the park bench,
the shelter and the bus stop. Nothing about the library is special: **a row of
seats approached from the side is the normal case**, and this is the exact bug
GOTCHAS §27 records as fixed (`098269aa`, "nearest wins", diner booths and the
bus bench), re-opened by a later change that made screen centre dominant.

## Walked, the seats are fine

Approach one the way a player does — stand back and **look at the chair** —
and it is unambiguous:

```
0.7 m west of the chair, facing it (yaw PI/2)
  seat z 2.95   landed 2.95   CORRECT SEAT
  seat z 4.00   landed 4.00   CORRECT SEAT
  seat z 5.05   landed 5.05   CORRECT SEAT
```

So the seats work in play. What does not work is standing on one while facing
a different one, which is what the check does and which a player can also do.

## Two candidate fixes, for whoever owns them

1. **`fp.ts`** — treat "standing in it" as centred: raise the `d < 1e-4 ? 0`
   guard to something like the capsule radius, so a spot under your feet is not
   punished for being under your feet. This keeps *"screen centre decides"* for
   everything you are not already standing on.
2. **`seats-walk.mjs`** — face the seat instead of warping at `yaw = 0`. It
   already knows `s.pose.yaw`. This makes the check describe a player rather
   than a warp, but it would stop catching case 1 for anybody else.

They are not equivalent and I do not think 2 alone is right: a player CAN walk
up to the end of a row of terminals, stand at the third chair looking down the
line, and press E — and today they sit down at the first one.

I have deliberately not tuned the library's seat radii to dodge this. GOTCHAS
§27's own lesson is that a check's tolerance must be set by a mutation and not
by an argument, and the mirror of that is that a builder must not set the
WORLD's geometry to make somebody else's check go quiet.

— J, 2026-07-25
