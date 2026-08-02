# w19 — `jump-walk.mjs` now tests the storey picker it is named for

Queue item 42. Commit `84e70c4b2`. Port 4184 (4180–4199 were all occupied by
other builders).

## Root cause, one line

The three storey spots were written as coordinates and never checked against the
building, and the one helper that could have revealed it — `warp` — silently
normalised the "leave the storey alone" case into "put me on the ground floor",
so every row agreed with every other row and the file looked healthy.

## The row was right about the fault and wrong about the measurement

**Right:** the three spots at (104, -16) / (112, -16) / (120, -16) are nowhere
near the walk-up, which stands at `APT_X0 = 200`. **Right:** `warp(x, z, gy ?? 0)`
turns the `null` storey — the case under test — into `setGy(0)`, so *upstairs*
was pinned to storey 0 before the jump it existed to measure.

**Wrong on one measurement, and it matters for how the row reads:** the row says
`groundAt` reads **0.000** at all three. It reads **5.400**. And "in no room at
all" is true of them but is not the discriminator the row thinks — `roomDims()`
publishes only the twelve shop/civic interiors (cx 440–1320), so the four
*outdoor* spots this file has always got right are `room NONE` too. The
walk-up is not a `roomDims()` room at all.

What the 5.4 actually means is worse than the row's version: the picker has
hysteresis, the player spawns on floor 3, and `groundAt` off the building simply
hands back the storey it was already on. So all three spots reported **the same
height as each other** — three rows named for three storeys were one storey
repeated, and the number they repeated was an artefact of where the player
happened to start. Measured with `scripts/probes/w19-walkup-storeys.mjs`.

## What it does now

The building's frame is **derived from what the world publishes**:
`scene.userData.spawn` (`ct/apartment.ts:114-119` builds it as
`{ x: APT_X0 - 1.4, z: APT_Z0 + 3.7, gy: 2 * ST0 }`), so `APT_X`, `APT_Z` and the
storey height come back out of it instead of being a fourth copy of coordinates
that have already moved once.

**One warp names a storey, and it is the only one that legitimately must** —
arriving in the lobby of a building with four stacked floors is exactly the case
where you have to say which floor you arrived on. Everything after it is walked:

- **the lobby** — asserts storey 0, `groundAt` 0, and that it is inside the
  walk-up's footprint, then jumps there;
- **the climb** — holds `W` from the lobby and watches the picker carry the
  player up flight A: `gy 0 -> 0.16 -> 0.48 -> 0.82 -> 1.13 -> 1.35`. Asserts it
  climbs at all, that it passes through heights **between** storeys (so the ramp
  is a ramp and not a step), and that the half landing is reached on foot;
- **the null-storey case** — warps to where the climb actually left the player
  with no storey named, and requires the storey to survive. This is the shipped
  bug, asserted directly: `1.35 stayed 1.35`;
- **the stairs** — walks back onto the ramp and jumps from a sloped floor, which
  is what the hysteresis exists for. `groundAt` non-zero there, 0.38;
- **upstairs** — the published spawn, floor 3 inside 301, the one upper-storey
  position the world itself vouches for and that `scripts/door301.mjs` already
  asserts stays standable. `groundAt` 5.40.

**The ramp position is the point of the design.** It cannot be written down —
it is wherever the climb had got to — so it cannot rot into a coordinate that
stops meaning anything, which is precisely how this file failed.

## Mutation test

The picker broken on purpose, in source: `aptGround`'s stair ramp flattened
(`rel = lx < 1.2 ? t * RISE : 2 * RISE - t * RISE` → `rel = 0 * t`).

**The rewritten check goes red six ways and exits 1:**

    climbed: gy 0
    FAIL holding W from the lobby CLIMBS — the storey picker follows the ramp
    FAIL and it passes through heights that are BETWEEN storeys
    FAIL and the half landing is reached on foot — gy 0.00
    FAIL and it is genuinely not the ground floor — gy 0.00
    FAIL standing on the stairs, between storeys — gy 0.00
    FAIL and groundAt is NON-ZERO there — 0.00

**The old file, on the identical broken world, was entirely green:**

    the apartment stairs   gy 0.00 -> 0.00  apex +0.519 m  same floor
    upstairs               gy 0.00 -> 0.00  apex +0.522 m  same floor
    jump lands you on the floor you left, everywhere

Its own output says `upstairs gy 0.00`. It printed that every run for the whole
of its life and nothing read it. `ct/apartment.ts` restored and rebuilt.

## One thing I got wrong, and how it surfaced

I first replaced the hand-typed eye height (`apex - (gy + 1.62)`) with
`pos()[1]`. **That is wrong:** `pos()[1]` is the rig's height *within* its
storey and excludes `gy`, so upstairs it read the 5.4 m of building as a 5.875 m
hop and two rows went red whose jump was fine. The check caught my instrument,
which is the argument for having it.

The fix is `camY()` sampled at rest, which already includes the storey. Measured
rather than assumed: `camY - gy` is **1.6200 exactly**, stable over six samples,
so this is arithmetically identical to the old constant with no constant in it,
and the 0.45–0.8 apex band is untouched. I did not re-centre the band.

## Found and NOT fixed

**The mutation has no durable home, and that is the one clause of DONE WHEN I
cannot close from inside this item.** "The check goes red when the storey picker
is deliberately broken" is proved above, but proved *by hand* — which is the
exact excuse `canfail.mjs`'s own header names ("it fired for real once"). The
durable form is a canfail case, and it needs two files this item does not name.
It is a two-line change; here it is ready to paste:

    const APT = 'src/proto/ct/apartment.ts';
    ['jump-storeys', APT,
      '        rel = lx < 1.2 ? t * RISE : 2 * RISE - t * RISE;',
      '        rel = 0 * t;   // selftest: the stair ramp made flat',
      'jump-walk.mjs', [], 'the walk-up stairs not climbing at all'],

and `scripts/checks.mjs`'s `jump-walk` row changes its third field from `false`
to `'jump-storeys'`. A runtime `--selftest` is **not** the answer here and I want
that on the record: the picker is internal to `ct/apartment.ts` and nothing
reaches it from the page except `warp`, so the only mutation a harness could
install would break the check's *view* while leaving the world intact — GOTCHAS
34 says that proves nothing.

**`jump-walk` runs at ~50 s now**, up from 22 s, because it walks. That is still
comfortably inside `checks.mjs`'s 180 s fast-tier ceiling and well under the 36 s
that moved `lotwalk` to slow — but it is a judgement the desk may want to make
rather than inherit, so I am flagging it rather than moving the row myself.

## Verdict

Green on the real world, all rows. `node scripts/bugsweep.mjs`: zero STATION
MISS. No after-images: this changes a check, not the world — `ct/apartment.ts`
was mutated and restored, and `npm run build` is clean.
