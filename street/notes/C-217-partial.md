# Row 217 (G, library stair) — verified in part, one claim does not hold

Parked mid-verification when the neighbour-walkout request arrived. **Do not
mark 217 either way on the strength of this note** — it is two thirds of a
check.

## Holds

- **The blank slab is gone.** No solid panel between 3.4 and 5.2 m on a side
  anywhere on the stair; the row describes a 3.8 x 4.6 m stair-side wall.
- **An open balustrade replaced it** — 37 balusters along the flight.
- **You can walk in from the door.** Door at z 10.4, walked to z 1.7 unobstructed.

## Does not hold as written: *"in, ONE turn east, up to gy 2.90"*

Walked it, seven times, turning east at every depth from z 7.0 to z -1.2:

```
  turn east at z 6.3 / 5.6 / 4.7 / 3.1  -> stops at x 922.7   the terminal desks
  turn east at z 1.9 / 0.5 / -1.2       -> stops at x 926.5   the side of the flight
  none of them climbs; gy stays 0.00
```

The flight ascends along **z**, not x — its rail runs from (926.99, y 1.82,
z 4.00) up to (926.99, y 3.94, z 0.50). So an eastward walk crosses the stair
rather than climbing it, and the route needs a second turn.

**And the lane that climbs is narrow.** Facing -z at the foot, from five
starting x:

```
  x 925.8  -> walks past it to z -9.9, gy 0.00
  x 926.3  -> same, z -10.0, gy 0.00
  x 926.8  -> stops at z 4.3, gy 0.00      (blocked)
  x 927.3  -> stops at z 4.3, gy 0.68      (starts up, then stops)
  x 927.8  -> z 0.4, gy 2.90               CLIMBS
```

So the flight is climbable — **gy 2.90 exactly as the row claims** — but only
from x ≳ 927.5, and the obvious approach (in, east, north) puts you at x 926.3
where you walk straight past the foot at ground level.

Whether that is a defect or just a loose sentence in the row is **G's call, not
mine**: the row's substance (slab gone, balustrade, foot opened to the room) is
true, and the gallery is reachable. What is not true is that one turn east gets
you there. Worth G re-walking their own route from the door rather than from
the stair foot.

Method note: my first attempt walked me OUT of the building and reported the
route unwalkable. **Yaw 0 faces -z and yaw pi faces +z** in this world; I had
it backwards. Anything that reports "route blocked" should print where it
actually ended up, not just whether it arrived.

---

# CORRECTED 2026-07-26 — the row holds, and I had it wrong twice

**Everything above under "Does not hold as written" is withdrawn.** The row is
now CONFIRMED. G's *"in, ONE turn east, up"* is a fair description of a route
that exists and works; I could not find it because of two faults in my own
method, and both are the same fault in different clothes — **I sampled, and
then reported the sample as the world.**

**1. "The lane that climbs is narrow" — it is 2.5 m.** I tested five x values
at the foot of the flight and three of them (925.8, 926.3, 926.8) are *beside*
the stair, not on it, so of course they walked past at ground level. Standing
across the foot at 0.25 m intervals instead:

```
  x 925.00 .. 926.75   gy 0.00     the floor beside the flight
  x 927.00 .. 929.50   gy 0.66     ON the flight — 2.5 m of it
  x 929.75 ..          pushed out  the outer wall
```

Nothing blocks it and nobody is pushed off it.

**2. "One turn east never reaches the stair" — it does, from the front.**
I turned east at z 6.3, 5.6, 4.7, 3.1, 1.9, 0.5 and -1.2 and read every stop
as the stair being unreachable. What actually stops you is furniture, and it
depends entirely on depth:

```
  z 7.5                 -> x 928.9   crosses clean
  z 6.5 .. 2.5          -> x 922.7   the terminal desks
  z 1.5 .. -1.5         -> x 926.5   the stair's own stringer
```

I had not sampled z 7.5. The one depth that works was outside the range I
chose, and the range I chose was not derived from anything — it was a guess at
where a player would turn.

## What survives, and is worth keeping

The finding that there is **exactly one crossing lane, at the front of the
room**, is real and it is in the confirmed row for G to judge. It is the
user's own complaint one layer along: not a wall now, but furniture, and a
player heading for stairs they can see is stopped by desks.

## The lesson, which is GOTCHAS 34 wearing a third costume

A walk test that reports "blocked" must print **where it ended up**, and a
sweep must justify its range. Mine did print the position — which is the only
reason this was catchable — but I read "stopped at 922.7" seven times without
asking what was AT 922.7. The answer was in `colliders()` the whole time.
