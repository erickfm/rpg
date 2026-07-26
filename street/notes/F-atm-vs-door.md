# F — the bank door does NOT steal the ATM's prompt. I was measuring from the road.

## The worry

My modal sweep printed `[E] into FIRST FEDERAL` while standing at an ATM spot,
and I flagged that the ATM might be unreachable — the same class as the user's
old complaint, *"theres still a diner entrance by the bank... make sure all
press e to enter options are aligned with the doors on the facades"*.

## The measurement

Three spots are registered on that frontage:

    FIRST FEDERAL — use the machine   (-7.00, 7.29)  r 1.25
    FIRST FEDERAL — use the machine   (-7.00, 8.24)  r 1.25
    into FIRST FEDERAL                (-6.25, 4.60)  r 1.05

Walking the pavement at x = −6.7, which is inside the kerb (the kerb edge is
−6.51, measured earlier by walking up it):

    4.0 DOOR  4.5 DOOR  5.0 DOOR  5.5 DOOR  6.0 —
    6.5 ATM   7.0 ATM   7.5 ATM   8.0 ATM   8.5 ATM  9.0 ATM  9.5 —

**Clean separation.** The door owns z 4.0–5.5, there is a 0.5 m dead band at
6.0, and the ATMs own 6.5–9.0. Neither steals from the other, and the dead band
between them is the honest gap between two radii rather than a conflict.

**No fault. The row is fine.**

## What I got wrong, and it is a good example of the shape

My first probe line ran at **x = −5.6**, which is in the **road** — outside the
kerb, and 1.4 m from spots with a 1.25 m radius. It returned DOOR twice and
then nothing at all, which I was one step away from reporting as "the ATM
prompt never appears".

The ATM was never out of reach. **I was standing in the street.**

And the tell was in my own earlier work: I had already walked road→pavement
that afternoon and recorded the kerb at x −6.51. The number I needed to choose
a probe line was in a note I wrote myself, and I picked −5.6 by eye instead.

## The refrain, one last time

Every wrong answer I have produced tonight has the same shape: **the
measurement was fine and the population, position or subject was chosen by
guess.** Tags, published spots, room ids, build hashes, kerb heights — the
world had the right number every time, and the only question was whether I
asked for it or estimated it.
