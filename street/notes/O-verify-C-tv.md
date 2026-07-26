# VERIFY C's "tv off unless i sit down to watch it" — IT HOLDS

**Verified by O, who did not build it.** Build `0bce3cc52+`, walked by hand
rather than scored by a script, and the reason for that is the finding below.

## The verdict: C's row is correct

C's predicate is `scene.userData.tv.on` and C's claim is that it is DERIVED
from being seated, with no other path to it. Stepped through the whole cycle
at C's own station — room 301, the bed — reading the predicate and the two
spots at every step:

```
at the seat        tv=false   sit-spot ok=true  (d 0)     stand ok=false
after E (sit)      tv=TRUE    sit-spot ok=false (d 0.82)  stand ok=true
after E (stand)    tv=false   sit-spot ok=true            stand ok=false
walked away 4.2 m  tv=false   neither spot in reach
back at the seat   tv=false   sit-spot ok=true
after E (sit)      tv=TRUE    stand ok=true
```

**It comes on when you sit, goes off when you get up, stays off while you walk
around, and comes back on when you sit again.** It does not latch and it does
not stick. That is the ask — *"tv off unless i sit down to watch it pls"* — and
it is met.

Worth adding to C's own evidence: **the set does not merely go off when you
stand, it goes off at the moment the seat releases you**, and the sit spot
re-arms in the same frame. C's row claims the respawn case; this is the
ordinary case measured at the same resolution.

## What I could NOT settle, said rather than glossed

**"It no longer lights the room when off."** C's row explains that the set was
registered through `ct/props.ts`'s `addLamp`, that the registry is build-time
only, and that the lamp is removed. **I cannot check that from outside** — the
lamp registry is private to `ct/props.ts` and is not on the scene's userData.
So that half of the row rests on C's own account, not on mine. It is not a
doubt; it is a gap in what an outside test can reach, and `ct/props.ts`
exposing a read-only head list would close it for everyone.

## And the part that is my fault, because it nearly cost C a false red

**I wrote a scripted check for this and it produced FIVE REDS on work that is
correct.** I have deleted it rather than committed it. Every red was the
instrument:

| what the script did | what it reported | what was true |
|---|---|---|
| read `__ct.scene.userData` — but `scene` is a FUNCTION here | C's published predicate is absent | it is there |
| warped to the seat's x/z at ground level | "SITTING DOWN turns it on" — RED | 301 is up the walk-up; the seat's `ok()` is false on every other floor, and I was standing three storeys underneath it |
| threw away the result of the sit before testing the get-up | four green "-> off" results | free passes over an empty population (GOTCHAS §34) — the set had never come on, so of course it was off |
| pressed E four frames after warping onto a spot it had just used | "it latches after the first sitting" — RED | the entry point's re-entry hysteresis had not released the spot yet. Nothing to do with the television |

**A check that cries wolf on another builder's row is worse than no check**
(GOTCHAS §27, §48), so it is not in the tree. The hand walk above is the
evidence, and it is reproducible from the table: warp to (198.3, −16.3) at
gy 5.4 and press E.

The pattern is worth one line for whoever verifies next: **six times tonight my
instrument was the fault and not the world.** The tell each time was a red that
appeared on a claim the builder had already measured — when that happens,
suspect the probe before the row.

— O
