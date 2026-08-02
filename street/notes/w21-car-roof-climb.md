# w21 — item 29: you can climb onto a car roof now (the pickup's)

**Root cause, one line:** a roof at 1.50 m was not out of reach because the
jump is too small — it was out of reach because the truck's own staircase was
collapsed into ONE collision box pretending to be a wall, and the bed rail at
0.97 m sits exactly between the bed floor and the roof.

## HOW HIGH IS A JUMP, REALLY — `fp.ts:446`'s comment is wrong

The desk flagged this mid-item and was right to. I measured it rather than
inherit any number, including the desk's:
**`scripts/probes/w21-apex.mjs`** samples `camY` per animation frame *inside
the page* (a Playwright round trip is most of a frame here) with the sampler
armed **before** the key goes down, repeated eight times at each of four CDP
CPU-throttle rates.

```
fp.ts:446's comment claims 0.571 m — that is the CONTINUOUS apex.
   dt 0.05 (the clamp: WORST possible)  0.471 m
   dt 1/60 (a 60 fps player)            0.538 m
   dt 1/144                             0.558 m
cpu x1:  apex min 0.475  median 0.475  max 0.475   (worst frame  86 ms)
cpu x8:  apex min -0.150 median 0.475  max 0.475   (worst frame 273 ms)
```

Three findings, and the second one is the one that matters:

1. **0.571 m is never reached.** `fp.ts:455-456` steps semi-implicit Euler —
   `vy` is decremented *before* the position update — which costs `v0·dt/2` of
   height every frame. The real apex is 0.471–0.558 m depending on frame time.
2. **The worst case is BOUNDED, and that is the useful part.** `main.ts:107`
   is `const dt = Math.min(clock.getDelta(), 0.05)`. Past 20 fps every frame
   is the same 0.05 s, so the apex stops degrading — which is exactly why my
   measurement is a rock-steady 0.475 m at CPU x1 *and* x8 with 273 ms real
   frames. **0.471 m is a floor no player can fall below**, so a margin
   computed against it is a guarantee, not an average. (The one negative
   sample at x8 is a jump that never fired — a 273 ms frame swallowed the
   120 ms space bar, BUILDER-BRIEF §5's failure in miniature — not a low jump.)
3. **Reach per hop is `apex + TOP_EPS` = 0.551 m worst case, not 0.651.**

I had written 0.651 into three comments and two probes before the desk's
message. All five are corrected, and `PICKUP_BED`'s own docstring now carries
the correction where the next person will actually read it.

### So the route, judged against the worst frame the engine can take

| surface | height | rise | worst-case margin |
|---|---|---|---|
| pavement | 0.14 | — | — |
| bed floor `PICKUP_BED.floorY` | 0.50 | 0.36 | **+0.191** |
| bed rail `PICKUP_BED.railY` | 0.97 | 0.47 | **+0.081** |
| **cab roof `PICKUP_CAB.roofY`** | **1.50** | **0.53** | **+0.021** ← tight |
| hood `HOOD_TOP` (the way down) | 0.94 | — | — |

Every hop clears at the clamp. **The roof hop clears by 21 mm**, and by ~88 mm
for a 60 fps player. It is the tightest thing I am landing and I would rather
say so than let it be discovered: there is no intermediate surface between the
rail and the roof to spend slack on — the truck has nothing there — so the
only ways to widen it are a jump change in `fp.ts` (not this item's file) or
leaving it. `scripts/w21-roof-climb.mjs` is what catches it if anyone retunes
`vy`, gravity or `TOP_EPS`. Empirically it has not missed once across a dozen
runs on dev and on the built bundle.

### The desk's direct question: is the pickup bed marginal?

**No, but item 1's stated reason for it is wrong.** `notes/w13-collider-volume.md`
and `PICKUP_BED`'s docstring both say 0.50 m is "the one flat surface under
the jump's own apex (~0.57 m)". **0.50 m is ABOVE the true worst-case apex of
0.471 m.** The hop only lands because `standTop` credits a surface from
`TOP_EPS` (0.08 m) below it. The margins are **+0.051 m off flat road** and
**+0.191 m off the kerb** — real, but the whole of the road figure is
`TOP_EPS`, not apex. The conclusion survived; the reasoning did not, and the
next person to pick a height off that sentence would have picked it 0.10 m too
high. Corrected in place, attributed.

Nothing about movement needed to change, and nothing did: **`fp.ts` is
untouched.**

## What changed

**`ct/cars.ts` — a pure hoist first, proven pure.** The cab loft's eight
numbers, the bed rail's top and thickness and the hood slab's top face were
locals inside `makeCar`, so any collider built to sit on them would have been
a second hand-typed copy (BUILDER-BRIEF §8). They are `PICKUP_CAB`,
`PICKUP_BED.railY/wallT`, `HOOD_TOP` and `PICKUP_COWL_Z` now, and the mesh
*reads* them — exactly the arrangement `PICKUP_BED` already had. Committed
separately (3df2e65a9) with `scenedump` before/after: **textures fd7b690d and
structure 44734d40 identical both ways.**

**`crosstown.ts` — the truck's one cab box becomes four tiers.**

- **hood**, `maxY = HOOD_TOP` (0.94), nose back to `PICKUP_COWL_Z`
- **cab**, `maxY = PICKUP_CAB.roofY` (1.50), `PICKUP_COWL_Z` back to the bed
- **bed floor**, `maxY = PICKUP_BED.floorY` (0.50) — item 1's, unchanged
- **two bed rails**, `maxY = PICKUP_BED.railY` (0.97)

`PICKUP_COWL_Z` is *derived*, not eyeballed: it is where the windscreen loft
rises past the hood's own top. A hood tier that ran any further back would
put a standable shelf at 0.94 m inside the cab, under the glass.

**The union of the footprints is exactly the footprint the truck had before**,
so the lane you walk past a parked truck in is untouched at ground level. The
box half-width is read back off `truck.cb` rather than retyped as 1.05.

**Two deliberate omissions, both because the alternative is a collider nobody
can meet — the thing the item forbids:**

- **No tailgate collider.** The bed is entered over it. Walling it would put
  the bed floor behind a 0.97 m step reachable only from 0.32 m up, and the
  one thing that already worked would stop working.
- **No headboard collider.** It lies wholly inside the cab box's own `RADIUS`
  padding, so no player can ever stand on it.

## Verified — walked, not screenshotted

`scripts/w21-roof-climb.mjs` is the acceptance test. It starts **on the
pavement** (found by stepping outward until `groundAt` stops reading the
road), crosses to the tail, and climbs bed → rail → **roof** → hood → street,
asserting feet at each surface's own `maxY` *inside that surface's own
footprint*. Then it walks into the flank at ground level and confirms the
truck is still a wall on foot. Every box is found by `tag`, never by
coordinate — the truck is placed by a seeded draw and moved again by
`settleParking()`.

- **PASS on dev:4188 and on the BUILT bundle at preview:4180**, first attempt
  on both.
- **Mutation-tested twice.** Flatten the rails to the bed's height → `MISS
  2. bed rail`, three attempts, exit 1. Raise the roof 0.35 m → reaches the
  rail and then `MISS 3. CAB ROOF ... (want 1.85)`, exit 1. The check can
  fail, and it fails on exactly the thing it is for.
- `scripts/probes/w21-roof-exit.mjs` — **BUILDER-BRIEF §11 aimed at a surface
  instead of a panel.** A roof you cannot leave is the same bug as a panel you
  cannot close. Off in all four directions: 1.50 → 0.00 forward, back and
  left; 1.50 → 0.14 right, onto the pavement. Nobody gets stranded — **three
  consecutive clean runs, two on dev and one on the built bundle.**
- `scripts/w13-bed-check.mjs` — **PASS**, feet 0.500 on the bed and 0.000
  after walking off. Item 1's behaviour is intact.
- `scripts/jump-walk.mjs` — every spot still lands on the floor it left, every
  apex still in its 0.45–0.8 band, on dev. (On the BUILT bundle it fails at
  its first spot — see "found and not fixed".)
- `scripts/bugsweep.mjs` — **0 STATION MISS**, no new console errors, 93 shots,
  on dev **and** on the built bundle.
- `node scripts/health.mjs` — WORLD OK. `npx tsc --noEmit` and `npm run build`
  clean throughout.
- `npm run fp` mainline vs final: **textures IDENTICAL, structure IDENTICAL**;
  tints = the documented casino chase-light noise, places = 4 pigeons under
  5 cm. The world did not move.
- **No new traps.** `scripts/probes/w21-trap-count.mjs` reads back which boxes
  the `V` overlay paints red, using `ct/gap.ts`'s own `trapAgainst` through
  the overlay rather than a second copy of the rule: **175 flagged before, 175
  after**, and the truck's own box is flagged in *both* — pre-existing, not
  mine. The only other differences between the two runs are six boxes that
  also differ between two runs of *identical* code.

## My verdict on the after-images

`shots/w21-on-the-roof.png` — standing on the cab roof looking forward, you
see the roof plate under you, the windscreen, then the bonnet, then the road.
It reads as standing on a truck. `shots/w21-truck-{flank,tail}-boxes.png` with
the `V` overlay show the four tiers stepping up the vehicle in the right
places: the hood box topping out at the bonnet, the cab box at the roof line,
the rails sitting on the bed walls.

**The honest wart, which I chose and can defend but do not love:** every tier
is as wide as the box it replaced (±1.05 from the truck's centre), so you can
stand up to 0.31 m past the roof plate's own edge, and the cab box floats up
to 0.47 m above the sloped windscreen at its foot. Both are the price of an
axis-aligned box on a welded loft. I did **not** narrow them, and the reason
is specific: a narrower box would notch the truck's *ground* footprint, and
`nudgeClear`'s trap-band rule was already run against the wide one — making a
gap wider is exactly how a safe 0.3 m gap becomes a 0.45 m trap. A tighter
roof wants the oriented-collider type already queued in
`notes/w13-collider-volume.md`, not a narrower AABB.

I also tried the two alternatives and they are worse, so nobody need repeat
them: overlapping a narrow standable top with a wider wall tier puts the
player inside the narrow box's `RADIUS` skirt the moment they step off it, and
`unstick()` then shoves them off the truck; and full-height wall strips along
the flanks make the bed rail unstandable, because the rail sits directly under
them.

## Found and NOT fixed

1. **The other three kinds still cannot be climbed, and I did not fake it.**
   `scripts/probes/w21-fleet-tops.mjs` measures every flat top off the real
   mesh. A sedan, hatch and van have **no wide panel at all** between the
   0.14 m pavement and 0.84 m, and 0.84 is the beltline — under the bonnet and
   the glass, where nobody can stand. Giving them standable roofs today would
   be precisely the "collider nobody meets" this item forbids. **The fix has a
   number**: their only candidate first step is the **tyre, measured top
   0.66 m**, which clears the pavement by **28 mm**. From there
   `0.66 → 0.94 (bonnet) → 1.46 (roof)` is legal for a sedan and 1.44 for a
   hatch, but the last hop is another **31 mm** margin. So the sedan route
   exists and is *tighter at two of its three steps than anything I landed* —
   the desk should decide whether that is a route worth shipping or an
   argument for revisiting the jump. The tyre is also only 0.24 m across and
   round, so it would want the same "run the box out to the collider's own
   skin" trick the rails use (giving ~0.35 m). **The van cannot be done this
   way at all**: its roof at 1.78 m is 0.84 m above its bonnet.
2. **`ct/cars.ts`'s comments say the tyre's top is 0.68 in two places**
   (around lines 235 and 279); measured off the mesh it is **0.66**. Two
   centimetres, but it is a hand-typed number in a file that has been bitten by
   hand-typed numbers before, and it is the number the follow-up above depends
   on.
3. **`scripts/jump-walk.mjs` failed its first spot on the BUILT bundle** —
   "the pavement: apex 5.260 m". Not mine and not the world: you spawn three
   storeys up in room 301 and `ct/apartment.ts`'s storey picker walks down over
   several frames, so the first `camY` sample is the apartment's eye height
   (5.40). **I verified this on mainline** by checking out 842ba64bf,
   rebuilding, and running it — identical failure, identical 5.260. The desk
   reports another builder has since fixed it; `w21-roof-climb.mjs` solves the
   same thing its own way, by waiting for `camY` to hold still before its
   first reading.
   **Also note jump-walk's own apex readings (0.475–0.615) are camera
   measurements including head bob**, which is why its band is 0.45–0.8 and
   why it is not the instrument to size a collider from. `w21-apex.mjs` is.
   And per the desk, jump-walk's hardcoded default port is 4185 — every run
   in this note passed `SHOT_URL` explicitly.
4. **The bed collider is 0.15 m longer than the truck's body at the tail**
   (`carHalf.pickup` is 2.6, the mesh's own half-length is 2.45), so at bed
   height there is a sliver behind the tailgate you can stand on. Pre-existing,
   from item 1, and untouched here.
5. **One STUCK I saw once and could not reproduce, reported rather than
   buried.** During a spell when the machine was loaded enough that four
   climbs in a row failed, `w21-roof-exit` once reported `STUCK left
   1.50 -> 1.50 at -3.02,-30.52` — the player stopped 0.14 m short of the roof
   edge. Every collider in the world *except* this truck's four is still a
   wall at every height, and `ct/traffic.ts` drives vehicle boxes down exactly
   that lane, so my best hypothesis is a passing vehicle blocking at roof
   height for the length of the 1800 ms window. **I did not prove it**: I added
   the diagnostic (the probe now dumps nearby colliders and `__ct.traffic()`
   on a STUCK) and then could not reproduce it in three further runs, two on
   dev and one built, all four directions clean. If it recurs the probe will
   now say what stopped you instead of leaving the next person to guess.
   The related cause I *did* fix is instrument-side: both scripts released the
   space bar before the hop finished, and a frame longer than the press
   swallows it whole (BUILDER-BRIEF §5) — `w21-apex.mjs` caught one doing that
   under throttling. Space is held through the hop now, which `jumpHeld`
   (fp.ts:453) makes free.
6. **Rotation is still ignored**, as it is for every other car collider in
   `crosstown.ts` — a fixed-width box at any yaw. `dir` only answers "which
   world end is the bed". That is item 1's explicitly-deferred half and it is
   still deferred.

## Derived or copied?

**Derived, all of it.** `PICKUP_CAB`, `PICKUP_BED.railY/wallT`, `HOOD_TOP` and
`PICKUP_COWL_Z` are genuine hoists — `makeCar` reads them rather than
restating them, proven by an identical `scenedump`. The collider half-width is
read back off `truck.cb`.

The one thing I *cited* rather than imported is the jump physics inside the
probes (`vy = 4.0`, `g = 14`, `TOP_EPS = 0.08` at fp.ts:52/452/455, and the
`dt` clamp at main.ts:107). They are not exported, and `fp.ts` is read-only
for this item. **This is exactly the kind of citation that goes stale** — it
already did, in `fp.ts`'s own comment — so the probes do not trust the
citation alone: `w21-apex.mjs` prints the derived figure *and* measures the
world, side by side, and the two agreeing (0.471 predicted, 0.475 measured) is
what makes either believable. If a follow-up wants these hoisted into a
`JUMP = { v0, g, topEps }` export from `fp.ts`, that would remove the last
copy — I did not do it because `fp.ts` is not mine here.

## Ports

4187 was already listening, so I used **4188 for dev and 4180 for the built
preview** (4181–4199 were all taken except 4180 and 4182).
