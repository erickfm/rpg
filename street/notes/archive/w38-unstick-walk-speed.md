# w38 — item 80: unstick-walk, 11m15s → 2m53s

**Root cause in one line:** a **fixed 1.1 s wall-clock wait per trap** — and
`dt` is clamped at 0.05 s (`src/main.ts:107`), so that was 1.1 s spent waiting on
*frames*, which are observable and were already over by then.

**Port 4195** (`vite preview`, built bundle). Proved free first; shut down at the
end.

## Result — all three DONE WHEN conditions, measured

| | before | after |
|---|---|---|
| wall clock | **11m15s** (two baselines never finished: a page crash at 4m40s, then the 10-minute cap) | **2m53s** (173 s) |
| traps visited | 582 | **582** — 531 genuinely stuck + 51 already passable |
| the (8.50, −94.50) trap | reported | **still reported**, same position |

```
582 traps found (inside-a-collider + every sub-0.97 m gap)
531 were genuinely stuck; 530 freed themselves
   (6424 rendered frames across 531 probes, 12.1 each — the fixed wait
    this replaced was ~66 frames every time)
51 candidate gaps turned out to be passable already
  FAIL  inside @ 8.50,-94.50 — still inside a collider after 59 rendered
        frames (stalled) (at 7.75,-95.25)
1/531 traps are still traps
```

Exit 1, as before. **Coverage was not cut** — the item was explicit that reducing
the trap count would be cutting coverage, and the count is identical.

## What changed

Each trap was **five round trips and two fixed waits** (`isBlocked`, `warp`,
60 ms, 1100 ms, `pos`, `isBlocked`, `canMove`). It is now **one round trip** that
warps, watches per rendered frame, and returns the same three facts — where the
rig ended, whether it is still inside, whether any direction is open. The probe
ends when the *world* says the attempt is over: free, stalled, or a 240-frame
terminator.

**12.1 frames per probe measured, against the ~66 the fixed wait always paid.**
That ratio is the whole saving, and it is why the answer was always arriving in a
fraction of the time it was being given.

## The one number that had to be derived, not tuned

**`STILL_FRAMES = 40`.** `FPRig.unstick` has a `PATIENCE` of **0.45 s**
(`fp.ts:371`): a player it cannot push out is teleported back to `lastGood` only
after 0.45 s of *accumulated* `dt`. That is 9 frames at the 0.05 s clamp and **27
at a 60 fps 1/60 s step**, so 27 is the worst case and 40 clears it with margin.

**Ending the probe on a shorter stall would have cut that rescue off and invented
failures the world does not have** — the exact "tune a threshold until it agrees
with you" move BUILDER-BRIEF forbids. The number comes from fp.ts's own constant.
Evidence it is doing its job: the one real failure took **59 frames** (40 still +
19), i.e. it waited well past PATIENCE and still reported the trap.

## Found and NOT fixed — for the desk to queue

1. **The (8.50, −94.50) failure is a false positive, and that is item 79** — I
   held that item immediately before this one and handed it back. `unstick-walk`
   is right that *something* is odd there and wrong about what: its `isBlocked`
   (line 35) omits `inFrame`, so it measures a collider turned 45° as if it were
   axis-aligned. `fp.ts:287` applies `inFrame` and calls the same point free, and
   the player cannot walk within 1.106 m of it. **I deliberately did not fix that
   here**: this item's DONE WHEN requires the trap to *still be reported* "before
   item 79 fixes it", so changing the predicate would have failed the acceptance
   test. Speed and semantics kept separate on purpose. Details in
   `notes/w38-chamfer-trap-premise.md`.
2. **The 6 "driven for real" cross-checks still use fixed waits** (1100 ms plus
   4 × 400 ms holds, ~19 s of the remaining 173 s). Same wall-clock fault class,
   but there the point is genuinely to hold a key for a duration, and 6 traps is
   not where the cost was. Worth converting only if this needs to get faster.
3. **The initial `isBlocked` is still one round trip per trap** (582 of them).
   Batching them into a single evaluate would save a couple of seconds. I left it
   alone: frames dominate the remaining runtime, and 12.1 frames per probe is
   already the physical cost of the escape itself (a ~1 m push at
   `UNSTICK_SPEED` 3.0 m/s is ~0.33 s), so there is no large win left without
   changing what is measured.

## Timeout headroom

`unstick-walk` is registered **slow tier** (`checks.mjs:626`), so its budget is
`SLOW_MS` = **1,500,000 ms**, not the 180 s default — 173 s sits inside both, with
enormous margin in the tier it actually runs in.

## Derived or copied?

**Derived.** `STILL_FRAMES` from `fp.ts:371`'s `PATIENCE`, cited by line;
`RADIUS` is the file's existing constant, unchanged. The in-page blocked
predicate is the one this file already used, moved rather than rewritten — I
deliberately did not "improve" it, for the reason in point 1.
