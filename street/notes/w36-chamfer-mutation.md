# w36 — item 67: mutation-testing the chamfer check

**Root cause, one line: nothing was wrong — w34's fix was already landed and
correct, and the only thing missing was proof that the check it repaired can
still fail. It can, loudly.**

Ports: **4193** (dev, for the mutation — HMR is what makes a source edit
measurable without a rebuild) and **4190** (preview of `dist/`, left over from
item 74). Both proved free with `curl` before use; both shut down at the end.

## The mutation

`src/proto/ct/bodega-corner.ts:198`, `rot: BAY.yawAlong,` deleted — the single
line that makes the chamfer one *turned* box instead of an axis-aligned one.

**Bytes confirmed changed**, which is the half of a mutation test people skip:

| | before | after |
|---|---|---|
| size | 32,806 B | 32,779 B (−27) |
| md5 | `5f33fd0f363ff1d13baf80cfea1a7759` | `3bbd96eb3707b3169204b06db7bbb64b` |

`git diff --stat` agreed: `1 file changed, 1 deletion(-)`.

## It goes red — and on the right checks

`SHOT_URL=http://localhost:4193/ node scripts/probes/w24-chamfer-walk.mjs`
**exited 1**, `3 CHECK(S) FAILED`:

```
FAIL  expected exactly 1 rotated collider at the corner, found 0
FAIL  the collision surface still steps: 806.3 mm
FAIL  3 walk(s) ended INSIDE the collision surface
```

This is the outcome that matters, not merely a non-zero exit. **Check 2a is the
one that carries the user's complaint** — *"its just a bunch of separate
rectangles"* — and it went from **0.0 mm to 806.3 mm** of stepping. The file's
own comments say 2a is the only check that separates a staircase from a turned
box, and the mutation moved exactly that number. Three walks also ended *inside*
the wall, which is the player-facing consequence.

Worth recording: **§4a still passed under the mutation** (`cleared the corner
3.37 m`), as did 4b. That is not a defect — 4a asks "can you get round the
corner", and you can get round a bad corner too. It is a reminder that 4a is the
weakest check in the file and 2a is the load-bearing one.

## The revert is clean

`git checkout -- src/proto/ct/bodega-corner.ts` → md5 back to
`5f33fd0f363ff1d13baf80cfea1a7759`, 32,806 bytes, line 198 restored, and
`git status --short` prints **nothing**.

## bugsweep

`SHOT_URL=http://localhost:4193/ node scripts/bugsweep.mjs` — **exit 0**, 96
shots, **0 STATION MISS**, 0 COVERAGE, and it reports `build 98cc480d8` = HEAD.

**Why dev and not the built bundle.** My first attempt aimed it at the `dist/`
preview and it correctly refused: *"MEASURING THE WRONG WORLD — 4190 is serving
build 170d12d2e, this checkout is at 98cc480d8"*. That guard is right and I did
not work around it. I also did not rebuild, because `dist/` holds **item 74's
delivered artifact** and a rebuild would have replaced the exact file I reported
an md5 for. The two commits between are `scripts/probes/` only —
`git diff 170d12d2e..HEAD -- src/ index.html` is **empty** — so no world source
moved; only the SHA the guard compares.

## FOUND, NOT FIXED — §3 is still flaky, and it is a different flake from w34's

**On a clean, reverted tree, `w24-chamfer-walk.mjs` §3 went red once:**

```
FAIL  1 red box(es) ON the chamfer: 7.09..9.91 x -95.21..-93.79 rot=0.7853981633974483
```

Every other check in that same run passed, including 2a at 0.0 mm — so **the
wall was built correctly and the check said otherwise.**

**Rate: 1 red in 6 runs** at `CPU_THROTTLE=8` on the clean tree (5 green, 1 red).

I tried to pin it and **could not**, and I am reporting the failed attempt
rather than a tidy guess:

- `scripts/probes/w36-chamfer-red-partner.mjs` (committed) samples exactly the
  way §3 does and additionally prints the box the chamfer is trapped *against* —
  §3 prints the red box but never its partner, which is why its output cannot
  tell "the wall is wrong" from "something parked beside it".
- **Not reproduced in 14 dedicated samples**: 6 unthrottled, 8 at x8.
- **My throttle hypothesis was wrong, and I tested it before believing it.** §3
  separates static colliders from moving ones by taking two samples one
  *wall-clock* second apart and keeping byte-identical footprints. I expected
  throttling to defeat that — too few frames between samples, so a moving car
  holds still and is scored static. Measured: **7 frames render per 1 s window at
  x8**, and the static set stays 513–514 of 520, i.e. the 6–7 moving colliders
  are still being excluded correctly. The mechanism is not that.

The remaining live suspect, unproven: a citizen or vehicle that **pauses** for
over a second is genuinely byte-identical across both samples and is scored
static, and §3's own comments already describe a walker 0.45 m off a facade as a
textbook trap corridor. A 1-second stillness test cannot tell "part of the built
world" from "standing still right now" — **which is the same family of defect
w34 fixed in §4a: a verdict that depends on when you looked.** Fixing it
properly means asking the world what a collider *is* rather than whether it
moved recently.

I did not touch it: the item said do not redo the fix, and this needs a change to
`w24-chamfer-walk.mjs`'s §3 that is its own piece of work. **Suggested item: give
§3 a source of truth for "static" that is not elapsed time, and make it print the
partner box when it fails.**

## Also found, not fixed

- **`scripts/probes/w24-chamfer-walk.mjs` §3 is silently skipped on a built
  bundle** — it needs `/src/proto/ct/gap.ts` from the dev module graph and prints
  `SKIPPED`. That is honest and deliberate, but it means the check that the V
  overlay agrees with the world **never runs against the thing we ship**.
- I ran 6 chamfer walks at x8 before the desk rewrote this item to say *"do not
  repeat the ten runs"*, and stopped the moment I read that. Since the data
  exists: **§4a cleared 3.38 / 3.37 / 3.43 / 3.43 / 3.43 / 3.43 m** against a
  2.83 m face. w33 and w34 measured 3.43 / 3.43 / 3.43 / 3.34. **Fifteen runs
  across three builders, essentially one number** — w34's fix holds.
- **I stopped a backgrounded run mid-flight.** I launched the ten runs with a
  3000 s timeout, the harness capped it at 600 s and backgrounded it, and that is
  precisely the trap that cost two previous builders this item. The desk's
  rewritten row said run nothing in the background; I killed it and re-claimed
  rather than letting it finish. Recording it because the next builder will be
  offered the same convenience.
