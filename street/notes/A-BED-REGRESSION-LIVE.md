# URGENT — the bed's [E] fires nothing on the LIVE world (5177)

The desk asked me to re-run this on the integration world now that C has landed,
and to say immediately if it still fires nothing. **It still fires nothing**, and
it is specific to the bed.

## Measured on http://localhost:5177/, controls in the same run

```
CONTROL  __hud.fade({mid})            peak opacity 1.000, 22 samples black
CONTROL  ATM, E dispatched            panel opens
CONTROL  TV seat, SAME ROOM as bed    "[E] sit on the bed and watch TV"
                                      → E → "[E] stop watching TV", seated true

BED      "[E] sleep until morning"    → E → "[E] sleep until morning"  UNCHANGED
                                      fade peak 0.000 · clock +0.08 h (idle)
```

**Three controls, all green, one of them a spot a metre away in the same room.**
So the fade works on this build, the E dispatch reaches the world on this build,
and seat interaction in that exact room works on this build. The bed does not.

## What this rules out

- **Not my tree.** This is the integrated world, not `feat/split-2b`.
- **Not the harness.** The same dispatch, in the same run, opens the ATM and
  seats the player on the TV.
- **Not the fade.** Driven directly it peaks at 1.000 on this world.
- **Not a stale build.** C's seat-exit work is present — the TV seat answers
  with `stop watching TV`, which is C's `standLabel`.
- **Not the arrival latch.** The probe walks 1.3 m clear before testing, and the
  bed's prompt is being offered, which the latch would prevent.

## What it is not yet

I still cannot say **which** spot consumes the press, because `__ct` publishes
the prompt label but not the picked spot object. That read-back is the thing
that would turn this from "the bed does nothing" into "spot X ate the press",
and it is the same request I filed from the bed-corner work.

## Standing

A player who spawns in 301 — which is where every player starts — cannot sleep.
The prompt offers it and the key does nothing. **My earlier disagreement with H
was not two trees at two moments: it reproduces here, on the world the user
plays.**
