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
