# w85 — item 230: the containment sweep now raycasts a grid, and it found one real hole

Everything below is measured on the **built bundle** at port **4410**
(`ss -ltn` clear before binding; `--strictPort`).

## What shipped

| file | what |
|---|---|
| `scripts/world-contained.mjs` | **new standing check** — the whole world, seeded from nothing |
| `scripts/checks.mjs` | registers it, SLOW tier, no `canfail` case (it carries `--selftest`) |
| `src/proto/ct/interior.ts` | **the fix** — the party-wall doorway had no floor |
| `src/proto/crosstown.ts` | `__ct.bounds()`; and the measured reason the north bound stays as it is |
| `scripts/probes/w85-item230-*.mjs` | six one-shot probes, named for their questions |

## The row's five DONE WHENs

1. **raycasts a grid rather than reading heights** — yes. Exact downward
   triangle raycast, triangle-major so the cost is O(scene) not O(scene × cells).
   `groundAt` is still called, but *only* to centre the walkable band; it never
   decides floor-versus-void. **Vertical faces fall out for free** — a wall's
   triangles project to zero area on the XZ plane — so nothing had to be told
   what a wall looks like.
2. **ground owned by no site is covered** — yes, and counted rather than
   claimed: **15575 of 20386 reachable cells (76.4%)** are outside every site
   rectangle.
3. **is (−30, 12) reachable on foot** — **NO.** See below.
4. **the bound is regional or justified as-is** — **justified as-is**, with the
   measurement written into `crosstown.ts` so it is not queued a third time.
5. **all sites still report 0 escapes** — re-run, see the last section.

## The instrument: no seeds, because the world is not one region

The first fill seeded at the spawn and covered **99 cells**. That is not a bug,
it is the world: the player spawns in flat 301 and every way out is an `[E]`
door. **Any single-seed fill measures one room and reports the rest of the world
contained by never looking at it.**

A list of seeds (one per site, one per room) is the exact habit that let the
jail's forecourt go unswept through two dedicated checks. So there are none:
every open cell is assigned to a connected component, and an escape is a cell
with nothing under it **in a component that holds real standing room**.

- 38 open components, 24 with ≥ 5 m² of floor
- 20386 reachable cells = **5096.5 m²**
- grid 0.5 m, and the number is load-bearing: `fp.ts` pads colliders by
  RADIUS 0.36 each side, so the thinnest real obstacle is 0.72 m and a
  4-connected step of ≤ 0.72 m cannot cross one without landing in it.
- **resolution-stable**: reachable area is 3389 m² at 0.5 m and 3362 m² at
  0.25 m — **0.8% apart** (`w85-item230-fill-resolution.mjs`). 4- vs
  8-connectivity differs by 16 cells out of 13555.

## THE REAL DEFECT: the party-wall doorway was a slot of open sky

The sweep's only finding, and it is at the exact spot the user asked for
(*"i should be able to walk from one into the other"*).

Each room's floor is `PlaneGeometry(W, D)` stopping at the room's own inner
face; the party wall stands on the `WALL_T` beyond that, which **neither room
floors**. Along the wall that strip is buried in masonry. In the item-196
opening the wall is cut away, and the strip is a **0.36 m (2 × WALL_T) hole you
can see the sky through** — measured at x 879.85…880.15 on a 0.05 m line, with
the only ray hits being the header at y 2.6–3.6.

Photographed before and after: `shots/w85-party-880-down.png` has a grey-blue
band of sky between two carpets; `shots/w85-party-880-down-after.png` has
carpet.

**Fix**: each room lays the half-threshold under its own flank, so the halves
meet on the slab boundary exactly as the wall bases do and neither room needs
the other's width. Density derived from the floor it continues
(`linoT.repeat.x / W * T`), never typed — BUILDER-BRIEF §7b.

Verified: hotel/casino component **1864 floored + 3 void → 1867 + 0**, reachable
cells unchanged at 20386; 351/351 points across the full 2.6 m opening floored;
**walked in both directions**; exactly two 0.18 × 2.6 m sill planes at x 879.91
and 880.09.

### Why nothing had caught it

`w75-site-contained` decides floor-versus-void from each mesh's **axis-aligned
bounding box**. Over the street region the two predicates disagree on **11660 of
50000 cells** — every one a box covering ground that is not drawn
(`w85-item230-aabb-vs-raycast.mjs`). A bounding box can only ever over-cover.

## (−30, 12): NOT reachable, and (20, 16) is not either

- **Structurally**: (−30, 12) lies in an open component of 5790 cells with
  **zero floor cells**, not connected to any component that has any.
- **On foot, by the route eightyone named as untested**: from deep in the park
  (reached by walking), heading north — **stopped at z −69.5, closest approach
  81.5 m**, 0 teleports. The park's north wall seals it.
- eightyone's own street-side attempt stopped at x −6.3. Neither route exists.

## The north bound: justified, not decoupled — DO NOT MAKE IT REGIONAL

The clamp sits at z 19 while the street's own end is 13. **It buys nothing.**
Held `w` northward from twelve starts swept across x 8…30 plus the road at
x −6…6: the furthest north anything reached is **z 13.83** — the end wall at
14.20 less the 0.36 radius, **5.17 m short of the clamp**. A regional bound
would be a change to `fp.ts`, the movement core, that moves the reachable set by
exactly zero cells.

**And `w75-site-contained`'s header is wrong about this.** It says *"there is
real pavement out to z 16.75 — I walked out there and photographed it
(`shots/w75-escape-z17.png`)"*. **That file does not exist in this tree or in
the main one.** The raycast says the drawn floor ends at z 14.0, and my own
photograph agrees: at (20, 16) the ground ends in a hard edge and the rest of
the frame is sky (`shots/w85-north-z16-down.png`), against (20, 12) where he
stands on asphalt among parked cars. Their z 16.75 is the bounding-box
over-reach above, not pavement.

## Four times my own instruments lied, and how each was caught

Recorded because the row asked for a population floor on every assertion and
these are what that bought.

1. **The fill "passed" from 78 m away.** `warp(20, 8)` put the player *inside a
   parked car*; `fp.ts` tolerates that for PATIENCE seconds and then restores
   `lastGood`, which was the park. The walker measured its closest approach from
   a start it never occupied and reported the answer I expected. Fixed by asking
   `blocked()` directly — *waiting to see if he stays is not enough*, which was
   the second wrong version.
2. **"No route across the park"** for a crossing already walked twice: the
   router snapped its destination to the nearest **free** cell, which sat inside
   a planter ring — free, connected to nothing. Fixed by picking the nearest
   **reached** cell, after the fill.
3. **The mutation selftest removed 0 meshes** — it dropped by `name` in a scene
   where nothing is named, and reported "the road still reads floored" about an
   empty set. Now geometric, and the drop count is itself asserted.
4. **The road sentinel could not go void.** (0, 0) reads floored off the
   centre-line plane *and five pooled car boxes parked at the world origin*, with
   every ground plane deleted. Sentinel moved to (3.2, −30.3).

Also: my negative control "the fix did not floor the wall line outside the
opening" failed 59/65 and **the fix was innocent** — a wall is a `BoxGeometry`
and its underside at y = 0 is a horizontal face a downward ray hits. True before
and after. Replaced with an assertion on what was actually added.

## Found and NOT fixed — for the desk to queue

1. **Five car-body boxes (1.8 × 4.5 m, y 0.34…0.84) sit at the world origin**,
   bbox centred on x 0, z 0. Almost certainly pooled traffic meshes. They are
   invisible to a player but they make (0, 0) read "floored" to any
   scene-reading check, and (0, 0) is the point every probe in this repo reaches
   for first. Worth a row.
2. **`w75-site-contained`'s AABB floor predicate over-claims by 11660 cells**
   over the street region alone, and its header cites a screenshot that does not
   exist. I did **not** touch it — the row says "all sites still report 0
   escapes", and swapping its predicate is a change that could turn it red for
   reasons unrelated to item 230. It should be re-pointed at the raycast.
3. **`scripts/world-contained.mjs` ignores `visible`** deliberately (GOTCHAS 79),
   which is right for authoring facts and is exactly why (1) can mask a hole at
   the origin. A pooled-object convention would fix both.
