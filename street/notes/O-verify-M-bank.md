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
