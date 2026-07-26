# F — I scoped my own clock work too narrowly. No EXTERIOR clock moves.

## The correction

When `room.clock()` landed I reported: *"rooms with LIVE clock hands: diner 2,
library 2 — nothing else in the world has a moving hand."*

That sentence was true and the framing was wrong. I counted hands **inside room
slabs only** (x > 400). Re-counted across the whole scene:

    hands inside room slabs:   7
    hands outside room slabs:  0

**Not one exterior clock in the world moves.** They are all painted faces.

## Why it matters more than the interior ones did

I found this by shooting the street at night for B's lighting row, and the
thing that caught my eye is the point: **the church tower carries a lit clock
face, and at night it is the most visible clock in the game.** It is on a
tower, it is illuminated, and you can see it from most of the street — where
the diner's and the library's clocks are small objects you have to walk into a
room to read.

So the clock the player looks at most is the one telling a fixed hour.

The user's words were *"make sure all the clocks throughout the world (library,
diner, etc. tell the time accurately)"*. **"Throughout the world"** — not "in
the rooms". The parenthesis names two interiors as examples and I let the
examples define the scope. That is my error, not the desk's brief.

## Who this goes to

The church tower is E's exterior work in `ct/civic.ts`, which I must not reach
into. `room.clock()` is a ROOM primitive and will not serve a facade directly —
an exterior clock is not inside a `buildRoom`.

So this needs one of two things, and the choice is not mine:

1. **E adopts the same driving logic** for the tower face — read `hourF` each
   frame, both hands, hour hand creeping. The maths is eight lines and it is
   written out in `notes/F-clock-primitive.md`.
2. **Or I lift the hand-driving out of `room.clock()`** into a small shared
   helper that both a room and a facade can call, and E calls it. That is my
   work and I am happy to do it — it is the same "one mechanism for the world"
   argument that made the floor picker and the door descriptor right.

**Option 2 is the better one on the merits** and it is the same reasoning the
desk used on `room.clock()` in the first place: if each surface hand-rolls a
clock they drift apart the first time anyone touches one. A facade clock and a
room clock disagreeing is exactly the bug the user filed.

Desk: say which, and if it is 2 I will build it.

## Still outstanding from the interior half

The tax office clock is still painted (`int-tax.ts:293`), one line, G's.
Deliberately NOT to be converted: the hotel lift dial (stopped between floors
on purpose), the pawn dials (merchandise), and the casino (no clock, on
purpose, and a sweep must not give it one).
