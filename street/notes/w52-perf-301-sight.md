# w52 — item 128: the performance drop in flat 301

**The user:** *"i get awful performance drops in my room not sure why."*

**Root cause, one line: the `[E]` line-of-sight test cast a ray against the
*entire world* once per candidate spot *per frame*, and flat 301 is a room where
a candidate spot is always in range — so his room paid the whole bill and the
street paid nothing.**

Ports: **4187** (dev) and **4188** (preview of the built bundle), both proved
`000` free before use and both shut down at the end. 4186 was already serving
another builder's world.

---

## What was measured, and why it is a count and not a timing

w50 handed this back with the right lead — raycasting is about a fifth of all JS
time while merely standing in 301 (`notes/w50-perf-301.md`) — and the correct
warning that **no frame-time from headless software GL transfers to the user's
machine**. So I did not chase a millisecond figure. I counted the work instead,
by wrapping `Mesh.prototype.raycast` (reached from a real mesh in the published
scene, so nothing is imported and no constant is retyped):

`scripts/probes/w52-raycast-count.mjs`, standing perfectly still:

| station | before | after |
|---|---|---|
| **flat 301** (spawn) | **7,832 mesh raycast tests per frame** | 3,970 |
| **301 landing**, outside his door | **15,664 per frame** | 5,221 |
| the street | **0** | 0 |

The scene holds 7,832 meshes. So the world was casting **one full sweep of every
mesh in the city, per frame, per candidate spot** — two sweeps a frame on the
landing, where the door and the flat are both in range. On the street no spot is
in range, so `canSee` is never called and the cost is exactly zero. **That is the
user's report reproduced: it is expensive where he lives and free everywhere
else.**

### The cause

`crosstown.ts`, the `[E]` resolver: `canSee` ends in
`seeRay.intersectObject(scene, true)`, which walks the whole scene graph. The ray
is at most ~6 m long inside a room about 4 m across; the world is over a
kilometre wide. Essentially all of that work was spent proving that the far end
of the street is not between him and his bed.

## The fix, and why this one

**`canSee` reads only the eye position and the spot. It does not depend on yaw or
pitch at all** — so turning on the spot, which is the single most common thing a
player does, cannot change any answer it gives. Standing still, nothing can
except an occluder that moves.

So the answers are **memoised against the position they were taken at**, and
re-taken when he moves `SEE_MOVE` (0.15 m — a quarter of the existing 0.6 m
`REACH_MARGIN`, so a spot cannot change tier on a stale sight line), changes
storey, or the entry goes `SEE_TTL` (0.10 s) stale.

**The important property is that the cost is now bounded per SECOND (~10 sweeps)
instead of per frame.** Per-frame figures understate this badly: headless runs at
12–24 fps, where the saving is only ~2x, but the work removed scales with the
frame rate. On a machine rendering at 60 fps the old code cast **60 full sweeps a
second** and the new code casts at most **10** — about **6x** — and the faster his
machine renders, the more it saves. The probe now reports sweeps/second for
exactly this reason; per-frame is the misleading form.

`__ct.warp` clears the cache. A teleport of any size breaks the cache's one
assumption — that he cannot have moved further than `SEE_MOVE` since the last
answer — and **every instrument in `scripts/` drives the world through that
door**, so without it a check silently measures the station before the one it
thinks it is at. This is not theoretical: without the clear,
`A-verify-select-through` moved by one station.

## The second symptom — *"my mouse doesnt work right in my room??"*

The item was updated while I held it to add a second report: *"its weird it feels
like my mouse doesnt work right in my room??"*, and his own correction *"its not
on the atm the atm works great. its in the room. my room."*

**The desk's working hypothesis is right, and the source says why.** Mouse deltas
accumulate into `input.mouseDX` as events arrive (`main.ts:47-50`), are applied
**once per rendered frame** (`fp.ts:458-461`), and are zeroed after the frame
(`main.ts:113`). So a long frame does **not lose** any rotation — the total is
preserved — it delivers it **in one jump instead of several small ones**. Coarse,
stepped camera motion is exactly what "the mouse doesn't work right" feels like,
and it can only happen where frames are long.

**So the two reports are one bug, and it is the one named above:** the only thing
that made frames long *in that room specifically* was a full-world raycast per
spot per frame, and 301 is the densest room in the world for `[E]` spots — the
bed seat, sleep, the door, and on the landing the flat door too
(`scripts/probes/w52-301-spots.mjs`). The landing measured **two** full sweeps a
frame for exactly that reason. Nothing in `ct/apartment.ts` touches yaw, pitch or
the mouse, which the desk had already checked and which I did not re-investigate.

This predicts something he can falsify: **the mouse should feel wrong in the same
places the frame rate drops and nowhere else** — bad in 301 and on his landing,
fine on the street, where this code casts nothing at all.

Item **135** (sum `getCoalescedEvents()` in `main.ts:47-50`) is the other half and
is somebody else's item: it improves sub-frame fidelity. It is complementary, not
a substitute — it cannot help if the frame itself is long.

## What the user can check with F

Stand still in 301 and press **F**. The mean should be unchanged or better; the
number to watch is the **worst frame**, because the old cost landed once per
frame on every frame. **His reading is the authoritative one** — nothing here can
tell him whether the drop he feels is gone, only that the world now does between
6x and 10x less of this particular work at 60 fps. If it still drops, the residue
below is where I would look next, and it is a bigger fish than what I removed.

## Proof that selection did not change

- **`A-verify-select-through`: the leak set is byte-identical to mainline** — 35
  leaks over 44 stations, the same 35 stations, `diff` clean. (See the pre-existing
  failure below; the point here is identity, not the score.)
- **`D-look-selects`: 12 pass, 0 fail** — looking still selects at 3 and 5 m, and
  still drops past the 6 m reach.
- **`check-seethrough`: pass** — no pavement visible through any shopfront.
- **`bugsweep`: 0 STATION MISS, 0 COVERAGE**, 96 shots, no new console errors.
- **`scripts/probes/w52-turn-cache.mjs`** — written for this change, because
  **no existing check could see the risk**: they all turn by warping
  (`D-look-selects.mjs:145`), which clears the cache and exercises only the fresh
  path. It turns 360° at one station in 301 two ways — dragging (cache live
  across the whole sweep) and warping (cache cleared every step) — and requires
  the prompt sequences to match. **24 of 24 headings agree, 4 distinct prompts,
  6.02 rad swept, 0.000 m drift.**

That probe refuses two ways of passing vacuously, **both of which it hit before I
believed it**:

- the spawn stands 0.24 m from the bed spot, inside the player capsule, where
  tier 1 (`onIt`) makes it unbeatable at every yaw and the prompt never changes.
  A run there agrees 24/24 and settles nothing, so the station is **searched for**.
- **Playwright's own mouse cannot drive drag-look**: `page.mouse.move` arrives
  with `movementX === 0`, which `main.ts:49` adds to `input.mouseDX`. The first
  run swept **0.00 rad** and would have "passed" on two columns of `(nothing)`.
  Yaw and drift are now read back and asserted.

### And the honest limit of that probe

It compares two paths **in one build**, so a cache bug that poisons both columns
equally is invisible to it. I mutation-tested it: keying every spot to one shared
cache entry **passes it 24/24**. What catches that bug is the
`A-verify-select-through` leak *set* — 35 on mainline, the same 35 with the
cache, **33 with the mutant**. So the identity claim above is load-bearing
evidence and not a tautology, but the turn probe alone is not.

---

## Found and NOT fixed

1. **The real prize is still there: a 6 m ray still tests all 7,832 meshes.** The
   cache makes it happen ~10 times a second instead of 60; it does not make any
   one cast cheaper. In 301 that is still ~48,000 mesh raycast tests a second to
   answer a question about two spots within 2 m. Almost all of it is provably
   wasted — a ray of length ≤ 6 m in a world 1,300 m across. The supported fix is
   a spatial prune: three.js **stops descending into a subtree when that object's
   `raycast()` returns `false`**, so a group-level bounds check is an official
   early-out rather than a hack. The scene is 2,750 top-level children with 3,939
   meshes concentrated in the 13 largest groups (`scripts/probes/w52-scene-shape.mjs`),
   so pruning at the top level alone should remove roughly half again. **I did not
   do it** because it needs bounds caching for objects that move, and a wrong prune
   offers spots through walls — the failure mode this project has been bitten by
   repeatedly. It wants its own item and its own equivalence check.

2. **`A-verify-select-through` FAILS ON MAINLINE and has nothing to do with this
   item.** 35 of 44 blocked stations leak a spot through a wall, mostly
   `sit in the pew`. I verified this by building the parent commit and running it:
   **35 leaks before my change, 35 after, same set.** It is a real standing
   failure that someone is going to trip over and attribute to their own work, as
   I nearly did.

3. **`seats-walk` sits at 103/219**, which matches the figure w40 recorded, so it
   is unchanged by this. Not investigated.

4. **The scene has 2,750 top-level children**, most of them single meshes. That is
   also why every scene-wide traversal in the world is expensive, not just this
   one. Worth a look if anyone ever profiles the render path.

## Files

- `src/proto/crosstown.ts` — the cache, its invalidation, and the clear in `__ct.warp`
- `scripts/probes/w52-raycast-count.mjs` — the per-frame/per-second raycast counter
- `scripts/probes/w52-turn-cache.mjs` — the turn A/B, with both vacuity guards
- `scripts/probes/w52-scene-shape.mjs` — top-level scene census, for sizing the prune
- `scripts/probes/w52-301-spots.mjs` — which spots are in reach in 301, for siting the turn test
