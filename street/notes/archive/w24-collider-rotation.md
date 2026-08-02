# w24 — item 36: colliders gain rotation; the bodega chamfer is ONE box

**Root cause (one line):** `fp.ts`'s `AABB` had no orientation, so a 45° wall
could only be faked as a staircase of axis-aligned bands — and the fake is
*felt*: the surface a player collides with stepped **152 mm** in and out along
the bodega's cut face.

> *"whats going on with the collision geometry here? we should fix this so its
> not just a bunch of separate rectangles and its just made properly."*

Ports used: **4215** (dev) and **4221** (built preview). 4180–4199 were all
occupied, as the brief warned; 4210/4211 were taken mid-session too.

---

## The measurement, before and after

`scripts/probes/w24-chamfer-walk.mjs`, run on dev **and** on the built bundle:

| | staircase (8 bands) | one turned box |
|---|---|---|
| boxes at the corner | 9 | **3** |
| collision surface along the cut | steps **152.1 mm** (0.354 … 0.506) | **FLAT to 0.0 mm** at 0.3590 |
| walked stop distance, 16 stations | 0.343 … 0.425, sawing | 0.425 at every station |
| red on the chamfer (static world) | 3 | **0** |
| cut the corner SE past the bay | catches | clears, 8.2–8.6 m along a 2.83 m face |

The 0.3590 is the player's own `RADIUS` (0.36) less the bisection's last step —
i.e. the surface is exactly the wall, everywhere along it.

## What changed, in the three committed stages the item asked for

1. **`fp.ts`: `AABB` gains an optional `rot`** (`mesh.rotation.y` convention).
   `blocked()`, `standTop()` and `escapeFrom()` go through `inFrame()` /
   `outOfFrame()`, which are the **identity** when `rot` is absent — so this
   commit is dead code. Proven: `fp` before/after gave *identical* textures,
   structure and tints, and the face profile and red count were unchanged,
   which is the part the fingerprint cannot see.
2. **`ct/bodega-corner.ts`: the corner is three boxes** — the canted wall as one
   turned box, the brick pier that closes it, and the block north of it.
3. **`ct/gap.ts` and `ct/debug-collision.ts` learn to read a turned box.**

### Two numbers that are derived, not chosen

- **The wall's yaw is `BAY.yawAlong`**, the bay's own published angle, not a
  second hand-derivation. `rot` deliberately uses the same convention so this
  is a read rather than a conversion — `BAY.yawAlong`'s own comment exists
  because hand-deriving this corner's orientation came out 90° wrong once.
- **Its depth is `CFW / 2`**, the cut triangle's height from its own
  hypotenuse, which makes a `CFW × CFW/2` rectangle the smallest one that
  contains the whole triangle. Its four corners are `(BX0, BZ1+CHF)`,
  `(BX0+CHF, BZ1)`, `(BX0+CHF/2, BZ1+1.5·CHF)`, `(BX0+1.5·CHF, BZ1+CHF/2)` —
  **every one inside the shell**, so none of the spill reaches walkable ground.

**The wall has to CONTAIN the triangle, not skin it.** A thin 0.4 m wall makes
the corridor tests happier (its footprint stays clear of the wing shopfront),
and I rejected it: sprint is 42 m/s in this build, which is 1.7 m per frame,
and `blocked()` only tests the destination — a thin wall is tunnellable, and
what is behind it is a sealed void with no way out. That is the
*"im literally stuck here"* failure, bought to make a warning quieter.

### Why the pier runs to `BZ1 + 1.5·CHF`

`gap.ts` clears a candidate corridor only when a filler spans it **across**,
one box at a time. With the pier stopping on the cut band, the 0.4 m of solid
brick between the turned box's north-east corner and the wing shopfront was
filled by the pier and the north block *between* them, neither spanning it
alone — so the overlay painted the chamfer red for a slot made of masonry.
Running the pier the full depth of the wall it closes against makes it one
spanning filler. Every metre it gains is inside the north block already, so it
cannot take walkable ground.

## The red set moved by exactly four, and all four are accounted for

Static-collider red **164 → 160** (`scripts/probes/w24-red-dump.mjs`), none
added:

- two were **chamfer bands that no longer exist**;
- two were the **produce crates**, false-red because a 0.63 m "corridor" was
  measured through the staircase to a band four steps away, and the interval
  union could not clear it while the crates stand 0.13 m off the wall. Against
  one pier that standoff reads 0.13 m — correctly unenterable. This is the last
  of the same family `notes/archive/w13-collider-volume.md` fixed.

**The world-wide red count is not a number.** `crosstown.ts` spreads the moving
`vehicleBoxes` into `colliders` and citizens carry boxes too, so two runs of one
build gave 171 and 166. Every comparison here is on the static set.

## Verified, my own

- **Walked, not screenshotted.** The boundary trace bisects on `unstick()`
  moving the player, which *is* `fp.ts`'s own collision predicate; the walked
  profile then confirms it at 16 stations.
- **The bodega still opens** — `scripts/probes/w24-bodega-door.mjs`: nothing on
  the `[E]` spot (0.0000 m shove), walk onto it from the pavement, prompt up,
  held `E` puts you inside. Dev and built bundle.
- `interiors-walk.mjs bodega` **26/26**, `diner` **26/26** (a non-chamfer room,
  as a general check on `fp.ts`).
- `jump-walk.mjs` — every spot lands on the floor it left, apexes in band.
- `w13-bed-check.mjs` — the one standable collider still holds you at 0.500.
- `bugsweep.mjs` — **0 STATION MISS**, no new console errors, 93 shots.
- `fp` before/after — textures and structure **IDENTICAL**, 8315 objects both
  sides, places 2 pigeons within 5 cm, tints the documented chase-light timing.
- `tsc --noEmit` and `npm run build` clean throughout.
- **Mutation-tested, all three, bytes confirmed changed:** `inFrame` ignoring
  `rot` → surface saw 807 mm, 6 walks inside the wall; the staircase restored →
  3 checks red including the 152 mm surface; `footprint` returning `c` → the
  gap.ts corner check reads x 9.914 against a true 10.000.

## Found and NOT fixed — for the desk

1. **`interiors-walk.mjs bodega` is flaky, and it was flaky before me.** The
   way-out-door and landing checks fail together about **1 run in 4**. Measured
   both ways, four runs each: staircase `0, 0, 6, 0` failures; turned box
   `0, 0, 0, 6`. Same rate, same checks. Not caused by this item, and worth its
   own item — a suite that fails a quarter of the time cannot verify anything.
2. **`gap.ts` measures a turned box by its bounding box.** Exact and unchanged
   for every unrotated box (same object, so `nudgeClear`'s parked-car decisions
   cannot move — proven, the static red set is byte-identical across that
   change). But a footprint is *larger* than its box, so gaps against a turned
   box measure smaller, and that can push a real trap under `ENTERABLE` and
   hide it. The corridor width would generalise cleanly (separating-axis over
   both boxes' axes reduces to today's arithmetic for axis-aligned pairs);
   `corridorFilled` would not — clearing a turned corridor needs 2-D coverage,
   not an interval union along one axis. **When a second turned collider is
   added, this is the thing to fix first.** Half a generalisation that reports
   *more* false red than today would be worse than none.
3. **A real trap on the main street's east walk, pre-existing.** A 0.5 × 0.5
   prop at `x 5.75…6.25` sits **0.45 m** off the corner block's face at
   `x 6.7` — squarely in the 0.40–0.95 m trap band. Present before this item
   and untouched by it.
4. **`corridorFilled` cannot see a rectangle filled by boxes stacked across the
   *other* axis.** It requires each filler to span one axis alone. That is what
   forced the pier's depth above; it will bite again.
5. **`escapeFrom`'s `minY` is still unimplemented** and `rot` is unread by
   `ct/crowd.ts`'s citizen avoidance — which does not matter today, because
   `ct/street.ts`'s `solid()` pushes to `colliders` only, never `citAvoid`, so
   the chamfer was never a citizen collider. It will matter the first time a
   turned box goes through `ctx.obstacle`.

## Files touched that item 36 does NOT name

- **`ct/debug-collision.ts`** — one line, `b.rotation.y = c.rot ?? 0`. The
  item's own DONE WHEN is about the V overlay, and an overlay that draws the
  chamfer axis-aligned would put a wireframe across walkable pavement and none
  along the wall you collide with.
- **`scripts/interiors-walk.mjs`** — the `[E]`-spot check above. It reported a
  door I had already demonstrated you can walk to and open, and leaving the
  suite the desk verifies with permanently red seemed worse than the boundary
  crossing. Both are reported here rather than folded in quietly.

The item names **`ct/bodega.ts`**, which does not exist; the corner lives in
**`ct/bodega-corner.ts`**.
