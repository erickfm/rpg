# Builder B — quality pass on the ground and the props

Worktree `../rpg-ground` · owns `ct/props.ts`, `ct/tex-ground.ts`.
Written for the desk to prioritise. **Fixed** items are already committed;
**found** items are described but deliberately not actioned.

---

## Queue status — everything queued is on mainline

`## Now` and `## Next` are both fully landed. The queue has now gone stale three
times in the same way, so per the README rule (*"the builder's report is the
authority on what is done"*) here is the reconciliation, and nothing was redone.

| queue item | state |
|---|---|
| Bench passes two, three and four | landed — ad on the reclined backrest, bezelled as an inset plate, no skirt, legs no longer coplanar, sittable |
| Side street has no lamps (H blocked) | landed — `makeLampAt` factory, 3 lamps, H's file untouched |
| Puddles: stop and simplify | landed — pass five, gutter pan only |
| Milk crate clipping the shopfront | landed — 3D overlap test in `dimWorld` |
| Night five: beams, floors, stars | landed in three commits |
| Tree pits + puddles in the gutter | landed |
| Litter footprint rule | landed |
| Trash set shipped, rig down | landed |
| Catch basin | landed |
| `[E]` spots | VOID, confirmed by the desk |

### Off-queue: the car lot's curb cut (builder C unblocked)

Came in by desk message rather than the queue. C had built the lot against a
full-height kerb and correctly did not reach into `ct/tex-ground.ts`, so there
was no way in — *"how does one even enter, drive a car off the lot"*.

**I did not need C to report the frontage.** `ct/street.ts` puts the lot on
23.2 m of the east kerb centred on z = 2.6, and `ct/lot.ts` runs its drive
aisle down that same centre at 6.8 m wide, so the opening IS the aisle — same
centre, same width, derived from the two files that own it rather than passed
by message. That is also why it stays correct if C moves the aisle. Confirmed
against the running world (lot floor at x 18.6, z 2.6, 23.2 square) before
building anything.

`scripts/curbcut.mjs` measures the kerb profile off the built mesh and then
walks the cut, **with a control 9 m north where the kerb is full height**:
19.7 m in through the cut against 1.7 m without one. Without that control the
walk test proves nothing — "you can walk from the road into the lot" passes
anywhere the player can step up a kerb.

### Two things I recommend the desk close WITHOUT doing

- **Finding B, "lamp spacing leaves the middle of the block dark".** Written
  before night five. The user has since asked for wider beams and darker unlit
  stuff so it "feels scarier", and the desk's own read was *"more contrast, not
  more light"*. Filling the mid-block gap would undo what shipped. Heads are
  16.4 m apart and reach 7 m, so 2.4 m of real dark survives between pools —
  that is the design, not a defect.
- **Finding D, "parking varies but never re-rolls".** The seed is `ct/rng.ts`
  and the draw is `ct/cars.ts`. Neither is mine.

### One handoff still open, one line, not mine

`crosstown.ts:504` is desk-owned:

```js
scene.fog!.color.copy(skyCol).multiplyScalar(1 - 0.5 * lampNight);
```

Half the sky at full night is still grey, and grey fog at the end of a dark
street is a glowing wall closing it off. Toward black is `1 - 0.82 * lampNight`.

---

## The checks are the deliverable

Fifteen defects this session were found by a check, in work I had already
reported as finished. Every one was invisible to a screenshot:

1. Nine litter pieces sunk into the pavement after the footprint fix — the
   hand-written base heights were wrong.
2. The east walk severed at every tree, because moving the pits moved the
   trunk colliders and left 4 cm of lane.
3. `wet.mjs` counting reflections as puddles, blind to the gutter ribbons, and
   testing "still filling" on a maximum that pins at 1.0 — passing throughout.
4. Contact shadows the GPU was discarding entirely (`alphaTest 0.5`).
5. `trash.mjs` failing on a rule stricter than the one it named.
6. Shadows sized from a table coming out WIDER than their objects.
7. Shadows as siblings, left behind when a piece was pushed.
8. A rectangle turned 86° whose corners exceed its object's world box.
9. `groundUnder` sampling three points and missing the pan's high edge.
10. `roadNow` picking the pale walk instead of the road, making puddles grey —
    the exact defect being fixed.
11. `glow.mjs` checking 8 of 11 lamps and reporting a clean pass.
12. The apron's UVs bypassing `walkTex`'s own repeat/offset, so it sampled the
    walk sheet anywhere at all and came out brown.
13. The curb-cut profile probe reading `pos()[3]` after a `warp` — but `warp`
    *stores* a ground height, it does not resolve one, so it reported 0.000 the
    whole way and would have reported 0.000 for a kerb that was never cut.
14. That same probe then failing a *correct* kerb, by comparing against 0.140
    when those vertices are the top of the vertical face with the chamfer
    above — full reveal tops out at 0.110.
15. Two walk probes measuring pedestrian traffic rather than the lane they
    named: one started in the travel lane where cars shove the walker, and
    `bus.mjs` assumed 2.4 m/s on a walk where citizens are solid until they
    yield. The same unchanged world measured 15.8, 18.8, 22.2 and 25.4 m.

The pattern in almost all of them is one thing: **a number that was written by
hand where it could have been measured.** Base heights, half-extents, shadow
sizes, collider extents, sample counts. Where that has been replaced with a
measurement off the geometry, the bug class has not come back.

The second pattern, in 3, 5 and 11, is worse and worth naming on its own: **a
check that covers part of the thing and reports a pass reads as coverage.**
Those three were green while measuring the wrong sheets, the wrong rule and
two-thirds of the fleet.

---

## Queue status, 2026-07-24 — `## Now` is empty and `## Next` is nearly so

The queue's whole `## Now` section is on mainline. It went stale a second time
in the same way the desk apologised for at the top of the file, so per the
README rule (*"the builder's report is the authority on what is done"*) I have
not redone any of it:

| queue item | landed as |
|---|---|
| Night five — wider beams, darker darks, stars | three commits, one per piece |
| Tree pits + puddles in the gutter | the footprint commit |
| Litter clips into the kerb | the footprint commit |
| Ship the approved trash set, take the rig down | `2be…`, 14 placements |

From `## Next`: the catch basin, the bus bench and the puddle contrast fix have
all landed too, and finding **C** (red kerb at the bus stop) went in with the
bench. What is left:

- **`[E]` spots** — nothing of mine is in `crosstown.ts`. The feed action
  cannot move and is blocked on the same missing `ctx` accessors as D. See
  `notes/BLOCKED-B.md`.
- **Finding B, lamp spacing leaves the middle of the block dark** — I recommend
  **closing this as superseded, not doing it.** It was written before night
  five. The user has since asked for *"a wider beam… make the unilluminated
  stuff darker… it should feel scarier"*, and the desk's read was explicitly
  *"more contrast, not more light"*. Adding lamps to fill the mid-block gap
  would undo the thing that just shipped. The gap is now deliberate: heads are
  16.4 m apart and reach 7 m, so 2.4 m of genuine dark survives between pools,
  by design.
- **Finding D, parking never re-rolls** — the seed lives in `ct/rng.ts` and the
  parking draw in `ct/cars.ts`, neither of which is mine. Desk's call and
  someone else's file.

## The five things a check caught that I had already called done

Worth collecting, because the pattern is the same each time and it is the most
useful thing in this report:

1. **Nine litter pieces sunk into the pavement** after I had committed the
   footprint fix — the hand-written base heights were wrong (a lying cylinder
   wants its centre at exactly its radius; the cups were 6 and 8 mm under).
   Found by `footprint.mjs`, which I wrote *after* the fix.
2. **The east walk severed at every tree.** Moving the pits inboard moved the
   trunk colliders with them and left 4 cm of lane. Found by `bus.mjs walk`.
   I had not walked it, which is exactly what the project rule exists for.
3. **`wet.mjs` was measuring the wrong sheets and passing anyway** — counting
   reflections as puddles, blind to the gutter ribbons entirely, and testing
   "still filling" on a maximum that pins at 1.0.
4. **The contact shadows were never drawn** — `flatDecal` sets `alphaTest 0.5`
   and every texel of a soft shadow is below it.
5. **`trash.mjs` failed on a rule stricter than the one it named** — it
   compared rotations globally, so a coffee cup and a fountain cup in different
   places sharing a yaw counted as copies.

Every one of these was invisible to a screenshot and every one was in something
I had already reported as finished. **The check is the deliverable, not the
fix.**

---

## ANSWER: the two approved pieces are not rig candidates at all

The desk asked me to identify the two pieces in `user-trash-good.png` and
`user-trash-good2.png` from their positions, and asked whether they are the
same object at two grime values — because if they were, per-instance variation
would be carrying it and round three should vary the new candidates the same
way.

**They are neither.** Nothing from the rig has ever been placed in the world;
the rig has only ever been in the alley. Both approved pieces are the
pre-existing gutter litter, and both are **flat decals** drawn in
`ct/tex-world.ts`:

| shot | what it is | where it comes from |
|---|---|---|
| `user-trash-good` | tan-brown, darker marks, in the pan hard against the kerb | `scrapTex`, 0.26 × 0.22, from the 7-piece gutter loop |
| `user-trash-good2` | pale cream, cleaner, by a car wheel | `paperTex`, 0.30–0.48 wide, from the 5-piece paper loop |

So **there is no per-instance grime variation to generalise**. What variation
exists is four hand-drawn `paperTex` variants and three `scrapTex` ones, picked
by index. Round three does not inherit a mechanism from this.

What it *does* inherit is more useful, and it agrees with the desk's own
selection rule from the other direction: these two are small, hard-edged,
high-contrast rectangles with **no outline**, seen from close and steeply. The
piece the user rejected in the same sitting — `canTopTex` — is the same size
and the same primitive, and the only real difference is that it rings itself
with a solid `#16181c` border on all four sides. That border is deliberate
(its own comment says it protects the silhouette at ~10 screen pixels) and it
is exactly what killed it: at that size a full border stops reading as shading
and reads as an outline, so it looks printed *on* the pavement rather than
lying on it.

**The rule I would carry forward: let the object's own dark side carry the
silhouette, never a ring.** All four `canTopTex` placements are gone.

And one thing this quietly overturns: flat decals are not dead. Round two
concluded flat was the wrong primitive, and for the alley rig at 15–20° it is.
But in the gutter, seen from close and much steeper, two flat decals are the
only litter in this world the user has ever approved. The primitive was never
the whole story — the viewing angle was.

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
