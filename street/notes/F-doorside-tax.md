# F — CORRECTION: the tax office is fine. Do not change its `side`.

**Builder G: ignore the previous version of this note.** It asked you to
consider changing `side: 1` in `int-tax.ts`. That sign is CORRECT and changing
it would break a room that works. I am glad this was routed rather than
reached into.

## What I got wrong

I ran the user's door test across all ten rooms and it reported:

    tax             -4.2       -4.63      ** SAME SIDE **

I then noticed that `int-tax.ts` declares `side: 1` while the diner and thrift,
which both passed, declare `side: -1`, and offered that as the likely cause.

That was pattern-matching, not measurement. Before asking G to act on it I
checked which side of the street each building is actually on:

    A-1 TAX   door at x = +7   outward normal -1
    PAWN      door at x = +7   outward normal -1
    THRIFT    door at x = -7   outward normal +1
    LIBRARY   door at x = -11  outward normal +1

**Tax and thrift are on OPPOSITE SIDES of the street.** Different `side`
values are exactly what that should produce. There was never an inconsistency
between them to explain.

## The real fault was in the check

`doorside2.mjs` judged with:

    opposite signs = correct

with no reference to which way the facade faces. That is only true for
buildings on one side of the street. The relation the mechanism actually
encodes is `doorWorldFor`'s own:

    worldOffset = side * (localOffset / k),   with side = -normal

so `sign(outside)` must equal `-sign(normal) * sign(inside)`. Checked against
both rooms that were already passing, which is what makes it a rule and not
another guess:

    thrift   normal +1   inside -2.2   outside +2.43   -(+1)(-1) = +1  ✓
    tax      normal -1   inside -4.2   outside -4.63   -(-1)(-1) = -1  ✓

With the normal in the rule, every decidable room passes:

    room       inside offset   outside offset   nrm  verdict
    bodega             0        -0.6   -1   centred — undecidable
    burger          -3.6        3.89   +1   mirrors correctly
    casino             0        null   -1   no frontage published
    church             0        null    ?   no frontage published
    diner           -2.6        2.89   +1   mirrors correctly
    hotel              0        null   -1   no frontage published
    library            0        null    ?   no frontage published
    pawn               0           0   -1   centred — undecidable
    tax             -4.2       -4.63   -1   mirrors correctly
    thrift          -2.2        2.43   +1   mirrors correctly

So the user's complaint — *"the interior of the tax service is on the right
side of the interior so i would expect the exterior to match"* — is satisfied
by the current code for every building that can be judged. Four mirror
correctly; the rest have centred doors or publish no frontage, and those are
undecidable rather than passing. Nothing here is a silent pass.

## What still stands from the previous note

The two measurement faults I fixed were real, and finding them is what
eventually surfaced this:

1. The check measured the "out to the street" SPOT, not the door, against a
   room centre recovered by scanning for flat meshes. Five of eight rooms read
   `0` and were dismissed as "centred — undecidable", including the diner,
   which declares `at: -2.6`. It now reads `__ct.roomDims()`, where `door.x`
   IS the signed offset from the room centre.
2. The loop was `slab < 8` against eight hard-coded names, and the world has
   ten rooms — **tax and thrift fell off the end entirely.**

Both are GOTCHAS 34. The third fault, the verdict rule, is a nastier version
of the same thing: not a check that finds nothing, but one that confidently
reports the wrong answer and names an innocent file.

## Also still standing

- **Authority direction** is already room → facade: rooms populate `DECLS`,
  `publishDeclaredDoors()` pushes to the painter, the mirror lives once in
  `doorWorldFor`. Nothing to flip.
- **Church**: steps climb 0.14 → 0.55 and back; `interiors-walk church` 25/25.
- **Diner seating**: booth run is perpendicular, continuous, lining the
  window. Walked 8.65 m of clear aisle end to end; sat and stood in two
  booths without landing inside a table. `shots/f-diner-aisle.png`.
