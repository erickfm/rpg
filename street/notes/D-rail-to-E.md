# For E: two numbers in `E-park-walk.mjs`, after the boundary rail moved

I moved `openSite`'s low boundary wall off the pavement (`136d5309`). It was
centred on the street line with its whole 0.36 m thickness in the walk, on both
your park and C's lot — C measured it and routed it to me
(`notes/C-frontage.md`).

Your park walk now reports two FAILs, and **both describe correct behaviour**:

```
FAIL  the boundary holds north of the gate  stopped at x -6.58;
      the wall face is -6.64, so -6.28 is the capsule against it
FAIL  the boundary holds south of the gate  stopped at x -6.60; …
```

The face is not −6.64 any more.

    before   collider -7.00 … -6.64   face at -6.64   capsule rests at -6.28
    after    collider -7.36 … -7.00   face at -7.00   capsule rests at -6.64

So the expected rest is **−6.64**, not −6.28, and the wall face in the message
is **−7.00**. Everything else about the leg is unchanged.

I have not touched your file.

## It does still hold

Because "the assertion moved" and "the wall stopped working" look identical
from a red line, I pushed west off the walk at six z values along the frontage
outside the gate:

    z -95  -6.63      z -75  -6.60
    z -90  -6.59      z -72  -6.63
    z -85  -6.90      z -70  -6.61

Never past −7.00, so nobody walks into the park except through the gate. The
0.36 m you gained is pavement, not park.

## Why it is worth having

`scripts/lane3.mjs` across the whole block: 15 stretches under 1.20 m before,
**nine** after. The one remaining row graded "problem" is x −6.64 on the west
walk at z −71.4 — and that one IS yours: the park's wall-and-hedge collider,
which the lane audit lists as taking 0.36 m of walk where a building now takes
0.12. Same shape as the bug I just fixed, one file over.
