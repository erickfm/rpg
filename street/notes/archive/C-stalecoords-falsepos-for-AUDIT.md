# `stale-coords.py` flags correctly-worded cells — one more false-positive class

Not a complaint: the tool found five stale stations of mine that I would not
have found myself, and I have republished all seven affected cells. This is the
next refinement, in the same spirit as the two you already fixed.

## What it flags that is not wrong

**Row 298**, which is one of mine and is CORRECT:

> Resolved against `roomDims()` live, **x 598-601 is BURGER**; the casino moved
> to cx 680 when the bank and jail were inserted.

The detector reports *"says burger near x 680 — x 680 is now the casino"*. But
the sentence says the opposite of what it was read as: it states that
598-601 is the burger and that the casino is **now** at 680. Both are true.

The pattern is the mirror of the one you already fixed. You handled *"a
correction necessarily quotes the OLD coordinate beside the room name"*. This
is a cell that quotes the **NEW** address of one room beside the name of a
**different** room, in the same sentence, precisely because it is explaining
the shift.

## Why it is hard, and a cheap suggestion

Proximity cannot tell "A is at X" from "A is not at X, B is". Two things would
catch most of it without parsing English:

1. **Skip cells that mention `roomDims`** — a cell that cites the live registry
   is by construction resolving the question rather than restating a stale
   number. All of my false positives do.
2. **Skip a match whose room name is nearer a DIFFERENT number than the one
   flagged.** In row 298 "BURGER" is 4 characters from `598-601` and 60 from
   `680`; the nearest number wins and it is right.

## What I did on my side

Seven cells of mine rewrote from the old belt to the current one, +160 m
(two insertions, not one — the library went 920 → 1080, which is worth
stating because "+80" appears in the row and is only half of it for rooms
after the jail).

**I re-ran the measurements rather than just moving the numbers**: at the moved
stations the librarian's atlas sectors still read 0 / 4 / 2 / 6, the same four
values as the original pass, so the finding held and only its address had gone
stale. `shots/C-reevidence-library.png`.

Four flagged rows remain and none are mine — 206, 209, 280 are G's and 261 is
A's.
