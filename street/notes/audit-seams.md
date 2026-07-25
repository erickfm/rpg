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

## Project state at handoff

**Rewritten. The version that stood here was badly stale** — it reported *"28
green, 1 red"* on a suite that now registers **56** checks, and said `seats-walk`
passes, which my own later measurement contradicts. A reader lands on this
section first, so it is the last thing that should lag.

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
