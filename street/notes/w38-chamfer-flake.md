# w38 — item 78: the chamfer-walk flake, named and fixed

**Root cause in one line:** `crosstown.ts` spreads citizen and vehicle boxes into
the same `colliders()` array as the masonry, so **a pedestrian crossing the
corner refuses the walk's `-z` step exactly like a wall does** — and §4a then
reports "the chamfer did not let me past".

**Port 4193** (dev server — §3 needs `gap.ts` served as source, which a built
bundle does not do). Proved free first; shut down at the end.

## The item asked about §3. §3 is clean; the flake is in §4a

I could not make **§3** go red in **56 samples** on a clean tree:

- 30 samples of §3's exact predicate via w36's `w36-chamfer-red-partner.mjs`
- 26 full runs of `w24-chamfer-walk.mjs`

Static set 513–514 of 520 colliders every time; chamfer never red. **§3's
guard against transient colliders works.** That satisfies the item's "20+
further samples" clause on its own, and it is recorded in the file.

**But the instrument does still flake, and I caught it: 3 failures in 34 runs,
all in §4a, unthrottled, on a clean tree.** Every one is
`did NOT clear the corner — stopped ~2.5 m along a 2.83 m face`. Given the item
describes "went red once in 6 runs on a clean tree while §2a read 0.0 mm in the
same run", I believe this is the same flake and the section number in the row is
off by one verdict.

## How it was found — the heading is the tell

§4a walks at yaw π/4, which is **exactly parallel to the 45° cut**:
`fwd = (+1,−1)/√2`, so `d(x+z) = 0`. A healthy leg therefore holds `perp` dead
flat at **0.800** the whole way along the face. The failing legs do not:

```
along 2.127  perp 0.800
along 2.331  perp 0.596      <- z frozen, x still advancing
along 2.540  perp 0.387      <- wedged, 30 frames, leg over
```

`perp` can only fall if the **`-z` step is refused while `+x` is allowed** —
`fp.ts` tests the axes separately — which drives `x+z` up into the wall. So the
question was never "is the chamfer built wrong" (§2a measures the surface flat to
**0.0 mm** on those same runs) but *what refused the `-z` step*, given nothing
static sits south of the player there.

`scripts/probes/w38-chamfer-stall-neighbours.mjs` answers it: on a stall, dump
every collider within 1.2 m and re-read them a second later.

```
run 11  STALLED  at x 8.863 z -96.382  along 3.001  perp 0.367
      x  7.086..9.914   z -95.207..-93.793  rot 0.7854  static   (the chamfer)
      x  9.000..18.400  z -96.000..-93.000  rot 0.0000  static   (the pier)
      x  8.018..8.518   z -97.250..-96.750  rot 0.0000  MOVING (an actor)
                                   <-- SOUTH of the player: this refused the -z step
```

A **0.5 × 0.5 m box due south of the player, which moves**: a citizen. You cannot
walk through people — that is the world working correctly. The instrument was
blaming the wall for it.

**The throttle hypothesis is dead and should not be re-run**, confirmed
independently: all 3 failures were at `CPU_THROTTLE=1`. It is not a frame-rate
effect; it is whether a pedestrian happens to be on that stretch of pavement.

## The fix discriminates — it does not loosen

A stall is **still a failure**. It is set aside only when the box beside the
player *demonstrably moves* (footprint gone one second later), and then the leg is
re-walked, up to 3 attempts, printing what blocked it. §4b gets the same
treatment for the same reason.

**Proved both ways, which is the part that matters** (BUILDER-BRIEF §7 — never
fix a failing check by loosening it):

| world | §4a |
|---|---|
| clean tree, 6 runs post-fix | **PASS** ×6 |
| **static** blocker planted at the citizen's exact footprint | **FAIL** — `stopped 2.80 m`, **not retried away** |

The static-wedge mutation is one line in `ct/bodega-corner.ts`
(`solid({ minX: 8.018, maxX: 8.518, minZ: -97.25, maxZ: -96.75 })` — the moving
box's own footprint, made immovable), byte-verified with `git diff --numstat` and
reverted after. **One run exercised both branches at once**: §4a failed on the
static box while §4b legitimately voided against a real passing citizen.

**A bonus from that mutation: it is also §3's genuine failing path.** With the
static box in place §3 printed `1 red box(es) ON the chamfer` — so §3 *can* go
red, on a real static trap corridor, which is worth knowing for a section whose
failing path was previously undemonstrated.

## Found and NOT fixed — for the desk to queue

1. **The row's section number looks wrong.** It says §3; the reproducible flake
   is §4a. §3 survived 56 samples. Worth correcting so the next reader does not
   start at the wrong section.
2. **This is the third instrument in two days blaming the world for an actor in
   the same collider array** (§3 already had to build a static filter for it;
   §4a needed one too). A shared "is this box an actor" helper in `scripts/lib/`
   would stop the fourth. I did not add one — the item names only
   `w24-chamfer-walk.mjs` (BUILDER-BRIEF §9).
3. **§4a's retry masks nothing but costs time**: 3 attempts × ~8 s worst case.
   Acceptable, but if pedestrian density rises the leg could exhaust its retries
   and fail for a reason that is still not the wall. It prints why, so the next
   reader will see it rather than guess.
4. `scripts/probes/w38-chamfer-capture.sh` keeps every run's full output, unlike
   `w36-chamfer-x10.sh` which greps one line and discards the track that explains
   a failure — at ~97 s a run that is the difference between diagnosing a flake
   and waiting for it again.

## Derived or copied?

**Derived.** The bay, the cut and the face frame all come from the scene the way
the original probe takes them; the actor test is the world's own collider array
sampled twice, not a list of known actor sizes. The only constant I introduced is
the 0.75 m neighbour radius, which is the player radius (~0.36 m) plus a margin,
and it is reported in the output rather than hidden.
