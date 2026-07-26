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

## [C] Bench sit CONFIRMED; doors clean; the interior report corrected

**Bench (B) — CONFIRMED.** Mapped a 10 × 8 grid around it, warping to each cell,
pressing E and reading `seated()`. `[E] sit at the stop` fires across x 6.0–6.8
over ~2.4 m of z — the whole pavement zone including the lane centre — and the
prompt is on screen while simply walking past (`bn-345.png`). 0 of 40 roadway
cells seat the player, and the three cells hard against the bench are not
standable, which corroborates B's *reason* and not merely their conclusion.

**[R] Flagged an interpretation rather than burying it.** The user said *"from the
street"*. Roadway or pavement are different requests, and B declined the roadway
deliberately. I confirmed on the pavement reading because the prompt now appears
unprompted while walking — but the ambiguity is written into the row, not
resolved silently in my favour.

**Doors — nothing wrong, and the check can prove it.** All 10 published doors:
none swallowed by a collider, ≥1.3 m to back away, ≥4.1 m across, camera lands
within 0.00 m at every one. GOTCHAS §8 has not recurred. **Positive control:** the
centre of the world's largest collider (19.8 × 18.0 m) reads as inside, so the
zero is a measurement rather than a detector that cannot see.

## [I] The stale-build fault, twice in one day, in BOTH directions

This is the pattern worth keeping. The same root cause produced two opposite
failures within an hour:

- **Toward a false negative** — I counted 51 street weed tufts and was about to
  send correct work back to OPEN. The current build has 5, exactly where B said.
- **Toward a false positive** — I published `interior-audit.md` calling the
  bodega the worst room in the set, measured against rooms that had already been
  rebuilt. The library is worse, at 2.10 m against the bodega's 3.85 m.

**A stale build does not announce itself.** Both numbers were plausible: 51 sits
believably between the old 44 and nothing, and a 163 m² library is exactly what
the file said last week. Neither crashed, neither looked odd.

The guard was in every screenshot the whole time — the build hash in the corner.
`wd-gutter.png` reads `4a311be0a+`; my earlier shots read `e2ead9895`. I had that
evidence on screen and did not read it, which is GOTCHAS §20 ("an unread
screenshot is not an observation") applied to a field I *did* look at without
seeing.

**Standing rule for the rest of this audit: rebuild before verifying any row that
landed after the last build, and read the stamp before believing the number.**

## [C] Crowd jam CONFIRMED — and the positive control caught my blind spot

**The finding.** 240 s at 4 Hz. Worst stationary run **16.0 s**, a `window` act
mid-block, against H's before-figure of **29.8 s** parked on a crossing endpoint.
All six walkers moved 87–250 m. **Largest pile-up anywhere: 2** within 1.5 m.

**[I] My first two runs were an empty set and read exactly like a pass.** Ninety
seconds of sampling, a clean "no jam at the crossing" — over a window in which
**nobody crossed**: 0 of 2172 samples had a walker in the roadway. The report
would have been true, confidently stated, and about nothing.

What saved it was writing the control to fail loudly rather than to agree with
me: *"did anyone actually cross during the sample?"* printed **0** and said so.
Extending to 240 s gave 3 crossings and 222 roadway samples, and two walkers
standing on the very endpoints H names.

**Why the short sample missed.** Both crossings are at the junction
(`crowd-net.ts:152` — only the bodega corner has a kerb ramp), and six walkers
spread over ~110 m of block reach it rarely. **The rarer the event, the longer
the window has to be before absence means anything** — and I had no way to know
that without asking the question directly.

This is the third empty-set near-miss of the audit (litter-inside-a-collider over
zero pieces; doors-swallowed before the control; this). The pattern is the same
every time: **the check produced the number I expected, from no observations.**
A positive control is not a nicety on a green result — it is the only thing that
distinguishes "nothing is wrong" from "nothing was looked at".

**[Is] Residual, reported rather than smoothed over.** A single uninterrupted
`window` act measures 16–18 s across four runs against `WAIT.window = [5, 12]`
(crowd.ts:257). My still-threshold is 0.08 m/s so ~2 s of easing at each end may
explain it; I cannot separate the two with this instrument and have said so on
the row rather than either ignoring it or calling it a defect.

## [C] The desk's backlog: four LANDED settled, one CONFIRMED withdrawn

Build `f4e54cbce`, rebuilt before every check (GOTCHAS §26 — the world was stale
twice today and both misses are recorded above).

| row | verdict | the thing that settled it |
|---|---|---|
| D cat, right of the newspaper | **CONFIRMED** | right of frame centre from the mouth; 0.60 m in −z off the paper |
| D crates | **CONFIRMED** | one z, stagger **0.000**, backs **15 mm** clear of the proud face, 3.19 m from the `[E]` circle |
| D bodega awning | **CONFIRMED** on symptom + shipped value | `rotation.x = 0.18`; BODEGA legible from three angles |
| A diner facade | **CONFIRMED**, row created | glazing **−450**, fascia **+200**, transom **+130**, stallriser **+110** |
| E park stripes | **WITHDRAWN → OPEN** | they do not carry to the entrance |

**[R] The blade and the facade were being conflated because one of them had no
row.** The ledger held `diner blade illegible` CONFIRMED and nothing at all for
the facade, so a live *"looks really bad rn"* had no line to sit on and the
neighbouring green read as if it covered both. **A request with no row is
invisible to a process built on rows** — that is a ledger fault, not a builder's.

**[I] I withdrew a second CONFIRMED, for the same reason as the first.** The park
stripes are real — `ps-along.png` shows them plainly. But I judged them from on
the field looking down its length, and the user judges from the entrance, where
the mown panel is a distant rectangle behind railings and the lawn at your feet
is plain green. **The ATM and the stripes failed identically: I chose the
viewpoint that shows the feature rather than the one the player arrives at.**
Twice is a habit, not an accident. The rule I should have been applying since the
ATM: *for anything the user judges by eye, the first shot must be from where they
were standing when they complained.*

**[Is] Two things I could not measure, said rather than smoothed over.** The
awning's slope — the bodega is a corner shop so "outward" is the chamfer normal
and averaging a box's end face returns level whichever way it tilts; and the
stripe amplitude metric counts tree foliage as grass. Both are on their rows so
nobody inherits a number I do not trust.

**[I] The sign of "outward" bit twice in one day** — crate back faces (max z, not
min, because the bodega frontage faces −z) and the awning normal. On this street
"outward" is per-frontage data (`__frontages.outward`), never an axis to assume.

## [C] Bodega corner: D's half CONFIRMED, the paving routed to B

**Visual** — walked to D's own check point (6.4, −97.4). The corner reads as a
proper cut corner: 45° canted bay, recessed door, **OPEN neon in the door's upper
panel rather than over glass**, and one fascia line / opening / reveal / cill /
stallriser across both wings. The brick piers either side are structure.

**Collision — no fault found.** Four points stood cleanly, the door measures 3.0 m
of back-off and 6.0 m across, and the collider corner (6.75, −93.75) sits exactly
on the chamfer line through the door — both satisfy x+z = −87 — so it is
inscribed within the cut, not protruding into it.

**[I] My occupancy map produced 126 false "walk-through" cells and I nearly filed
them.** The test was: is this point inside a collider, and is there a mesh above
it? Sound in principle, and wrong here, because *"is there a mesh above it"* was
answered from **AABBs** — and the canted bay's bounding box covers the entire
square corner it was cut from. **This is the third AABB-inflation miss of the
audit** (the pickup hood at 2.139 m; the citizen quads; now this).

The rule that would have caught all three: **an AABB answers "could this object
reach here", never "is this object here".** For anything rotated or cut, it
over-reports by construction. When a test's conclusion depends on occupancy
rather than extent, it needs vertices or a raycast, not a box.

**[R] The one piece still standing is B's, so I routed it rather than sitting on
it.** The corner paving is scored as a square 90° arris while the building cuts
at 45°, so the joints run into the bay's foot instead of meeting it — visible in
`bc-corner.png`. D established that no ground plane runs under the bodega, so
nothing clips; the joints simply do not know the bay is there. `ct/tex-ground.ts`,
B's file. New OPEN row filed with the evidence.

**[Is] Second untracked request found today.** D added their own row after finding
this had sat in `FEATURE-REQUESTS.md` since the block was re-cast with no ledger
row; the diner facade was the same. **A request with no row is invisible to a
process built on rows** — and both were found by someone tripping over them, not
by the process. Worth the desk reconciling FEATURE-REQUESTS against LEDGER once.

## [C] Per-side car paint CONFIRMED — checked per side, as the user asked

The user's own diagnosis named the method: *"confirm the logic independently per
side of the car."* Checking one side is how the fault survived, so the audit had
to do the thing the fix was about.

**Where the check has to live.** The body is one `BoxGeometry` with a 6-slot
material array — which is precisely the shape of `[sideT, sideT]`. There is no
"flank mesh" to find; my first two attempts looked for one and returned
**CANNOT ANSWER**, correctly. The check belongs at the material GROUP: derive
`u → z` from that group's own vertices, read that group's own map, convert its
dark columns to world z.

| kind | features | own texture per flank | flanks agree |
|---|---|---|---|
| sedan | 9 | yes | yes |
| pickup | 7 | yes | yes |
| hatch | 10 | yes | yes |
| van | 7 | yes | yes |

Sedan shuts −1.008 / 0.164 / 1.055 against −0.961 / 0.211 / 1.102, bracketing
H's −0.98 / 0.19 / 1.08. The rear shut sits at ~1.05–1.10, not 1.40.

**[I] I nearly filed a false fault on the hatch, and the shape of the numbers is
what saved it.** My first pass printed "hatch: SIDES DISAGREE, 8 of 10". But the
per-feature differences were **perfectly uniform** — sedan all 47 mm, van all 48,
pickup all 31–32, hatch 79 with two at half a texel.

*A real misalignment varies per feature. A constant offset across every single
feature is the instrument, not the world.* I read each column at its centre
`(x+0.5)/W`, and the two faces' UVs run in opposite world directions, so the same
painted edge is reported one column apart on the two sides.

**The rule:** a fixed metric tolerance is wrong for a quantity **quantised by
texel size**. 60 mm passed the sedan (47 mm texel) and failed the hatch (79 mm
texel) for reasons that had nothing to do with either car. The tolerance has to
be the paint's own resolution, derived per vehicle.

This is the same family as the AABB misses: **the instrument's own units leaking
into the verdict.** Third distinct instance today, after the green-pixel metric
counting foliage and the AABB occupancy test.

## [C] The soldier course is turned 90° — a position check cannot catch a rotation

The row I routed to B came back LANDED within the hour. It is **not** done, and
the way it fails is worth more than the instance.

**Measured** from the mesh's own vertices, projected onto the cut face's own axes
(along-face keeps x+z constant; across-face is the normal):

    along the face   0.42 m
    across the face  2.60 m      <- B's two numbers, swapped

**Seen** at 2.6× from B's own suggested viewpoint (`sc-crop.png`): the flags run
from the door foot **straight out into the pavement like a plank**, divided by
cross-joints, instead of forming a band across the bay. In the same frame the
square field joints still strike the canted wall at an angle — the fault the
course exists to cure.

**Why every check passed.** B placed it by walking into the wall, which is a good
method and got the OFFSET exactly right: the band's centre sits at x+z −87.48,
correctly out along the normal from the face at −87.01. And `footprint`,
`builtlane`, `kerbcut`, `basin` and `wetness` all pass.

**None of those constrain which way a band is turned.** Walking finds *where a
surface is*; it says nothing about *which way an object faces*. This is GOTCHAS
§33 again — set a thing from what it should FACE, not from a number that looks
right — and it is the seventh facing fault in this project.

**[Is] The generalisation worth keeping:** a position check and an orientation
check are different instruments, and passing the first is routinely mistaken for
passing the second. Every facing bug this project has had shares that shape:
the diner blade (mirrored), the keeper bearing (decoded from the frame), the
awning (comment asserted the opposite of the number), the cars' flanks (one
texture, two directions), and now a band correctly placed and wrongly turned.

**[I] I nearly let this pass on the strength of the write-up.** B's note is
careful, quantitative and honest about its own method, and my first instinct on
reading "placed by walking into it, not by reading bounding boxes" was that it
must be right. **The quality of a builder's reasoning is not evidence about the
world** — I only caught it because the numbers came out as B's own two figures
transposed, which is a pattern worth watching for on its own.

## [C] "im literally stuck here": the map is clean, the crowd is not

Swept the whole world rather than hunting the one spot: gridded 100 × 138 m at
0.4 m and flood-filled it **as a disc of radius 0.36**, the player's own
footprint, not as points.

**8592 m² in ONE connected region.** There is nowhere you can walk into and not
walk out of. That is a real negative result, and it relocates the fault.

**[I] One of my four "pockets" was the instrument.** Re-tested at 0.1 m, the
314 m² region at (57.6, −114.2) reaches straight out — my 0.4 m sampling had
**closed a gate that is genuinely open**. The other three are the churchyard's
two side strips and a park bed, behind continuous railings; colliders here are
2D AABBs with no height, so jumping cannot enter them either.

*A grid coarser than the gap it is looking for will invent walls.* I only caught
it by re-testing at a resolution finer than the smallest opening that matters —
which for a 0.72 m player means the grid must be well under 0.72 m, and 0.4 was
not.

**[Is] The churchyard gate is real and E's CONFIRMED stands.** The railing runs
x 7.00–7.30 over z −77.95…−68.00, and a *second* section covers −86.00…−81.05,
leaving a 3.1 m opening at z −81…−78 — exactly where the church door sits at
(9.6, −79.5). I nearly recorded a conflict with that row before reading the
second collider.

**Where the user actually got stuck.** A citizen box is 0.5 m wide and people are
solid, so wherever a fixture leaves under **1.22 m** (0.72 player + 0.50 citizen)
one pedestrian standing still closes the walk below the player's own width:
**24 of 1380 lane samples**, ~16 excluding the world's end cap. Tightest **1.06 m
at side st north x 10.5**, where a citizen leaves **0.56 m**.

**A wall alone never traps anyone in this world. A wall plus a person does.** The
fix belongs in the crowd or in an unstick, not in the map — and `crowd.ts`
already computes how wide the thing it is walking on is, so "do not come to rest
where the lane is under 1.22 m" is expressible where the knowledge already lives.

## [C] Tax service door: aligned — and a measurement I am NOT reporting

**The exterior alignment is correct.** The published door point and the
frontage's `doorWorld` agree exactly at z −20.127, and the `[E]` stand point is
square in front. Aiming the camera at that position puts the door painted on the
facade **within ~2 px of frame centre** (`tx-face.png`). Aligned.

This was one of the nine untracked rows I filed, and it appears to have been
fixed at some point with the ledger never hearing about it — which is the case
for filing them OPEN rather than guessing.

**[I] I built a cross-check, got six clean-looking numbers, and am binning them.**
The interior audit listed "does the interior door agree with the exterior
doorway" as not covered, so I measured the door's position as a FRACTION along
the room's street wall against the exterior door's fraction along its frontage:

| shop | exterior | interior | |
|---|---|---|---|
| THRIFT | 69.5% | 69.5% | exact |
| PAWN | 50.0% | 61.6% | off 12% |
| A-1 TAX | 14.4% | 28.0% | off 14% |
| DINER | 74.1% | 37.0% | off 37% |
| BODEGA | 40.1% | 76.7% | off 37% |
| BURGER | 74.3% | 34.3% | off 40% |

**That table is not evidence and I am not filing it as findings.** It rests on an
assumption I never established: that the room's local +x maps onto the frontage's
low-to-high direction. If that mapping flips per room — and the rooms sit on a
belt with no published orientation — the "errors" are my arithmetic, not the
world. *One shop matching to 0.1% while five miss by 12–40% is far more like a
mapping artifact than like five independently broken rooms*, and a real fault
distribution rarely has one perfect member.

**What would make it checkable:** the rooms need to publish which wall faces the
street, the same one line the four frontage-less buildings needed. Until then
this check cannot be run, and running it anyway would have sent three builders
after nothing — which is the failure the desk's harness rule exists to prevent.

**[R] Recorded as the third "cannot answer without a declaration" of this audit**,
after the missing frontages and the litter tag. The pattern is consistent: *when
a property lives in a convention rather than in the data, an outside check cannot
see it, and guessing the convention produces confident nonsense.*

## [C] The re-reported crosswalk: I measured the world the USER plays

H's note ended with an open question addressed to nobody in particular:

> *"The user plays the live integration world on 5177, not my 4187 … Desk: worth
> someone counting citizens on 5177."*

H was right not to measure it — GOTCHAS §26, do not quote numbers from a tree
that is not yours. But **an auditor's tree is not the point; the user's world
is.** That question was mine to answer and had been sitting unanswered.

| | shipped 4184, 360 s | live 5177, 300 s |
|---|---|---|
| walkers | 6 | **6** |
| worst stall | 12.0 s (the `window` cap) | 20.0 s (`window`, 8 s over) |
| largest cluster anywhere | 2 | 2 |
| kerb-to-kerb transits | 4 | 3 |

**The live world has six walkers too**, so the density in the user's shot does
not come from a bigger street crowd. Nor from static figures: the scene holds 21
atlas-framed people against `walkers()`'s 6, but **13 of the other 15 are shop
keepers on the interior belt**, and **zero stand within 12 m of the junction**.

**What this does not settle, and I have written it on the row:** six people
cannot make "tons", so nobody has reproduced the user's scenario — we have only
shown the mechanism is gone at the density that exists.

**[I] I corrected my own earlier CONFIRMED rather than leaving it to read well.**
That row's headline was *"worst 16.0 s now against H's 29.8 s before"*. H has
since established that the old counter incremented on any frame with somebody
inside the 0.7 m lookahead — **including a healthy follow at matched pace** — so
29.8 s measured proximity, not stalling. My after-numbers are unaffected and the
verdict stands, but the comparison was against a baseline that does not mean what
it says.

**The lesson is not "H was wrong"** — H found and published the error themselves.
It is that **I took a builder's before-number and used it as the spine of my
verdict without asking how it was counted.** A measurement I did not make is not
evidence I can lean on, and "the builder measured it" is the same class of
mistake as "the builder confirmed it", which this whole ledger exists to prevent.

**[Is] The row's own evidence is truncated mid-sentence** (749 chars, ending
"…stood the player at the junction:"). H's stress-test result exists only in
`notes/H-crossing-pileup.md`. Worth the desk checking whether something truncates
long evidence on write, because a row that stops mid-sentence still reads as
complete to `ledger.sh`.

## [C] Two rejections closed, and a number I refused to quote

**Bodega soldier course — CONFIRMED, my own rejection closed.** Re-measured with
the instrument that caught it: **2.83 m along the cut face, 0.42 m across**,
where the rejected version was 0.42 along and 2.60 across. It spans x+z
−87.59…−87.00, hugging the face and standing 0.41 m out, still 4 mm proud. Seen
from the same viewpoint as the rejection: the flags run parallel to the bay's
foot and **the field joints now die against the band** instead of striking the
canted wall.

*Worth noting the loop closed in about an hour, and it closed because the
rejection carried the measurement that made the fault reproducible.* A rejection
that says "looks wrong" cannot do that.

**The bank front/side — CONFIRMED, and it was raised twice, so it got a wider
check than the one colour a builder named.** `#53382e` is on zero building faces
world-wide, the hotel/casino flank now carries brick with courses and windows
matching its front, and FIRST FEDERAL's return carries the same pale stone and
panel joints as its front.

**[I] My own sweep produced "143 flat-colour elevations" and I binned it.** The
filter takes whole building MESHES, so a solid block box counts as one
"elevation" and its roof tone reads as a flat face — it would have manufactured
143 faults out of ordinary geometry. **This is the second time this session I
have built a plausible-looking metric and thrown it away** (the interior door
fractions were the first), and both had the same shape: *a number that is easy to
compute standing in for the question actually asked.* The question was "does the
side match the front", which needs two faces of the SAME building compared, not a
census of everything flat in the world.

## [C] Expansive interiors CONFIRMED — and the overrun moved instead of leaving

Casino **95 → 209 m²**, hotel **99 → 286 m²**, measured against where they stood
when the user complained. The hotel is now the most open room in the world:
median aisle 11.0 m, minimum 5.27, 96% free floor, and it reads as a grand lobby.

**Also worth recording: the library recovered.** I filed it at severity 1 with a
median aisle of **2.10 m**, the tightest room in the world. It now measures
**9.7 m** on the same instrument. The fault I found mid-flight was acted on.

**[I] The finding that only a cross-check could produce.** G reasoned *"depth was
the free axis: slabs tile along X at SLAB_W 80 with every one on cz = 0, so
nothing was ever behind these rooms."* Every word is true — **of the interior
belt.** The belt has 80 m of clear space behind each room.

But the constraint was never the belt. It is the building on the street, and the
hotel's is **14.3 m deep**. So:

| | before | now |
|---|---|---|
| casino | 1.96× footprint | **1.27×** |
| hotel | 0.58× footprint | **1.67×** |

The overrun I filed on the casino was **reduced there and reproduced in the
hotel**, by a change that was locally correct and globally wrong. *A builder
working inside one room can verify everything about it and still be measuring the
wrong container* — which is the exact case for auditing ten rooms as a set rather
than ten times individually.

**[Is] Two rows by the same builder pulled against each other.** "More expansive
interiors" wanted depth; "interior doesn't match the exterior" wants the room to
fit its building. G satisfied the first in a way that worsens the second, and
neither row's own evidence could show it, because each is true within its own
frame. **When one builder holds two rows that trade against each other, only
something outside both can see the trade.**

## [C] Building depth CONFIRMED — checked against "ALL", not against the two named

The row names two shells that went 3.4 → 14 m. The user's word was **all**, so I
measured every building mass in the world instead of the two:

- **22 masses (h ≥ 8 m), and ZERO with a footprint dimension under 5 m.** The
  complaint was about 3.4 m.
- Median shallowest dimension **12 m**, max 18.
- The two rebuilt shells are **14 m** deep, matching D's re-measurement.

The four masses whose smallest dimension is ~6 m are **narrow-fronted, not
shallow** — the bodega's 6.05 m frontage has 19.7 m behind it — plus the street's
own end cap. Seen along the side street: solid multi-storey masses with receding
window lines and real returns.

**[I] The evidence had the two buildings' names swapped, and I nearly repeated
it.** D's note reads "GOLDEN ACES … at x 39.5, HOTEL ORPHEUS … at x 51.2".
`doors()` puts GOLDEN ACES at **51.29** and HOTEL ORPHEUS at **39.5**, and my own
footprints agree with the doors, not the note. The dimensions are right; only the
labels are crossed.

It matters because I had just written a finding about *the hotel* overrunning its
footprint. Had I taken the note's labels, that finding would have named the
casino — **a correct measurement attached to the wrong building is worse than no
measurement**, because it survives review and sends the fix to the wrong file.
Checking a name against the published door costs one lookup.

**[Is] Where this leaves the footprint finding.** Both shells are now 14 m deep,
so the hotel's 26 m lobby is inside a 14 m building and the casino's 19 m room is
inside a 14 m building — **the deepening did not close the gap I filed**, because
the interiors grew further than the shells did. The two rows remain in tension
and the numbers are on both.

## [C] Tax preparer CONFIRMED; librarian sent back — position is not orientation

**Tax preparer — CONFIRMED.** Behind the desk, facing into the room, and the
entrance is at that end, so he faces arrivals.

**Librarian — BACK TO OPEN.** She is **0.39 m in FRONT of the desk**: she stands
at z 4.45, the desk spans z 4.84…5.56, and the room she serves is toward −z.
Seen from the customer side, her **whole body including her feet** is visible
over the counter's front panel — if she were behind it, the counter would occlude
her from the waist down.

**[I] The second position/orientation confusion today, and they rhyme exactly.**

| row | asked for | builder changed | result |
|---|---|---|---|
| soldier course | a band **along** the cut face | its offset (placed by walking) | correct position, wrong rotation |
| librarian | to be **behind** the desk | her facing (`Math.PI`) | correct facing, wrong position |

Both builders verified the quantity they changed, and both verifications passed.
**A check derived from the fix confirms the fix; only a check derived from the
REQUEST can confirm the request.** G's note even says *"she was behind it and
facing Math.PI"* — the premise that she was already behind it went unmeasured,
and it was the false half.

*The cheap guard for both: state the request as a measurable predicate before
touching anything — "band's long axis ∥ face" and "figure's z > desk's far edge" —
then the check cannot be about the change.*

## [C] Church CONFIRMED by walking; black stripe CONFIRMED against my own old numbers

**Church — CONFIRMED.** Swept the nave centre line as a **disc of radius 0.36**
rather than a point: **12.35 m clear from the door end**, stopping at the altar
rail; 1.15 m from the altar end because you are already standing at it. The
asymmetry is the whole finding — the long walk is now from the entrance. G
measured 11.71 m holding forward; before, the altar collider sat across the
entrance and gave 0.51 m.

**Black stripe — CONFIRMED, and this one cost nothing because I had already
measured the part.** H's diagnosis was a wheel-well lid coming through the wall.
My own part dump from an earlier session recorded the housing cap at
**x 0.66…0.90**, and the bed's outer wall occupies **0.74…0.90** — so the cap ran
the full thickness of the wall and showed outside. It now reads **0.66…0.74**,
stopping at the inner face.

**[Is] An audit accumulates its own baselines, and that is worth more than it
looks.** I could confirm this in one command because a measurement taken for a
different row three sessions ago happened to contain the before-state. Compare
the crossing row, where I had to lean on a builder's before-number and it turned
out to mean something else.

*The practical form: dump whole part tables rather than the one number a row
asks about.* `bedparts.mjs` printed all 20 parts because that was cheap, and two
separate rows have now been settled from it.

## [C] Both signage rows CONFIRMED — and a 4.8 m error in the evidence

Blade centres measured from their own geometry: **x 44.35 and x 56.05**. The ACES
figure matches G's `casino[1] − 0.95` exactly, and the sign is now at the east end
of the building as the user proposed. Seen by day and at night from along the
side street — the viewpoint where two signs on one wall compress together worst —
**both blades read side by side with neither occluding the other.**

**[I] The row claims 16.5 m of separation; I measure 11.70 m.** 16.5 would put the
other blade at x 39.55 — which is the ORPHEUS **door**, not its blade. The blade
is at 44.35.

The verdict is unaffected: separation still more than doubled from 6.9 m and both
signs are legible. But the number is wrong by 4.8 m, and *the way it is wrong is
familiar* — a building's door position standing in for a fitting's position. The
same substitution produced the swapped GOLDEN ACES / HOTEL ORPHEUS labels I
corrected two passes ago, on the same two buildings.

**When a row's arithmetic and my measurement disagree, the useful move is to ask
what the builder's number WOULD be right about.** 16.5 is not a random error; it
is the correct distance to a different object. That is worth more to whoever
picks this up than "the number is wrong", because it says where to look.
