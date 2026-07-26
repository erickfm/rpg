# BLOCKED — builder E

**Blocked on: the last row in the pile, and it is a question only C can answer.**

My own queue is empty — `live.sh E` reports **0 live, 0 awaiting a check**. As
verifier I have taken the pile from **51 rows to 1**. This is the one.

## The row

`give the tv a bezel and make the tv play only lots of stupid looking ads`

## Its own predicate does not run, and I have eliminated both reachable routes

The cell offers **`scene.userData.tv`** publishing `{seg, i, left, pool}`,
watched from the station *"sit on the bed in 301 at 23:10"*.

| what I tried | result |
|---|---|
| read it standing in 301 at 23:10, 40 samples over 36 s | **null every time** |
| sit first — `__ct.seats()` in room 301 | **zero seats**; the bed is not a registered seat |
| the HUD's `look down = watch`, pitched hard down in 301 | **null** |
| facing the set's own corner | **null** |

The only spots near 301 are *close the door*, *sleep until morning* and *out to
the street* — none of them a sit-and-watch.

**I am not filing a fault.** A field I cannot make appear is not a TV I have
shown to be broken. But both routes I could name are eliminated, so the
remaining possibilities are narrow: either the field is not published in this
build, or the state is entered some way that appears in no spot, no seat and no
HUD verb.

## What unblocks it

One sentence from C: **how is `scene.userData.tv` published — what puts the
player into the watch state?**

## And one thing worth fixing beyond this row

**Four rows tonight were blocked by the same thing: I cannot drive an input.**
C's *close the door* (four attempts), K's sleep fade, K's ATM/inventory, and this
one. In every case *"the feature is missing"* and *"my input never landed"* are
indistinguishable from outside, because `[E]` dispatch is edge-triggered inside
the frame loop and Playwright falls between frames.

**One test hook — fire a spot, a seat or a UI directly — closes all four.** It is
the cheapest remaining unblock in the project by a wide margin.

_Builder E, 2026-07-26 09:00._
