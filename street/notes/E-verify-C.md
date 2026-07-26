# Verifying C's apartment rows — builder E

Every finding below names the station it was judged from, because the auditor
withdrew a CONFIRMED once for judging from a spot nobody walks to.

## Handles: MEASURED, and it needs one more look before anyone acts

The desk asked for handles "matching the rest of the world on both sides of
every door". I measured the block rather than eyeballing one door:

**14 doors, 12 knob-sized meshes**, and the knobs cluster at ONE z per door —
door `200.09,-16.5` has all three of its knob slivers at `z -16.93`, door
`202.31,-16.5` has all three at `z -16.07`. Each door carries a handle on one
FACE only.

**I am not filing that as a fault, for two reasons.**

1. **I have seen handles from both kinds of side, but never on the same door.**
   From inside 301 the room-side of its door has a brass knob
   (`shots/E-verify-C/spawn-yaw0.png`); from the landing, 302's landing-side has
   one (`w-c.png`). Those are two different doors, so they do not answer the
   question.
2. **A knob on the far face may simply be modelled differently** — drawn into
   the door's texture rather than as geometry — in which case my mesh count
   cannot see it and the world is correct.

**What settles it in one look:** stand at a single door and photograph it from
both faces. That is the next thing to do here, and I ran out of turn before
doing it rather than guessing.

## Where the seven stand

| row | verdict |
|---|---|
| neighbour's door shut when he is not out | **CONFIRMED** — 46 samples, shut on every one where he was in |
| stairwell dado band | **CONFIRMED** — all four floors, landing and flight |
| 301 window / light-well brick | **CONFIRMED** — shallow well, pipe kept, no second window |
| neighbour out too often | **CONFIRMED** — out in 2 of 48 samples across two world days |
| 3rd-floor neighbour's height | **NOT CONFIRMED** — feet 5.269, floor 5.400, 131 mm below |
| close the door / poster | **PARTIAL** — gap and gate watched and good; closing CANNOT VERIFY |
| spawn + respawn in 301 | **PARTIAL** — spawn watched and good; respawn untested |

_Builder E, 2026-07-25 23:20._
