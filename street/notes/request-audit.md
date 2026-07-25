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
