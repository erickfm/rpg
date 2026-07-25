# Builder A — the mirror test passes

The user's ask, twice: *"the interior of the tax service is on the right side of
the interior so i would expect the exterior to match. so it should be on the
left side of the building exterior… make the exteriors match the interiors."*

Their test — stand inside, note which side the door is on, walk out, turn round,
confirm it swapped — **has now been run and it passes.** I had left it
unfinished last turn and said so; this closes it.

## A-1 TAX — the building the complaint was actually about

`shots/tx-inside.png`, `shots/tx-outside.png`

| | window run | door |
|---|---|---|
| **inside**, facing the front wall | left | **right** |
| **outside**, facing the facade | right | **left** |

Word for word against the ask: *"the interior of the tax service is on the right
side of the interior so i would expect the exterior to match. so it should be on
the left side of the building exterior representing this interior."*

Inside right → outside left. **That is the original complaint, closed.**

## Two more of the rooms F has declared

**The diner** — `shots/mm-inside-wall.png`, `shots/mm-outside.png`

| | window run | door |
|---|---|---|
| **inside**, facing the front wall | left | **right** |
| **outside**, facing the facade | right | **left** |

**Burger Barn** — `shots/bb-inside.png`, `shots/bb-outside.png`

| | window run | door |
|---|---|---|
| **inside**, facing the front wall | left | **right** |
| **outside**, facing the facade | right | **left** |

Both mirrored.

Reached the room through its own `[E]` spot rather than by warping to
coordinates, so the route the player actually takes is the route that was
tested. I did not guess which way the front wall faced — shot all four
cardinal yaws from inside and picked the one showing it, which is why this
took a second attempt after last turn's camera faced along the room.

## What that confirms end to end

1. `ct/doors.ts` (F) declares the door in **world coordinates** at module scope.
2. `registerFrontage()` resolves it against the frontage's placement — including
   `uDir`, the single piece of handedness, measured off the mesh `uv` rather
   than assumed.
3. The painter reads it through `doorAlongU()` and paints the door there. The
   three declared frontages moved off the painter's own choice to do it:
   burger `−29 → −25.11`, diner `−54.27 → −46.61`, thrift `−56.77 → −59.32`.
4. The room places its door from the same number, applying its own mirror.
5. Standing on either side, the two agree — and disagree in the correct
   direction, which is the whole point.

One number, world coordinates, three consumers, the mirror applied once inside
each. A room later flipped to face the other way keeps working, because nothing
anywhere stores a "side".

## Still outstanding

- **THRIFT: now CONFIRMED.** The earlier attempt failed because backing off
  5 m puts the camera inside a clothing rack — the room is crammed by design.
  Taken instead from a lateral offset 2.5 m back: window left, **door right**
  inside; **door left**, window right outside. Mirrored.
  `shots/th2-1.png`, `shots/th2-outside.png`.
- **PAWN cannot be checked by walking in — it has no way in.** It declares at
  z −60.50 and the facade moved there, but there is no `[E]` prompt at that
  facade at 6.25, 6.1 or 5.9 m out. Consistent with `BLOCKED-G` calling
  `int-pawn` finished but door-blocked. F's or G's; recorded in `BLOCKED-A.md`.

**Four of the five declared rooms are verified mirrored: A-1 TAX, the diner,
Burger Barn and THRIFT.** The fifth is unreachable, not wrong.
- **Every shop that has NOT declared** still takes its door from the painter's
  own layout. Those are self-consistent (facade and room use the same fallback)
  but they are not expressing any room's intent, because there is no room behind
  most of them. Only the declared ones are the user's ask being satisfied.
- **The deprecated `Frontage` fields** are still live because `ct/interior.ts`
  reads them at lines 513 and 523. `BLOCKED-A.md` has it; they go the moment
  the desk says F is across.
