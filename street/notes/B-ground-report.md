# Builder B — quality pass on the ground and the props

Worktree `../rpg-ground` · owns `ct/props.ts`, `ct/tex-ground.ts`.
Written for the desk to prioritise. **Fixed** items are already committed;
**found** items are described but deliberately not actioned.

---

## Fixed this pass

### 1. The library doors are clear (`499df04`)

Builder E is recessing the library into a courtyard. `ct/street.ts` stands it
at `zw = -5.0`, `w = 16` (so z −5 … −21) and `ct/civic.ts` centres a 5 m
entrance bay on it, which puts the doors at **z −15.5 … −10.5**. Two of mine
were in it: the payphone at z −11 (collider straddling the north jamb) and
street tree 1 at z −15.5 (dead on the south jamb).

- Tree 1 moved 4 m south onto the library's solid flank — a tree in front of
  stonework is right; in front of the doors it is not. Done with a
  `TREE_SHIFT` table beside the existing `TREE_TRIM`, so the seeded stream is
  untouched and no other tree moved. Kept on the half-metre so its pit still
  lands on the walk sheet's slab grid.
- Payphone moved north to the MERIDIAN frontage (z −3). Same stretch of walk,
  so it stays where the player expects it, and MERIDIAN is exactly the bland
  modern slab that gets a payphone bolted to it.

The reserved span is now a named constant, `LIB_DOOR_Z0/Z1`, with the
derivation written next to it. **If E moves the library, that is the one
number to change.**

> **E should sanity-check both positions.** I own the props, E owns the
> building; I picked these from the geometry, not from seeing the finished
> courtyard.

**Bonus, and it fixes a bug I had previously only reported:** the payphone was
0.9 m deep, and its collider reached x = −5.95. With the rig's 0.36 m radius
that blocked out to −5.59 and closed the *only* through-lane on the west walk,
since the lamps already block from −6.11. Walking the west lane used to stop
dead at z ≈ −10. It is now 0.3 m deep — a wall phone on a backboard, not a
booth — and the lane **runs 24.9 m straight through**. The face you look at is
unchanged: 0.9 m wide, 2.3 m tall.

### 2. Decals were buried under the gutter pan (`42bc42b`)

The user's *"trash … under the gutter somehow"* was right, and the real damage
was worse than the report. Measured against the pan surface:

| | clearance | |
|---|---|---|
| gutter puddles | **−2.1 … −6.0 mm** | all 8 under the concrete, never once visible |
| awning puddles | **−128 mm** | sitting on a sidewalk 13 cm above them |
| gutter litter | **+3.6 mm** | inside z-fighting range at any distance |

One mistake, made three times: everything was laid at a single flat `y`, but
three surfaces meet along the kerb line at three different heights — road at
0, the gutter pan **cross-sloped** 0.018 → 0.006, and the walk at 0.140. I
built that slope in `tex-ground.ts` and then dropped decals through it from
`props.ts`.

`tex-ground.ts` now exports `gutterSurfaceY(d)` and `GUTTER_W`; `props.ts` has
one `surfaceY(x)` that every decal goes through. After: **0 buried, min
clearance 5 mm, 11/14 puddles showing in a storm.**

---

## DIAGNOSIS: "still no puddles during rain" — it is a contrast inversion

Verified on the LIVE world at :5177 (build stamp `4867554`), not in my
worktree. Worked the four causes in the order given. **Nothing changed yet.**

**1. Is it raining when they look?** Partly. `rainAt` is true for **6 of 24
hours (25%)**. From spawn at 13:20 the first rainy hour is h=15 — **100 real
seconds of standing around** — then it rains for 60 s and is dry for ~300 s.
So a player often genuinely is not in rain. *Contributing, not the cause.*

**2. How long until a puddle is visible?** Not the problem. Measured on live:
first puddle visible **2 s** after the rain starts, 11 of 14 by 6 s, all 14 by
14 s. My `wetness` rework already fixed this — the old `dt * 0.22` figure in
the queue predates it.

**3. Where are they?** Every street puddle sits at |x| ≈ 4.6 — inside the
45 cm gutter strip. Nothing is mid-road or anywhere you look while walking.
*Contributing.*

**4. Rendering — THIS IS IT.** The puddles are present, filled, correctly
placed and genuinely being drawn. They are invisible because they have almost
no contrast against the road, and it is worst exactly while it is raining.
Measured by sampling the actual sheets and compositing them:

| | road luminance | puddle body | contrast |
|---|---|---|---|
| dry | 0.2381 | 0.1523 | **22** / 255 levels |
| raining | 0.0397 | 0.0551 | **4** / 255 levels |

Two things go wrong at once, and both are mine:

- **The wet tint crushes the road 6×**, 0.238 → 0.0397, because `updateRain`
  lerps it toward the slate `WET` at 0.95. The puddle is a fixed dark sheet
  and cannot go darker than that.
- So the sign **inverts**: at 0.0551 the puddle is now 4 levels *lighter* than
  the road it sits on. It is a faint pale smear — a very quiet version of the
  glowing puddle that was shipped and rejected once already. The only reason
  you can see anything at all is the sky-sheen texel (14 levels).

The design rule "a puddle is darker than the road" is what breaks: it holds on
dry asphalt and is impossible on a road already darkened to near-black by the
rain that made the puddle. Standing water reads by **reflecting** — sky, lamps,
signs — not by being dark, and reflection is the one thing the current sheet
almost entirely lacks.

### Options, not yet actioned

1. **Ease off the wet tint** (one number, `rainLevel * 0.95`). The road should
   darken when wet, but a 6× crush leaves no room under it for anything. This
   also affects the night pass, which the user liked — so it is not free.
2. **Let the puddle carry a real reflection**: a stronger sky/lamp sheen scaled
   by the ambient, so it reads bright against a dark wet road by day and does
   not glow at 3am. This is the honest physical answer and the one I would pick.
3. **Put some water where the player looks** — a few shallow sheets on the road
   crown and at the crossing, not only in the gutter.
4. **Make rain findable at all**: 25% of hours, first one 100 s from spawn, is
   thin for a feature asked about three times. A weather hook (or a rainier
   opening hour) would let it be demonstrated on demand.

I recommend 2 + 3, with 1 held back unless the desk wants it, because it
trades against the night look that just landed.

## Found, not fixed — for the desk to rank

### A. "Trash looks too clean" — the other half of that note

Placement is now right but the *look* is not addressed. The litter sheets
(`canTopTex`, `paperTex`, `scrapTex`) live in `ct/tex-world.ts`, which is
DESK-owned, so I can change how much there is and how it sits, not what it
looks like. Options, cheapest first:

1. **Density and variety** (mine): 7 gutter pieces + 5 papers over ~90 m is
   sparse. It could take maybe half again as much without breaking the
   "don't go overboard" note, and cluster rather than spread — rubbish
   collects against kerbs, in corners, and at the catch basins, not evenly.
2. **Grime under it** (mine): a litter piece on clean concrete reads as
   dropped one second ago. A dark stain decal under each would age it.
3. **Repaint the sheets** (desk/whoever owns `tex-world.ts`): the paper is
   already "rained on" per its comment, but the cans are still bright.

### B. Lamp spacing leaves the middle of the block dark

With the new night floor the gaps between lamps are genuinely black — which
is what was asked for — but the lamps are every 28 m per side (west −9, −37,
−65; east −23, −51, −79), so mid-gap is ~14 m from any head and the 4 m pool
radius does not come close. It reads well on the main street. Worth a look
from the user before anyone adds lamps.

### C. The bus stop frontage should be red kerb, and is not

My own rule in `tex-ground.ts` says red kerb marks no-parking, and a bus stop
is exactly that. It is a third entry beside `HYDRANTS`/`KJUNC`, ~5 lines. This
is the kind of inconsistency this user spots; I have flagged it twice now and
it is cheap.

### D. Parking varies but never re-rolls

`ct/rng.ts` seeds from a fixed constant, so "stable per session" is really
"the same arrangement every session, forever". A per-session seed for the
parking draw would make it differ between playthroughs; the cost is 3 cars of
noise in the scenedump `places` fingerprint. Desk's call — it is a deliberate
trade, not an oversight.

### E. Tree pits overhang the kerb chamfer by ~6 cm

Cosmetic, visible only looking straight down at the kerb edge. The pit is
0.8 m wide starting at x = ±5.0, but the walk surface now starts at ±5.0625
(the arris chamfer). Trivial to fix when something else takes me into that
loop.

---

## Process note

Two edits this session **silently did nothing** because I used
find-and-replace against text that had changed on mainline (`rainLevel * 0.8`
→ `* 0.95`, and the `ctx` import line). One of them hid the night bug for a
whole round. I now grep for the *result* of every scripted edit rather than
trusting that it applied — and the assertion-style replaces in this session's
commits are why the second one was caught immediately.

## Scripts (all honour `SHOT_URL`)

```
scripts/kerb.mjs       shots | probe | walk    kerb, gutter, corner returns
scripts/bus.mjs        shots | walk | stop     the 42 and its stop
scripts/lamplight.mjs  shots | probe           lamp tint, night range, per-surface floors
scripts/wet.mjs        probe | shots           wetness outlasting the rain
scripts/parking.mjs    probe | dist | shots    the parked row
scripts/people.mjs     atlas | street | probe  the crowd
```

`wet.mjs probe` and `lamplight.mjs probe` are the two that could not be
replaced by looking: one measures behaviour that only exists over time, the
other reads material colours off the scene graph and normalises brightness out
so it tests identity rather than whether a screenshot looks right.
