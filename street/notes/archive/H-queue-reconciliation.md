# H's queue: every unchecked box, against the ledger

`notes/queues/H-traffic.md` has **14 unticked items** and my ledger rows show
**0 OPEN**. That gap is bookkeeping, not work — the desk writes the queue file
and builders only read it, so I cannot tick them. This is the mapping so it can
be done in one pass, and so my status stops reading as stalled.

**12 CONFIRMED by the auditor, 6 LANDED awaiting audit, 0 open.**

| queue item (`## Now`) | ledger row | status |
|---|---|---|
| Export a drop-in citizen sprite | `citizenSprite` shipped; 5 modules use it | done, `H-sprite-adoption.md` |
| Write the citizen style guide | `notes/CITIZEN-STYLE.md`, cited by `lot.ts:897` | done |
| Pedestrians are frozen IN THE ROAD | "these people are stuck" | **CONFIRMED** |
| The wheel arches came back worse | wheel ruling + silhouette | **CONFIRMED** ×2 |
| A face reads as three different colours | "whats up with this kids face" | LANDED |
| A pedestrian jitters back and forth | "this red guy glitches back and forth" | **CONFIRMED** |
| Wheels clip through / doors not doors | bed cavity + doors misaligned | **CONFIRMED** ×2 |
| Parked cars leave a trap gap | "im literally stuck here" | **CONFIRMED** |
| Profile feet read backwards | "legs on these people is still off" | **CONFIRMED** |
| Truck tailgate aliasing | "textures on back of truck are janky" | **CONFIRMED** |
| Truck bed shallow / floor body-coloured | bed cavity + floor darkening | **CONFIRMED** |
| Move the parked truck off the alley mouth | "move the truck a bit away" | LANDED |
| Extend the detail down the side street | "details extend out that way" | LANDED |
| Pedestrians get more complicated paths | "more complicated paths" | LANDED |

Plus two found and fixed while working the above, which were never queue items:
the black stripe on the truck's flank (**CONFIRMED**) and the walkable graph
walking up the road at the side street's east end (LANDED).

## The one thing left on the fleet, and it wants an eye rather than a rule

Every face on every vehicle is now **square-texel at 32 px/m — 0 faces off
square, ratios 0.98–1.02** — after the flanks, the noses and tails, and finally
the roofs and hoods (the van's roof was ratio 0.47).

The pickup's **bed floor** is the exception at 16.2 × 16.1 px/m. It is SQUARE,
so nothing is stretched; it is simply half the resolution of the walls around
it, and its ribs are drawn to that grid. Doubling it means redrawing the ribs —
a look change, not a density fix — so it wants the user's judgement rather than
mine. It is the last non-uniform surface in the fleet.

## Rulings, all four discharged

- **Well → ×0.18.** Sill separation 7 levels → **30** (well 60,56,37 against a
  sill of 90,84,58), body and tyre both well clear.
- **Alley mouth.** Needed no edit — already derived from `AZ0` with a 2.5 m
  sight line; truck measured **4.36 m clear** on the alley-side kerb.
- **Masonry rounds by density.** Applied to every panel, vertical and
  horizontal. Nothing already landed was re-done.
- **East end has no pavement.** Made an explicit crossing. The ground half — a
  ramp and stripes, as at the junction — stays routed to B (`ct/tex-ground.ts`
  flags KRAMP on the bodega corner only).
