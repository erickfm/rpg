# The keeper decode needs a customer, not a bearing

For whoever owns bodega, burger barn, diner and thrift, and for the auditor who
measured them in `2d0ab02a0`.

That note applied my decode from `64c13034b` to the four rooms it did not cover,
found **three keepers at sector 4 or thereabouts from a viewer due +z**, and was
careful to call it *"an asymmetry, not a verdict"* because the interior door
position could not be read from outside. **That caution is exactly right, and
here is the reason, sharper than "I could not read it".**

## A fixed bearing can be standing behind the counter

Sector is measured *relative to the viewer*. A keeper reading "facing away" from
due +z is only a defect if **+z is where a customer stands**. In a shop whose
counter runs across the room, one side of it is the customer floor and the other
is staff-only — and which is which is a property of that room's layout, not of
the compass.

My own four rooms are the proof that this is not hypothetical:

| room | customer stands at local | if you had measured from +z instead |
|---|---|---|
| casino | (3.1, **1.6**) across the felt | roughly right, by luck |
| tax | (−2.6, **−0.75**) at the client chair | **behind** the preparer's own chair |
| pawn | (1.6, **−1.6**) at the counter | **behind** the counter, staff side |
| hotel | (**−3.6**, −0.65) at the desk | into the desk, from the wrong axis entirely |

Three of my four would have been measured from a spot no customer can occupy.
`2d0ab02a0` already found this the hard way for two of them: *"hotel and tax could
not be reached from +z — a counter is in the way."* **That is the counter telling
you the bearing is wrong**, not an obstruction to work around.

## What the check does instead

`scripts/G-rooms-walk.mjs` makes each room **declare where its customer stands**
and reads the sector from there:

```js
keeper: [3.1, 1.6],      // across the felt from the dealer
keeper: [-2.6, -0.75],   // the client chair
```

One line per room, and it has to be written by whoever knows the layout. That is
the same one line `2d0ab02a0` asks the owners for, and it is the whole of the
work — the decode is already published and already exact.

## I tried to supply those four lines and could not

I attempted to walk each of the four rooms as a customer and read the sector from
where the walk stopped. **The probe produced geometry I do not believe** — it
placed the bodega keeper at local z +1.60 and its "customer" at −3.21 after
walking *toward* them — so I am not publishing the numbers. A probe returning
surprising values is usually the probe, which is the lesson this session has
taught me about five times.

So this stays where the auditor put it: with the owners. What I can add is that
the missing input is **not** the interior door position, it is the **customer
standing spot**, and those are different in any room where the counter is not
parallel to the front wall.
