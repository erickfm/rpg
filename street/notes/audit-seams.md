# audit/seams — final handoff

Base `98e6693b`. Read-only throughout: **nothing under `street/src/` was touched
in any commit on this branch.** Verify with
`git diff --name-only $(git merge-base add-stick-and-city98 HEAD)..HEAD -- src/`
→ empty.

## Touched

Reports — `notes/seam-audit.md`, `request-audit.md`, `lane-audit.md`,
`interior-audit.md`, `float-audit.md`, `AUDIT-TRIAGE.md`,
`BLOCKED-AUDIT-seams.md`.
Instruments — `scripts/`: `lane3.mjs`, `handed.mjs`, `doorsweep.mjs`, `turn.mjs`,
`reach.mjs`, `rooms.mjs`, `masonry.mjs`, `seampairs.mjs`, `aim.mjs`, `steps.mjs`,
`stand.mjs`, `church.mjs`, `whose.mjs`, `route.mjs`, `boxcheck.mjs`, `seamnew.mjs`.

## Where everything landed

**Route: nothing.** Every finding I hold is closed, parked with a reason, or
blocked.

Each row is marked with **how much the check is worth** — see
`AUDIT-INSTRUMENTS.md`, "classified by whether its two sides share an ancestor":
**[I]** independent (two sides, no common source), **[R]** measured against a
stated rule, **[C]** circular (proves the pipeline, not the value).

**[I] has been split, because it was too generous.** Having reproduced another
agent's figure with the same jumped clock they used and called it confirmation
(`fc18e7f51`), I re-graded my own markers against a stricter test: *two sides* is
not *two methods*. Where one instrument measures both sides, a systematic error
in that instrument hits both identically and they agree no matter what is true.

- **[I]** — two sides **and** two methods. The strongest thing here.
- **[Is]** — two sides, **one instrument**. Real, but a shared-method risk:
  if the extraction is wrong, both sides are wrong the same way. Not a downgrade
  to worthless; a downgrade to *"re-derive the extraction before betting on it"*.

The distinction is not hypothetical. The `[Is]` row below is exactly the check
that produced this audit's largest retraction — a BoxGeometry face-index error
made 135 of 239 junctions "disagree" when the world was fine, because **both
sides were read the same wrong way**.

| area | final state |
|---|---|
| **Pattern #1 / masonry density** | **[R]** every texture declares 8/16/32 across 236 faces, nothing else. **[Is]** `seampairs`: 735 real junctions, every like-for-like disagreement is the deliberate 2× band/wall. **[C]** the per-face canvas-vs-mesh check is circular — it proves the pairing, not that any `wM` is right |
| **Sidewalk encroachment** | **[I][R]** **CLOSED.** Tightest walk **0.89 → 1.15 m**, sub-1.20 m stretches **15 → 3**. Colliders vs the capsule — no shared ancestor, and the thresholds are the stated rule |
| **The user's ~45 requests** | **All graded.** Last NOT DONE (wheel arches) closed at `6333004c`. One blocked. **[I]** the behavioural results — 8 of 8 doors open and land in the named room, 57/57 seats, 9/9 way-outs. **[C]** the door *position* agreements prove plumbing only |
| **Interiors as a set** | **[R]** wall thickness **0.18 m in all eight**. **[Is]** ceiling spread 0.90 → 0.80 m and keepers **4 of 8 → 8 of 8**, both room-against-room |
| **Floats** | **[Is]** one real float at Round 3 (thrift price card) — **now gone**. Mesh against every other mesh |
| **Seams in new ground** | Side street + park far half swept at grazing angles. 8 shot, 3 read, nothing found |

**Blocked (1):** the bench ad — a failed *search*, not a failed shot. No
ad-panel geometry exists anywhere by shape. Located as *the stop in front of
LIQUOR*. Needs its owner. See `BLOCKED-AUDIT-seams.md`.

## Scope of that state: there are TWO suites, and I only ran one

**Ran the other one.** Both states, in one place, for the first time:

| suite | state |
|---|---|
| `npm run checks` | **52 green, 5 red** — 2 flaky, 2 known and explained, 1 correct red catching real defects, **0 describing something wrong with the world** |
| `E-verify` (6 areas) | **exit 0 — all 6 areas walk.** Courtyard, churchyard, park, drape, onslope, coplanar. Nothing sinking into the grass, nothing floating above it, nothing fighting for the same height |

So **both boards are green**, and that is now recorded rather than assumed.
`E-coplanar`'s 150× speedup is what made this runnable at all — the suite it was
optimised for finishes inside one window now, which is the first time I have been
able to ask the question.

One line from that run is worth keeping:

```
NOTE  the walk past the church, north: z -90.00 -> -66.24
      <-- stopped short; nothing static there, check citizens
```

That is **one pedestrian deciding a binary** — the class behind my flaky
`seats-walk` and E's own SEALED gate probe — and the harness handles it the right
way: it **reports the possibility as a note instead of failing on it**. A check
that cannot tell a blocked walk from a busy one, and says so, is worth more than
one that picks.

**`npm run checks` is not the project's verification. It is one of two.**

```
E-* scripts on disk                      14
E-* registered in npm run checks          0
```

All fourteen run under **`E-verify.mjs`**, a parallel six-area suite —
courtyard, churchyard, park, drape, onslope, coplanar — and `E-verify` is not
registered either. Among them are checks that **found real faults**:
`E-coplanar` found three, and was made **150× faster** (`86df27558`) explicitly
so a suite could finish between rebases — a suite that is not this one.

**So the numbers below describe `npm run checks` and nothing else.** When I
published *"52 green, 5 red"* as the project state, fourteen scripts covering an
entire builder's area were outside it. That is a scope error in my report, not a
gap in E's work: running your own harness is reasonable, and nothing anywhere
records that a second suite exists.

**`checks-registered` cannot see any of it** — its population is scripts carrying
a `--selftest`, and none of the fourteen has one. That is the same blindness I
measured at **25 scripts**, now with a concrete cost: an entire area's
verification is invisible to the audit that exists to catch invisible checks.

> **"The suite is green" is a claim about whichever suite you ran.** The desk's
> options are to register the fourteen, or to record in one place that two suites
> exist and what each covers. Either is fine; the present state — where neither
> is written down — means a green board and a green board are different boards.

## Project state at handoff

**Rewritten. The version that stood here was badly stale** — it reported *"28
green, 1 red"* on a suite that now registers **56** checks, and said `seats-walk`
passes, which my own later measurement contradicts. A reader lands on this
section first, so it is the last thing that should lag.

**Measured at build `29d6bfae0`, when `CHECKS` held 56 entries. It now holds 70.**
The 14 added since — G's two room suites alone are 132 checks the runner had
never run — are **not** in the figures below. I am dating it rather than
re-running it, because an aggregate here needs a quiet window (see below) and a
stale number that says when it was taken is worth more than a fresh one that
does not.

This is the second time this section has gone stale, and the previous fix went
stale the same way: it corrected *"28 green"* to 52 and then said *"a suite that
now registers 56 checks"* — a number that was true the day I wrote it. **The
missing thing was never the count. It was the date.**

Measured across the full suite, both tiers, and every red diagnosed:

| | |
|---|---|
| green | **52** |
| **flaky** | **2** — `seats-walk` (56/58, 57/58, 56/58, **58/58** on one build) and `nightgrade` (0, 0, 1, 2 on one build). Neither describes a broken world; both sample one instant against citizens and phasing lights |
| known and explained | **2** — `checks-registered` (three offered scripts, a three-line fix **nobody is permitted to apply**) and `interiors-walk` (imports raw `.ts`; the suite drives a preview. **195/195** against a dev server) |
| correct red, catching real defects | **1** — `no-silent-pass`, which caught three scripts exiting 0 on an unknown mode word |
| **describing something wrong with the world** | **0** |

**Reproducing this is not routine, and that is a property of the repo rather
than of the number.** `4c89bd1b7` measured why: a long aggregate takes about
twenty minutes, the merge train rebases builders more often than that, so HEAD
moves out from under `dist/` mid-run and every remaining check exits 3 on the
provenance guard — *"an aggregate is something you get when you are lucky rather
than a gate you can lean on."*

I got this one by **waiting for mainline to go quiet** and saying so at the time.
Anyone re-running it during active work will get a scatter of exit-3s that look
like failures and are not. **Re-run the individual harness for any single claim
here; only trust an aggregate you watched complete against one unchanging build**
— read the served SHA back before believing the total.

**Two of my own earlier green claims do not survive**, and both are in
`AUDIT-TRIAGE.md`:

- `seats-walk` is **flaky, not passing**. Two benches at x −8.65 have exactly one
  standable approach point, so one pedestrian decides the verdict.
- `spots-walk` **can pass having checked nothing** — it prints its subject count
  and never asserts it. One of four registered checks I found in that state.

The open findings, all routed and none of them mine to fix: the **floating
litter** (18 visible, quantified against a target, guard offered), three
**empty-set guards**, the `checks-registered` **ownership gap**, and the bench ad
in `BLOCKED-AUDIT-seams.md`.

## Which world these results describe — and the half that cannot be checked in it

Everything here was measured on **my own preview build**, never on `:5177`, the
live integration world the user actually playtests. `bae53b2c5` establishes why
that gap cannot be closed by trying harder:

> *"**Anything that walks is worthless there.** `live-integrate.sh` rebuilds
> every 15 s and that RELOADS THE PAGE, so a harness longer than about fifteen
> seconds has the ground taken out from under it."*

**My strongest claims are precisely the ones that walk** — 8 of 8 doors opened by
pressing the key, 57 seats sat, 9 way-outs walked to their own frontage, the
entry/exit round trip. Every one is a harness of minutes. **None of them can be
run against the world the user plays**, and none of them was.

**What makes the transfer credible is not my work but E's.** The same commit
measured geometry and floors across both worlds and found them *identical* —
`groundAt` at the church door 0.55 and the library flight 0.42 in both, 66 park
floor points agreeing **to the millimetre**, the mound at 0.51, the dish 50 mm
deep. Behaviour that rests on geometry and floors should therefore carry over.

> **So: geometry in the played world is measured, and behaviour in it is
> inferred.** The inference is well-supported and it is still an inference. If a
> walking result here ever matters enough to bet on, the way to check it is to
> serve the integration build **statically** — not to point a walk at `:5177`,
> which will destroy its own execution context mid-run and report the collapse as
> a failure of the world.

## Every result in this report was measured on an **empty street** — and holds on a busy one

Every check in the suite, mine included, runs static or drops the moving
colliders. So every number in this handoff describes a pavement with nobody on
it. Tested populated (`lane-audit.md` R6–R7, `request-audit.md`):

| system | built / empty | lived / populated |
|---|---|---|
| narrowest pavement | 1.15 m | **0.72 m** — exactly the player's width, **0 of 20 samples impassable** |
| reachability | all destinations | **all destinations**, area varying 0.015% |
| door triggers | 63–75 standable points each | **never fully blocked**; only A-1 TAX intrudes on, 73 → 25 |

> **The world is robust to its own population.** Nothing becomes impassable,
> unreachable or unenterable. Quote the built figure when discussing the design
> and the lived figure when discussing the experience — **1.15 m is the
> pavement, 0.77 m is the walk.**

## Risk — the corrections ledger

Every claim I published on this branch and later withdrew, in one place, because
a reader who lands on the original paragraph will not necessarily scroll to the
retraction. **If you are about to act on something I wrote, check this list
first.**

| claim I published | status | where the correction lives |
|---|---|---|
| *"42 of 109 masonry faces disagree with their stamp"* | **WRONG** — `BoxGeometry` face-index error | `seam-audit.md` — RETRACTION |
| *"135 of 239 junctions disagree"* | **WRONG** — same cause | `seam-audit.md` — RETRACTION |
| *"the brick mismatch is legible at one corner"* | **WRONG** — that was perspective | `seam-audit.md` — RETRACTION |
| *"raising the casino ceiling stranded three fittings"* | **WRONG** — they hang off `room.H` by design | `AUDIT-TRIAGE.md` |
| *"one bench can no longer be sat on (56/57)"* | **WRONG** — a tool false negative; 57/57 stands | `request-audit.md` |
| *"the bodega has no published frontage"* | **WRONG** — it has one, `axis: 'x'`; my probe only read `axis: 'z'` | `request-audit.md` |
| *"A-1 TAX door is on the same side inside and out"* | **WRONG** — missing street-side flip; mainline's `c206db78` agrees it is correct | `interior-audit.md` R19b |
| *"the park is unlit / still a yard"* | **SUPERSEDED** — true when measured, fixed since | `request-audit.md` |
| *"church steps NOT DONE"* | **WRONG** — I scanned the block it moved off | `request-audit.md` |
| *"the 12 mirrored pennants"* | **TRUE but not worth routing** — the art is symmetric | `seam-audit.md` R8 |
| *"vice responds to nothing (0 of 303)"* | **SUPERSEDED** — true at `e24c959a`, fixed one build later; 62 of 303 respond | `AUDIT-INSTRUMENTS.md` |
| *"the wet look dies on street and survives on tex-ground"* | **WRONG attribution** — the split is registry vs registry, not module vs module | `AUDIT-INSTRUMENTS.md` |
| *"registered surfaces respond at night at −83.5%, same as day"* | **WRONG** — jumped clock inflated the dry baseline 3.4×; stepped it is −46.8% night, −65.4% day | `AUDIT-INSTRUMENTS.md` |
| *"a surface LIGHTENED by 280.9%"* | **WRONG** — a walking citizen; my sweep did not drop movers | `AUDIT-INSTRUMENTS.md` |

**Fourteen corrections. Three were caught by mainline before me, ten by me, one by
the desk.** The pattern in almost all of them is the same: a measurement I
trusted because it was precise, describing something other than what I thought.

**I published two wrong findings on this branch.** Both are retracted in place,
with the measurements that killed them:

1. **"42 of 109 masonry faces disagree with their stamp"** and **"135 of 239
   junctions disagree"** — a `BoxGeometry` has four side faces and I measured
   every one against `parameters.width`. Mainline diagnosed it (`7fe644b9`)
   *before* my retraction landed. My own first repair was **circular** — it
   picked whichever dimension matched the declaration, so it could never report
   a mismatch; mainline's material-index version replaced it.
2. **"raising the casino ceiling stranded three fittings"** — they are hung off
   `room.H` deliberately, and the source says so at `int-casino.ts:361`. I had
   documented that exact false-positive class one round earlier.

Both were caught by **reading the source**, not by measuring harder. Anything on
this branch resting on a measurement without a source check should be treated as
provisional.

## The through-line, if only one thing is kept

Every instrument I built that tried to infer **what a thing is** from its shape
has eventually been wrong — the geometric masonry filter, the door-leaf filter
that returned citizens, the float detector that returned lamp bulbs, the box
face. Every one was fixed by the world **declaring** something instead:
`userData.mod`, `userData.masonry`, `__frontages`, `declareDoorWorld`.

> **An auditor outside the code can measure what a thing looks like. It cannot
> reliably infer what a thing is.** The declarations added this session are worth
> more than everything I found with them.

Two secondary rules that earned their place:

- *An unread screenshot is not an observation* — now `GOTCHAS.md` §20 — **and a
  read screenshot is not an observation of what you aimed at.** Five of six of
  my early frames were pointed at nothing.
- *Establishing that a defect is real is not the same as establishing that it
  matters.* I carried the 12 mirrored pennants for eight rounds before asking
  whether they were visible. They are not: the art is a symmetric triangle.

## Left

Nothing assigned. Queue `## Now` items are all worked; `## Next` (pattern #1) is
closed clean. One blocked item above.

## The four queue items, each pinned to where it is answered

The desk has not touched `queues/AUDIT-seams.md` in fifteen hours and all four
boxes are still unticked. The README says the report is authority and the queue
is only the desk's belief, so this is not a discrepancy — but a reader comparing
the two deserves the mapping rather than my word.

| queue item | where it is answered | outcome |
|---|---|---|
| **Fix the probe harness, then grade all 45** | `request-audit.md` | harness fixed (scripts made self-locating); **all ~45 graded**; re-graded after the four landings; the last NOT DONE — wheel arches — closed, and since **reframed**: the reported fault is fixed, what remains is a taste ruling |
| **Sweep the block for sidewalk encroachment** | `lane-audit.md`, `scripts/corridor.mjs` | **0 stretches under 1.00 m** across both walks. 1.15 m built, 0.77 m lived, never impassable. Mutation-tested: a planted 0.50 m post is caught at 0.77 m, a box in the road correctly ignored |
| **Walk every interior and audit it as a set** | `interior-audit.md` | walked by hand, and independently at **195/195** by `interiors-walk` — an instrument I do not own, reproducing its owner's figure, re-run and still 195/195 after the world-coordinate migration |
| **Re-verify pattern #1 after A's fix** | `seam-audit.md` | done — **and my own masonry check retracted as circular**, replaced by mainline's material-index version. The `[C]` marker on that row is the result |

**Two things the queue could not have asked for**, because they were found on the
way: the **floating litter** (18 visible, quantified against a target, guard
written and registrable) and the **two-suite gap** (14 E-scripts outside
`npm run checks`, so "the board is green" meant one board).

**Where I was wrong is in the corrections ledger above** — fourteen entries, of
which the three worth re-reading are: reproducing another agent's number with the
same flawed method and calling it independent confirmation; discarding the one
correct keeper reading because it did not repeat; and dismissing my own
instrument's true report by pattern-matching it to a familiar failure.

> Each was precise, reproducible, and about the wrong thing. **That is the single
> lesson this audit has to give: a number is not a measurement until you know
> what frame it is in** — which clock path, which material, which registry, which
> build, which instant, which suite.

## [C] Apron and forecourt: both CONFIRMED (build e2ead9895)

**The apron (B).** I missed this last time by standing inside the lot; the row is
about the driveway where the lot meets the walk, so the shot has to come from the
road. `kerbcut.mjs:174` already knew the line — CZ 2.6 — which is how I found it.

A ramp is a *profile*, not a look, so I measured it and brought a contrast case:

| | driveway z=2.6 | plain kerb z=-20 |
|---|---|---|
| profile | 0 -> 0.140 over **x 5.00 -> 7.00** | 0 -> 0.140 in **one sample** |
| shape | 8 steps of ~1.35 cm, **2.0 m at ~7%** | a single 0.140 step |

The contrast is the whole proof. A single scan showing a rise could be anything;
the same scan 22 m away showing a one-sample step is what makes it a ramp.

**Overlap answered itself from `groundAt`.** If the walk sheet still ran beneath
the apron, the walkable top across x 5.25-7.00 would read 0.140 for its whole
length. It reads the ramp — so the walk is genuinely cut for the driveway, and
the apron reaches walk height exactly at its own far edge. That is a stronger
answer than looking for z-fighting, because it uses the function the player's
feet actually use.

**The forecourt (B).** Textured, and it reads as stone: at 4x the flags carry
per-slab grit and joints with tone varying flag to flag, and the treads carry
aggregate. The real answer to what the user saw is that the forecourt is a WARM
sand stone and the walk in front is a COOLER grey — the "patches" are a change of
material at the building line, which reads as shadow only while both are flat
fills. Confirms b0b69cb48 independently of the builder.

**[Is] Only grainless surfaces left in frame: the two planter boxes.** Smooth
cream, no grain. Matches B's "12 flat" being copings, posts and planters. Not
this row; noted so it is not rediscovered as a new fault.

## [C] Cups CONFIRMED; the trash/puddles row split (build e2ead9895)

**Cups (B) — CONFIRMED.** B's tag at `props.ts:2597` is what made this
answerable at all; four of my shape-based finders failed on exactly this kind of
question earlier in the audit.

| type | n | share |
|---|---|---|
| flattened cardboard | 5 | 35.7% |
| folded newspaper | 4 | 28.6% |
| milk crate | 3 | 21.4% |
| **fountain cup** | **1** | 7.1% |
| **coffee cup** | **1** | 7.1% |

2 of 14 = 14.3%, down from 5 of 14, and each cup type is rarer than each of the
other three. Not oversized: the fountain cup's 0.430 m box is a **straw**, and
the cup body is 0.156 m — visible only by walking to it. Both sit believably
(gutter against the kerb; under the Tony's Pizza bench beside a newspaper).

**[I] My own summary line said "not rarest" while its own table said otherwise.**
The rank check took the first `/cup/` match and ignored the second, so two types
tied at n=1 for last were reported as fourth of five. This is the SECOND time in
this audit a summary line has contradicted the data directly above it —
`benchlean.mjs` filtered on `tiltX` while the lean was in `tiltZ`, and I nearly
sent a satisfied request back to OPEN on it. **When a one-line verdict and the
table disagree, the table is right and the verdict is a bug.**

**[I] A clean 0 over an empty set, again.** My first litter run reported "0
inside a collider" — off ZERO pieces, because the tag is on the litter GROUP and
I had filtered `isMesh`. GOTCHAS 34. The script now exits 3 when nothing carries
the tag. The finding only becomes evidence once it is 0-inside over 14 REAL
pieces.

**[R] The trash/puddles row split in two.** One row was carrying two distinct
user complaints that need two different kinds of answer:

- *"trash cannot be clipping through stuff like this"* — a factual claim.
  0 of 14 inside 364 colliders, 14 of 14 grounded within 3 cm. **CONFIRMED.**
- *"these are puddles and they look awful"* — an aesthetic verdict. The artefact
  class is gone (contrast the right way round, edges soft and irregular, no hard
  rectangles at 3x) so OPEN would be false, but I am not the eye that said
  "awful". **Stays LANDED; the desk should show the user `shots/cp-pud.png`.**

That second call is downstream of the ATM: I confirmed it from a viewpoint I
chose rather than where a player stands, and the user's verdict overturned mine.
An auditor can settle whether an artefact exists. It cannot settle whether
something looks good.

## [C] The ATM, attempt 4: CONFIRMED — and the method is the finding

This is the row I got wrong. I confirmed attempt 3 from square-on, 1.4 m out,
centred, and the user overturned me. So the method changed rather than the
standard: **I walked the pavement past it looking AHEAD.** The walk band at
z 7.29 is x -5.0 to -7.2, so a player is at about x -6.2 — that is the viewpoint,
and it is not one I get to choose.

All four named properties, measured:

| ask | measured |
|---|---|
| inlaid | 0.170 m recess, 5 pieces, lit side `#8a8d92` / shadowed `#6b7076` / back `#23282d` |
| slanted | three rakes — screen 8.1, keypad 33.7, apron -21.3 deg |
| lower | screen 1.30-1.72, keypad 1.18-1.30 world = **1.04-1.58 m above the pavement** |
| more detail | 8 parts; CRT with text, card slot + indicator, 3x4 keypad, cash slot |

**Why three attempts were rejected and this one is not.** At 4% body-to-wall
separation the recess had nothing to read against, so from where a player walks
there was no ATM to see — the geometry was right and invisible, which is
GOTCHAS 23 (real is not the same as visible). In `aw-pass-3m.png`, 3 m out,
walking, looking straight ahead and NOT at it, the dark body now reads plainly as
a unit set into a pale wall. That is the change. A checklist of four satisfied
properties would not have told me this; the walking shot did.

**[I] My own separation figure was garbage and I nearly cited it.** `atmmeasure`
reported "68% at best" against the wall — but the filter picked the nearest
object with width <= 0.6 m, which is a *narrow* object, i.e. a pillar, 1.7 m
away. It never looked at a wall. Discarded. **A number computed by the wrong
filter is not a weak measurement, it is a different measurement**, and it read
as corroboration of D's claim purely because it happened to point the same way.

**[I] D's 0.900 m and my 1.080 m were never in conflict.** The machine FACE runs
apron-bottom 0.82 to screen-top 1.72 = 0.900 exactly; my figure included the
niche lip and sill. Same object, different bounds. I record this because my first
reaction was "the builder's number is wrong", and reconciling took one line of
arithmetic — cheaper than a disagreement.

**[Is] `material.color` is a TINT.** screen, keys and apron all report `#ffffff`
because they are textured; appearance is texMean x tint, so the body tone D
changed cannot be read off `material.color` at all. The five niche tones are
untextured and therefore readable. Fourth time this has mattered.

## [C] The pickup bed: CONFIRMED — and the tag I asked for was never needed

**[R] Withdrawing my own request for `userData.variant = 'pickup'`.** I filed it as
the one line that would "close this permanently". It was unnecessary. `wheelZ` is
unique per kind (sedan 1.45, hatch 1.2, **pickup 1.65**, van 1.5) and `cars.ts:813`
already publishes `userData.wheelbase`, so **wheelbase 3.30 is the pickup** — all
four found without touching src. *Before asking a builder to publish a property,
check whether it is already published under another name.* Two of the four tags I
requested this audit may be like this; I will check the others before they cost
anyone a commit.

**Tyre in the bed cavity: no.** H built real wheel housings.

```
Cylinder  x 0.70..0.94   y 0.017..0.663  z 1.31..1.99   rear tyre
Box       x 0.66..0.70   y 0.500..0.720  z 1.22..2.08   housing inner panel
Box       x 0.66..0.90   y 0.720..0.760  z 1.22..2.08   housing cap
```

Panel face flush at 0.70, cap clearing the tyre top by **0.057** (the same figure
as the confirmed wheel-arch row), housing overrunning the tyre by 0.09 at each
end. Enclosed on every side, identical on all four pickups, and seen: the bed is
a clean grey tub, the faint step in it IS the housing.

**[I] I nearly filed the exact opposite finding.** I built the cavity box from the
source constants — `HW 0.9`, `WALL_T 0.16`, so x +-0.74 — and got "tyre intrudes
4 cm, all four trucks, both sides". That cavity does not exist over the axle,
where the housings narrow it to +-0.66. **The constants described the bed; they
did not describe the bed AT THE AXLE.** A source-derived envelope is a hypothesis
about the geometry, not the geometry. Measuring the real meshes killed it in one
run — and had I not looked first, I would have sent a correctly-fixed row back to
OPEN with confident arithmetic behind it.

**Block outside the silhouette: none, 0 of 23 vehicles.** The one apparent outlier
at 2.139 m is a `1.7 x 0.1 x 1.5` slab rotated 0.950 rad at the hood position —
**an open bonnet on the car lot's display truck**, which has 20 parts against 16
on the street trucks and appears in `af-apron.png`. Set dressing.

**[Is] Rotation inflates an AABB; ask the vertices.** My first check filtered on
`geometry.boundingBox` height and reported "nothing over 1.0 m tall" while a
transformed corner sat at 2.139. The geometry was 0.1 m thick and raked 54 deg.
When a world AABB and a geometry bbox disagree, the transform is the answer.

## [C] "this guy is floating": CONFIRMED — I built the instrument I said I lacked

Last session I recorded that this row was **unverifiable by my instrument**,
because the float lives in the atlas and mesh-bottom-vs-`groundAt` can never see
it. That was true, and it was also the wrong place to stop. `footpaint.mjs` reads
each figure's OWN atlas frame, finds the **lowest opaque pixel**, converts it to a
world height and compares that to the ground. *It is the painted shoe that has to
touch, not the quad.*

| frame | n | atlas padding | painted foot vs ground | off-ground |
|---|---|---|---|---|
| **64-row (citizens)** | **18** | median 0.119 | **median 0.000, max 0.000** | **0 of 18** |
| 2-row (not people) | 2 | 0 | 2.56 | 2 |

**The proof needs all three numbers, and any one alone gives the wrong verdict:**

- quad bottom vs ground — off on **20 of 20**. My old check. Would have failed it.
- atlas padding — **unchanged**, still 4 empty rows of 64. Would have failed it.
- painted foot vs ground — **0.000**. The only one the user can see.

H did not repaint the atlas. They dropped the quad by exactly the padding, so the
quad now hangs below ground and the painted shoe lands on it. That is why the
two obvious checks both say "broken" about a thing that is fixed.

**[Is] The two 2.56 m outliers were never people.** Splitting the sample by frame
height separated them at once: 2-row frames, part of the park pergola
(`pf-float.png`), up where they belong. **A population that mixes citizens with
whatever else carries an atlas frame will report floating figures that are not
figures** — the split is what makes "0 off-ground" mean something.

**[R] Closing the loop on my own rule.** I wrote last session that "for a
billboarded sprite, position and orientation are in the transform, but everything
you can SEE is in the frame. Reach for the atlas first." I then filed the row as
unverifiable rather than reaching for the atlas myself. **Stating the rule is not
applying it.** This is the fourth property this audit that lived in the frame
rather than the transform, and the first one I have actually measured there.

## [C] Grasses CONFIRMED — and I counted 51 against a stale build first

**The finding.** 273 tufts in the world; the five on the street kerb seam are
exactly the five B names (west −105.62, −92.78, −8.78; east −91.88, −50.78, all
at x ±4.95). Gaps of **12.8, 41.1 and 42.0 m** against the old 2.4 m spacing —
that is the whole point, since the user objected to a LINE, not to weeds. Park
222 and lot 39 correctly untouched. Bare gutter both ways in `wd-gutter*.png`.

**[Is] The signature came from the source.** `weeds.ts:101` builds every tuft the
same way — a Group of exactly two PlaneGeometry quads at 0.30 × 0.35 × scale with
`position.y == height/2`. Filtering on that ratio plus that offset found all 273
with **zero** non-pairs. Four shape-based finders failed earlier in this audit
because I invented the shape; this one is read off the constructor, and the tag
I would otherwise have asked B for was unnecessary. *Second time this session
that reading the builder's own construction beat requesting a new tag.*

**[I] My first count was 51 street tufts, and it was wrong — stale build.** I had
rebuilt the preview at the START of the session; B's commit landed after it. The
bundle I measured was `e2ead9895`, the tree was `4a311be0a`. One `npm run build`
took it from 51 to 12, and from "44 → 5 is false" to "the five are exactly where
B says".

This is the FOURTH stale-preview near-miss in this audit and the most expensive
one yet, because unlike the others it produced a *plausible* number rather than a
crash — 51 sits believably between the old 44 and nothing. **A stale build does
not announce itself; it answers confidently about a world that no longer exists.**

The guard already exists and I was not using it: the build hash in the corner of
every screenshot. `wd-gutter.png` reads `4a311be0a+`, the earlier shots read
`e2ead9895`. **Rebuild before verifying any row that landed after your last
build, and read the stamp in the shot before believing the count.** `reportWorld`
in `scripts/lib/which-world.mjs` exits 3 on a SHA mismatch and belongs at the top
of every verification script, including this one.
