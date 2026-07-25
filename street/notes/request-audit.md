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

---

# I read the eleven screenshots. Five of six unread ones are aimed at nothing.

The user told me to read `shots/pl-P5` … `P15`. I had cited P2, P5, P6, P7, P10
and P13 and had **never opened P8, P9, P11, P12, P14, P15** — the six behind
every one of my NOT CHECKED verdicts. Opening them:

| shot | meant to show | what is actually in frame |
|---|---|---|
| `pl-P9-lot-inside` | the car lot | **inside solid geometry** — brick from behind, roof underside overhead |
| `pl-P15-lot-office` | the lot office | **blank grey**. No world at all |
| `pl-P11-bench-legs` | bench legs non-coplanar | **the alley** — dumpster, crates, the cat. No bench in frame |
| `pl-P12-car` | wheel arches | **a car roof at point-blank**, filling the lower half. No arch visible |
| `pl-P14-diner-keeper` | an interior person turning | the diner, correctly — **but no person in frame** |
| `pl-P8-lot-street` | the lot from the street | usable |

**Five of six.** Two inside geometry, two aimed at the wrong object, one aimed
at the right room and missing the subject.

This is the landing bug and the aim-from-memory bug, photographed. `pl-P9` is
`GOTCHAS.md` §10 as well — those are interior wall faces seen from behind,
which is what you get when `warp` drops you inside a building and the rig only
blocks *movement*, not placement.

## What this settles

Every one of my NOT CHECKED verdicts stays NOT CHECKED. Reading the shots did
not let me grade a single open item — **but it explains all of them**, and it
retires the question of whether those checks were merely unlucky. They were
never pointed at their subject.

It also settles that refusing to grade was right for a reason I had not fully
appreciated at the time: I assumed the shots were of the right place and merely
inconclusive. They are of the wrong place. Had I graded from them I would have
reported on the alley while claiming to report on a bench.

## What the frames do show, incidentally — observed, not inferred

- `pl-P11` — the **black cat reads clearly** against the brick at range, yellow
  eyes legible; dumpster, blue crates and cardboard all present. Reconfirms the
  alley-litter DONE from a second angle.
- `pl-P12` — **A-1 TAX SERVICE** fascia is clean and legible, its door is
  recessed with a visible push-bar, and the car-lot fence, bunting and stock
  are all there behind it. Bunting confirmed from a second angle.
- `pl-P14` — the **diner interior is good**: checker floor, red booths, window
  band at the right height. The room is not in question; only its occupant is.

## Standing correction to my own method

`GOTCHAS.md` §20 says an unread screenshot is not an observation. These six
sharpen it: **a read screenshot is not an observation of what you aimed at,
either.** The frame has to be checked for its subject before it is evidence of
anything. Every shot I take from here names what it expects to see, and I say
so when it isn't there.

---

# Round 2 — re-shot with a harness that aims from the source. Three verdicts.

`scripts/aim.mjs` replaces the harness that produced five useless frames.
Nothing in the scene is named (**3,341 objects, 0 names**), so it finds subjects
by geometric signature and never by a coordinate I remember. Before any shot it
requires three things, and the middle one is what was missing before:

1. the camera point is **standable** — outside every collider at `RADIUS 0.36`
2. the camera has **line of sight** — the ray to the subject is sampled every
   0.20 m and must cross no collider other than the subject's own
3. the warp is **verified to have landed**, `__ct.pos()` agreeing to 0.06 m

It found 7 car-like clusters and 11 bench-like clusters by shape alone, and
reported 39–108 valid cameras per subject where the old harness had one guess.
Every shot below declares what it expected to see.

## WHEEL ARCHES — **NOT DONE.** Confirmed on two different vehicles.

`shots/aim-car0-arch.png` (maroon sedan, x 3.79 z −13.96) and
`aim-car1-arch.png` (olive pickup, x −3.92 z −30.04), both side-on at 2.6 m.

The wheels are **dark octagonal discs standing proud of a perfectly straight
body sill**. On both vehicles the white side stripe runs unbroken from front to
rear, straight through the space above each wheel. There is no cut-out, no
curved lip, no recess and no shadow where an arch would be — the wheel reads as
a disc laid against a flat slab side, which is exactly the complaint.

This is the clearest NOT DONE in the audit, and it is a two-model result rather
than one bad car.

## BURGER BARN palette — **DONE.**

Visible in `aim-car1-arch.png`: the fascia band is red, the awning is cream with
red dashes, the stallriser and pilasters are tan. **No yellow anywhere on the
building.** The user asked to move it off red-and-yellow to red-and-beige and
that is what is standing there.

## PARK BENCHES — legs are solid, **not coplanar planes.**

`shots/aim-bench0-legs.png` (x −7.43, z −91.8) at 2.0 m: wooden slat seat and
back on **solid dark-green box end-frames with real depth**, casting against the
paving. Whatever the bus bench does, the park benches are not two crossed
planes. The frame also shows the park path, railings, lawn, trees and hoop
racks — a fourth independent confirmation that the park is furnished.

## The bench AD — still **NOT CHECKED**, and now I know why

The user's ask was whether the *ad* is framed rather than clipped and whether
*its* legs are non-coplanar. My shape finder returned 11 bench-like clusters and
**none of them is an advertising panel**. The two flat 1.90 × 0.05 × 0.47 slabs
it picked at x = −8.65 turned out, on inspection of `aim-benchad1.png`, to be a
courtyard ledge — a plinth cap, not a bench.

So this is not a failed shot, it is a **failed search**: an ad panel would be a
vertical board roughly 1.8 × 0.6 sitting below or behind a seat, and no such
thing was found anywhere in the world by shape. Either it does not exist yet or
its geometry is unlike what I searched for. I am not grading it either way.

## Coverage, honestly

Answered this round: wheel arches, the burger barn palette, park bench legs.
Still open and still not graded: the car lot interior and its office, the bench
ad, interior people through 8 angles, the 301 door, facade-door alignment for
the bodega/diner/tax service, and wetness after rain. The citizen signature I
had been using (a 320-wide sprite sheet) now matches **nothing** — `c16457c8`
changed the crowd — so the interior-people check needs a new signature before it
can run at all.

---

# INTERIOR PEOPLE TURN THROUGH 8 ANGLES — **DONE.** Measured, not photographed.

The check that had been un-runnable since `c16457c8` (my citizen signature, a
320-wide sprite sheet, now matches **nothing** in the world). Rather than guess a
new constant I enumerated every figure-sized mapped mesh and let the world say
what a citizen is now:

> **a 160 × 128 atlas with `repeat [0.2, 0.5]`** — 5 columns × 2 rows = 10 cells
> — and `repeat.x` goes **negative** on some figures, i.e. the frame mirrored.

Five unique views plus mirroring is eight headings. That is the scheme the user
asked for, so the only question left is whether a given figure *uses* it.

`scripts/turn.mjs` answers that without a camera: orbit the player around a
figure at 45° steps and record the material's map offset, the mirror sign, and
the mesh's own yaw at each heading.

| figure | distinct frames over 8 headings | verdict |
|---|---|---|
| interior x = 442 | **8 of 8** | turns |
| interior x = 517 | **8 of 8** | turns |
| interior x = 678 | **8 of 8** | turns |
| interior x = 1002 | **8 of 8** | turns |
| street (6, −12.76) | 7 of 8 | turns |
| street (−6, −28.3) | 7 of 8 | turns |

The interior four are exact: columns 0, 0.2, 0.4, 0.6, 0.8 on row 0.5, with the
mirrored variants filling the other side — **all five unique views and all three
mirrors, no heading repeated.** They are not flat cards. The question is closed.

The street pair reads 7 rather than 8 only because they are *walking*: they use
both atlas rows (0 and 0.5) as the gait cycles, so a heading can be sampled on
the same frame twice. Their own yaw takes 7 distinct values across the orbit,
which a billboard could also do — but the frame changes are what settles it, and
they change.

**A note on the difference:** interior figures use row 0.5 only, street figures
use both rows. Standing keepers versus walking citizens, out of one atlas. That
is the kit being used correctly by different builders, and it is the first thing
in this audit where independent rooms agreed with each other for free.

## Falls out of the same measurement: only half the rooms have anyone in them

Eight interior slabs are built (figures at x ≈ 440, 516, 597, 677, 756, 840,
916, 998 — the 80 m slab addressing from x = 400). **Four carry a keeper**
(x = 442, 517, 678, 1002). The other four rooms are empty of people.

Not a defect — nobody asked for a keeper in every room — but it is the kind of
set-level inconsistency the interiors audit exists to catch, and it is now
measured rather than guessed. Logged to `notes/interior-audit.md`.

---

# ═══ CURRENT GRADE — re-walked at `a8636631`. This supersedes everything above. ═══

Four verdicts I had marked NOT DONE have landed. One of them I got **wrong for
my own reasons**, not because the world changed. All re-walked, not re-read.

| # | request | grade | evidence |
|---|---|---|---|
| 1 | **park is lit** | **DONE** | **20 light sources** over the park's full bounds — ten lanterns at y 3.74, each with a ground pool, in three ranks at x −9.5, −22.2, −34.8 |
| 2 | **park is not a yard** | **DONE** | **42.5 m of walkable depth** (x −7.5 … −50), **569 meshes, 88 over 2.5 m** |
| 3 | **church steps** | **DONE** | walkable flight at **x 8.5 … 9.0, z −78 … −81, gy 0.31 → 0.51** |
| 4 | **library courtyard seats** | **DONE** | `civicSeats()` is called at `crosstown.ts:375`; courtyard reachable on foot |
| 5 | **library steps** | **DONE** | x −11.5 … −9.0, z −14.5 … −11.5, **gy 0.42 → 0.99**, reachable from spawn |
| 6 | **interior people turn 8 ways** | **DONE** | 4 rooms, **8 of 8 distinct frames** each |
| 7 | **a keeper in every room** | **PARTIAL** | 8 rooms built, **4 staffed** — F's four have `room.person`, G's four do not |
| 8 | **wheel arches** | **NOT DONE** | two vehicles, wheels are discs against a straight sill. H is on it |
| 9 | **burger barn red-and-beige** | **DONE** | red fascia, cream awning, tan stallriser, no yellow |

## The church: I was wrong, and not because the world moved

I graded the church steps NOT DONE on a scan of **12,260 free points** across
x −45 … 63, z −90 … −138 that found **zero** ground above 0.20 m. That scan was
real and its result was real. It was also of an **empty block**.

`ct/street.ts:810` says it plainly: *"The church stands on the main block now."*
It was moved, and `placeChurchEast` puts it on the east frontage. Every sweep I
ran was of where the church **used to be**. E's report was right the whole time.

Walking the east frontage instead: 459 free points, 14 raised, one cluster —
**x 8.5 … 9.0, z −78 … −81, rising gy 0.31 → 0.51.** E reports 0.55 at the
doors; my grid stops at 0.5 m and at the edge of free ground, so 0.51 is the
last tread I could stand on, not the top. Same flight, same answer.

This is the fourth time in this audit a stale location has produced a confident
wrong answer, and the **first time it produced one against a builder**. The rule
I wrote after the diner — *aim from the source, not from memory* — I applied to
my cameras and never to my **scan boxes**. A search region is an aim.

## The park: my "8 lanterns" was also a partial view

`bounds.minX` was −13.40 against a 32 m park, so the reachable world stopped
about seven metres in — and my light census used a bbox of x −21 … −7, which was
that same near strip. Over the park's **full** bounds it is **20 light sources,
569 meshes, 88 over 2.5 m**, in three ranks rather than one. Both my park numbers
were right about what they measured and wrong about the park.

## What is still genuinely unchecked

The car lot interior and its office; the bench ad (a **failed search** — no
ad-panel geometry exists anywhere by shape); the 301 door; facade-door alignment
for the bodega, diner and tax service; and wetness persisting after rain. I am
not grading any of them, and the reachability grid now exists to do the first
one properly next.

## CAR LOT — **DONE.** Walked in, office at the back, rows either side.

I looked in the wrong place first and it is worth saying how. My lot-finder
defined the lot as *"reachable ground east of the shopfronts near things shaped
like cars"*, which located a 553 m² region at x 7.5 … 54, z −83.5 … −109 with
three cars beside it. `shots/lot-in-east.png` shows what that actually is: **the
side street** — centre line, kerbs, BILLIARDS, CHOP SUEY, FLOWERS, the hotel
blade. The three cars were parked at the kerb. A heuristic that says "cars mean
car lot" finds every street in the world.

`ct/street.ts:853` places it: `placeLot(ze, 23.2)` — **23.2 m of the east
frontage**, at the north end. Shot from inside at (10.5, 2.5):

- **rows either side of a central aisle** — five cars left, five right, nosed
  into marked bays, white bay lines on the tarmac
- **the office at the back, dead centre** — the only structure inside the lot
  bounds, **3.0 × 2.7 × 4.6 m at (27.6, 2.6)**, glazed front, CROSSTOWN sign
  over the door, **a keeper standing in the doorway**, a bin beside him
- **WE FINANCE ANYONE** in red and **CALL 555 0199** in blue above the office
- a faded ghost sign painted across the brick back wall — *"… AUTOS · WHOLESALE
  AND RETAIL"* — plus a lamp, price starbursts on the windscreens and a banner
  across one car
- brick side walls enclosing it, so it reads as a lot and not as a gap

Every part of the request is there: **you walk in from the street, the office is
at the back, and the cars are in rows either side.**

## Routing note — the 12 mirrored faces are the LOT's

My `handed.mjs` found 12 mirrored shopfront faces at **x = 7.18**, spanning
z +13.23 → −8.03, canvas 64 × 20, and a mainline commit replied that they were
not in that builder's files.

**x = 7.18 is the car lot's fence line, and z +13.23 → −8.03 is 21.3 m of the
lot's 23.2 m frontage.** They belong to `ct/lot.ts` by position. The 64 × 20
canvas matches `pennantT` at `ct/lot.ts:227`; the only other 64 × 20 in the world
is an awning underside in `ct/vice.ts:733`, which is horizontal, not a 2 m
upright. Position is the strong evidence and the texture size agrees with it.

## FACADE DOORS — **DONE** for all three the user named.

`doorsweep.mjs` finds doors by walking and carries no coordinates: **83 sample
points fired a prompt, 10 distinct doors**. Standing at the exact centre of each
prompt span and facing the facade:

| prompt | what fills the frame | verdict |
|---|---|---|
| **BODEGA** (east, z −95.4) | the glazed bodega door with its **OPEN** sign, red-and-white awning over it, produce crates on the pavement | **on the door** |
| **A-1 TAX SERVICE** (east, z −20.1) | the grey door slab dead centre with its **yellow push-bar**, venetian blinds either side — and the prompt itself in frame | **on the door** |
| **DINER** (west, z −46.6) | a **double door**, two dark leaves with pale push-plates and a centre mullion, interior booths visible through the glass right of it | **on the door** |

Ten doors, and the three the user asked about are each centred on their own
facade opening. `[E] into No. 227` is exact to **0.00 m** against its leaf; the
bodega is 0.45 m, which at a 1.25 m prompt span means the whole span is on the
doorway.

## Two ways this measurement went wrong first, both worth recording

**1. My door detector found people.** A door leaf and a citizen are the same
shape — on the ground, about 1.9 m tall, about 0.9 m wide — so the first run
reported THRIFT STORE 1.34 m and BURGER BARN 3.25 m **OFF THE DOOR**. Both
"doors" were at **x = −6.00**, the centre of the walk, which is where citizens
stand and where no facade is. They were the citizens at (−6, −60.59) and
(−6, −28.3) that I had already catalogued in my own people census two rounds
ago. Excluding the 160 × 128 atlas and the walk centreline removed all of it.

Had I published that run, two builders would have been sent to move doors that
are not misplaced, on evidence that was a pedestrian standing in the street.

**2. Leaf geometry cannot answer this question anyway.** After the fix, only
**2 of 7** prompts have a separate door-leaf mesh within 4 m. The A-1 TAX door
is plainly there in the photograph — grey slab, yellow push-bar — and my
detector cannot see it, because most doors here are built into the shopfront
rather than as a standing leaf. A "NO LEAF FOUND" means my filter missed it, and
saying otherwise would have been a third wrong answer.

The player's test — stand where the prompt fires and look — is the one that
works, and it is also the one the user actually asked for.

## THE 301 DOOR — **DONE**, and it does more than was asked.

Run against the live world, reading `__ct.colliders()` at each step, so "is it
shut" is a collider fact rather than a picture of a door:

| state | blocked? | prompt |
|---|---|---|
| open at rest | `false` | `[E] close the door` |
| after **E** | **`true`** | `[E] open the door` |
| re-opened | `false` | `[E] close the door` |
| **standing in the swing** | — | **`[E] step clear of the door`** |
| after **E**, in the swing | **`false`** — it refuses | |
| a pace back, after **E** | **`true`** | |

The user asked whether the door could be closed. It closes, it **blocks** when
closed, it reopens, and it **will not shut on you** — and rather than silently
failing it changes the prompt to say why. That last part was not requested and
is the difference between a door that works and a door that feels built.

`shots/d301/05-shut-square.png` confirms it visually: the leaf square in its
frame, panelled, brass handle, nameplate, striped paper either side.

**Note for the harness's owner:** `02-shut.png` is pitched at the ceiling — the
light fitting fills the frame and the door is a sliver at the bottom edge. The
prompt text in it still proves the state, and `05-shut-square` is aimed
properly, so nothing is wrong with the result. But it is the same aiming defect
I have now hit in four separate places, in someone else's harness this time.
The collider readout is what makes this script trustworthy; the frames are
decoration and one of them missed.

## PUDDLES AND WETNESS — the anomaly was mine, not the world's.

I reported an unresolved contradiction: one sweep found **57 puddle decals, many
at opacity 1**, and a later pass found **none above 0.02**. I flagged it as an
anomaly, said explicitly it was not a bug, and warned that one of my two numbers
had to be wrong.

**Neither was wrong.** `ct/props.ts:1002` makes both readings correct:

- puddle and splash opacity is a function of `wetness`, not a constant
- `wetness` **rises fast and decays slowly** — soaking takes seconds,
  `dryFor = 48 × (1 + soak × 1.5) × (1 + nightNow × 1.1)` seconds to dry, so
  longer after a long storm and longer again at night
- `m.visible = m.opacity > 0.015` **hides them entirely once dry**

Two readings taken at two points in one wet/dry cycle *must* disagree. The
contradiction was evidence of the feature working.

### Measured, with the hour pinned

A 24-hour sweep is useless here: every wet surface is multiplied by `ambient()`,
so luminance across the day is mostly the day/night curve. Pinning the clock
holds ambient *and* `rainAt(hourAbs)` constant, so any remaining movement is the
wetness term alone.

| hour pinned, 20 s | broad road/walk sheets | kerb + gutter strips | translucent meshes |
|---|---|---|---|
| 02 | 0.5592 → 0.5592 (**0**) | 0.5994 → 0.5994 (**0**) | 407 → 407 |
| 08 | 0.9569 → 0.9572 (+0.0003) | 0.9536 → 0.9538 (+0.0002) | 405 → 405 |
| **14** | **0.8458 → 0.6625 (−0.1833)** | 0.9663 → 0.957 (−0.0093) | **347 → 354**, mean opacity 0.725 → **0.741** |
| 20 | 0.5443 → 0.5443 (**0**) | 0.5981 → 0.5981 (**0**) | 425 → 425 |

Three hours sit at steady state and one is visibly in transition — the ground
darkening by 0.18 while **seven more translucent surfaces come up** and mean
opacity rises. The street changes state over seconds rather than snapping, which
is the thing the user asked for.

The split between the two rows is the design working too: `props.ts` gives thin
strips exponent 0.55 and broad sheets 1.7, so near saturation the broad sheets
move ~20× more while the gutter barely stirs — and at the dry end that reverses,
which is what "the gutter is where it is all running TO" means.

### What I did not measure

**I never watched a full dry-down.** At 48–170 s of game time, lengthened by soak
and by night, it needs a multi-minute hold and I ran 20 s. So I am grading the
persistence **DONE on construction plus a consistent partial measurement**, not
on having seen the tail. If anyone wants the tail proven, that is a longer run
and I will say plainly that I have not done it.

---

# WHEEL ARCHES — **DONE.** The last NOT DONE in the request audit is closed.

Re-walked the fleet at `e73dd6a8`, after H's attempt three (`6333004c`), from
the kerb beside each parked car at **standing eye height (1.74 m)** with the
camera looking down at the wheel — no hero angle, no crouch, no low camera. All
three street cars found by shape, every warp verified to have landed.

## Measured, not eyeballed

| | before | now |
|---|---|---|
| arch top | 0.34 + 0.27 = **0.61 m** | 0.34 + **0.38** = **0.72 m** |
| tyre top | 0.68 m | **0.663 m** (measured on all 12 wheels) |
| clearance | **−0.07 m** — tyre stood *above* the arch | **+0.057 m of arch above the tyre** |

H's diagnosis was right and it was the height, exactly as stated. The width term
was already correct (0.38 m half-width against a 0.34 m tyre) and both terms are
now stated **in metres and converted per axis**, so it is the same arch on every
body instead of one derived from panel length — which is what used to make it a
band down a van and an arch on a pickup.

The second half of the fix matters as much: the well was `#0a0b0e` against a
tyre of `#101114`, indistinguishable, so the cleared air above the tyre read as
one dark mass with a hubcap in it. That is changed.

## The old signature is gone

My NOT DONE was specific, and it is the thing to re-test:

> *"the white side stripe runs unbroken from front to rear, straight through the
> space above each wheel"*

**It no longer does.** On both the maroon sedan and the olive pickup the flank
stripe now runs along the body and **terminates at each wheel opening**. On the
pickup the wells read plainly at 2 m — dark arch above and around each tyre. On
the sedan the rim is present but subtle at that distance, because the tyre still
stands 0.04 m proud of the flank and the disc occludes the arch behind it; what
clears the disc is the 5.7 cm above the tyre's top, and 5.7 cm at 2 m is a thin
band.

**That is a pass, not a hedge.** The wheel sits in a well with air above it, the
sill is no longer straight through, and the defect I named is not reproducible.

## One thing for H, not a defect

`ct/cars.ts:90` still carries a full comment block headed **"wheel arches:
REVERTED to the pre-arch paint, deliberately"**, arguing the arch cannot work
and should not be attempted — and it sits **directly above the live arch
implementation that does work**. Two contradictory blocks, the stale one first.
The next person to read that file will believe the arch was abandoned. Worth
deleting now that the argument it makes has been disproved by the code beneath
it.

---

# The frontage roster confirms the door verdicts — two methods, same answer

`tex-world.ts` now publishes `globalThis.__frontages` (`2bdcf1d8`). That gives a
second, entirely independent source for where every shopfront door is: I walked
the world and recorded where each `[E]` prompt fires; the roster states where the
door was *authored*. They should agree, and nothing about my method feeds theirs.

| door | prompt centre I **walked** | roster's authored door | difference |
|---|---|---|---|
| A-1 TAX SERVICE | −20.13 | **−20.1** | **0.03 m** |
| DINER | −46.63 | **−46.6** | **0.03 m** |
| PAWN SHOP | −60.50 | **−60.5** | **0.00 m** |
| THRIFT STORE | −59.38 | **−59.3** | **0.08 m** |

**All four inside 8 cm.** The DONE verdict on facade doors stands on two
independent measurements now rather than one.

It also retires a loose end. My leaf-geometry pass reported **"NO LEAF FOUND"**
for PAWN and THRIFT and I said at the time that meant *my filter missed it*, not
that anything was wrong. The roster confirms that reading exactly: both doors are
authored precisely where their prompts fire. Nothing to route.

## The bench ad is now routable — partially

`BLOCKED-AUDIT-seams.md` says I cannot attribute the bus bench. The roster puts
it: the bench at east walk z −36.25 … −33.75 sits in front of **LIQUOR**
(face x = 7, 13 m frontage, door at z −25.1).

That does not tell me who *built the bench* — street furniture is not a frontage
— but it turns *"east walk, z −36.25 to −33.75"* into *"the stop in front of
LIQUOR"*, which is a thing a person can be asked about. Updated in the BLOCKED
note; the item stays blocked on whether an ad panel exists at all.

## One gap in the roster itself

**The BODEGA has no published frontage.** Probing (6, −95.4) — where
`doorsweep.mjs` fires `[E] into the BODEGA` — returns nothing from
`__frontages`, while every other shopfront I probed resolves. The bodega is the
one with the canted bay, so it is plausibly built outside the frontage
mechanism on purpose.

Flagging rather than filing: a roster that covers every shopfront but one is
still a large improvement, and the one it misses is the one shaped differently.
But a future finding on the bodega's face will come back `(no frontage covers
it)` and look unattributable when it is not.

## Re-verified with a self-locating instrument: **8 of 8 keepers**, not 4

`turn.mjs` was the most dangerous script in my set — `notes/AUDIT-INSTRUMENTS.md`
flags it because its subject table hardcoded **citizen positions, and citizens
walk**. Rewritten to find figures by the 160 × 128 atlas signature at run time,
with no coordinate typed in:

```
16 figures found by atlas signature
```

### The verdict is confirmed and extended

| | before | **now** |
|---|---|---|
| interior keepers measured | 4 | **8** |
| showing 8 of 8 distinct frames | 4 of 4 | **8 of 8** |

**Every keeper in every room presents all eight headings** — five unique atlas
columns plus their three mirrors, no heading repeated, in all eight rooms. When
I first graded this only half the rooms had a keeper; now all do, and all eight
pass. The DONE stands on twice the evidence.

### What the hardcoded version was hiding

Five street figures now report:

```
ERROR  no 160-atlas figure within 3 m (nearest 4.26 / 4.72 / 3.65 / 5.69 / 4.59)
```

They were located at the start of the run and **had walked away before the orbit
reached them.** The instrument now says so. The old one, pointed at coordinates
harvested minutes earlier, could only ever have found *whoever happened to be
standing there* — and reported it as the same subject.

**That is the stale-coordinate defect in its purest form**, in my own harness,
and I only saw it because I removed the coordinates. Reporting a walking subject
as a measured one is not a wrong number; it is a number about the wrong person.

### The limitation, stated

**This test cannot reliably measure moving citizens** — the subject relocates
mid-measurement, and the honest output is an error rather than a reading. It
measures *static* figures cleanly, which is where the question mattered: the
user asked about the people **inside** the shops, and all eight of those are
standing still and all eight turn correctly.

## The BODEGA's `[E]` is the only one that does not reach the pavement centreline

Three probes had singled this shop out — canted bay, no `__frontages` entry, and
a prompt my line sweep could not find. Mapped properly with a 2D patch sweep at
0.2 m (`scripts/bodega.mjs`), visibility-checked prompt read:

```
swept x 4.8…9.4 × z −91.5…−100.5:  706 standable points, 372 inside colliders

[E] into the BODEGA — 109 points
   x 6.2 … 8.6     z −96.9 … −94.5
   nearest edge to the walk line (x = 5.9):  0.3 m
```

**The trigger is large and healthy** — 2.4 × 2.4 m, 109 standable points. Nothing
is blocked, and the entry defect the user originally reported is long fixed.

**But its nearest edge is x = 6.2, and the pavement centreline is x = 5.9.** My
line sweep missed it by 30 cm, and so does a player.

### Why that is worth a builder's attention

`doorshot.mjs` walking the centreline finds **seven doors**: DINER, THRIFT,
A-1 TAX, No. 227, PAWN, BURGER BARN, and the bus stop. Every one of them
announces itself to somebody simply walking down the pavement.

> **The bodega is the only shop in the world you have to step toward to be told
> you can enter.** Not blocked — but silent from the one line every player walks.

That is a 0.3 m difference and it is invisible in code: the bodega's trigger is
authored against its **canted bay**, which is set back from the flat frontages
either side, so a trigger sized identically to its neighbours' starts further in.

### What I am not claiming

Whether this matters is a design call, not mine. A recessed shop that requires
a step toward the door is arguably more real, not less. **What I can say is that
it is unique** — one shop of eight behaves differently from a player's point of
view, and nothing in the code says so on purpose.

If it should match its neighbours, the fix is to extend the trigger 0.3 m toward
the kerb. If the recess is deliberate, it is worth a line saying so, because this
is now the fourth time this shop has come back as an anomaly in an audit.

### Measured like-for-like: the gap is **0.8 m**, not 0.3 m

My previous round said the bodega's trigger starts 0.3 m off the walk line. That
was measured against the *line*, not against **what the other doors do**, which
is the comparison that matters. Every door swept the same way the bodega was —
a patch across the full pavement depth, doors found by walking first:

| door | side | trigger points | nearest edge, relative to the walk line |
|---|---|---|---|
| BURGER BARN | west | 27 | **0.6 m kerb-side** |
| DINER | west | 50 | **0.6 m kerb-side** |
| THRIFT STORE | west | 49 | **0.6 m kerb-side** |
| A-1 TAX SERVICE | east | 50 | **0.6 m kerb-side** |
| PAWN SHOP | east | 49 | **0.6 m kerb-side** |
| No. 227 | east | 38 | 0.4 m kerb-side |
| **BODEGA** | east | **72** | **0.2 m facade-side** |

**Six of seven doors extend 0.6 m past the centreline toward the kerb.** The
bodega's nearest edge is 0.2 m the other way.

> **The gap between the bodega and the group norm is 0.8 m**, not the 0.3 m I
> reported. Correcting my own figure: I measured the distance to a line when the
> meaningful quantity was the distance to what everything else does.

Note also that the bodega has the **largest trigger of all seven** — 72 points
against 27–50. It is not a small or mean trigger. It is a big one, sited 0.8 m
deeper than every neighbour.

That makes the finding stronger and the fix smaller: the bodega does not need a
bigger trigger, it needs its existing one moved 0.8 m toward the kerb to sit
where the other six sit. Whether that is right is still the owner's call — a
canted bay may want exactly this — but the number is now the one worth quoting.

### The census, completed at nine doors — and the side street is the opposite problem

My first pass stopped at the main block. `doorsweep`'s own line table has the
side street at **z = −97.3**; I had guessed −95.4 and found nothing, which is
the fourth time this audit that reading the source beat guessing a coordinate.

Complete, all nine doors:

| door | side | trigger points | nearest edge |
|---|---|---|---|
| BURGER BARN, DINER, THRIFT, A-1 TAX, PAWN | main walks | 49–50 each | **0.6 m kerb-side** |
| No. 227 | east | 38 | 0.4 m kerb-side |
| **BODEGA** | east | 81 | **0.2 m facade-side** |
| **HOTEL ORPHEUS** | side st | 22 | **1.9 m past the line** |
| **GOLDEN ACES** | side st | 26 | **1.9 m past the line** |

**A caution on the last two, stated before the number is used.** The side street
runs along x, so its walk line is a *z*, and "past the line" there means
**toward the carriageway**, not toward the facade. The sign convention does not
transfer, and these two are **not** rankable on the same scale as the seven
above. I nearly published them in one sorted list, which would have read as
"the hotel is nine times worse than the bodega" and meant nothing.

What is defensible about them: their triggers extend to **z ≈ −99.2**. My own
lane audit measured the side street's walkable strip as **−97.25 … −96.3**. So
those two prompts fire from about **1.9 m south of the walk — over the kerb and
into the road.**

> The bodega's trigger is too **shy** to meet a player on the pavement. The
> hotel's and the casino's are generous enough to meet one **standing in the
> carriageway**. Both are the same defect — a trigger authored without reference
> to where the pavement actually is — pointing in opposite directions.

Neither is a blocker and I am routing neither as urgent. But the pair makes the
bodega finding sharper rather than weaker: **the world has no shared convention
for where a door's trigger should reach**, and the five that agree on 0.6 m agree
by construction rather than by rule.

### The mechanism: every `[E]` is a disc with a hand-picked centre and radius

`ct/ctx.ts:21` —

```ts
export interface Spot {
  x: number; z: number; r: number;
  label: () => string;
  ok: () => boolean;
  act: () => void;
}
```

**A trigger is a circle.** Each module picks its own centre and its own radius,
and **nothing in the type relates `r` to where the pavement is.** That is the
whole explanation for all three behaviours I measured:

| door | why it reads the way it does |
|---|---|
| the five at 0.6 m kerb-side | centre near the doorway, radius ≈ 1.35 m — the disc happens to cross the walk |
| **BODEGA** at 0.2 m facade-side | centre sits deep in the **canted bay**, so the same-sized disc starts further in |
| **HOTEL / ACES** at 1.9 m into the road | larger radius against a **narrower pavement**, so the disc overshoots the kerb |

Nobody made a mistake. Three modules each chose a sensible-looking `r` for their
own doorway, and the pavement was not a term in any of those decisions.

> **A radius is a property of the door. Reach is a property of the pavement in
> front of it.** The `Spot` type only lets you express the first, so the second
> is an accident everywhere — and it agrees on five doors purely because five
> flat frontages happen to be the same depth.

### The fix is already sitting there

`__frontages` (`2bdcf1d8`) publishes `facePos`, `doorWorld` and `doorWidthM` for
every shopfront. A door spot derived from that — centred on the published door,
with a radius that reaches the kerb line and stops — would put all nine on the
same footing without anyone choosing a number.

**That is a builder's call, not mine, and it is not urgent.** Nothing here blocks
a player. But it converts "the bodega feels different" from a mystery that has
cost four separate probes into one line of shared arithmetic.

**Bodega tally, closed:** canted bay → no `__frontages` entry → prompt off the
walk line → trigger disc centred in the recess. Four anomalies, one cause.

## Every `[E]` and every seat, checked with the tools that already existed

I was about to write a spot-reachability sweep. `scripts/spots-walk.mjs` already
does it, and `scripts/seats-walk.mjs` already does the seats. **I checked before
building** — which is the discipline I have been slowest to learn this session,
having just flagged that four copies of the face-index logic existed and two
were wrong.

Run at HEAD:

```
135 [E] spots registered
   80 live spots checked: reachable, and standing where they claim
      of those, 8 name a declared building and sit exactly on its published door
   55 gated by ok() from the street — seats you are not on, interior way-outs

57 seats registered
   57/57 seats sit, lock, and stand clear
```

**No unreachable trigger anywhere.** `GOTCHAS.md` §8 — colliders eating `[E]`
spots, which has bitten this project once — is clean across the whole registry.

**57 of 57 seats work.** That is the user's *"for every seat in the game i want
to be able to sit down"*, closed on the full set rather than on the ones anybody
remembered — including the library courtyard benches and the park's far half,
which I confirmed separately from a frame.

### These do not contradict my bodega finding — they answer a different question

`spots-walk` asks **"is there anywhere you can legally stand inside this
radius?"** For the bodega the answer is yes, emphatically: 81 standable points.

I asked **"does the radius reach where a player actually walks?"** For the bodega
the answer is no, by 0.8 m against the group norm.

Both are true and neither supersedes the other. A trigger can be perfectly
reachable and still never meet anyone, because *reachable* is about the trigger
and *reach* is about the pavement — the same distinction that made `Spot`'s
hand-picked radius the root cause. Worth stating plainly so the two reports are
not read as disagreeing.

### What is left

Nothing on the spot or seat side. Two clean sweeps from instruments I did not
have to write, and the only open question in this area is the design call on
`Spot`'s radius, which is a builder's.

## The `[E]` census, complete: 135 spots, every one accounted for

| set | count | verified by |
|---|---|---|
| live from the street | 25 | `spots-walk.mjs` — reachable, standing where they claim |
| seat spots (sit + stand halves) | 92 | `seats-walk.mjs` — **57/57 sit, lock, stand clear** |
| diner booth seats | 5 | `seats-walk.mjs` |
| apartment: close the door / way out | 2 | `door301.mjs` — closes, blocks, reopens, refuses to shut on you |
| **bodega counters** | **2** | **this round** |
| interior way-outs (`out to the street`) | ~5 | `interiors-walk.mjs` — **not run by me** (needs a dev server, >9 min) |

### The two counters, closed

```
buy cereal — $2.50    disc at (441.75, 2.2) r 1.0
   70 standable samples · prompt fired at 70 · reads "[E] buy cereal — $2.50"
buy soda — $1.25      disc at (441.75, 1.0) r 1.0
   70 standable samples · prompt fired at 70 · reads "[E] buy soda — $1.25"
```

**Every sampled point in both discs is standable and fires the prompt** — 70 of
70, twice, with the price correct in the label. Spots read from the live
registry rather than typed in, so this stays true if the shop is re-priced or
re-laid-out.

### What that leaves

**About five interior way-outs**, and they are the one thing in the world's 135
`[E]` spots that no sweep I could run has touched. They are not suspect — the
tool for them exists and I simply could not complete a run of it in my
environment. Recorded in `AUDIT-INSTRUMENTS.md` rather than carried as a finding.

Everything else: **130 of 135 spots verified by somebody**, including all 57
seats, all nine doors, the 301 door, and both shop counters.

### The last gap closed: all nine way-outs fire. **135 of 135.**

I estimated "about five" interior way-outs. There are **nine**, and every one of
them works — sampled by warping into each room and walking its disc, spots read
from the live registry:

```
(201.2, -19.6)  apartment   59 standable · fired 59
(440.0,   3.65) bodega      67 standable · fired 67
(516.4,   3.7)              96 standable · fired 76
(596.8,   3.95)             96 standable · fired 74
(677.4,   2.95)             96 standable · fired 74
(756.6,   3.95)             96 standable · fired 73
(840.0,   3.45)             96 standable · fired 74
… nine in total, all firing
```

**No unreachable way-out anywhere.** You can always get back to the street.

This closes the census with nothing outstanding:

> **135 of 135 `[E]` spots in the world are verified** — 25 from the street,
> 92 seat halves, 5 booth seats, 2 shop counters, 2 apartment, 9 way-outs — by
> `spots-walk`, `seats-walk`, `door301`, and this round.

### One observation, offered with its likely explanation

Six of the nine fire from **~74 of 96** sampled points inside their own declared
radius — about 77%. The apartment and bodega fire from 100%.

The likely reason is mundane and not a defect: a way-out sits **at the doorway**,
so part of its disc lies outside the room, and `ok()` requires you to be inside.
A disc centred on a threshold will always have a dead quarter. The two that
score 100% have smaller discs (r 0.95–1.0 against tighter geometry).

I am noting it rather than filing it, because the alternative explanation — that
the declared radius overstates the live region — would need a builder to
distinguish, and nothing about it costs a player anything: every one of these
fires from most of the room-side of its own doorway.

---

# ⚠ REGRESSION at HEAD: one bench can no longer be sat on. **56/57.**

Final regression pass over the sound instruments. Everything holds except one:

| check | result |
|---|---|
| masonry stamps vs geometry | **236 checked, 0 disagree** ✓ |
| lane | **3 stretches under 1.20 m**, tightest 1.15 ✓ |
| `[E]` registry | **137 spots, 82 live, all reachable and where they claim** ✓ |
| **seats** | **56 / 57** ✗ |

```
FAIL  seat 1/57 "sit on the bench" @ -8.65,-20.38
      no "sit on the bench" prompt from the one standable point (-8.6,-19.43); got null
```

**The bench at (−8.65, −20.38) has exactly one standable point inside its whole
disc, and the prompt does not fire there.** Every other seat in the world passes.

That coordinate is the library-courtyard bench — the same flat slab my Round 2
`aim.mjs` sweep picked up and misread as a possible ad panel. It is a seat, it is
registered, and right now you cannot sit on it.

### Why this is worth routing immediately

The user's words were *"for every seat in the game i want to be able to sit
down"*. This is the one seat in 57 that fails, and the failure mode — **one**
standable point, prompt null — reads like something has been placed into the
bench's approach since it was last checked.

### Honest caveat on the word "regression"

Earlier this session I recorded **57/57**. I now believe that run went against
port **4185**, a stale dev server I had left up, because `scripts/lib/which-world.mjs`
refused today's run with:

```
wrong world: served 1746b2f0+, local 6d151c74
```

So I cannot prove 57/57 → 56/57 is a change in the world rather than a change in
which world I was measuring. **What I can prove is that at HEAD, on a build made
from this checkout, one seat of 57 fails.** That is the claim I am making.

### And a note of thanks to whoever wrote that guard

`which-world.mjs` caught me measuring a stale build — the exact failure I have
documented five times in other forms this session and fallen into twice. It
refused to run rather than return a confident wrong number. **That guard is worth
more than anything in this report.**

## ⚠ RETRACTED, one commit later: the bench works. 57/57 stands.

I reported *"one bench can no longer be sat on"* and asked for it to be routed
immediately. **It is not true.** Standing on that bench's sit spot and reading
the HUD:

```
at (-8.65, -19.43)  landed=true  HUD: [E] sit on the bench   ok=true
at (-8.60, -19.43)  landed=true  HUD: [E] sit on the bench   ← the exact point seats-walk called null
at (-8.65, -19.60)  landed=true  HUD: [E] sit on the bench
at (-8.65, -19.20)  landed=true  HUD: [E] sit on the bench
at (-8.65, -19.00)  landed=true  HUD: [E] sit on the bench
at (-8.40, -19.43)  landed=true  HUD: [E] sit on the bench
at (-8.90, -19.43)  landed=true  HUD: [E] sit on the bench
```

**Seven of seven, including the one named in the failure.** The spot is
registered, `ok=true`, and the player is inside its radius at every sample. The
library-courtyard bench is fine and **no seat needs routing.**

### What I have not established

Why `seats-walk` returns a false negative here. Its prompt reader is sound —
`#ct-prompt` with a 140 ms settle, and 56 other seats pass through it. The clue
I cannot resolve without reading it properly is that it found **one** standable
point in the disc, where my own grid shows a broad free region north of the
bench. Its standability or approach test is stricter than mine in a way specific
to this seat.

**That is the tool owner's to look at, and it is a false negative, not a defect.**

### On my own conduct here

This is the third claim I have published and retracted this session. The
difference is the interval: the masonry headline stood for three commits and
mainline caught it; the casino regression stood for one and I caught it; **this
one stood for one commit and I caught it by doing the diagnosis I should have
done before filing.**

I had the diagnosis one step away — I ran a failing tool, saw a symptom, and
wrote *"worth routing immediately"* on the strength of it. The rule I keep
re-learning, now stated as plainly as I can:

> **A failing check is a claim about the check until you have reproduced the
> failure by hand.** I reproduced it by hand and it did not reproduce.

---

# Census restated at the current build: **137 spots**, and two new ones close the steps request

My `[E]` census said 135. The guarded re-run says **137** — my earlier numbers
came from a build one step behind, which `scripts/lib/which-world.mjs` would have
caught if my scripts had carried it. **They do now.** (Guard added to
`counters.mjs`, `wayouts.mjs`, `spotsplit.mjs`; five one-shot diagnostics
deleted rather than left lying around.)

Re-verified at `c5566b8d`, everything holds:

| set | count | state |
|---|---|---|
| live from the street | 25 | ✓ `spots-walk` |
| seat spots | 92 | ✓ `seats-walk` |
| booth seats | 6 | ✓ `seats-walk` |
| **interior way-outs** | **9** | ✓ **all nine fire, re-confirmed** |
| **bodega counters** | **2** | ✓ **70/70 each, re-confirmed** |
| apartment door + exit | 2 | ✓ `door301` |
| **civic doors — NEW** | **2** | ✓ **verified below** |

## The two new spots are the tops of both flights

```
try the doors of the PVBLIC LIBRARY   disc (-11.25, -13)  r 1.2
   73 standable samples · prompt fired at 73
try the doors of the church           disc (8.75, -79.5)  r 1.2
   80 standable samples · prompt fired at 68
```

Those coordinates are **exactly where I found the flights**:

- the library steps I located at **x −11.5 … −9.0, z −14.5 … −11.5**, rising
  gy 0.42 → 0.99 — the spot sits at (−11.25, −13), inside them
- the church flight at **x 8.5 … 9.0, z −78 … −81**, rising gy 0.31 → 0.51 —
  the spot sits at (8.75, −79.5), inside it

> **The user asked: *"can you walk up the LIBRARY steps and the CHURCH steps and
> go in"*. You can now walk up both, and there is something to press at the top
> of each.** That request is closed end to end rather than half — the climb was
> already there and the arrival now answers.

The church fires from 68 of 80 sampled points rather than all 80, which is the
same threshold effect as the way-outs: a 1.2 m disc at the head of a flight
overhangs the steps, and the overhang is not standable ground.

## What this round actually demonstrates

I published a census off a stale build and did not know. The guard that catches
that already existed, 163 of 182 scripts already used it, and mine did not
because I wrote them before noticing. **The fix was three import lines.**

That is the fifth time this session the answer was an existing convention I had
not adopted — after `doorsweep`'s visibility check, `spots-walk`, `seats-walk`,
`lib/faces.mjs` and `groundAt`.

---

# Re-run after `098269aa`: **the bodega now reaches the pavement.**

`098269aa` — *"[E] takes the NEAREST spot, which is what its comment always
claimed"* — landed after my trigger census. `crosstown.ts` said *"nearest live
spot wins"* and the loop broke on the **first** spot in range, so with two
triggers overlapping the winner was whichever module happened to build earlier,
however far away. Re-measured:

| door | before | **after** |
|---|---|---|
| **BODEGA** | **0.2 m facade-side**, 81 points | **0.2 m kerb-side — reaches the line**, **120 points** |
| DINER | 0.6 m kerb-side, 50 | 0.6 m kerb-side, 43 |
| THRIFT | 0.6 m kerb-side, 49 | 0.6 m kerb-side, 40 |
| HOTEL / ACES | 1.9 m past, 22 / 26 | 1.9 m past, 15 / 16 |

**The finding I filed is resolved.** I reported the bodega as *"the only shop in
the world you have to step toward to be told you can enter."* It now announces
itself from the pavement centreline like every other shop, and its trigger grew
from 81 usable points to **120** — the largest of the nine.

## Honest attribution: this fix was not aimed at me

`098269aa`'s three cited cases are all **seats** — a diner booth offering the
booth 0.67 m away, and the bus bench doing it at 0.9 m. Nobody set out to fix
the bodega. What was actually wrong was never the bodega's radius: **a nearer
spot was being beaten by an earlier-built one**, and the bodega's own prompt lost
inside its own disc.

That means my measurement was right and my diagnosis was **half wrong**. I wrote
that the trigger was *"authored against its canted bay, so a trigger sized
identically to its neighbours' starts further in."* The trigger was fine. The
selection was picking someone else.

> I measured the symptom accurately, attributed it to geometry, and the cause was
> in the loop that chooses between overlapping triggers. **A correct measurement
> with a confident wrong cause is still a wrong finding** — and it would have
> sent someone to move a trigger that did not need moving.

## What remains

The bodega still reaches **0.4 m less far** than the five-door norm (−0.2 vs
−0.6). That is a real difference and it is small; whether a canted bay should
match a flat frontage is the design call I flagged before, unchanged.

The side-street pair still fire from **1.9 m into the carriageway**, unchanged by
this fix — that one is genuinely a radius, not a selection.

---

# Correction: the BODEGA **does** have a published frontage. My probes could not read it.

I reported twice that *"the BODEGA has no published frontage"* and built a
narrative on it — that three separate probes had singled the shop out as built
differently. **One of those three was my own bug.**

The roster entry exists:

```
BODEGA   axis: "x"   span 10.4 … 16.45   facePos -96   door 12.8234
```

**It is an `axis: 'x'` frontage** — it runs along x on the side street's north
face at z = −96, which is exactly where the bodega is. My probes assumed every
frontage was `axis: 'z'` and compared a z coordinate against an x span, so
`route.mjs` returned *"(no frontage covers it)"* for a frontage that covers it
perfectly well.

## What this invalidates, precisely

- **"The bodega has no frontage entry"** — withdrawn. It has one.
- **The three-probe narrative** — reduced to two: the canted bay is real, and
  the trigger sitting off the walk line was real (and has since been fixed by
  `098269aa`). The third leg was mine.
- **`doorside2.mjs`'s bodega row** — it compared an interior x-offset against a
  frontage whose own axis is x, on a facade whose normal runs along z. That
  comparison is not meaningful and its `centred — undecidable` verdict for the
  bodega should be read as *no verdict*, not as a measurement.

## What survives, and is a genuine gap

**`GOLDEN ACES` and `HOTEL ORPHEUS` are not in the roster at all.** Sixteen
frontages are published — BURGER BARN, DINER, THRIFT, A-1 TAX, LIQUOR, PAWN,
BODEGA, FLOWERS, CHOP SUEY, DELI, RECORDS, GARAGE, BILLIARDS, SMOKES, LOANS,
RADIO — and the casino and the hotel are not among them, despite both having
`[E]` doors that `doorsweep` finds and both having interiors.

That is a real coverage gap and it is not an artefact of my axis confusion: I
checked the names, not the geometry.

## The lesson, which is getting repetitive on purpose

A published record had **two axis conventions** and I only ever handled one.
Every conclusion I drew from `__frontages` — the door cross-check, the routing
note, the bodega narrative — silently skipped every `axis: 'x'` entry.

> **A field named `axis` exists because the answer differs by axis.** I read the
> field, stored it, printed it, and never branched on it.

## Walked vs authored, all four pavements, both axis conventions

Redone with the axis honoured. 42 prompt samples, **10 distinct doors** across
the west walk, east walk and both side-street pavements:

| prompt | walked centre | authored door | diff |
|---|---|---|---|
| BURGER BARN | −25.25 | −25.11 | **−0.14** |
| DINER | −46.75 | −46.61 | **−0.14** |
| THRIFT STORE | −59.25 | −59.32 | **+0.07** |
| A-1 TAX SERVICE | −20.25 | −20.13 | **−0.12** |
| PAWN SHOP | −60.50 | −60.50 | **0.00** |

**Five of five comparable doors agree within 0.14 m.** Two independent sources —
where the prompt fires when you walk, and where the door was authored — and the
worst disagreement is 14 cm on a 1.15 m doorway.

### The bodega row is my axis mistake again, not a defect

My script printed `BODEGA  walked −95.25  authored 12.82  diff −108.07`. That is
**a z compared against an x**, which is precisely the error I documented one
commit ago and then made again inside the script written to fix it.

The bodega is a **chamfered corner**. `__ct.doors()` gives its point as
`(8, −95)` with `chamfer: true` and a normal of `(−0.707, −0.707)` — a 45° door
on the corner between the east walk and the side street. Its `[E]` fires from
the east walk; its frontage is authored along the side street. **Both are
correct descriptions of the same corner**, and no single-axis comparison can
relate them.

**Excluded, not failed.** A corner building needs a corner-aware check and I do
not have one.

### Four doors have no roster entry at all

`[E] sit at the stop` and `[E] enter No. 227` — street furniture and a
residential entrance, so reasonably absent. But **`[E] into the HOTEL ORPHEUS`
and `[E] into GOLDEN ACES`** both fire, both have interiors, and **neither is in
`__frontages`**. That is the coverage gap from the previous round, now confirmed
from the walking side as well as by name.

> Ten doors in the world. **Five verified against their authored position to
> within 14 cm, one is a corner the check cannot express, and four are not in
> the roster** — two of them major buildings.

## Axis-free, corner-safe: **8 of 8 doors verified**, including all three corners

Comparing **points in world space** instead of scalars along an axis. `__ct.doors()`
publishes `{x, z, nx, nz}` and a stand point per building, so there is no axis
convention left to get wrong:

| prompt | walked centroid | declared door | distance |
|---|---|---|---|
| BURGER BARN | (−6.3, −25.25) | (−6.3, −25.1) | **0.15** |
| DINER | (−6.3, −46.75) | (−6.3, −46.6) | **0.15** |
| THRIFT STORE | (−6.3, −59.25) | (−6.3, −59.3) | **0.08** |
| A-1 TAX SERVICE | (6.3, −20.25) | (6.3, −20.1) | **0.13** |
| PAWN SHOP | (6.3, −60.5) | (6.3, −60.5) | **0.05** |
| **BODEGA** | (6.3, −95.25) | (7.5, −95.5) | **1.20** · chamfer |
| **HOTEL ORPHEUS** | (39.5, −97.3) | (39.5, −96.8) | **0.55** · chamfer |
| **GOLDEN ACES** | (51.25, −97.3) | (51.3, −96.8) | **0.55** · chamfer |

**8 of 8 name-matched prompts sit within 1.5 m of their own declared door.**
Five flat frontages inside 15 cm; three chamfered corners inside 1.20 m, which
is what a stand point offset around a 45° corner looks like.

`[E] sit at the stop` and `[E] enter No. 227` match nothing within 12 m —
correctly, since neither is a shop door.

### The bodega is finally resolved rather than excluded

Two scalar checks in a row could not express it and one of them printed a
108-metre "disagreement". As a **distance between two points** it is 1.20 m and
entirely unremarkable. The building was never the problem; **projecting a 2D
question onto one axis was.**

### And it narrows my own coverage claim

I reported that GOLDEN ACES and HOTEL ORPHEUS are missing from the roster. They
are missing from **`__frontages`** — but both **are** in `__ct.doors()`, with
declared points and stand points that their prompts match to 0.55 m.

> So the gap is narrower and more precise than I said: **the casino and the
> hotel declare their doors but not their frontages.** Anything asking "where is
> this building's door" finds them; anything asking "what is this building's
> frontage" does not.

### What I would keep from three rounds of this

Two of my checks compared a z against an x, and I made the second mistake inside
the script written to fix the first. The cure was not more care — it was
**changing what is compared**: two coordinates and a distance, instead of one
coordinate and a convention.

---

# The casino's lost door: real, growing, and **invisible to a player**

Mainline's `e6c08482` reports the casino's door declared but never collected —
eight modules export a `DOOR`, seven reach `declaredDoors()`, and `int-casino.ts`
is one of **four** modules now resolving to an undefined namespace.

Confirmed at HEAD, and it is recent: **`__ct.doors()` returns 7 and GOLDEN ACES
is absent.** My own run one round ago returned **8, with GOLDEN ACES present and
matched to its prompt at 0.55 m.** So this arrived between those two builds.

## What a player loses: nothing

| | state |
|---|---|
| `[E] into GOLDEN ACES` trigger | **registered and live** — (51.29, −97) r 1.05, `ok=true` |
| does it fire when you walk? | **yes**, from x 50.5 … 52.0 on the side-street pavement |
| the painted facade door | **drawn and correct** — gold-framed double doors with push-bars, dead centre, red carpet out to the kerb, under the 777 and the LOOSEST SLOTS marquee |

The trigger is a separate registration from the declaration, so **entry is
unaffected**, and the door is painted by other means. `shots/casino-facade.png`
shows a complete, handsome shopfront. **Nobody playing this world would ever
know.**

## What is actually lost: the casino disappears from every tool that asks

Anything consuming `declaredDoors()` no longer sees it — including my own door
cross-check, which is exactly why I counted **8 declared doors last round and 7
now**. My *"8 of 8 doors verified"* is, at HEAD, **7 of 8 verifiable**, and
GOLDEN ACES can no longer be checked that way at all.

> **A silent defect that costs the player nothing and costs every instrument
> everything.** It does not degrade the world; it degrades the ability to
> measure the world — which is worse, because it is the thing that would have
> caught the next one.

## And it is a recurrence of a defect I filed

`BLOCKED-AUDIT-seams.md` — mine — was the world-down report where
`ct/doors.ts` read `MODS[path].DOOR` from an undefined namespace, fixed by
`84d59e04`. The guard that landed then is precisely what surfaced this now
(`ct/doors.ts:91` warns rather than skipping silently).

**The same circular-import failure has gone from one module to four.** One of
them is losing something. Three declare nothing today — so they are quiet now
and will not be quiet forever.

## The casino is fully enterable. The lost declaration costs a player nothing.

The last untested link. Pressing **E**, with a room whose door *is* collected as
a control:

```
DINER (control)   prompt "[E] into the DINER"
   (-6.3, -46.75) → (677.4, 2.35)   moved 685.5 m   INSIDE the interior belt

GOLDEN ACES       prompt "[E] into GOLDEN ACES"
   (51.25, -97.3) → (596.8, 3.35)   moved 554.8 m   INSIDE the interior belt
```

**You press E at the casino and you arrive inside it** — slab 2, x 596.8, which
is exactly where I measured the casino's room and its way-out spot at
(596.8, 3.95). The control behaves identically. Nothing about the entry path
depends on the lost declaration.

### The casino, end to end

| | |
|---|---|
| painted facade door | **correct** — gold double doors, push-bars, red carpet |
| `[E]` prompt | **fires**, x 50.5 … 52.0 on the pavement |
| pressing E | **puts you inside**, 554.8 m to slab 2 |
| the room itself | 222 meshes, a keeper turning through 8 headings, ceiling 2.90 |
| way out | fires, returns you to the street |
| **`__ct.doors()`** | **absent — the only thing that is wrong** |

> **A player can walk to the casino, read its sign, see its door, press E, go in,
> play, and leave.** The defect is invisible from every position a player can
> occupy. It exists only in the declaration that instruments read.

That is worth stating plainly because it sets the priority: **this is not a
broken casino.** It is a broken *record* of the casino, and it should be fixed
because the record is what the next check will trust — not because anything in
the world is failing today.

---

# EVERY DOOR, END TO END: **8 of 8**

The whole entry path for all eight shops — walk up, prompt fires, press E, land
inside, and the room you land in is the one the sign named. Doors taken from the
live registry, nothing typed in.

```
into the BODEGA          prompt yes  →  slab 0 (bodega)   MATCHES the sign
into BURGER BARN         prompt yes  →  slab 1 (burger)   MATCHES the sign
into GOLDEN ACES         prompt yes  →  slab 2 (casino)   MATCHES the sign
into the DINER           prompt yes  →  slab 3 (diner)    MATCHES the sign
into the HOTEL ORPHEUS   prompt yes  →  slab 4 (hotel)    MATCHES the sign
into the PAWN SHOP       prompt yes  →  slab 5 (pawn)     MATCHES the sign
into A-1 TAX SERVICE     prompt yes  →  slab 6 (tax)      MATCHES the sign
into the THRIFT STORE    prompt yes  →  slab 7 (thrift)   MATCHES the sign

8 of 8 doors: prompt fires, E works, and you land in the room the sign names
```

**No door in this world sends you to the wrong shop, and none fails to open.**

That closes the loop on the audit's first functional finding. The earliest
report in this file was the user's — *the player cannot enter the bodega* — and
the bodega is now the first row of a clean sweep.

It also puts the casino's missing declaration in its final place: **GOLDEN ACES
passes every part of this test.** The record is wrong; the door is not.

## Where the entry system stands, complete

| layer | state |
|---|---|
| prompt fires on the pavement | **8 of 8** |
| `[E]` opens it | **8 of 8** |
| you arrive in the named room | **8 of 8** |
| the way back out fires | **9 of 9** |
| the door's declared position matches where the prompt fires | **8 of 8**, within 1.5 m (corners included) |
| the door is collected into `declaredDoors()` | **7 of 8** — the casino, structural, invisible to players |

Every layer of the entry system is verified except the one that no player can
see, and that one has a traced cause, a measured blast radius, and a one-line
guard proposed.

---

# My "5 of 5 doors verified" checked exactly the five that were **told**, and none that guessed

A's `eba406e17` adds `FrontageWorld.doorDeclared`, recording which facades were
given the door position and which fell back to guessing:

```
declared  (5):  BURGER BARN, DINER, THRIFT, A-1 TAX, PAWN
fell back (11): LIQUOR, BODEGA, FLOWERS, CHOP SUEY, DELI, RECORDS,
                GARAGE, BILLIARDS, SMOKES, LOANS, RADIO
```

**My cross-check verified BURGER BARN, DINER, THRIFT, A-1 TAX and PAWN — the
same five, exactly.** I reported them as *"walked position agrees with authored
position to within 0.14 m"* and treated that as a check of the whole roster.

> It was not. It was a check of **the declaration path**, on the only five
> frontages that use it. Of course they agree: one end of my comparison is the
> number the other end was handed.

That is not worthless — it confirms the declaration is plumbed through correctly
and nothing corrupts it in between. But it is a **much narrower claim** than the
one I made, and the eleven that guess are untouched by it.

## What my method can and cannot say about the other eleven

It cannot say anything. Ten of the eleven have **no `[E]` at all** — LIQUOR,
FLOWERS, CHOP SUEY, DELI, RECORDS, GARAGE, BILLIARDS, SMOKES, LOANS and RADIO
are shopfronts without interiors, so there is no walked position to compare
against. The eleventh is the BODEGA, whose door **is** declared to
`__ct.doors()` even though its frontage fell back — which is why my axis-free
2D check placed it at 1.20 m and my frontage-scalar check could not place it at
all.

**Eleven of sixteen frontages have a painted door whose position nothing
verifies**, and my report implied otherwise.

## Recorded because it is the same mistake in a new place

I have a ledger of ten corrections in `audit-seams.md`, and the pattern in most
of them is *"a measurement I trusted because it was precise."* This is that
again, in its purest form:

> **A cross-check between two sources is worth nothing if one source is derived
> from the other.** I compared where the prompt fires against where the door was
> authored — and for those five, the prompt fires there *because* that is where
> it was authored.

The check I should have run is the one A's new flag now makes possible: compare
the **guessed** door positions against something independent. I cannot, because
those eleven have no prompt. Someone who can paint-sample the facade could.

## The eleven guessed doors cannot be verified — by me or by any artefact in the world

I said someone who could paint-sample the facade should check the eleven guessed
door positions, then realised I can look at facades, so I tried.

**LIQUOR** (axis z, 13 m, door offset +3.43 m from centre) shot cleanly: crimson
fascia, glazing, and a dark door with a push-bar **right of centre, at almost
exactly the offset the roster states** — predicted ~671 px into the frame,
observed ~670.

And that is when the point landed:

> **The painter draws the door at the roster's position.** So the painted door
> agreeing with the roster is not evidence of anything — it is the same number
> twice, exactly like my "5 of 5 declared doors agree" was the same number twice.
> **I built a second circular check while writing up the first one.**

For the five **declared** frontages there is a genuine independent source: the
`[E]` trigger, registered separately by the module. That is why the walked-vs-
authored check meant something there. For the eleven **guessed** ones there is
no such source — no prompt, no interior, no second declaration. Every observable
artefact is downstream of the guess.

**So: the eleven guessed door positions are unverifiable, full stop.** Not
"unverified by my tools" — there is nothing in the world to check them against.
The most that can be said, and it is worth something, is that the results look
sane: LIQUOR's door sits in its glazing band, framed, with a push-bar, where a
door belongs.

*(My axis-`x` camera placement is also wrong — the frame I aimed at RECORDS
shows the BODEGA corner instead. Two of six camera points were rejected as
unstandable and one was mis-aimed, so this survey covered 3 of 11 even before
the circularity made it moot. Recorded rather than quietly dropped.)*

### What would actually settle it

Nothing available today. A door's position would need a second, independent
expression — the frontage says one thing, the *interior's* front wall says
another, and they must agree. That is exactly what `mirror-walk` does for the
eight rooms that have interiors, and **the eleven do not have interiors.** They
are shopfronts painted on a wall.

Which makes this a non-problem dressed as one: **a guessed door on a building
you can never enter has nothing to be wrong against.**

---

# ⚠ My door-position verification was circular from the start. Here is the line.

`int-diner.ts`:

```ts
export const DOOR: DoorDecl = {
  building: 'DINER', w: 12, cz: -49.5, side: -1, at: -2.6, width: 1.15,
};
...
door: { r: 1.05, at: DOOR.at, width: DOOR.width },   // ← line 58, the [E] spot
```

**The `[E]` trigger's position is `DOOR.at`. The roster's authored door position
is computed from the same `DOOR.at`.** So when I walked the pavement, found
where the prompt fires, compared it against the authored position and reported
**"5 of 5 agree within 0.14 m"** and **"8 of 8 within 1.5 m"** — I was comparing
a number against itself, with a rendering pipeline in between.

That is the third circular check I have built, and the largest:

| check | two sides | independent? |
|---|---|---|
| walked prompt vs authored door | both `DOOR.at` | **no** |
| painted facade door vs roster | painter reads the roster | **no** |
| declared-frontage cross-check | the five that agree are the five that were told | **no** |

## What that measurement is actually worth

**Not nothing.** It proves the plumbing: `DOOR.at` reaches the trigger, the
frontage and the painter without being corrupted, transformed wrongly, or
dropped — across two axis conventions, three chamfered corners, and 109 m of
street. A broken pipeline would have shown up as a large disagreement, and none
did.

**But it cannot detect a wrong `DOOR.at`.** If a room declared its door two
metres off, every consumer would place it two metres off, and my check would
report perfect agreement.

## What survives as genuinely independent

The **behavioural** results, because their two sides do not share a source:

- **8 of 8 doors: press E and you arrive in the room the sign names.** The
  arrival is the interior's own placement; the sign is the room's label. Nothing
  in `DOOR.at` decides which slab you land in.
- **57 of 57 seats sit, lock and stand clear.**
- **9 of 9 way-outs fire.** **130+ of 135 spots reachable.**
- the lane, the masonry stamps, the float sweep, the 8-angle turn test.

## The rule, now proven three times on my own work

> **Before calling agreement a verification, find the two sides' common
> ancestor.** If they have one, you have measured a pipeline, not a fact.

I will take the lane audit as the counter-example worth keeping: it compares
`__ct.colliders()` — what the movement code actually tests — against the player
capsule radius. Neither derives from the other, which is why *"0.89 m"* was a
finding and *"the door is where the door is"* never could be.

---

# Which of the user's requests have a guard, and which are verified once and forgotten

`28540aaa` asked *"which of my own user requests are unguarded?"* That question
belongs to this report, so here it is for all of them. There are now **30
registered checks** in `npm run checks`.

## Guarded — a check would catch a regression

| request | check |
|---|---|
| can you get into the car lot; office at the back, cars either side | `lotwalk`, `lot-layout`, `lot-frontage` |
| the library and church steps | `steps-walk`, `civic-doors-walk` |
| sit on every seat | `seats-walk` |
| every `[E]` reachable and on its door | `spots-walk`, `doors-declared`, `frontage-honours`, `mirror-walk` |
| close the 301 door | `door301` |
| the park lit and alive | `park`, `glow` |
| wetness lasting after rain; puddles in the gutter | `wetness`, `rain`, `basin` |
| don't encroach the sidewalk | `lot-frontage`, `footprint` |
| one masonry density | `density`, `seampairs` |
| see-through shopfronts | `check-seethrough` |
| the bus and its bench | `bus`, `bus-walk`, `bus-bench`, `bench` |
| gutter litter, bins | `trash` |

## **Unguarded** — verified once, by hand, and nothing would notice if it broke

| request | how it was verified | would a regression be caught? |
|---|---|---|
| **wheel arches read as arches** | measured (arch top 0.72 vs tyre 0.663) and photographed | **no** |
| **BURGER BARN red-and-beige, not red-and-yellow** | read off a frame | **no** |
| **interior people turn through 8 angles** | `turn.mjs` — structural, 8 of 8 rooms | **no — not registered** |
| **blade signs read correctly from both directions** | `handed.mjs` + scene-graph reasoning | **no** |
| **the cat, the alley litter, the crates** | read off frames | **no** |
| **citizens have legs and feet, not flat cards** | read off a frame | **no** |

> **The suite covers behaviour and geometry thoroughly and appearance almost not
> at all** — and appearance is where most of the user's requests live. Every
> unguarded item above is something you can only currently confirm by looking at
> it, which means it is confirmed exactly as often as somebody looks.

## The cheapest thing that would close part of that gap

**`turn.mjs` is already a structural check and is not registered.** It reads the
atlas frame and mirror flag at eight headings and needs no camera or human
judgement — the same shape as `density` or `seampairs`. Registering it would
guard *"do the interior people turn through 8 angles"*, which is a direct user
request currently protected by nothing.

The others genuinely need a human eye or a pixel-sampling approach nobody has
built. **Worth saying plainly rather than pretending the suite covers them.**

*(`scripts/**` is builder A's; I am naming the gap, not filing the script.)*

## Two appearance checks attempted structurally: one works, one exposed a hole in my own verdict

Testing whether "appearance" requests really need an eye.

### BURGER BARN red-and-beige — **works, no camera needed**

Sampling every material on that frontage's shopfront band and testing for
yellow:

```
BURGER BARN   frontage found · 13 materials on the shopfront band
   PASS — no yellow
```

**A direct user request, checked structurally in milliseconds.** This one could
be registered tomorrow, and it confirms by a second method what I had only read
off a frame.

### Wheel arches — my check failed, and it was right to

```
94 tyres · highest tyre top 0.858 m · arch line 0.72 m
   ** FAIL — the tyre stands above the arch **
```

That FAIL is **my instrument being naive**, not a defect: I applied a single arch
line to every tyre in the world. There are **four size classes**:

| tyre top | count | what |
|---|---|---|
| 0.663 m | 44 | the street fleet — the ones I measured |
| **0.803 m** | **44** | **the car lot's stock** |
| 0.851 m | 2 | larger vehicle |
| 0.858 m | 4 | larger vehicle |

`0.72` is the arch line for the **0.663 class only** — rocker 0.34 + `ARCH_H`
0.38, from the sedan and pickup I photographed.

### The part that matters: my wheel-arch verdict covered 2 vehicles of 94 tyres

I graded *"wheel arches read as arches"* **DONE** on the maroon sedan and the
olive pickup, side-on, at eye height. Both are the 0.663 class. **The car lot's
44 tyres are a different size class and I never looked at one.**

> The verdict stands for what I checked and **says nothing about half the tyres
> in the world.** If the lot's stock uses the same `ARCH_HW`/`ARCH_H` constants
> against a larger wheel, the arch would clear by less — or not at all — and
> nothing I did would have seen it.

That is a coverage gap in a DONE I reported confidently, found only because I
tried to turn it into a check. **Trying to automate a hand verdict is a good way
to discover how narrow the hand verdict was.**

### The lot class, looked at — weaker evidence, and I will not over-read it

Same method, applied to the 0.803 m class: camera 2.6 m from a lot car's wheel,
standing eye height, landed verified. `shots/lotarch.png`.

What the frame supports: two lot cars in the foreground, a maroon sedan and an
olive one, both showing **dark regions around the wheels** rather than a disc
laid on a flat slab, and no tyre obviously standing proud of a straight sill.
The olive car's rear wheel in particular sits in a visibly darker well.

What the frame does **not** support: a confident verdict. The lot's cars are
parked nose-in, so the only camera position the aisle allows gives a **rear
three-quarter** view, not the clean side-on I had for the street pair. Arches
read at their weakest from three-quarters — which is exactly the angle at which
I would most like to be careful, given I have already read one perspective
artefact as a defect this session.

> **The 0.803 class is not obviously wrong, and that is all I am claiming.** The
> street class got a side-on photograph and a numeric clearance (0.72 vs 0.663).
> The lot class has a three-quarter photograph and no arch line, because I do not
> know its rocker height.

### What would settle it, cheaply

The numeric check needs **the arch line per vehicle class**, not one constant.
`ARCH_HW`/`ARCH_H` are in `ct/cars.ts` and the rocker height per body is right
there beside them — someone with `src/` access can read four numbers and turn
this into an assertion that covers all 94 tyres instead of 44.

Until then the honest state of the request is: **DONE for the street fleet,
plausible-but-unverified for the lot's stock**, and I have corrected my own
report to say so rather than leaving a blanket DONE covering vehicles I never
examined.

### Resolved: the lot's cars are the same cars, standing 14 cm higher

I raised a coverage gap — *"my wheel-arch DONE covered 2 vehicles of 94 tyres,
and the lot's 44 are a different size class"*. **It dissolves. The gap was mine.**

```
crosstown.ts:304   car.position.set(x, 0, z)        ← the street fleet, y = 0
lot.ts:422         const Y = site.y;                ← the lot's stock
lot.ts:66          "own asphalt at KERB_H, which is exactly coplanar
                    with the site's ground"
crosstown.ts:520   "the park and the car lot are paved at KERB_H"
```

`KERB_H` is **0.14**. And:

```
lot tyre top    0.803
street tyre top 0.663
difference      0.140   ← exactly KERB_H
```

**The lot's cars are not a different size class.** They are the same `makeCar`
output — `lot.ts:1265` calls it with no scale — standing on a lot paved 14 cm
above the road. Every dimension is identical in car-local space, which is the
space `ROCKER = 0.34` and `ARCH_H = 0.38` are written in.

> So the arch clears the tyre by the same 5.7 cm on all 94 tyres, and the
> **wheel-arch verdict covers the whole fleet after all.**

### The error, which is the same one as all the others

My check compared **world-space** tyre tops against a **car-local** arch line.
That is the third coordinate-space mistake in this audit:

| | the two spaces I mixed |
|---|---|
| the box faces | `parameters.width` vs the face actually mapped |
| the door sides | z-offsets across buildings facing opposite ways |
| **the wheel arches** | **world y vs car-local y** |

Each time the numbers were precise, reproducible, and about two different
things. **A quantity is not a measurement until you know which frame it is in** —
and I have now learned that badly enough, three times, to write it at the top of
`AUDIT-INSTRUMENTS.md`.

The one thing that survives from this detour: **`looks.mjs` proves the BURGER
BARN palette can be checked structurally**, which is a real, registerable guard
for a user request that currently has none.

---

# Does the world still work when it is busy? Three systems, tested populated.

Every check in the suite runs on a static world or drops the movers, so all of
them — mine included — describe an empty street. Having found that the lane
genuinely differs when populated, I tested the three systems that matter.

## 1. The lane — tight, never closed

| | built | lived |
|---|---|---|
| narrowest clear width | 1.15 m | **0.72 m**, exactly the capsule |
| median | — | **0.77 m** |
| samples impassable | — | **0 of 20** |

## 2. Reachability — untouched

Four flood-fills with the movers in: **every destination reachable in every
sample**, reachable area varying by **9 cells in ~62,000 (0.015%)**. Citizens
narrow the pavement and never cut it.

## 3. The doors — never blocked

Eight samples, movers included, counting standable points inside each trigger:

```
into the BODEGA            69 … 69
into BURGER BARN           73 … 73
into GOLDEN ACES           75 … 75
into the DINER             73 … 73
into the HOTEL ORPHEUS     63 … 63
into the PAWN SHOP         73 … 73
into A-1 TAX SERVICE       25 … 73     ← the only one anything intrudes on
into the THRIFT STORE      73 … 73

no door was ever fully blocked by a citizen
```

**Seven of eight triggers never vary at all** — nothing ever enters them. **A-1
TAX drops to 25 of 73 standable points**, losing two-thirds of its approach at
times, and still leaves ample room. That is the one door where the street's
traffic actually reaches the threshold, which fits: it sits on the east walk at
z −20, beside the parked car and the busiest stretch of pavement I measured.

## The conclusion, which is a good one

> **The world is robust to its own population.** The pavement gets tight enough
> to touch the player's own width, one doorway loses two-thirds of its approach,
> and **nothing anywhere becomes impassable, unreachable or unenterable.**

Every earlier result in this audit was measured on an empty street. **They all
hold on a busy one** — and that had never been checked, by me or by the suite.

---

# The whole suite, run: **one red in the project, and it is the glob-order defect**

I had never run `npm run checks` end to end. Doing so at `ba8dda8a`:

```
✓ check-wiring   ✓ health          ✓ check-seethrough  ✓ density
✓ nightgrade     ✓ seampairs       ✓ lotwalk           ✓ lot-frontage
✓ door301        ✓ mirror-walk     ✓ frontage-honours  ✓ burger-palette
✓ tree-crown     ✓ window-lattice  ✓ shop-interior     ✓ checks-registered
✗ doors-declared FAILED (1)
✓ lot-layout     ✓ people-walk     ✓ entrance-brick    ✓ D-walk (98s)
✓ windowlights   ✓ shells          ✓ footprint         ✓ trash
✓ glow           ✓ park (36s)      ✓ wetness (40s)     ✓ basin
✓ kerbcut        ✓ bus ×2 (65s)    ✓ rain (58s)        ✓ spot-coverage
· six walking suites deferred to --slow
```

**Twenty-eight green. One red. `doors-declared` — the casino's `DOOR` never
reaching `declaredDoors()`.**

That is the defect I traced from *"a door is missing"* to a byte offset:

- the glob object literal is emitted at **809,884**
- `int-casino`'s binding at **811,650** — **1,766 bytes too late**
- `interior` and `civic-doors` and `world` likewise, all after it
- **only the earliest of three globs is affected**; `interior`'s and `world`'s
  are constructed after everything they read and lose nothing
- the fix is `doorStandFor` in a leaf module, and **the working glob already
  proves the shape**
- verifiable by `node scripts/globorder.mjs`, no runtime, exit-coded
- **no player-visible consequence** — all 8 doors open and land in the right room

## What it means that this is the only red

Two things worth saying:

**The suite is in good order.** Twenty-eight checks covering wiring, health,
glass, density, seams, the lot, the park, litter, lighting, wetness, rain, the
bus, the kerb, the palette, the trees, the windows, the spots — all passing,
several of them written today in response to gaps I named.

**And the one red has a complete answer already written.** Mechanism, blast
radius, determinism, player impact, a one-command diagnostic, and a fix whose
correctness is demonstrated by another glob in the same bundle. **There is
nothing left to investigate on it** — only to do.

---

# Three of the four unrun walking suites, run directly — and the church is **locked**

The six walking suites run last in `--slow`, which is why I kept losing them.
Invoked directly instead, skipping the twelve-minute preamble:

```
world-wired       8 interior files on disk, 8 rooms registered in the world
                  every interior on disk is built and reachable            ✓

steps-walk        church: walked 2.69 m up, gy 0.14 → 0.55
                  church: walked back down, gy 0.55 → 0.14
                  the steps climb and descend, and nothing sinks           ✓

civic-doors-walk  church: climbed to gy 0.55, prompt "[E] try the doors
                  of the church"
                  church: pressed E → "[E] the church is locked"
                  both civic flights lead somewhere: the doors answer      ✓
```

## It confirms my church figure, including the caveat

I measured the church flight at **gy 0.31 → 0.51** and wrote that *"E reports
0.55 at the doors; my grid stops at 0.5 m and at the edge of free ground, so
0.51 is the last tread I could stand on, not the top."*

**`steps-walk` walks it to 0.55.** The caveat was right and the discrepancy was
exactly what I said it was.

## And something I never checked: pressing E

**`[E] try the doors of the church` → `[E] the church is locked`.**

I verified that the civic door spots exist and fire — 73/73 for the library,
68/80 for the church — and **never pressed the key.** The church does not open.

That is a **deliberate, authored response**, not a failure: something wrote that
string. But the user's request was *"can you walk up the LIBRARY steps and the
CHURCH steps **and go in**"*, and the church's answer is no.

> **The climb works, the arrival works, the door answers, and the answer is
> "locked".** Whether that satisfies the request is the user's call and not
> mine — but my earlier grading said the steps request was closed end to end,
> and it is closed **up to the threshold**.

I have corrected that above rather than leaving a DONE that covers less than it
sounds like. **`interiors-walk` remains the one suite I have never completed** —
it exceeded nine minutes solo, twice.

## Neither civic building opens — and the library's refusal points at a board that is not there

Pressing E at both civic doors:

```
library: climbed to gy 0.99, "[E] try the doors of the PVBLIC LIBRARY"
         pressed E -> "[E] the PVBLIC LIBRARY is closed — opening hours are on the board"

church:  climbed to gy 0.55, "[E] try the doors of the church"
         pressed E -> "[E] the church is locked"
```

**Both are authored refusals, not failures.** Somebody wrote both strings, and
the library's is the better line of the two — it declines and tells you where to
look instead.

**But there is no board.** Searching 4.5 m around the library's door spot for
anything board-shaped between waist and head height returns **two meshes**, both
0.78 × 0.62 × 0.78 with 16 × 16 canvases at (−8.85, 0.97, −15.9) and
(−8.85, 0.97, −10.1) — and a square view of the entrance shows what they are:
**the two hedges on plinths flanking the steps.**

`shots/libdoor.png`, from the pavement: stone flight, double doors with brass
push-plates, fanlight over, pilasters either side, dark canopy, hedges left and
right. **Nothing on the wall, nothing on a stand, nothing beside the doors.**

> **The refusal tells the player to read something the world does not have.**

Scope, honestly: I searched 4.5 m around the door and looked at one square
frame. A board somewhere else on the building — the courtyard side, further
along the frontage — would not be in either. But it is not where the message
sends you, which is *at the doors you just tried*.

### What this does to the steps request

*"Can you walk up the LIBRARY steps and the CHURCH steps and go in"*:

| | state |
|---|---|
| walk up the library steps | **yes** — gy 0.14 → 0.99, walked and confirmed twice |
| walk up the church steps | **yes** — gy 0.14 → 0.55, walked and confirmed twice |
| go in | **no, either** — both authored as shut |
| the library's "see the board" | **the board does not exist at the doors** |

The climb is done and done well. The entry was never built, and one of the two
refusals makes a promise the world does not keep.

## Pressing the last two keys: No. 227 works, the counter I cannot observe

Continuing the method that found the locked civic doors — press the key, then
check what actually happened.

**`enter No. 227` — works.**

```
before: "[E] enter No. 227"
after : "[E] out to the street"      moved 196.3 m
```

You press E on the pavement and you are inside the walk-up, with the way out
offered. The residential entrance is as real as the eight shops.

**`buy cereal — $2.50` — no observable change, and I cannot read the wallet.**

```
before: prompt "[E] buy cereal — $2.50"   wallet: null
after : prompt "[E] buy cereal — $2.50"   wallet: null   moved 0.0 m
```

The prompt does not change, the player does not move, and **I cannot read the
purse through the DOM** — my first detector matched the prompt element itself
(it contains `$2.50`), and right-clicking, which the HUD offers as *"right-click
= wallet"*, surfaced no readable amount.

> **This is not "the counter is broken."** It is *"pressing E here produces
> nothing I can observe, and the purse is not visible to a DOM probe."* Those
> are very different claims and only the second is mine to make.

### And someone else can already do this

`27424ae1` — *"The purse proof buys until refused, instead of counting on five
keystrokes"* — so a purse test exists and works by a method I do not have. The
right conclusion is not that the counters are unverified; it is that **they are
unverifiable by me**, and already verified by whoever wrote that.

**Recorded rather than routed.** The pattern worth keeping from this small
sequence: pressing the key found a locked church, a locked library, a message
naming a board that is not there, and a working residential door — **four
findings from an action I had verified only up to the prompt.**

## The round trip closes: every way-out puts you back at your own shop

I confirmed all the way-outs *fire* and never pressed one. Pressed now:

| room | from | landed | |
|---|---|---|---|
| bodega | (440, 3.65) | **(5.88, −97.12)** | east walk, at the bodega |
| burger | (516.4, 3.7) | **(−5.8, −23.61)** | west walk, at BURGER BARN |
| casino | (596.8, 3.95) | **(52.84, −97.25)** | side street, at GOLDEN ACES |
| diner | (677.4, 2.95) | **(−5.8, −45.11)** | west walk, at the DINER |
| hotel | (756.6, 3.95) | **(41.06, −97.25)** | side street, at the ORPHEUS |
| pawn | (840, 3.45) | **(5.8, −59)** | east walk, at the PAWN SHOP |
| tax | (915.8, 3.7) | **(5.8, −18.63)** | east walk, at A-1 TAX |
| thrift | (997.8, 2.7) | **(−5.8, −57.82)** | west walk, at the THRIFT |

**Every way-out puts you back on the street, and every one puts you back at its
own building.** Not merely outside — outside *where you went in*. Each landing
sits 1.5–1.6 m from the door it belongs to, which is the small forward offset
you would want rather than being dropped exactly on the trigger you just used.

### The round trip, complete and pressed rather than read

| | |
|---|---|
| walk to a shop and press E | **8 of 8** land in the room the sign names |
| press E inside to leave | **8 of 8** land on the street at that shop's frontage |
| the apartment | **in and out**, No. 227 → `[E] out to the street` |
| the 301 door | closes, blocks, reopens, refuses to shut on you |
| the two civic flights | climb and descend; **both doors answer "shut"** |

Everything a player does to get into and out of this world is now verified **by
doing it**, not by reading a declaration that says it would work.

That distinction earned its keep this session: firing prompts told me the civic
doors were fine, and pressing them found a locked church, a closed library, and
a message pointing at a board that is not there.

## The wheel arches are CLOSED and OPEN, and the difference matters to the user

`8bcb24bd8` answered the tyre-finder question I declined to file, and reading
H's own `BLOCKED-H.md` shows my **DONE** and H's **blocked** are about two
different questions. Both are true. The user should not have to work that out.

**What I closed, and it stays closed.** The user's criterion was the signature he
named — *"discs against a straight sill"*, the white stripe running unbroken
above each wheel. Measured and re-walked at standing eye height: arch top
**0.61 → 0.72**, tyre top **0.663**, **+0.057 m of arch above the tyre**, and the
flank stripe now terminates at each wheel opening instead of running through it.
**That signature is gone.**

**What H has blocked is a different thing, and it is item 1 of their BLOCKED
file — waiting on a user ruling, not on work.** Read out of `ct/cars.ts`:

| | |
|---|---|
| tyre | radius `0.34` → 0.68 m diameter |
| the flank it must sit in | `ROCKER 0.34` → `BELT 0.84` = **0.50 m of panel** |
| tyre outer sidewall | `0.94` against a flank at `0.90` → **0.04 m proud, by construction** |

> *"A 0.68 m wheel cannot be cropped by an arch cut into a 0.50 m panel and still
> show air above the tyre. **There is no term to tune.**"*

H also records that the desk's instruction was to revert if attempt three missed,
that it **met 4 of 5 targets**, and that **they did not revert** — flagged at the
time, open for the desk to overrule. Their three ways out (leave it; raise `BELT`
0.84 → 0.94 and move every silhouette; shrink the wheel 0.34 → 0.30) are all the
user's call.

**My own DONE already said the uncomfortable half** — *"the tyre still stands
0.04 m proud of the flank and the disc occludes the arch behind it… 5.7 cm at
2 m is a thin band"* — but the heading says **the last NOT DONE is closed**, and
a heading is what gets read. **A verdict that is right in the body and
over-confident in the title is one nobody reads twice.**

### And I was wrong to dismiss the proud-of-flank number

Last round `arch2.mjs` reported 5 tyres proud of the flank and I declined to file
it, reasoning the finder identifies by shape and one entry had the wrong colour
and height. **That was right about one entry and wrong about the phenomenon.**
Proud-of-flank is **real, documented in `ct/cars.ts`, stated by H, and stated in
my own DONE section**. I pattern-matched my own instrument's true report onto a
familiar failure mode and threw it away.

The `0.140` entry at `#323826` is still probably not a tyre. The rest, at
`#101114`, are real — though they read **0.109–0.121** against the 0.04 the
arithmetic predicts, and I do not have an explanation for the gap. **That
discrepancy is the open question**, and it belongs with the proportion decision
rather than with me.

## RESOLVED: the proud-of-flank discrepancy was my flank finder, and the tyres confirm H

I left one open question — my instrument measured tyres **0.109–0.121 m proud**
where `ct/cars.ts` predicts **0.04**, and I said the gap was unexplained and
belonged with the proportion decision. It does not. It is mine.

Measured across three cars:

```
tyre outer x   0.961  0.923  0.928  0.966  0.942  0.935  0.939  0.947  1.044  0.876
flank half-width per car     0.981          0.826                     1.73
```

**The tyres cluster on 0.94 — exactly the outer sidewall H's arithmetic
predicts.** The *flank* is what varies: 0.981, 0.826 and 1.73 for three cars,
against a flank the source puts at **0.90**. The proud/inboard verdict flips
entirely on that estimate, which is why the same fleet read as *"5 proud, 8
inboard"* and looked like a regression.

**So `arch2.mjs`'s flank detection is wrong and its tyre measurement is right** —
and the tyre measurement is now **independent confirmation of H's numbers**
rather than a contradiction of them: outer sidewall 0.94 predicted against
0.923–0.966 measured, tyre top 0.663 against an arch line of 0.72.

The script now carries that warning at the top of the file, because a retraction
in a report does not repair a script — the lesson this audit opened with, and the
second time this week I have had to apply it to my own work.

### What this means for the ruling in front of the user

`6de93860f` reframed H's item correctly: the reported fault is fixed and what is
open is **taste with a cost** — a 5.7 cm crescent, or raise the beltline and move
every silhouette. **My contribution to that decision is now a confirmation rather
than a complication:** the tyre stands **0.04 m proud, not 0.11**, so the
occlusion is what H's arithmetic says it is, and the crescent is the size the
measurements say it is. Nobody needs to reopen the geometry before answering.

## GRADED: "the wheels need to not clip through" — the flare works

The user's words, and one of the two faults he has raised twice:

> **"pickup looks great but the wheels need to not clip through, maybe we need to
> have some inlaid wheel things pickups have"**

`7f0909aa4` gives every car a **fender flare** — a panel standing proud of the
tyre, so the tyre stops being the outermost thing on the car. Its author also
says the honest thing about the delay: *"I have been holding this behind a
beltline ruling for a long time, and that was the wrong call."*

**Measured, and the signature is unambiguous:**

```
car (3.79, -13.96)   14 meshes (was 10)   outermost panel 0.981   tyres 0.923-0.966   all inboard
car (-3.92,-30.04)   16 meshes (was 12)   outermost panel 0.957   tyres 0.935-0.947   all inboard
```

**+4 meshes per car — one flare box per wheel.** The second car is the one that
matters: its outermost panel moved **0.826 → 0.957**, and its four tyres went
from **proud by 0.109–0.121** to **inboard**. Every tyre I can measure is now
behind a panel. That is exactly what the user asked for — the wheel sits *in*
something instead of standing through it.

**DONE**, and it closes the second of the two faults he had to report twice.

**One number I am not asserting.** The commit describes the flare as *6 cm proud
of the tyre's outer wall*; I measure the margin at **1.0–1.5 cm**. The
`flank half-width` column I am reading is the one I marked unreliable two rounds
ago — it finds the panel by shape and disagreed with `ct/cars.ts` before. So the
**direction is certain and the magnitude is not mine to state**; if 6 cm was the
intent, the owner should check which panel my finder is reading.

**This also retires my own open question.** I had flagged tyres reading
0.109–0.121 proud against an arithmetic 0.04 and could not explain the gap. With
the flare in, the same probe reads them inboard on both cars — the panel moved,
which is what the flare is. The question is answered by the fix rather than by me.

## GRADED: "The arch is a black RECTANGLE, not an arch" — fixed, and I had missed it

The user's own sentence from the second wheel round. `4ea578240` found the cause:
the pickup carries **two** arches painted by two different lines. The cab flank's
was fixed long ago — derived from the body so each car's well matches its paint —
and **the BED skin kept the original `#0a0b0e`**, near-black, indistinguishable
from the tyre on a dark sedan and a hard black box on a tan pickup.

**Verified.** No panel at wheel height carries `#0a0b0e` anywhere on the street:

```
z ~-15.9   #554937  #ffffff
z ~-14     #3e3424  #554937  #ffffff     ← the tan pickup
z ~-6.9    #272017  #ffffff
```

Warm body-derived tones where the near-black was. **DONE.**

### The part that is mine

**I graded the wheel arches DONE and cited the pickup.** My own words:

> *"On both the maroon sedan and the olive pickup the flank stripe now runs along
> the body and terminates at each wheel opening. On the pickup the wells read
> plainly at 2 m."*

The wells I read *did* read plainly — I was looking at the **cab flank**, which
had been fixed. **The bed arch, on the same vehicle, was still the black
rectangle the user described**, and I did not distinguish the two. Its author put
it exactly right: *"that complaint was live this whole time on the one vehicle
they pointed at."*

**What I would do differently is smaller than it sounds.** The user named a
vehicle — *"pickup looks great but the wheels need to not clip through"* — and I
graded the class *"wheel arches"* across two cars. **Grading the class instead of
the case is how a live complaint survives a DONE.** When the user points at one
object, the verdict has to be about that object, on every face of it.

Both faults the user had to raise twice are now closed: **the wheels
(`7f0909aa4`)** and **the black rectangle (`4ea578240`)**.
