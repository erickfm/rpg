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
