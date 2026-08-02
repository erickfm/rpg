# Item 26 — the roulette places: three were unreachable, and the sliver is 0.80 m

**Root cause, one line:** the five roulette places ringed the wheel's `+z`
side, which is 0.80 m from the last slot bank — and a place needs 2.35 m of
clear radius there (1.55 m to the stool, 0.80 m more to its `[E]` approach), so
the arithmetic ran out before the stool reached the felt.

## Two corrections to the item

1. **It is three places, not one.** Measured with
   `scripts/w15-roulette-gap.mjs`: the three inner places (world `(676.06,
   1.50)`, `(676.90, 1.75)`, `(677.74, 1.50)`) all had their registered
   approach point inside the slot bank. Only the two at the ends of the arc
   were usable. w17 found the middle one; the other two fail the same way.
2. **The gap is 0.80 m, not 0.08 m — out by a factor of ten.** Read straight
   off the live colliders:

   ```
   roulette table   x 675.75 … 678.05   z -0.95 … 1.35
   last slot bank   x 674.70 … 678.50   z  2.15 … 3.45
   ON THE WHEEL'S CENTRE LINE (x = 676.9):  gap 0.800 m between z 1.35 and z 2.15
   ```

   This matters for the diagnosis, not just the record. At 0.08 m it reads as a
   near miss that a smaller stool or a shorter approach would close. At 0.80 m
   it is plainly a **layout** problem: the smallest stool ring that still
   reaches the felt needs 2.35 m and has 1.95 m, so no radius and no approach
   distance can fix it. That is what w17 meant by "a layout call, not a seat
   call", and the ten-fold number hid it.

## What I changed — `ct/int-casino.ts` only

**The ring moved to the side that is actually open.** Clearances from the wheel:
`+x` **4.05 m** (the avenue), `−z` 1.40 m (poker), `−x` 1.25 m (west wall),
`+z` **0.80 m** (the bank). It was on the 0.80 m side.

Two constants, `ROU_OPEN` and `ROU_SPAN`, are now read by **both** the stool
ring and the wheel head, so the head stays opposite the players instead of
being a second hand-typed assumption. `RZ - 0.42` was the other half of the
same "players are on +z" belief, and moving the ring without it would have put
the wheel behind the seated row. This is the class w17 fixed in the yaws.

**The arc is not centred on `+x`, and that is why five places still fit.**
Solving `0.2 + 2.35·cos a` against the bank and the poker table (both less the
0.36 m capsule half-width, plus 0.15 m of margin) gives a legal arc of
**0.810 … 2.807 rad**: 1.997 wide, centred on **1.81**, leaning off `+x`
because the bank is the nearer constraint. My first pass centred it on `π/2`,
wasted the slack at the far end, and squeezed the stools to 0.58 m apart — at
which point `[E]` starts picking a neighbour. Using the whole arc gives
**0.74 m between stool centres**, against 0.89 m before the move.

## DONE WHEN — all three met

| clause | result |
|---|---|
| the seat has a legal standing approach | **5 of 5**, `w15-roulette-gap.mjs` |
| `seat-facing.mjs` still green | **219 registered seats · 219 look at something** |
| `bugsweep` zero STATION MISS | **0**, on the built bundle |

And the part the brief insists on — **I walked it**
(`scripts/w15-roulette-walk.mjs`): for each of the five, in from the avenue,
`[E]` held, seated on **that** stool, `[E]` again, back on my feet. 16/16.

## Mutation tests

| mutation | result |
|---|---|
| restore the original ring (`a = -1.15 + i * 0.575`) | gap check **FAIL: 3 of 5 have no legal approach**; walk **11 FAILs** |
| the walk's stand-up clause when the sit failed | now reports *"never sat down, so standing up was not tested"* instead of passing |

## Two of my own instruments were wrong first, and that is the useful part

Both times the check accused the room of something the check was doing.

1. **The walk overshot.** The first version started a full stride behind the
   approach point and held `W` for ~1.8 m, sailed past the approach and landed
   on the **next stool round** — so all five places reported "`[E]` seats you"
   at the wrong stool and I nearly widened the ring for nothing.
2. **The walk started inside the poker table.** The second version warped
   radially outward from the approach point; for the place nearest poker that
   start point is 0.07 m inside poker's collider, `unstick()` shoved the player
   0.78 m sideways before the walk began, and the place read as unreachable.

The fix for both was to approach **from the avenue**, which is how a player
actually arrives. *A walk that does not start and stop where a player would is
not the player's walk* — worth a GOTCHAS line, and it is the same lesson as the
"0.00 m clear behind" readings below.

Also: **the first screenshot after page load came back solid black, twice.**
The room's own `[E]` prompt was drawn over it, so the page was alive and the
camera was where it was told to be — the frame simply had not been composed.
The look script warms up before its first shot now. A black first frame is
indistinguishable from a room with no lights in it.

## Found and did NOT fix

1. **The roulette table's collider is a 2.30 m SQUARE around a 2.20 m ROUND
   table.** Its corners stick out 0.43 m past the rail, which is why my gap
   check reports "0.00 m clear behind" for the two outer places — the stool's
   own footprint is inside the square, though nothing there actually blocks a
   player. Harmless today. Shrinking it is not free: `PIT` is also read by the
   slot-bank stool-skipping logic (`inPit`), so it is its own row.
2. **The poker table's clearance is 0.02 m.** At the ring's radius the far
   approach point sits at z −2.15 against a poker collider that starts at
   −2.17. I kept the span well inside that, but any future change to `PIT[2]`
   or to the ring will land on it with no warning. `w15-roulette-gap.mjs` will
   catch it.
3. **Nine slot stools were removed by w17 for the same class of fault** and the
   last bank row still "hangs over the pit" — the file's own words. The real
   structural fix is that `BANK_Z`'s last row at 2.8 is too close to the pit;
   moving it back to 3.6 would open the roulette's `+z` side completely but
   drops the gap to the next bank from 1.90 m to 1.10 m, and the file documents
   1.90 m as the difference between *"edging past a machine and walking between
   two of them"* — a user-driven number. **I did not trade one against the
   other**; re-aiming the ring costs nothing and keeps both.

## Derived or copied?

Derived. `ROU_OPEN`/`ROU_SPAN` are solved against the collider positions rather
than chosen, and the working is in the source comment. The stool ring and the
wheel head read the same two constants. Both checks fit the ring out of the
live seat registry — five stools on a common circle — rather than typing a
coordinate, so moving the table moves the checks with it.
