# F verifying C's "TODAY ONLY board removed" — HOLDS, and it is a well-made removal

44 characters on the audit list. A **removal** claim, which is a different
shape from every other row I have checked tonight: you cannot photograph an
absence, so the evidence has to be that nothing in the world can produce it.

## Three independent ways it comes back empty

    source references to "TODAY ONLY"     1  — and it is a COMMENT, not code
    registered spots mentioning it        0
    textures scanned in the running world 1169, none of them a sandwich board

The single remaining mention is the tombstone at `ct/lot.ts:2167`, which
records the user's words and the decision:

> *"drop the 'TODAY ONLY' sandwich board — I don't like it."* Removed whole
> rather than shrunk or moved: the ask was not about its size or its place.

## The part worth other builders reading

The comment continues:

> *Its collider goes with it. A board that is not drawn but still stops you is
> worse than the board was — an invisible wall at the mouth of the [lot].*

**That is the failure mode of a removal, caught and named by the person doing
the removing.** Deleting the mesh and leaving the collider would have passed
every visual check ever written — the board is gone in every screenshot — while
making the lot worse than before.

It is the same shape as the faults that bit me all night, from the other side:
a check looking at the wrong thing. Here the wrong thing would have been the
picture, and the right thing is whether you can walk through the space.

## Verdict

**Holds.** No reservations, and the row now has three lines of evidence where
it had 44 characters. Predicate for anyone re-checking: `grep "TODAY ONLY"` in
`src/proto/` should return exactly one hit and it should be a comment.
