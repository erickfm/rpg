# Request audit — verifying the user's asks end to end

**Branch** `audit/seams`, base `add-stick-and-city98` · read-only.
Instruments: `scripts/steps.mjs` (finds raised ground by scanning),
`scripts/doorsweep.mjs`, `scripts/lane3.mjs`, `shots/pl-*`, `shots/b2-*`.

## The harness was fixed first

Two rules, both from the previous pass failing:

1. **Every warp is verified before its reading is used.** `at()` warps, settles
   two frames, and compares the rig's own position against what it asked for; a
   mismatch returns null and the sample is discarded.

   **Correction, found by using it on the car lot and reported here rather than
   left standing.** This check does *less* than I claimed. `warp` sets the rig's
   position unconditionally and the rig only blocks *movement*, never pushes you
   out — so a point inside solid brick verifies as "landed" perfectly happily.
   What the check actually catches is **state carry-over between checks**, which
   was the real bug last pass (the car-lot probe running from where the church
   probe finished). It does **not** establish that a point is standable.

   That matters for exactly one conclusion below, and I have withdrawn it.
   Ground-height readings are unaffected — `groundY(x, z)` is a function of the
   coordinates whether or not a wall is there — so the library and church step
   results stand.

   **The right test exists and I have already used it elsewhere:**
   `__ct.colliders()` is exposed, and a point is standable iff it lies inside no
   collider. That is exact, instant, and is what `scripts/lane3.mjs` already
   does. The next pass should fold it into `at()`.
2. **Nothing is aimed from memory.** The steps are *found* by scanning ground
   height across a region and clustering what comes back above 0.20 m. No
   coordinate for them appears in the script.

---

# THE TWO PRIORITY ANSWERS

## 1. LIBRARY STEPS — **DONE.** My earlier verdict was wrong, and here is where they are

I previously walked at the facade at z = −13 and stopped dead at x = −7.0 with no
rise, and called it inconclusive-leaning-not-done. **That was the wrong place.**

Scanning for raised walkable ground finds them:

> **x −11.5 … −9.0, z −14.5 … −11.5, ground rising 0.42 m → 0.99 m.**

The library is **recessed** — that is the *"make entire library building a bit
recessed so there like a courtyard public 3rd space area"* ask — so its steps sit
**2.0 to 4.5 m behind the facade line**, inside the courtyard. Walking at x = −7
puts you against the courtyard's street wall, not the steps. You reach them by
entering the courtyard opening and turning in.

The climb is real: 0.14 m on the pavement to **0.99 m** at the top, ~0.85 m of
rise, and the player is carried up it. **`a25df0c1` works.** My earlier report
should not have been read as a doubt about the steps; it was a doubt about my
own aim, and it was right to be.

## 2. THE PARK — **NOT DONE.** Not lit, and still the yard

| measured | |
|---|---|
| additive light sources inside the park | **0** |
| meshes inside the park | 62 (4 of them over 2.5 m tall) |
| bright objects above 1.5 m | 1 |

**There is no light source of any kind in the park.** `shots/pl-P6-park-night.png`
confirms it: at 22:30 the park is a black rectangle. The only light in frame is a
street lamp on the road *outside* the railings and one lit window above. Stars
are visible over it.

And it is still the yard. `shots/pl-P5-park-day.png` and `pl-P7-park-in.png`,
standing inside it: **a flat green lawn, one bench, one bin, a hedge strip — and
three sides of blank 13 m red brick wall.** No trees, no lamps, no path reading
from the ground, nothing above knee height except the walls. The enclosure is
precisely the blank brick the user objected to.

What *has* landed is real and worth crediting: the railings and gate read as a
fence you can see through, the piers are there, the bin and bench exist, the
hedge is in, and **you can walk into it and stand in it**. The frontage half of
the ask is done. The inside is not.

> The user called it the shittiest yard they had ever seen. From inside, at
> night, it is an unlit black rectangle walled by three blank elevations. **I
> would expect that complaint again, in the same words.**

Wants **E** for the lamps and **B** for the trees — `ct/park.ts`'s own note says
the back wants trees and that they are B's file, asked for through the desk.

**One caveat on my own measurement:** my "is anything alive in there" check
looked for the citizen atlas by texture width and found **zero people anywhere in
the world**, which cannot be right — the detector is broken, not the world. So I
can state the park is unlit and empty of scenery with confidence, and I cannot
state anything about whether people walk through it.

---

# CHURCH STEPS — **NOT DONE as a walkable thing**

Scanned x −8 … 14, z −104 … −114, which covers the whole church frontage and
churchyard: **485 points landed and not one is above 0.20 m.** There is no
raised walkable ground anywhere in front of the church.

The ask — *"inlay the church and give it some stairs... and a lil courtyard"* —
is marked done in `FEATURE-REQUESTS.md`. The inlay and the churchyard have
landed. **The stairs, if they are modelled, are not something the player can
climb**: the ground stays at street level across the entire frontage. Compare
the library, where the same scan finds a 0.85 m climb immediately.

---

# Graded from this pass

| ask | verdict | observed |
|---|---|---|
| library recessed into a courtyard | **DONE** | recessed ~4.5 m; steps found and climbable |
| library steps | **DONE** | x −11.5…−9, z −14.5…−11.5, gy 0.42→0.99 |
| church inlaid + churchyard | **DONE** | inlay and yard present |
| church steps | **NOT DONE** | no walkable rise anywhere on the frontage |
| park — frontage, railings, gate | **DONE** | reads as a fence you see through |
| park — lit | **NOT DONE** | zero light sources; black at night |
| park — alive / not a yard | **NOT DONE** | bare lawn, three blank brick walls |
| *"for every seat…"* — park benches | **DONE** | `[E] sit on the bench`, two benches |
| *"for every seat…"* — car lot | **DONE** | `[E] sit on the bench`, five points |
| *"for every seat…"* — library courtyard | **NOT DONE** | no sit prompt on the frontage; `ct/civic.ts:65` states the cause and `civicSeats()` is written but unwired |
| HOTEL ORPHEUS blade, from the west | **DONE** | reads correctly, legible from the street |
| GOLDEN ACES facade detail | **DONE** | LOOSEST SLOTS / #1 BLACKJACK / 24 HRS / VACANCY all present and correct-handed |
| alley litter + the cat | **DONE** | crate, cardboard, cone, cat all in `pl-P10` |
| citizens with legs and feet | **DONE** | `pl-P13` — proper legs, shoes, not a flat card |
| gutter litter | **DONE** | paper scraps in the gutter in `pl-P13` |
| nine `[E]` doors, one per room | **DONE** | `doorsweep.mjs`, all nine fire |
| sidewalk not encroached | **DONE with a caveat** | nothing impassable; tightest 0.89 m — `notes/lane-audit.md` |

# NOT CHECKED — and why

**Car lot — now SEEN, from the street.** `shots/lot2-mid.png`, standing on the
road looking east. Chain-link fence with a gate, pennant bunting across the
frontage, **"$99 DOWN WE FINANCE" · "NO CREDIT NO PROBLEM" · "BUY HERE PAY
HERE"** banners, a pennant flag on a pole, a floodlight mast, a "TODAY ONLY"
A-board, a traffic cone, and a row of cars behind the fence. The
*"typical car price signs yknow?"* and *"lot sleaze"* asks are visibly **DONE**,
and it reads as a used car lot at a glance.

**What I still cannot confirm: whether you can walk IN, and whether the office
is at the back with rows either side.** Every camera I have is from outside the
fence looking in. The standability scan cannot answer it either, and the reason
is itself a finding — see below.

**Finding: there is no collision east of x ≈ 15.** The building colliders in
`crosstown.ts` run `FACE − 0.3 … FACE + 8`, i.e. x 6.7 … 15. Past that the
collider list is empty, so a collider-based standability scan reports the entire
region x 15 … 36 as standable — 2137 points in **one connected component**
running x 7.5 … 36, z −6 … −62. That is why it cannot separate "the lot" from
"inside a building": as far as collision is concerned, there is nothing out
there. It is only the shells' geometry that stops you, and only for the first
8 m.

**Blade signs from the east** — `pl-P2` shows the ACES marquee and blade reading
correctly, and the ORPHEUS blade at a distance where I cannot honestly call the
E and L. The tight pair I tried to shoot found the marquee canopy instead. Still
open, and it is the third time this sign has resisted a clean answer.

**Bench ad framed / legs non-coplanar**, **wheel arches**, **puddles in the
gutter under rain**, **closing the 301 door**, **interior people through 8
angles**, **facade-door alignment for BODEGA / DINER / TAX**: not reached.
Puddles specifically need the clock driven to a raining hour, which I did not do.

# For the next pass

The car lot and the remaining visual checks want exactly what fixed the library:
**scan for the thing, then aim at what the scan returns.** `scripts/steps.mjs`
is the pattern — it took one run to locate steps that three hand-aimed cameras
had missed, and its 1651 rejected warps are the reason its 624 readings can be
trusted.

---

# Grading pass 2

Method as before: find the thing by scanning the scene graph for what it *is*
(neon = the only materials with `fog === false`; benches by proportion; puddles
by being flat, transparent and on the road), then aim at what the scan returns.

| ask | verdict | observed |
|---|---|---|
| *"make rain cause some puddles"* — **the rain itself** | **DONE** | Drove the clock to the first raining hour using the world's own hash (`rainAt`, `ct/props.ts`). `shots/gr-rain-street.png`: rain streaks falling the full height of frame, road gone dark and wet, lamps lit with warm pools on the tarmac, lit windows. It reads as rain. |
| *"make wetness last a lil after it stops raining"* | **NOT CHECKED** | needs two clock positions and a wait; not done |
| *"the gutter should have the water in the gutter"* — **puddles visible** | **ANOMALOUS — wants a builder, not another audit pass** | see below |
| casino / hotel **blade signs from the east** | **STILL UNRESOLVED — four attempts** | see below |
| bench ad framed / legs non-coplanar | **NOT CHECKED** | the bench scan matched interior seating and the lot's, and found nothing on the main street between x 4 and 7 — the bus bench has moved and my proportion filter did not catch it |
| wheel arches | **NOT CHECKED** | the car scan returned bodies at x ≈ −10.7, inside the west block, not the parked cars on the street |

## The blade sign has now defeated four attempts, and here is why

Attempts: two hand-aimed wide shots, one auto-detected close pair, and this pass
a scan-and-aim at 5.5 m standoff. Every one is blocked the same way.

**The GOLDEN ACES marquee canopy overhangs the pavement.** Any street-level
camera within roughly 8 m of either blade is *underneath* it, and the frame fills
with the canopy's underside and the shopfront — `shots/gr-blade0-fromW.png` and
`gr-blade0-fromE.png` are both that. From further back the blade is small enough
that the E and L cannot be called honestly, which is where attempts one and two
ended.

**Two ways to actually settle it, for whoever picks this up:**

1. **From across the road.** Stand on the *south* side-street walk, z ≈ −109,
   and look north at the blade from ~13 m. That clears the canopy entirely and
   still gives enough pixels. No camera I have tried was on that side.
2. **Do not photograph it at all.** The question is whether the two faces of a
   two-sided sign carry mirrored UVs. That is readable from the scene graph —
   find the pair of coincident planes, compare their world-space u direction
   against each face's normal — and it gives a yes/no rather than a judgement
   about pixel shapes at distance. Given this sign's history, that is the
   approach I would take.

This is the third finding this session where the honest answer was "my
instrument cannot see this" rather than a verdict. The pattern is worth naming:
**when a check fails twice the same way, stop re-aiming the camera and change
the instrument.**

---

# Handedness, settled by reading the scene graph — 12 mirrored sign faces

The blade question defeated four cameras. `scripts/handed.mjs` stops
photographing and asks the geometry instead. For every mapped plane above 1.8 m:

```
normal = the plane's +z rotated into world space
uDir   = the plane's +x rotated into world space      (the texture's u axis)
right  = cross(up, normal)                            (a viewer's right hand)
correct  iff  dot(uDir, right) > 0
```

A negative dot means the artwork runs right-to-left for anyone looking at that
face — whatever it depicts. Symmetrical letters cannot hide it.

**179 mapped sign faces. 12 are mirrored, and they are all in one place.**

| u·right | faces | canvas | at |
|---|---|---|---|
| **−0.997** | 6 | 64 × 20 | x **7.18**, y 2.70, z +11.30 → −6.10 |
| **−0.972** | 6 | 64 × 20 | x **7.18**, y 3.01, z +13.23 → −8.03 |

All twelve are `DoubleSide` planes standing at **x = 7.18** — 0.18 m proud of the
east facade — at head height, spread along the east shopfronts from z = +13.2 to
z = −8.0. Their front faces point **into the building**; the street sees the
back, and a double-sided plane's back is mirrored by construction
(`GOTCHAS.md` §10). Twelve shopfront signs on the busiest stretch of the block
are reading backwards to anyone walking past them.

**Method note, so the number is trusted:** the check is *undefined* for
horizontal planes — with `up = (0,1,0)` the right-vector degenerates — and it
reports exactly `0` for them rather than guessing. The two large horizontal
canopies at (51.29, 3.71, −96.85) and (39.51, 4.31, −97.03) come back as `0` for
that reason, not as a pass. **The vertical blades themselves are not in the
179**, so this run still does not answer the original blade question; it answers
a bigger one I was not looking for.

## Widened run — full accounting, and where the blades actually are

Re-ran with the filter opened up and **every exclusion counted and reported
rather than silently dropped**:

| | count | |
|---|---|---|
| checked | **193** | upright, mapped, above 1.2 m |
| **mirrored** | **12** | the same twelve at x = 7.18 — unchanged |
| excluded: no texture map | **39** | nothing to mirror; see below |
| excluded: below 1.2 m | 376 | ground clutter, not signage |
| excluded: not upright | 55 | the world-up test is invalid on these, so they are **reported, not guessed** — including the two marquee canopies at (51.29, 3.71, −96.85) and (39.51, 4.31, −97.03) |

**The vertical blades are not among the 193, and they are not among the 55
tilted ones either — so they are in the 39 with no texture map.** The earlier
neon scan found them as 0.22 × 12.85 × 0 planes at (51.23, 10.77, −96.07) and
(48.33 / 54.12 / 34.85, …): upright, vertical, well above 1.2 m. They pass every
filter except having a `map`.

**That inference was wrong, and reading the materials disproved it.** All 228
fog-disabled faces on the side street are `PlaneGeometry`, **all carry a map**,
and **all are `side: 0` — FrontSide, not DoubleSide**:

| size | map | side | at |
|---|---|---|---|
| 0.22 × 12.85 × 0 | yes | FrontSide | (48.33 / **51.23** / 54.12, 10.77, −96.07) |
| 0 × 14.2 × 1.1 | yes | FrontSide | (**44.20** and **44.50**, 12.10, −96.95) |
| 0 × 15.8 × 1.24 | yes | FrontSide | (**46.22** and **46.58**, 13.50, −96.67) |
| 0 × 6.2 × 6.8 | yes | FrontSide | (**50.97** and **51.48**, 22.70, −94.30) |

They come in **pairs at mirrored offsets about a common centre** — 44.20/44.50,
46.22/46.58, 50.97/51.48 — which is exactly the shape `twoSided()` builds: two
FrontSide planes back to back so each is only ever seen from its own side.

## And that means the answer was already in my own notes

`notes/seam-audit.md` Round 2, finding **R1**, settled this weeks of work ago:

> *`twoSided` builds two planes at `rotation.y = ±π/2` and calls
> `pixTex(tw, th, draw)` with the **identical** `draw` for both, so the two faces
> are mirror images in world space.*

That was demonstrated then with matched opposite-side photographs, and the
helper's own comment claims a fix ("the back face gets a texture that was
painted mirrored") that the code does not implement. **Each of these pairs
carries identical artwork on two opposed faces, so one face of every pair is
mirrored.** The pair structure I have just measured is the same helper, still
building signs the same way.

So the blade question is **closed, and it was closed before I started**. I spent
five attempts photographing a question my own earlier report had already
answered, and then a sixth building an instrument to answer it again. The
finding stands; what failed was my reading of my own audit trail.

**The lesson is worth more than the finding:** before building a new instrument
for a question, grep the existing reports for it. `notes/seam-audit.md` is 400
lines and I wrote all of them.


---

# Puddles at a daytime raining hour — an anomaly I cannot resolve

Took my own advice from the previous pass: found the first raining hour that
falls in daylight using the world's own hash — **h = 15, clock 15:00** — warped
to the street, and gave the sim **9 seconds** so the puddles could pool
(`puddleLevel` eases at 0.22/s, so ~0.86 of full after 9 s, and opacity should
be ≈ 0.72).

**What I observed** (`shots/pd-street-day.png`):

- **The ground is wet.** The road is markedly darker than on a dry day — the
  wet-look tint on the ground materials is applied and reads correctly.
- **No rain particles.** Not one streak in frame.
- **No puddles.** And the programmatic check agrees: after 9 s, **0 flat
  transparent decals with opacity above 0.02**.

That last part contradicts my own earlier frame. At **05:00** — the first
raining hour by the same hash — `shots/gr-rain-street.png` shows heavy visible
streaks falling the full height of frame. Same hash, same code path, two
raining hours, and only one of them has rain in it.

**I am not calling this a bug.** Three things could produce it and I cannot
separate them from outside:

1. the rain genuinely is not running at h = 15 despite `rainAt(15)` being true;
2. it is running and the particles are somewhere the camera is not — the drop
   volume follows the player and I warped immediately before the shot;
3. my "after" pass is wrong. It is: the same filter that found **57** decals on
   the first sweep, many at opacity 1, found **zero** nine seconds later. Decals
   at opacity 1 do not vanish. **One of my two measurements is broken and I do
   not know which**, so neither number should be trusted on its own.

The one solid observation is the screenshot: **at a daytime raining hour the
street is wet and there is no rain and no standing water in it.** That is what a
player would see, and it is enough to hand to whoever owns `ct/props.ts` — with
the explicit warning that my instrumentation of it disagreed with itself and
should be rebuilt rather than believed.

---

# Re-check at `7f67c56b` — the 12 mirrored faces are NOT closed

Two mirroring fixes landed after I logged them: `e0fdad7e` ("A-1 TAX mirrors —
the original complaint, closed") and `7d27c5f0` ("Burger Barn mirrors too: door
right inside, left outside"). Re-ran the handedness check to see whether they
reached these.

| | previous run | **now** |
|---|---|---|
| faces checked | 193 | **207** (the world grew) |
| **mirrored** | 12 | **12 — the same twelve** |
| coordinates | x 7.18, z +13.23 → −8.03 | **identical** |
| u·right | −0.997 / −0.972 | **identical** |

**Unchanged, to three decimal places.** The two fixes that landed addressed
**facade-to-interior door-side mirroring** — which door edge a room's opening
sits on, and making the painted facade agree with it. That is a real and
different defect, and closing it was right. It does not touch these.

## What the twelve actually are

Reading the geometry rather than guessing: they are flat in **x** (normal ±x), so
they face **across the street**, standing at x = 7.18 — 0.18 m proud of the east
facade. Two families:

| six at | size (x × y × z) | canvas | density |
|---|---|---|---|
| y = 2.70 | 0 × 0.77 × 1.98 | 64 × 20 | 32 px/m along z, 26 px/m up |
| y = 3.01 | 0 × 1.07 × 2.08 | 64 × 20 | 31 px/m along z, 19 px/m up |

So: **1.98–2.08 m long, 0.77–1.07 m tall, at head-to-fascia height, running the
length of the east shopfronts from z = +13.2 to z = −8.0** — the stretch a player
walks first. `DoubleSide` with their front faces pointing into the building, so
the street sees the mirrored back (`GOTCHAS.md` §10).

Note the canvases are **non-square texels** as well (31 × 19 px/m on the taller
family), which is the lighting-and-signage anisotropy already logged in
`notes/seam-audit.md` — same objects, second defect.

## Routing

These are on the **east shopfronts**, so `ct/street.ts` (D) unless the shopfront
furniture has moved to another module since. The fix is the standard one for
this class: give each face its own correctly-handed artwork, or make them
`FrontSide` and place a second plane for the other side — which is what
`twoSided()` already does for the neon, and what its comment claims it does with
mirrored artwork but does not.

---

# THE PARK — re-checked at `e55a909f`. My headline finding is CLOSED.

I reported the park as the audit's strongest negative: *"zero light sources of
any kind… a black rectangle at night… a flat lawn, one bench, one bin, and three
sides of blank 13 m brick. I would expect the 'shittiest yard' complaint again,
in the same words."*

Re-ran the same measurement. **It is wrong now, and comprehensively.**

| | when I reported it | **now** |
|---|---|---|
| light sources inside the park | **0** | **8** |
| meshes | 62 | **131** |
| over 2.5 m tall | 4 | **32** |

The eight are four lanterns, each a lit head at y = 3.74 with a 4.4 × 4.4 m
ground pool under it, evenly spaced down the park at x = −9.55, z = −92.97,
−86.33, −79.67, −73.03.

`shots/pk-park-night-in.png`, standing inside at 22:30 — the same station and
the same hour as the frame I called a black rectangle:

- **four lanterns lit**, warm halos, light pooling on the path
- **trees**, a lot of them — the jump from 4 tall meshes to 32 is the planting
- **a monument on a plinth with an inscribed plaque**, centre of frame
- **benches**, railings, a path that reads as a path
- the street beyond legible over the railings — BODEGA, RECORDS, GARAGE

The three blank brick elevations that were the whole complaint are now behind
tree canopies and read as the back of a block rather than as a wall.

**This is done.** Not partly — the ask was *lit and alive* and it is both. The
only thing I flagged that I still cannot speak to is whether people walk through
it, because my citizen detector was broken when I checked and I have not fixed
it.

## Worth recording about the audit, not the park

This was the finding I stated most forcefully, with the most confidence, and in
the user's own words. It was true when measured and false eleven commits later.
**A negative finding has a shelf life**, and the stronger the language the more
important it is to re-check before anyone quotes it. I would rather have caught
this myself — as here — than have the desk route a builder to fix a park that
had already been fixed.
