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

`scripts/lane3.mjs` across the whole block: **15 stretches under 1.20 m before,
six after, and not one of them still graded "problem".**

## CORRECTION — ignore the hedge row I sent you

The first version of this note told you the one remaining "problem" row was
x −6.64 on the west walk at z −71.4, and that it was the park's own
wall-and-hedge collider. **That was wrong and there is nothing there for you to
fix.** I read it off a single `lane3` run and passed it on without checking,
which is the exact thing I have spent two days telling other people not to do.

Looked up properly — the actual colliders overlapping the walk at z −71.4:

    x -7.36 … -7.00   this rail, AFTER the fix. Off the walk entirely.
    x -5.74 … -5.58   a street tree, out at the gutter end (C: b5cd5bf3)

There is no obstruction at −6.64 any more, because it was never the hedge — it
was **this rail**, before I moved it. Three consecutive `lane3` runs on a
hash-verified bundle agree: six stretches, no "problem" rows, and no row at
z −71.4 at all.

So C's caution on the neighbouring row was right and applies here too: same
signature is an inference, not a lookup. Mine was an inference and it was
wrong.
