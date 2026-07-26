# F — the user's door test now runs, and it finds the tax office

## The test was reporting nothing

The queue item says to run the user's own test on every building: *"stand
inside, note which side the door is on, walk out, turn round, and confirm the
exterior door is on the mirrored side."* `scripts/doorside2.mjs` claimed to do
this. It was not doing it.

Two faults, both GOTCHAS 34 — a check can pass because it found nothing to
check:

1. **It measured the wrong thing inside.** It took the "out to the street"
   SPOT and compared it against a room centre recovered by scanning the scene
   for flat meshes. The spot is placed for standing room, not on the door
   centreline, and the scan took whichever flat mesh was lowest. Five of eight
   rooms came out at `insideOffset = 0` and were written off as "centred —
   undecidable" — including the diner, which declares `at: -2.6`, and the
   thrift, which declares `at: -2.2`. Neither is remotely centred.

   It now reads `__ct.roomDims()`, which publishes `door: {x, z, nx, nz}` in
   room-local coordinates. `door.x` **is** the signed offset from the room's
   centre: no arithmetic, no guessing where the slab starts.

2. **It only looked at eight rooms.** The loop was `slab < 8` against a
   hard-coded list of eight names. The world has ten rooms. **Tax and thrift
   fell off the end** — so the check silently stopped covering the one room
   this whole item is about.

## What it says now

    room       inside offset   outside offset   signs
    bodega             0        -0.6      centred — undecidable
    burger          -3.6        3.89      OPPOSITE — correct
    casino             0        null      no frontage published
    church             0        null      no frontage published
    diner           -2.6        2.89      OPPOSITE — correct
    hotel              0        null      no frontage published
    library            0        null      no frontage published
    pawn               0           0      centred — undecidable
    tax             -4.2       -4.63      ** SAME SIDE **
    thrift          -2.2        2.43      OPPOSITE — correct

Three rooms verify correct. **The tax office is wrong**, which is exactly the
building the user was standing in when they complained:

> *"the interior of the tax service is on the right side of the interior so i
> would expect the exterior to match… this should be done for all buildings.
> make the exteriors match the interiors."*

## The diagnosis, and why I have not fixed it

`int-tax.ts` declares `side: 1`. The two rooms that verify correct declare
`side: -1`:

    building: 'A-1 TAX', w: 13,   cz: -15.5, side:  1, at: -4.2
    building: 'THRIFT',  w: 12.5, cz: -61.75, side: -1, at: -2.2
    building: 'DINER',   w: 12,   cz: -49.5, side: -1, at: -2.6

`side` is what applies the mirror in `doorWorldFor` — `d.cz + d.side * (d.at /
k)`. With the wrong sign the mirror runs the wrong way, which produces exactly
the SAME SIDE verdict above.

**`int-tax.ts` is builder G's file, so I am routing this rather than reaching
in.** If tax sits on the same side of the street as the diner and thrift, its
`side` should be `-1` and this is a one-character fix in G's room. Please
confirm the street side before anyone changes it — the sign is only obvious
from the layout, and guessing it is how this went wrong the first time.

## Not a fault: the authority is already the right way round

The queue asks to flip the authority so the room declares and the facade
follows. That already holds: rooms populate `DECLS` in `ct/doors.ts`,
`publishDeclaredDoors()` pushes each room's door out to the painter, and
`doorAlongFrontage()` hands it over in the canvas columns a painter wants. The
mirror lives in one place. Nothing needed flipping — the queue text predates
the flip.

## Two more stale items, both verified by walking

- **Church** (previous note): steps climb 0.14 → 0.55 and back down;
  `interiors-walk church` 25/25 in and out.
- **Diner seating**: the booth run is already perpendicular, continuous and
  lining the window. Walked it: **8.65 m of clear travel** end to end along
  the aisle in a band from z −0.3 to +0.9, blocked at −0.6 which is the
  counter side — comfortably past the 1 m the queue asks for. Sat in two
  booths and stood up; standing returns you to your pre-sit position with
  2.3 m of free movement, so nobody ends up inside a table.
  `shots/f-diner-aisle.png` is the view down it: counter and stools one side,
  booths lining the window on the other, aisle between.
