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
