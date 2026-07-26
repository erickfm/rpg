# VERIFY M's bank — PART CONFIRMED, and one claim I did NOT settle

**Verified by O, who did not build it.** Build `a5640e44c`.

## What I confirmed, from where a player stands

`shots/O-verify-M-vault-out.png`, standing in the banking hall at
(445.3, −3.6) and looking down the room:

- **It is a bank and it is very nice inside**, which is the ask. FIRST FEDERAL
  SAVINGS over the teller line; bronze screens and dished deal trays; terrazzo
  with brass dividers; an acoustic-tile ceiling with three runs of troffers; a
  writing island; a chrome-and-maroon queue line; a brochure rack; a ficus;
  people from H's atlas at the counter and on the floor.
- **The strongroom door is real and it is open** — the round combination dial
  and its dished face are plainly in frame from across the hall.
- **The loan is offered**: `[E] ask about a loan — the officer's desk is by the
  window` is up in that same frame, so the second row's interaction is live
  from the hall rather than only from a spot somebody warped onto.

## What I did NOT settle, and why I am saying so instead of scoring it

M's row claims *"A VAULT YOU CAN WALK INTO … Every other interior here is one
space; this one has a room inside it."* That is a movement claim and this
project does not take those from stills, so I walked for it.

**I found an enclosure and it is the wrong one.** Walking from the middle of
the room at the back corners:

```
back-left  (−x, −z)   walked 4.51 m, stopped 2.49 m short of the corner
back-right (+x, −z)   walked 7.42 m, stopped 1.41 m from it
from inside (+x, −z): +x 0.11 m · +z 0.11 m · −z 0.00 m · −x 9.74 m
```

Three sides stop you inside 1.4 m and one carries you 9.7 m back out — a real
enclosure with one way in. **But the photograph taken from that spot shows the
teller counter running along it: what I walked into is the working side of the
teller line, not the strongroom.** Three sides blocked and one way out
describes both, which is exactly why the walk alone could not tell them apart.

So: **M's vault claim is not verified by me, and it is not refuted either.** I
measured a different object and very nearly filed it as the vault, which would
have been a confident wrong verdict on somebody else's row.

**What would settle it, for whoever takes this next:** walk at the strongroom
DOOR rather than at a corner — it is visible in `O-verify-M-vault-out.png` — and
require that you cross its sill and end up with safe-deposit boxes on three
sides. The cheap version is for `ct/int-bank.ts` to publish the vault's own
footprint the way `ct/lot.ts` publishes `LOT.bounds`; GOTCHAS §22 records that
a module publishing its own extent is what stopped thirteen findings being
routed to the wrong owner.

## Method note, since it is the fourth time tonight

I aimed at "back-left" because the row says back-left, and "left" is the term
GOTCHAS §33 exists to warn about — it means nothing without a facing. The
enclosure I did find is at (+x, −z) in room-local terms. **That is not a fault
in M's build**; it is the row's wording, and the fix is the one §33 gives:
express positions in world or axis terms, never left/right.

— O

---

# RESOLVED, same pass — THE VAULT HOLDS, and the section above is history

**Read everything above as the record of a near-miss, not as an open fault.**
GOTCHAS §44 is that a measurement written as a fault is read as an open defect
forever unless the "after" is written beside the "before", so here it is.

I re-walked, aiming at the **door** instead of at a corner, and found the door
by asking the floor rather than by knowing where it is: sweep the back wall at
0.5 m intervals and take the x where you travel furthest past the wall line,
because a doorway is exactly the place a wall lets you through.

```
lx      -6.2  -5.7  -5.2  -4.7  -4.2 … -1.7 … 2.8   3.3   3.8 … 5.8
past     0.22  3.05  0.72  0.67  0.23   -0.26   1.10  1.19  1.20   1.12
```

**One column out of twenty-five: `lx -5.7`, 3.05 m past the wall line against a
median of 0.67 m.** A flat wall has no such column.

Standing inside at (434.30, −5.05):

```
+x  1.16 m      -x  0.78 m      -z deeper  0.43 m      +z back out  10.29 m
```

**Three sides stop you inside 1.6 m and the way you came in carries you 10.29 m
back into the hall.** A room inside a room, entered through one door — M's
claim, measured on foot.

And it is furnished as one: `shots/O-verify-M-vault-inside-in.png`, taken
standing in it facing the back wall — four courses of safe-deposit boxes with
label holders and twin keyholes, wrapping the corner. Nothing else in this
world looks like that.

## I withdraw my wording note as well

I wrote above that the row's *"back-left corner"* was loose, because I had
measured an enclosure at (+x, −z). **The vault is at `lx -5.7`, which is the
back-left.** M's sentence was right; my corner walk was the loose thing, and
the (+x, −z) enclosure was the teller's working side.

That is the fourth time tonight the instrument was at fault and not the world,
and the second time I nearly filed it against another builder. The tell both
times was the same: a disagreement with a claim the builder had already
measured carefully.

— O
