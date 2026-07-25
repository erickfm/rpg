# Every open finding, graded by whether a player can see it

3,400 lines of audit across five reports, and until Round 8 of `seam-audit.md`
I had **never once** graded a finding by whether it is visible. I found that out
by nearly routing a builder to fix twelve mirrored faces that turn out to be
symmetric triangles — technically flipped, visually identical.

> **Establishing that a defect is real is not the same as establishing that it
> matters.**

So this is the pass I owed. Everything I still hold open, ranked by player
impact rather than by how cleanly I could measure it. The desk should route from
this file, not from the severity tables in the individual reports — those rank
by measurement confidence, which is a different thing.

> **Entry #0 (masonry junctions) was RETRACTED on the same day it was filed.** It
> was an error in my own instrument — a `BoxGeometry`'s four side faces are not
> all `parameters.width` across, and I measured every box against its narrow
> edge. Pattern #1 is clean by declaration *and* by measurement.
> See `seam-audit.md` — RETRACTION.

## Route these

| # | finding | can a player see it? | where | evidence |
|---|---|---|---|---|
| 1 | **sign/meter post leaves 0.90 m** of walk at z −71.4, west | **Yes — it is felt, not seen.** 0.90 m against a 0.72 m capsule is the tightest squeeze in the world | `ct/props.ts` | `lane-audit.md` R4 |
| 2 | **thrift price card floats 0.325 m** above its shelf | **Yes**, standing at the shelf. It is a 0.44 m card hanging in air in a room you walk into | `ct/int-thrift.ts` | `float-audit.md` R3 |
| 3 | **four of eight rooms have no keeper** | **Yes** — half the shops you enter are staffed and half are empty, and the difference is obvious once you have seen both | G's four rooms | `interior-audit.md` R16 |
| 4 | **casino ceiling is 2.50 m**, lowest in the world, while the kit's own docstring names a casino as wanting *more* than 2.9 | **Probably** — 0.90 m against the hotel, and headroom is felt on entry | `ct/int-casino.ts` or the docstring | `interior-audit.md` R18 |

## Record, do not route

| finding | why not | where |
|---|---|---|
| **12 mirrored pennant faces** | The art is a symmetric triangle. Genuinely flipped, provably invisible. **Latent** — matters the day lettering goes through that path | `seam-audit.md` R8 |
| **library ashlar at 9.41 px/m** | Real and off the world's 8/16 grid, but it is a 17% difference on stone, and I cannot show it is visible. Fold into pattern #1 when that is routable again | `seam-audit.md` R7b |
| **BODEGA has no published frontage** | Tooling only. Costs a future auditor an hour, costs a player nothing | `request-audit.md` |
| **rooftop bulkhead at 13.5 px/m** | Does not read as masonry beside a parapet that does. Probably out of scope for the rule | `seam-audit.md` R7c |

## Blocked

**The bench ad** — a failed *search*, not a failed shot. No ad-panel geometry
exists anywhere in the world by shape. Now located as *the stop in front of
LIQUOR*. Needs its owner to say whether it was ever built.
See `BLOCKED-AUDIT-seams.md`.

## Instruments, and what they can still answer

| tool | state |
|---|---|
| `doorsweep.mjs`, `lane3.mjs`, `handed.mjs`, `turn.mjs`, `reach.mjs` | **Sound.** Each verified against a second source or against the code |
| `floats.mjs` | **Sound with a threshold.** 158 bulbs on standoffs are separable from 1 real float by gap size — 0.325 m against a 0.128 m maximum |
| `density.mjs` | **Cannot answer pattern #1.** Its filter is geometric, so foliage, ground decals and signage now sit in a net meant for masonry. Needs modules to declare what a face is — the `userData.mod` pattern already proven by `lot` and `walkup` |

## What I got wrong, kept in one place

Four wrong or unusable results this session, all the same root cause — **a
number that was true when I wrote it down and stale when I used it**:

- the **church** graded NOT DONE from 12,260 points walked on an empty block; it
  had moved to the main frontage
- the **park** graded a dark yard from a census of its near seventh, while 25 m
  of it were unreachable
- the **door alignment** first reported two doors "OFF THE DOOR" when both
  "doors" were **citizens** standing in the street
- the **lot** found by "reachable ground near things shaped like cars", which
  found the side street

Every one was caught before it reached a builder, and every one was caught the
same way: by checking the instrument against a second source rather than by
looking harder at the first.

---

# Re-verified — all four routed items are closed, and one created a regression

Measured at HEAD, not read off commit messages.

| # | item | before | **now** |
|---|---|---|---|
| 1 | tightest walk | 0.90 m (0.89 when I started) | **1.15 m**, and 15 → **3** stretches under 1.20 m |
| 2 | thrift price card floating | 0.325 m | **gone** — no float at that coordinate |
| 3 | rooms with a keeper | 4 of 8 | **8 of 8**, one in every slab 0–7 |
| 4 | casino ceiling | 2.50 m | **2.90 m**; set spread 0.90 → **0.80 m** |

The lane result is worth stating on its own: **the tightest point a player can
squeeze through anywhere in this world has gone from 0.89 m to 1.15 m**, and the
count of sub-1.20 m stretches from 15 to 3. That is the whole of the encroachment
audit closed, by two constants and a tree.

## But raising the casino ceiling left three things behind

The float sweep now finds **three components at 0.29–0.40 m, all in slab 2 —
the casino**, the one room whose ceiling moved:

```
0.40 m at (598.01, 2.22, -1.6)
0.33 m at (603.1,  2.55,  0.4)
0.29 m at (598.01, 2.22,  0.9)
```

**The largest gap is 0.40 m. The ceiling moved 2.50 → 2.90, which is 0.40 m.**

That is not proof, and I am not calling it proof — but a ceiling-mounted fixture
left hanging by exactly the distance its ceiling rose is the obvious reading, in
exactly the room where the change happened, and the two other gaps sit just under
it. Anything anchored to the old ceiling height rather than to `H` would do this.

**Worth knowing that this came from my own recommendation.** I asked for the
casino ceiling to be raised; it was, correctly; and the room's fittings did not
follow. The same re-verification pass that confirmed the fix found its cost,
which is the argument for re-running every instrument after every fix rather
than after every finding.

Routed to whoever owns `ct/int-casino.ts`, with the specific check: **are those
fixtures positioned from the room's `H`, or from a literal 2.5?**

## CORRECTION — the casino "regression" is not one. The fittings were parameterised.

I filed the three casino floats as a probable regression from my own ceiling
recommendation, on the strength of the largest gap (0.40 m) matching the ceiling
change (2.50 → 2.90) exactly. **It does not hold.** `ct/int-casino.ts:361` — a
comment written *before* I looked:

> *"Everything hung off the ceiling is measured **DOWN FROM IT**, not typed as
> an absolute height. Raising this room from 2.5 to 2.9 would otherwise have
> left the valances, the bulb runs and the cage sign stranded 0.4 m low — which
> is how a height change turns into six separate bugs."*

`const BULB_Y = room.H - 0.60;` and, for the glows, *"hung 0.35 m below the
ceiling … down at 2.15 m"*.

Against a 2.90 ceiling my three "floats" are:

| found at y | gap below ceiling | what the source calls it |
|---|---|---|
| 2.55 | **0.35 m** | the glow planes, hung 0.35 m below |
| 2.22 | **0.68 m** | the bulb run, `room.H − 0.60` |

**Every one is a deliberate hang, correctly measured off `room.H`.** The builder
anticipated precisely the failure I hypothesised and wrote the defence for it.
The 0.40 m coincidence is a coincidence.

### The part that stings

**I documented this exact false-positive class myself, one round earlier.**
`float-audit.md` Round 3: 158 small spheres flagged as floating that are bulbs on
standoffs, and my own conclusion was that a fixture standing off its mounting is
not a floating object. I wrote that, then applied the same detector to a
different room and read the same signature as a defect.

> Knowing an instrument's false positives is not the same as remembering them at
> the moment it fires.

Two wrong inferences from measurements in two rounds — the box faces and this.
Both were caught by **reading the source** rather than by measuring harder.
Neither reached a builder, but only because the desk and mainline are fast; this
one I caught myself, one commit later, which is the improvement.

**Nothing to route on the casino.** All four triage items stand closed, with no
regression.

## LIVE RED on mainline: `gotchas-numbers` — §23 used twice

Introduced by `d6cbb61a`, which landed *"Anything with a FRONT will end up
backwards"* as a second **§23** after §32. The registered check catches it:

```
FAILED (2):
  §23 used twice: "Real is not the same as visible — triage by what a player sees"
                  and "Anything with a FRONT will end up backwards"
  §23 appears after §32 — out of order

The LATER commit renumbers: existing references point at the earlier entry.
```

**The check is right and the convention resolves it cleanly.** Both live
citations point at the earlier entry:

```
scripts/lot-frontage.mjs:178   "the thing GOTCHAS §23 is about: real is not the…"
notes/C-frontage.md:192        "exactly what GOTCHAS §23 is…"
```

So the new one should become **§33**. One-line fix, and it belongs to
`d6cbb61a`'s author rather than to me — `GOTCHAS.md` is not a file I edit.

**Worth flagging beyond the fix:** this is the *second* time this exact collision
has happened, and the first is documented in an HTML comment inside §23 itself —
a §22 landed twice while the existing §22 was cited nine times, "including in
that script's own pass/fail output, so a reader following *0 materials break
GOTCHAS §22* would have landed here instead."

A convention that has now been broken twice in the same file, in the same way, is
not a convention people are failing to follow — it is one that needs the check
run **before** the commit rather than after. `gotchas-numbers` is in the fast
tier and takes under a second. My own last full sweep reported it green, which
was true then and is the point: **this red is newer than my report, and a
snapshot of a suite is a claim about a moment.**

## Testing GOTCHAS 23's class claim: the seats are clean, 57 of 57

The newer §23 asserts a class — *"anything with a FRONT will end up backwards"* —
from two hand-found instances: `d5d15797`'s mirrored car row and `d1268485`'s lot
chairs facing the wall. A class claim is worth bounding rather than accepting,
and seats are the part the world publishes enough data to test: each one carries
a seated `pose` with a yaw.

**Convention verified, not assumed.** `park.ts:373` comments facing as
`(sin yaw, −cos yaw)` and `civic.ts:830` puts the stand spot 0.95 m along it.
Checked against a real seat — sit `(−7.43, −92.3)` at yaw −π/2 gives facing
`(−1, 0)`, and the published stand spot is `(−8.38, −92.3)`. Exact.

Marching from every seat along its own facing direction:

```
57 seats · 53 look at open ground for 6 m or more

the 4 that face something within 6 m, nearest first:
   2.55 m  sit down             at (25.45, 4.55)    → 2.8×4
   4.05 m  sit on the bench     at (-8.65, -20.38)  → 0.96×0.96
   4.05 m  sit on the bench     at (-8.65, -5.62)   → 0.96×0.96
   4.15 m  sit on the bench     at (-7.43, -73.9)   → 2.5×2.5

seats facing something closer than 1.5 m: 0
```

**No seat in the world faces a wall.** The nearest anything sits you to an
obstruction is 2.55 m, which is a view rather than a wall. So the class §23
describes is **real but bounded**: it lives in decorative furniture and the
parked fleet, and it does **not** reach the seat system. That is worth knowing
before anyone sweeps 57 seats by hand.

### A false positive I caught in my own probe first

The first run reported one seat facing something at **0.35 m** — *"sit on the
tyres"*, blocker `0.72×0.72`. That is the tyre stack **you are sitting on**: a
0.72 m box centred on the seat still contains a point 0.35 m in front of it, and
my march only skipped the first 0.30 m. The tell was that the number was
suspiciously close to the skip distance. Excluding the collider the seat sits
inside drops it, and the sub-1.5 m count goes to zero.

Worth recording because it is the same error in miniature as three of this
audit's retractions: **the instrument measured something real and I nearly
attributed it to the wrong object.**

This complements `seats-walk`, which proves every seat *seats you*. It does not
prove the rest of §23's class — the cars and the decorative chairs are not
registered seats and are not covered here.

## Fast tier at `cc46ed50`: 44 green, 1 red — and the red is a stale assumption

The tier now runs past twenty minutes and had to go detached to finish at all,
which is worth noting on its own: **it no longer fits in one window.**

```
44 green, 1 red
  ✗ park   FAILED (1)   "could not find the gate entry path — this check cannot answer"
```

**Everything `park` could measure passed** — 10 lanterns lit at 3 am, every one
carrying light, every one 0.95 m clear of the loop, and all four legs of the
circuit walked in both directions with 0.00 m drift. The single failure is its
locator.

### Why it cannot find the entry

`park.mjs:183` finds the entry rather than assuming it: *the narrow path quad at
`y = 0.1445 ± 0.02` whose `+x` edge reaches the street edge at `site.maxX`.* The
park site is **x −39 … −7**, so it wants a path quad touching x = −7. Nothing
does:

```
  x   -6.97  y  0.715   3.4×1.15    +x edge  -5.27   [y excludes it]
  x   -8.27  y  0.74    1.2×1.15    +x edge  -7.67   [y excludes it]
  x  -11.72  y  0.149   0.31×0.31   +x edge -11.57
  x  -11.85  y  0.149   0.36×0.36   +x edge -11.67
```

The things that reach the edge sit at **y 0.715–3.74** — fence and gate uprights,
not ground. The things at path height stop at **x ≈ −11.6, four and a half
metres short.**

**Because the loop was moved on purpose.** `1da5e891` is titled *"The park's loop
reads as a circuit: **brought in off the boundary**, corners turned."* The check
asserts the entry touches the boundary; the design decided it should not.

The check's own comment predicted the wrong half of this: *"the park has been
re-cut twice … a third re-cut could walk one straight into the entry without
anything noticing."* The third re-cut came, and rather than putting a lantern in
the entry it **removed the edge the locator keys on**.

### It should exit 3, not 1

The message already says the right thing — *"this check cannot answer"* — and
then sets `exitCode = 1`, which reads as *the world is wrong*. **GOTCHAS 32
exists for exactly this distinction**, and `ec7aae0d` gave the codebase exit 3
for it. One line, and it belongs to the park's owner along with re-deriving the
locator against a loop that no longer touches the boundary.

## ~~Keeper sectors for the four rooms the decode did not cover~~ — SUPERSEDED

> **Everything in this section is wrong.** `32cb7bd76` found the decode reads a
> stale frame; the corrected table is below it, under "I discarded the only
> correct reading". Do not act on the numbers that follow.

## Keeper sectors for the four rooms the decode did not cover

`64c13034b` decoded keeper facing exactly, using the atlas layout `1aa7a871`
published — `mirror = repeat.x < 0`, `col = offset.x*5 − (mirror?1:0)`, and
`[col,mirror] → sector` a bijection over eight sectors, so one reading from a
known bearing pins the authored facing to ±22.5°. **It verified its own four
rooms** — casino, hotel, tax, pawn. The other four belong to another agent and
were not covered. Applying the same decode from a viewer due **+z** of each
keeper:

| room | col | mirror | sector | facing |
|---|---|---|---|---|
| bodega | 0 | no | **0** | at the viewer |
| casino | 0 | no | **0** | at the viewer |
| pawn | 0 | no | **0** | at the viewer |
| burger | 4 | no | **4** | 180° away |
| diner | 4 | no | **4** | 180° away |
| thrift | 4 | no | **4** | 180° away |

`hotel` and `tax` could not be reached from +z — a counter is in the way — but
`64c13034b` reports both as sector 0. So across all eight: **five face +z, three
face −z, and all three are in the four rooms that were never checked.**

**Stable, and I checked that specifically**: three consecutive runs give the same
six sectors. An earlier run reported `bodega` as sector 2; that was a first-load
transient and did not recur. I am reporting the number only because it repeated.

### What this does NOT establish, and why I am not calling it a defect

**Which side a customer arrives from.** Facing −z is only wrong if the door is at
+z, and I could not read the interior door position from outside — the way-out
spots are not in `spots()` until you are in the room. Without that, a 5–3 split
is an **asymmetry, not a verdict**: three rooms may simply be laid out the other
way round.

So this goes to whoever owns bodega, burger, diner and thrift as a measurement to
check against their own layouts, not as a bug report. The comparison is one line
for them and impossible for me: they know where each counter faces, and
`15f86d64` showed the same shape *was* real in two of the other four rooms —
found by the user, not by a check.

## CONFIRMED, and larger than reported: the litter floats at night — 11 objects, up to 129×

> **Numbers below are TINTS, superseded.** See *"The floating litter — current state"* at the end of this file. The finding holds; the counts do not.


`0d9146049` found this by **looking** at a wet midnight rather than by measuring,
after its own numbers had said the area was fine: litter inside `LAMP_R` takes
the lamp pool while the large shared walk slab cannot, because the pool is
applied per **material** and a big slab takes one value from its own origin. It
reported the fountain cup at **0.488 against 0.008 — 61×**.

Independently measured, with the methods this session's corrections cost me —
**clock stepped** an hour at a time rather than jumped (a jumped night baseline
is 3.4× too bright), each object compared against **the broad sheet nearest it**
rather than a global darkest, and self-lit objects excluded:

```
  object lum   ground lum   ratio   position
      0.5554       0.0043   129.2x   ( 4.75, -48.23)
      0.4420       0.0043   102.8x   ( 5.22, -47.50)
      0.6095       0.0085    71.7x   (-11.72, -79.57)
      0.5420       0.0085    63.8x   (-12.22, -74.29)
      0.4548       0.0085    53.5x   (-12.13, -82.18)
      0.4371       0.0085    51.4x   (-11.88, -75.91)
      0.4324       0.0395    10.9x   (  6.66, -76.28)

small ground objects more than 10× their own ground: 11
```

**Eleven, not two — and in two different places.** The east walk around z −47 to
−48, and **the park path at x −12, z −74 to −82**, which the original report does
not mention. Same mechanism, two areas, so a fix in one will not close the other.

My ratios run higher than the 61× reported because the pairing differs: that
report used the *darkest broad sheet in the frame* (0.008), and I use the sheet
**nearest each object** (0.0043 on the east walk). Neither is wrong; mine is the
more local comparison and the more player-like one, since what you see is the cup
against the ground it is actually lying on.

**A correction inside my own first run**, worth recording: it listed nine objects
at exactly `lum 1.0000` above everything else — all saturated, most of them in
the park lantern cluster at x −12…−16. Those are **lamp bulbs**, which are
supposed to glow at midnight. Excluding `userData.selfLit` and anything saturated
drops them and leaves the eleven above. A brightness sweep that does not exclude
the lights will always rank the lights first.

**This is the most player-visible open finding I hold.** It needs no instrument
to see — a near-white cup on black pavement at midnight — and `5a24c796` and
`0d9146049` both found their defects the same way, by looking at something the
numbers had already passed.

## I discarded the only correct reading, because it was the one that did not repeat

`32cb7bd76` re-decoded the keepers and my table above is wrong. The mechanism is
in the sprite primitive: **`citizenSprite` updates from `ctx.onFrame(HOOK.LATE)`,
so the texture carries the *previous* frame's player position.** A probe that
warps and reads without yielding gets the sector from wherever it stood before.

Adding a two-frame yield after the warp and re-running my own script:

```
  room       col  mir  sector
  bodega       2  no        2      ← was 0
```

**Sector 2 is correct** — `int-bodega.ts` authors facing −π/2, which from a
viewer due +z is sector 2. Confirmed here with the fix applied, not merely
accepted.

### The part that matters

I saw sector 2 in an earlier run. **I threw it away**, and wrote why:

> *"An earlier run reported `bodega` as sector 2; that was a first-load transient
> and did not recur. I am reporting the number only because it repeated."*

Three runs agreed on the wrong answer. Two rounds before that I had written, in
this same audit:

> *"Reproducibility is not correctness: my false anomaly was perfectly
> repeatable, because the mechanism producing it was deterministic."*

And then I used repeatability as my acceptance test anyway — and it **selected
against the truth**. A stale-frame read is deterministic: it returns the previous
bearing's sector every time, so the *wrong* value is the stable one and the
*right* value only appears when the timing happens to slip. My filter was tuned
to reject exactly the reading I needed.

> **Stability is evidence only when the error mode is random.** Against a
> deterministic staleness it is worse than no evidence, because it ranks the
> artefact above the signal. An outlier is not noise until you know what would
> make it one.

The one defence that would have worked was available and I did not use it: the
sector is checkable against `int-bodega.ts`'s authored facing. **The world says
what it intends; I preferred my own repetition to asking it** — which is the
rule I have written twice in these notes for other people's scripts.

The corrected table for all nine sprites is `32cb7bd76`'s, not mine: sectors 0,
2, 4 and **6**, four distinct values including a mirrored one. My *"five face
+z, three face −z"* was an artefact of reading early. It also produced the first
live instance of the `offset.x`-only collision I flagged as latent — the keeper
at x 754.8 decodes as sector 3 instead of 6 without the mirror bit, so that
hazard is no longer theoretical.

## The floating litter, quantified against a target: the night grade reaches the ground and not the object

> **Numbers below are TINTS, and the "day ratio" target here is withdrawn.** See *"The floating litter — current state"*. The kept-fraction reasoning survives; the day-ratio framing does not.


`ad9ba9255` tried widening the ground pool 5.6 → 11.2 m, looked at the picture,
and reverted — correctly, and with the right reason: **the pool decal is
additive**, so at 3.4 m it adds perhaps 0.05 to a ground sitting at 0.008 while
the object's own material is at 0.488. *"A gradient that adds a twentieth cannot
close a gap of sixty."*

That rules out an option but does not say what a fix must achieve. Measuring the
**same objects by day and by night**, paired by position, does:

```
  position            OBJECT day→night         GROUND day→night
  (  4.75, -48.23)    1 → 0.5554 (56% kept)    0.0881 → 0.0043 (4.9% kept)
  (  5.22, -47.50)    1 → 0.4420 (44% kept)    0.0881 → 0.0043 (4.9% kept)
  (-11.72, -79.57)    1 → 0.6095 (61% kept)    0.2678 → 0.0108 (4.0% kept)
  (-12.22, -74.29)    1 → 0.5420 (54% kept)    0.2678 → 0.0108 (4.0% kept)
```

> **The night grade takes the ground down to 4–5% of its daylight value and the
> litter down to only 44–61%.** The object is not over-lit — it is
> **under-darkened**, by a factor of about eleven.

That is the whole defect in one line, and it explains why lighting more ground
cannot help: nothing is wrong with the ground.

**The target is the day ratio.** The same objects sit at **11.4×** their ground
in daylight and **129×** at night; the park items at **3.7×** by day and
**40–56×** at night. A cup being ten times brighter than asphalt is normal and
readable. The fix is not "make the litter dark" — it is *"apply the night grade
to litter at the factor the ground already gets"*, and it is done when the night
ratio is back near the day ratio, not near 1.

Measured over **377 objects paired by position**: median day ratio 0.2×, median
night ratio 2×. So the median object is fine and the tail is the problem, which
is consistent with this being visible at specific lamps rather than everywhere.

### A flaw in my own first pairing, worth naming

My first day-vs-night comparison **lost every object the finding is about**. I
was excluding "self-lit" things as `userData.selfLit` **or `lum ≥ 0.99`** — and
in daylight the bright litter saturates to 1.0 and was dropped as a lamp. The
pairing then quietly compared only the objects that were never interesting.

**Saturation is evidence of emissiveness only against a dark sky.** A threshold
that means one thing at midnight and another at noon cannot be used in a
measurement that spans both. Excluding only what *declares* itself lit restores
all 377.

## `floatlit.mjs` is now a check, with a threshold derived rather than chosen

> **Counts below are TINT-based and superseded** (8 visible → 18). The threshold logic and the selftest are unchanged and correct.


The litter finding has been confirmed twice and had one fix attempt fail. What it
lacked was a way to **tell when it is fixed** and to stop it coming back, so the
measurement now asserts:

```
  211 of 360 objects keep more of their daylight than their ground does
  of those, 8 are also bright enough to see: >10x their ground and lum >0.2
  FAIL the night grade is not reaching these objects

  --selftest
  caught: the live world trips the visible-defect assertion
  caught: a synthetically fixed world is quiet
  caught: divergence collapses to 1 when both sides move together
  3/3 inverted truths behaved as required
```

**The threshold is the mechanism, not a number I picked.** The metric is the
fraction of daylight each side *keeps* — ground keeps 4–5%, litter keeps 44–61%
— so a correctly graded object scores ≈1 and the cup scores ≈11. Failing above 4
leaves room for genuine lamp pools and still catches this. The check goes green
when the night ratio returns to the day ratio, which is the target, rather than
when the litter is black.

**Two metrics I tried and rejected, because the first one lied.** Dividing night
contrast by day contrast flagged **210 objects** — an object that is merely dark
by day scores 54× on a 10× change and swamps the real cases. Kept-fraction is
stable against that.

### 211 real, 8 visible — and the gap is the point

The wide count is not noise: **the ground is one 134 m mesh whose origin is
12.3 m from any lamp** (`071e4fd27`), so it can never take a pool and nearly
anything small beside a lamp out-keeps it. Almost all of that is invisible — a
dim object at 0.02 that ought to be 0.004 is still black on black.

So the assertion fires on the **visible** subset and reports the real count as
context. That is GOTCHAS §23 applied to my own instrument, and §23 is my own line
before it was a gotcha: *establishing that a defect is real is not the same as
establishing that it matters.* A check that failed on all 211 would be true and
unroutable.

**Offered to the shared runner**, following `59e925b10`'s pattern: it has the
`--selftest` the runner requires, and it needs a day capture to pair against
(`JSON_OUT=1 NIGHT_H=13` once, then `PAIRED=<file>`). It is **red at HEAD by
design** — it guards an open defect and goes green when that defect is fixed.
Adding it is the runner owner's call, not mine.

## CORRECTION: my day *ratio* was tints, not appearance — the kept-fraction is not

`114c5bef7` found that `MeshBasicMaterial.color` is a **tint, white by default** —
the texture carries the appearance. Checked against my own day capture:

```
day capture: 497 objects, 182 with tint exactly 1.0 (37%)
distinct GROUND day tints: 0.0878  0.2468  0.3993  0.802  1
```

The cup at the top of my table is one of the 182. **Its "day = 1" is *no tint
applied*, not a measurement of how bright it looks at noon** — that lives in a
texture I never read.

### What that withdraws

> *"These objects sit at 11.4× their ground in daylight"* — **withdrawn as an
> appearance claim.** It compares an untinted object against a genuinely tinted
> ground, which are different quantities. And with it the phrasing of the target:
> *"the night ratio should return to the day ratio"* is stated in a number that
> does not mean what it sounds like.

### What survives, and why

**The kept-fraction is a per-material self-comparison, so the texture cancels.**

```
object   1.0000 → 0.5554   graded to 56%
ground   0.0878 → 0.0043   graded to  4.9%
```

Both are the *same material's own tint at two times*. Whatever texture each
carries is identical in both readings and divides out. So **"the night grade
reaches the ground at ~5% and the object at ~55%, about eleven times short"
stands**, and so does the routing built on it.

**And the check is already sound**, by luck rather than foresight: I switched
`floatlit.mjs` to kept-fraction last round because the other metric flagged 210
objects, not because I knew about tints. The metric I rejected for being noisy
was also the one that was measuring the wrong thing.

**The target, restated in the quantity that means something:** the kept-fraction
ratio should be **≈1** — litter graded by the same factor as the ground under it.
Not "return to the day ratio", which was tint arithmetic.

### One thing my measurement did establish, used by someone else

`19c96ad94` found the confirmation for its mesh-splitting routing in a column
`floatlit.mjs` prints and I never commented on:

```
road objects   ground 0.0043  →  129×, 103×
park objects   ground 0.0093  →   65×, 58×, 49×, 47×
walk object    ground 0.0395  →   10.9×
```

**The walk's ground reads 9× brighter than the road's** — same litter, same
lamps, same night, objects all at 0.43–0.61. That is a ground-against-ground
comparison at one instant, so it is sound for the same reason the kept-fraction
is. The walk is slabbed and can take a pool; the road and park floor are each one
mesh. **The ratios follow the ground, not the object** — which is the fix
direction, and it was sitting in my own output unread.

## `checks-registered` is red with three entries, and the "offer it" pattern is why

```
WRITTEN BUT NEVER REGISTERED — these run exactly never:
  scripts/G-rooms-walk.mjs  has a --selftest and is in no tier of npm run checks
  scripts/G-vice-walk.mjs   has a --selftest and is in no tier of npm run checks
  scripts/floatlit.mjs      has a --selftest and is in no tier of npm run checks
```

**I did not turn this red, and I did make it worse.** `59e925b10` added selftests
to the first two; my `cfb350f71` added the third. Checked rather than assumed —
`git log -S"--selftest"` dates each, and `59e925b10` precedes mine on mainline.

### The pattern is the finding

All three arrived the same way: *give it a `--selftest` and **offer** it to the
shared runner.* That is the documented route to adoption, and it lands the script
in exactly the state this check exists to flag — self-testing, unregistered,
running never. **Two agents, three scripts, one pattern**, so it will happen again
on the next offer.

The check's own words are the reason it matters: *"a check that is not run cannot
fail."* An offered check is indistinguishable from a forgotten one, and the whole
point of `checks-registered` is that the difference is invisible without a
declaration. **That is the same rule this audit has hit five times — an
undeclared exemption looks exactly like a defect**, which is why I annotated
`twoworlds.mjs` and `basincheck.mjs` rather than leave them to be re-discovered.

### For mine specifically

`floatlit.mjs` **cannot be dropped into a tier unmodified**: it needs a day
capture to pair against (`JSON_OUT=1 NIGHT_H=13` once, then `PAIRED=<file>`), and
it is **red at HEAD by design** because it guards an open defect. So the `EXEMPT`
route is the right one for now, and the line to paste is:

```
'floatlit.mjs': 'needs a paired day capture (PAIRED=…) and is red by design until
                 the floating-litter defect is fixed — see AUDIT-TRIAGE.md',
```

Neither `checks.mjs` nor `checks-registered.mjs` is a file I edit, so this is a
routing note rather than a change. The general fix is the one the pattern
suggests: **an offer should carry its own EXEMPT entry**, so "offered, awaiting
adoption" is a state the board can see instead of a red nobody owns.

## CORRECTION: I called a ground-vs-ground comparison sound, and it was not

`40522fa6f` withdrew the confirmation it had drawn from my ground column, and the
withdrawal lands on me too. I had written of it:

> *"That is a ground-against-ground comparison at one instant, so it is sound for
> the same reason the kept-fraction is."*

**That reasoning is wrong.** The kept-fraction is sound because it compares **one
material with itself at two times** — the texture is identical in both readings
and divides out. Two *different* grounds at one instant share nothing of the
kind. Measured:

```
  road at the cup     texMean 0.2401  tint 0.0092  appearance 0.00222
  walk at its litter  texMean 0.4162  tint 0.0092  appearance 0.00385
```

**The tints are identical.** The grade treats both grounds the same; the gap is
concrete being lighter than asphalt. I made a soundness argument in the very
commit where I was correcting myself about tints, and it was the same error again
one line down.

### So I swept my own check for it

`floatlit.mjs` had both kinds. `div` (kept-fraction) is same-material-two-times —
**provably unaffected**, since `appearance = texMean × tint` and the identical
`texMean` cancels top and bottom. But `ratio` — object against *ground* at one
instant — is cross-material, and my **visible-defect gate was built on it**.

The check now computes appearance properly, sampling each texture's mean:

| | tint only (before) | appearance (now) |
|---|---|---|
| objects >10× their ground | 11 | **33** |
| **visible offenders** | 8 | **18** |
| worst | 129× | **286×** |

**Measured properly the defect is bigger, not smaller** — my 8 understated it by
more than half. `--selftest` still passes 3/3, both the fires-on-live and
quiet-on-fixed halves.

> **The rule, stated so I stop re-deriving it:** a ratio between two *different*
> materials must use appearance. A ratio of one material against *itself over
> time* may use tint, because the texture cancels. I have now got this wrong
> twice and right twice, in the same file.

## The `checks-registered` red cannot be fixed by anyone, and the reason is in OWNERSHIP.md

Still red, all three entries, after the commit that said it was handled:

```
scripts/G-rooms-walk.mjs  has a --selftest and is in no tier
scripts/G-vice-walk.mjs   has a --selftest and is in no tier
scripts/floatlit.mjs      has a --selftest and is in no tier
```

`4d5016e54` — *"it now carries its own EXEMPT lines"* — added a **note** listing
the lines to paste and changed no code, saying so plainly: *"Still not editing
checks.mjs or checks-registered.mjs; both are other builders'."* My `643ceddd9`
did exactly the same thing one commit earlier.

**Two agents, two notes, both proposing the same three-line fix, neither able to
apply it.** The `EXEMPT` block still holds only its original three entries.

### Why, precisely

`notes/OWNERSHIP.md:68`:

> ***`scripts/**` and `notes/**` — anyone may add files. Do not edit another
> agent's script or handoff note.***

That is the whole mechanism. `checks.mjs` and `checks-registered.mjs` are
*"another agent's script"* for everybody except whoever created them, and
**OWNERSHIP.md has no category for shared infrastructure** — files the entire
board depends on and no one is designated to maintain. The rule is right for
personal probes and wrong for the runner.

The result is a red that is **known, trivial, agreed, and unfixable by
convention**. And it is a red in the one check whose purpose is to stop silent
opt-outs — its own words are *"Opting out is fine. Opting out silently is not."*
Here the silence is in the ownership file rather than the code.

### The narrow fix, for the desk

Add a **shared-infrastructure** line to `OWNERSHIP.md` naming the files every
agent depends on — `scripts/checks.mjs`, `scripts/checks-registered.mjs`,
`scripts/lib/which-world.mjs`, `scripts/scenedump.mjs`, `scripts/fpadd.mjs` —
and permit **additive** edits to them by anyone: an `EXEMPT` entry, a `CHECKS`
row. Structural changes still go to the author.

Without that, every future offer produces the same red and the same note.
**Three scripts have already arrived by that route.** `OWNERSHIP.md` is not a
file I edit either, which is the point — this needs the desk, not another
builder writing a fourth note proposing the same three lines.

# The floating litter — current state, and the only numbers to quote

This finding has been measured four times and revised three. **Three earlier
sections of this file carry superseded counts** and now say so at the top. This
is the one to read.

**Measured at HEAD, appearance-based (`texMean × tint`), clock stepped, movers
dropped, self-lit excluded:**

```
  229 of 322 paired objects keep more of their daylight than their ground does
  of those, 18 are also bright enough to see: >10x their ground and lum >0.2
  worst divergence 32.7x at (-14.93, -83.38) — day 1.8x, night 59.5x
  FAIL
```

| | |
|---|---|
| **the defect** | the night grade takes ground to **4–5%** of daylight and litter to **44–61%** — the object is *under-darkened*, not over-lit |
| **how many** | **18 visible**, 229 real. The gap is real: the ground is one 134 m mesh that can never take a lamp pool, so nearly anything small beside a lamp out-keeps it, mostly invisibly |
| **the target** | the **kept-fraction ratio ≈ 1** — litter graded by the same factor as the ground under it. *Not* "return to the day ratio", which was tint arithmetic and is withdrawn |
| **status** | **open and unchanged.** One fix attempt (`ad9ba9255`, widening the pool) failed for a reason that rules the approach out: the pool is additive and adds ~0.05 to a ground at 0.008 |
| **stability** | **18 visible on three separate builds**, including after `d07f60879` and `d27855b74` re-layered the park's dish, corner fall and desire lines — the ground those park objects sit on. The count did not move, which is the expected result and worth having: the defect is in **how an object takes the grade**, not in the ground geometry beneath it |
| **guard** | `floatlit.mjs`, `--selftest` 3/3, red by design until fixed. Unregistered — see the `checks-registered` deadlock |

**Which numbers are safe to quote from the superseded sections:** the *mechanism*
(ground keeps 4–5%, litter 44–61%) is sound in all of them, because it is a
same-material ratio across two times and the texture cancels. Every **count** and
every **object-vs-ground ratio** in them is tint-based and understates the
defect — 8 visible became 18, and 129× became 286×, once appearance was measured
properly.

> Measuring it correctly made it **worse each time**. That is worth saying
> plainly to whoever picks up the fix: the three earlier numbers were not
> conservative estimates, they were wrong in a consistent direction.

# Assertions over an empty set: 4 registered checks, and one of them is `no-silent-pass`

Three agents have now found this class one instance at a time — `32d9d6521`
(five of its own), my `ae7a30bba` (two of mine), and `80b6abfe6`, where
**`footprint` passed with ZERO tree pits and its author watched it happen**.
Found singly three times is the signal to enumerate, so I swept all **56
registered checks** for assertions that iterate a subject set without ever
testing that the set is non-empty. **Four.**

### `spots-walk` — the serious one

```
line  68   const spots = await p.evaluate(() => window.__ct.spots());
line  70   console.log(`${spots.length} [E] spots registered`)      ← printed
line 156   process.exit(fails.length || errs.length ? 1 : 0);       ← never consulted
```

It **prints** the count and **never asserts** it. If `__ct.spots()` came back
empty it would report `0 [E] spots registered`, find no failures, and **exit 0**.

This is not hypothetical in this codebase: `globorder.mjs` exists because
declarations are **silently dropped when a binding is emitted after the glob
that reads it**, which is exactly how a registry ends up short or empty. And the
guarantee at stake is one the header records the user asking for **three times**
— *"make sure all press e work"*.

### `no-silent-pass` — the same defect, in the check built to prevent it

```
line 37   const suspects = readdirSync(dir)…
line 85   process.exit(1);                       ← only when `bad`
line 87   `no check in this suite can pass by doing nothing (${suspects.length} scripts)`
```

If the `readdirSync` filter ever stops matching — a rename, a moved directory —
`suspects` is empty, nothing is executed, and it exits 0 printing

> *"no check in this suite can pass by doing nothing (**0** scripts)"*

**A vacuous pass, announcing that vacuous passes are impossible.** Its own header
says it is *"named for what it asserts"*; on an empty list it asserts nothing and
says so in the same breath.

### The other two, flagged and not confirmed

`lot-frontage` and `rain` both assert and neither tests a subject count, but I
have **not** established that their sets can actually be empty — my scan is a
grep, and their iterations may be over fixed literals. **Flagged for their
owners, not asserted by me.**

### The fix is one line each, and it is the same line

```js
if (spots.length === 0) { console.error('CANNOT ANSWER — no spots registered'); process.exit(3); }
```

Exit **3**, GOTCHAS 32's code for *the check never ran* — the same fix I applied
to my own two in `ae7a30bba`. **Four checks, four one-line guards**, and none of
these files is mine to edit.

> The pattern underneath: every one of these prints the count. **The number was
> on screen the whole time and nothing compared it to zero.** Printing is not
> asserting, and a check that reports its subject count without testing it is
> telling you exactly what it failed to check.

## Closing my own two open flags: `lot-frontage` confirmed, `rain` cleared

I left those two "flagged, not asserted" last round. Leaving a grep result for
someone else to resolve is half an answer, so I read both.

### `lot-frontage` — **confirmed**, and only one of its three sets is at risk

```
line 153   const mine = measure(span[0], span[1]);
line 160   `lot  frontage z … , ${mine.length} samples every 0.25 m`     ← printed
line 188   const bad = mine.filter((r) => r[1] < CLEAR - 0.05);
```

Same shape as the others: the sample count is **printed and never asserted**. If
the lot's frontage span ever collapsed — the module failing to build, `span[0] ≈
span[1]` — `measure` returns nothing, `bad` is empty, and the check passes having
measured no pavement at all.

**But its other two sets must be allowed to be empty**, and this matters for
whoever fixes it: `fromSite` and `kerbside` are lists of *intruders*, guarded by
`if (fromSite.length)`. **Empty there is the pass condition.** A guard bolted onto
the wrong collection would turn a clean lot into a permanent red. The one line
belongs on `mine`, not on the intruder lists.

### `rain` — **cleared**

```
const PAIR = [NIGHT_H, DAY_H];      // a fixed two-element literal
for (const h of PAIR) { … }
if (soaked < SOAK_TO) { …; process.exitCode = 1; }
```

It iterates a **fixed pair**, which cannot be empty, and its assertion is a
**threshold on a measured value**, not a filter over a collection. My grep
flagged it for having no `.length === 0` guard; it does not need one. **No
defect — withdrawn.**

### Final tally, and what the scan was worth

**3 confirmed of 4 flagged**: `spots-walk`, `no-silent-pass`, `lot-frontage`.
One false positive — a **25% error rate on the grep**, which is why every one of
them was read before being reported and why `rain` never became a routed defect.

> A scan that names candidates is worth running; a scan whose output is published
> unread is a way of being wrong at scale. The four names took a minute to
> generate and the three verdicts took twenty to establish — **and the ratio is
> the job.**

# Full suite at `29d6bfae0`: 52 green, 5 red — all five diagnosed

> **My headline in this section is WRONG.** *"Only `nightgrade` describes
> something wrong with the world"* — it does not. See *"nightgrade was flaky too,
> and I only ran the repeat test on the red I already doubted"* at the end of
> this file.

My last published state predates the park topography, the shelter, the keeper
fixes, the litter work and the tint corrections. Mainline went quiet, so nothing
could land mid-run and invalidate it. **All five reds are diagnosed below; two
are known, one is correct, one is flaky, one is real.**

### `seats-walk` — **FLAKY, not broken.** Do not route this as a broken bench

Four runs, **identical build**, nothing else changed:

```
run 1   56/58   (2 fail)        run 3   56/58   (2 fail)
run 2   57/58   (1 fail)        run 4   58/58   exit 0
```

Only ever **two** seats, both at x −8.65 — `(-8.65, -20.38)` twice, `(-8.65, -5.62)`
once. And the message names its own cause:

> *"no `sit on the bench` prompt from **the one standable point** (-8.6,-19.43); got null"*

**One standable approach point.** My own earlier work is the mechanism: standable
counts are instantaneous, not static — I measured A-1 TAX vary **73 → 25** as
citizens walked past. A seat with exactly one approach point is maximally fragile
to one pedestrian standing on it, which is precisely a run-to-run coin flip.

**The bench is not broken — it sits fine on a clear run.** The fix is either more
approach room for those two, or a retry/mover-drop in the check. Anyone routed to
"fix the bench" would find nothing wrong with it. These are the same two benches
my seat-facing sweep singled out as the only street benches with something within
4.05 m.

### `no-silent-pass` — **correctly red.** It caught three

```
FAIL lamplight.mjs   exit 0 on --no-such-mode — it can pass having checked nothing
FAIL parking.mjs     exit 0 on --no-such-mode
FAIL truck.mjs       exit 0 on --no-such-mode
```

The same vacuity class three of us have been sweeping, found by a **different
mechanism** — mode dispatch rather than empty sets. Working as designed.

### `nightgrade` — **1 real material**

```
1 materials were graded by dimWorld and did not move
   0.096 at 48.8,3.8,-97.7   0.00x0.00  tex ?x?
```

A **degenerate 0.00 × 0.00** material in the vice quarter that takes the grade
and does not respond. Also reported, not failed on: *5 materials are past 1.0 at
23:00 — the grade multiplied past white*, which clamps invisibly but not to
anything reading the colour back.

### The two already known

| | |
|---|---|
| `checks-registered` | the deadlock — three offered scripts, a three-line fix, and **no one is permitted to apply it**. Needs an OWNERSHIP.md shared-infrastructure category |
| `interiors-walk` | the dev-vs-bundle artefact. It imports raw `.ts`, the suite drives a preview. Passes **195/195** against a dev server |

**So the honest headline is 52 green, 1 flaky, 2 known-and-explained, 1 correct
red catching real defects, and 1 genuine one-material fault.** Only `nightgrade`
describes something wrong with the world.

# Project-wide: 149 of 750 commit citations are dead to everyone but their author

Three agents audited the hashes in **their own** notes. Nobody had measured the
board, and all three used `git cat-file -e`, which I showed last round is the
weaker test — it succeeds on rebased-away objects still sitting in the local
store. Re-run across **all 88 notes that cite commits**, asking the portable
question (`merge-base --is-ancestor … add-stick-and-city98`):

```
750 citations · 601 reachable · 149 dead to anyone but their author   (20%)
```

The concentration matters more than the total:

| note | cites | reachable | dead |
|---|---|---|---|
| `feat-interiors.md` | 32 | 4 | **28** |
| `D-alley-report.md` | 89 | 70 | **19** |
| `A-nightgrade.md` | 18 | 8 | **10** |
| `A-mirror-harness.md` | 13 | 4 | **9** |
| `A-seampairs.md` | 11 | 5 | 6 |
| …33 more notes | | | 1–5 each |

**`feat-interiors.md` cites 32 commits and 28 of them resolve for nobody** — a
handoff note whose evidence trail is 88% unfollowable by the person it was
written for. `A-build-stamp.md`, `A-frontage.md`, `A-last-three-faces.md` and
`A-pattern1-closed.md` are at **zero reachable**.

### Two caveats, and the second is the important one

**My own file still shows 4.** I repaired those last round; they reappear because
my repair table *quotes the dead hashes* to record what they were. **A note
documenting dead hashes will always report dead hashes** — the same
can't-tell-context problem one level up, and a reason not to automate this into a
check without a way to mark a hash as quoted rather than cited.

**149 is a lower bound.** My scan only counts hashes that still exist as objects
locally; a citation whose commit was rebased *and pruned* fails `cat-file -e` and
is silently classified as "not a commit". Git is warning about exactly this right
now — *"too many unreachable loose objects; run `git prune`"*. **The day someone
runs `git gc`, an unknown number of these citations stop being detectable at all,
while staying just as broken.**

That is the argument for fixing them now rather than when someone notices:
repairing a citation needs the old commit to still be readable, and the window
for that closes silently.

**The repair is mechanical** — find the commit on mainline by subject:
`git log --format=%h --fixed-strings --grep="<subject>" add-stick-and-city98`.
That is how I fixed three of my four. None of these notes is mine to edit.

## The recovery table, built before the window closes

Last round I noted that the repair window for dead citations **closes silently**:
fixing one needs the old commit still readable, and git is already warning about
*"too many unreachable loose objects"*. So I built the mapping while the objects
exist — `notes/AUDIT-hash-recovery.md`, **138 hashes across 42 notes**, grouped
by note, largest first.

```
dead citations: 138 distinct hashes
  recoverable — same commit on mainline under a new hash:  132
  not on mainline at all (never landed, or subject edited):  6
```

**Verified, not inferred.** Subject matching alone could pair two different
commits sharing a message, so I checked with `git patch-id --stable`: on a
22-mapping sample, **22 of 22 pairs have an identical patch-id** — the same
change, re-hashed by the rebase that landed it.

The 6 that cannot be repointed are listed at the end of that file. For those the
honest repair is the one I applied to `9610e25`: **say in the note that the hash
resolves for nobody**, rather than substitute a plausible-looking replacement.

**None of the 42 notes is mine to edit** — the table is so that each owner's fix
is a find-and-replace rather than an investigation, and so that it remains
possible at all after the next `git gc`.

## One pedestrian deciding a binary: three findings, one mechanism, and a remedy already chosen

`9e59be123` fixed two of its own walks and described a shape I had just measured
from a different direction:

> *"one un-retried walk decided OPEN vs SEALED, so **a single citizen in the
> gateway** turned the whole climb into a SKIP and the run still said everything
> passed. It reported SEALED once today on a build where it had been open all
> morning."*

That is my `seats-walk` finding in another file. Put together, three independent
observations are the same defect:

| observed | by | the single point of failure |
|---|---|---|
| `seats-walk` 56/58, 57/58, 56/58, **58/58** on one build | me, this session | *"the one standable point"* — two benches at x −8.65 have exactly one approach |
| gate probe reported SEALED on a build open all morning | `9e59be123` | one un-retried walk decides OPEN vs SEALED |
| A-1 TAX standable points **73 → 25** as citizens pass | me, earlier | the count is instantaneous, not static |

**The mechanism is identical**: a check samples one point, one time, and a
pedestrian standing there flips a binary. It is not a flaky *world* — it is a
sample size of one against a population that moves.

### The remedy is already chosen, and it is not mine to invent

`9e59be123` retried *"three times like every other walk in that file"*. So the
project has both a precedent and a pattern, and my `seats-walk` routing should
say so rather than offer a design choice: **retry, as E's walks already do.**
Widening the two benches' approach would also work and is the more permanent fix,
but it changes the world to suit a check, which is the weaker reason.

**And the worse half is the reporting, not the flake.** E's gate probe did not go
red when it could not decide — it **SKIPPED and the run said everything passed**.
That is the vacuity class again: `32d9d6521`, `80b6abfe6`'s footprint with zero
tree pits, my two, and the four registered checks I enumerated. **A check that
cannot decide must not be counted as one that decided.** Exit 3 exists for it.

Nothing here is a new defect — it is three known ones sharing a cause, which is
worth writing down once so the next instance is recognised rather than
rediscovered.

# `nightgrade` was flaky too, and I only ran the repeat test on the red I already doubted

`d38cc3801` answered my *"one genuine one-material fault"* with three
corrections, and all three land:

**Not degenerate.** The `0.00x0.00` I quoted is `nightgrade.mjs:98` printing
`g.width ?? 0` for a geometry that has no `width` — the object is
`SphereGeometry(0.075, 6, 4)`. **I passed the check's own display artefact
through as a geometric finding**, and anyone acting on it would have gone looking
for a zero-area mesh that does not exist.

**Flaky.** Measured myself, four runs of one build:

```
run 1  0 materials  exit 0        run 3  1 material   exit 1
run 2  0 materials  exit 0        run 4  2 materials  exit 1
```

Its author measured `1,0,1,0,1` over five. It samples one instant per hour and a
chase light phases in three, so what looks "unmoved" depends on where the chase
is at the two instants.

**Intended.** They are the blade-sign bulbs — `dimWorld` grades them and the
tick overwrites with an absolute colour, so identical day and night is the
design. The opacity ramp does fire, 0.55 → 0.85.

### The corrected state of that run

| | |
|---|---|
| green | 52 |
| **flaky** | **2** — `seats-walk` *and* `nightgrade` |
| known and explained | 2 — `checks-registered`, `interiors-walk` |
| correct red, catching real defects | 1 — `no-silent-pass` |
| **describing something wrong with the world** | **0** |

**The project was in better shape than I reported.**

### What I actually got wrong

In that same commit I established `seats-walk`'s flakiness **by running it four
times** — and then took `nightgrade`'s single run at face value. Same report,
same page, one red repeated and the other not.

The difference was not evidence. **`seats-walk` reported something I already
doubted** (I had measured those two benches as the only ones with an obstruction
within 4.05 m), so I re-ran it. `nightgrade` reported something I had no prior
about, so I wrote it down.

> **I ran the repeat test on the finding I suspected, not on the finding that
> needed it.** A suspicion is not a sampling plan. Every red in a world with
> moving citizens and phasing lights needs the same treatment, and the one you
> have no opinion about needs it most — because nothing else will catch it.

I had written *"one pedestrian deciding a binary … a sample size of one against a
population that moves"* **two commits earlier**. Then I published a single-sample
verdict.

## Re-measured: the dead-citation backlog is not shrinking

```
citations 758 · reachable 608 · dead 150      (was 750 / 601 / 149)
```

Repairs have landed — mine, and `48b9156a6`'s fourteen, now verified by patch-id
after it adopted the check I used on the recovery table. Both are already inside
that baseline. **The count still did not fall**: eight new citations appeared and
one of them is already dead.

The concentration is unchanged, and it is where it always was:

```
 28  feat-interiors.md      6  A-seampairs.md         5  A-shoturl-sweep.md
 19  D-alley-report.md      5  A-face-lib-proposal.md 4  A-build-stamp.md
 10  A-nightgrade.md        5  A-shopfronts.md        4  A-declaresurface.md
  9  A-mirror-harness.md
```

### This is a leak, not a backlog

Every dead citation was **live when it was written**. An agent writes a note
about work in flight, cites its own commit, and the rebase that lands it renames
that commit. **The note is wrong the moment it becomes useful to anyone else.**

So repairing 138 hashes does not fix anything durable — the next round produces
more, which is exactly what this re-measure shows. The two things that would:

1. **Cite by subject, not by hash**, for anything not yet on mainline. A subject
   survives a rebase; a hash does not.
2. **Cite the hash only after it has landed** — after the rebase, not before.

### One caveat on the metric, now confirmed

`AUDIT-hash-recovery.md` is excluded from this count, because a table of dead
hashes is otherwise indistinguishable from a note full of broken ones. **That is
the same context problem that made a fingerprint look like a rotted hash**, and
it means the number cannot be automated into a check without a way to mark a hash
as *quoted* rather than *cited*. Anyone recording a repair inline — as I did —
keeps their own note in the count forever.

## `openSite`'s one flat plane will NOT fix the floating litter — pre-empting the second wasted attempt

`be0767d62` routes a new finding: *"`openSite` in `ct/street.ts` floors every
site with one opaque flat plane, so a module that owns relief cannot cut into
it."* That is the same single-mesh ground my litter work keeps meeting —
`071e4fd27`'s *"the road can never light: one 134 m mesh, and its origin is
12.3 m from a lamp"* — so the two findings look like one problem, and fixing
`openSite` looks like it would close both.

**It would not, and my own numbers are the reason.** The litter defect is on the
**object** side:

```
object   1.0000 → 0.5554   keeps 56%
ground   0.0878 → 0.0043   keeps 4.9%
```

Slabbing the floor changes the **ground** term. Even if a slabbed site then took
a full lamp pool, that pool is **additive** — `ad9ba9255` measured it adding
about **0.05** to a ground sitting at **0.008**, and reverted the attempt for
exactly that reason. Against an object at **0.55**, raising the ground from 0.004
to 0.05 leaves a **11× gap where there was a 129× one**: better, and still the
defect. The cup stays the brightest thing on a dark pavement.

> **Two fixes, two problems.** `openSite`'s flat plane genuinely blocks relief and
> should be routed on its own merits. It is **not** the floating-litter fix, and
> anyone who does it expecting that will get a smaller version of the
> `ad9ba9255` result — a real improvement to the ground, and a cup still
> floating over it.

The litter fix remains the one the measurement points at: **grade the object by
the factor its ground already gets.** Target is a kept-fraction ratio near 1.

I am recording this *before* anyone starts, because the pool-widening attempt was
already made and reverted on this same reasoning, and the second attempt would
cost more — `openSite` is load-bearing for every module that sits on a site.
**A negative connection between two findings is worth as much as a positive one
and is much easier to miss**, because nothing prompts you to check whether the
fix you are about to make is for the other problem.
