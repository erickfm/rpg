# F — walked a full circle round every figure in my rooms

The live row is *"make sure the people in the buildings are in the right
orientation"*, and the original complaint was sharper than a single-angle
check can answer: *"the burger barn guy shows you his BACK NO MATTER WHERE YOU
STAND"*. A figure that is wrong by a constant still passes a check taken from
one spot. So this walks four sides of each figure and decodes which atlas
column it picks from each.

## Result

    diner    N:col0  S:col0   E:col0  W:col2m   ** CONSTANT **
    diner    N:col2  S:col2m  E:col0  W:col4    TURNS
    diner    N:col2m S:col2   E:col4  W:col0    TURNS
    diner    N:col4  S:col0   E:col2  W:col2m   TURNS
    thrift   N:col0  S:col0   E:col0  W:col0    ** CONSTANT **
    thrift   N:col4  S:col0   E:col2  W:col2m   TURNS

The waitress and both newly seated booth customers turn correctly, as does the
thrift's keeper. Four figures verified properly for the first time — not
"passes the check", but *walked round*.

## The two constants are probably NOT faults, and I am not claiming either way

My detector selects any textured plane 1.5–2.2 m tall and wider than 0.7 m
inside a room slab. That is not the same as "a citizen". Two things it will
also catch:

- **the thrift's MANNEQUIN**, which is deliberately static and deliberately
  posed at the wrong angle — a shop dummy that swivelled to follow you would
  be the bug.
- **tall wall art** — the diner carries framed photographs and a window
  display of about that size.

So the honest reading is: every figure I can confirm is a person turns
correctly, and the two constants are most likely objects that should not turn.
**I have not confirmed which meshes they are**, and I would rather leave that
open than record two false faults or two false clears.

## What would close it

The kit knows which meshes it made through `room.person()` — it registers
their frame hook. Tagging those (`mesh.userData.citizen = true`) would let a
circle test select exactly the figures and nothing else, and would make this
answerable in one run instead of by inference. That is a small kit change and
it is mine; it is the next thing I would do on this row.
