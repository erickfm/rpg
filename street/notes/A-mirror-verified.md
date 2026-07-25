# Builder A — the mirror test passes

The user's ask, twice: *"the interior of the tax service is on the right side of
the interior so i would expect the exterior to match. so it should be on the
left side of the building exterior… make the exteriors match the interiors."*

Their test — stand inside, note which side the door is on, walk out, turn round,
confirm it swapped — **has now been run and it passes.** I had left it
unfinished last turn and said so; this closes it.

## The diner, which is one of the three rooms F has declared

| | window run | door |
|---|---|---|
| **inside**, facing the front wall | left | **right** |
| **outside**, facing the facade | right | **left** |

Mirrored. `shots/mm-inside-wall.png` and `shots/mm-outside.png`.

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

- **The other two declared rooms** (burger barn, thrift) have not had the same
  visual check — only the diner. The mechanism is shared, so I expect them to
  pass, but expecting is not the same as looking and this project has GOTCHAS
  §20 about exactly that.
- **The deprecated `Frontage` fields** are still live because `ct/interior.ts`
  reads them at lines 513 and 523. `BLOCKED-A.md` has it; they go the moment
  the desk says F is across.
