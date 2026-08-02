# w39 — item 83: the instruments stop guessing which boxes walk

**Root cause in one line:** six instruments hand-rolled the same static filter —
sample the collider array twice, keep what looked the same — which classifies by
MOTION when the question is KIND, so **a citizen who merely paused was scored as
masonry** and a citizen who walked through a measured gap moved the verdict.

**Port 4180** (dev server) and **port 4181** (`vite preview`, the built bundle).
Both proved `000` before use; both shut down at the end.

## What was migrated, and what the numbers did

| instrument | registered | what it now reads |
|---|---|---|
| `scripts/gaps.mjs` | yes | `staticColliders()` for the corridor scan, the vacuity floor **and** the doorbell half |
| `scripts/builtlane.mjs` | yes | `staticColliders()`; ~70 lines and 9.5 s of waiting deleted with it |
| `scripts/unstick-walk.mjs` | yes | trap list **and** both verdicts |
| `scripts/seat-facing.mjs` | yes | the fourth copy of the snapshot filter, gone |
| `scripts/side-walk.mjs` | yes | the standable-[E] scan |
| `scripts/probes/w24-chamfer-walk.mjs` | no | §3, the copy w38 named specifically |

`scripts/lib/collide.mjs` gained `assertStaticColliders(page)`. **It guards, it
does not fall back.** `(staticColliders ?? colliders)()` would silently go on
measuring geometry against pedestrians against an older world, which is the bug
itself wearing a defensive-programming hat. It also refuses a world where
`statics.length === all`, so no run can claim stability over a sample with
nothing moving in it (GOTCHAS 71).

## The three DONE WHEN conditions, measured

`scripts/probes/w39-instruments-static.mjs` samples every migrated verdict from
**both arrays in the same frame** — two runs of this world differ, so a static
number from one run and an unfiltered number from another prove nothing about
each other. Paired samples do.

```
── CLEAN WORLD: 12 samples, 500 ms apart, while the crowd walks ──
  narrowest walk (builtlane)       static 1.12..1.12  CONSTANT  |  all 0.72..0.77  VARIES
  trap candidates (unstick-walk)   static 568..568    CONSTANT  |  all 582..584    VARIES
  red boxes (gap.ts)               static 160..160    CONSTANT  |  all 169..173    VARIES
  citizens on a measured pavement band: 6..6 across the run

── WITH A REAL STATIC TRAP PLANTED (0.50 x 0.50, mid-pavement, east walk) ──
  narrowest walk (builtlane)       static 0.72..0.72  CONSTANT
  trap candidates (unstick-walk)   static 569..569    CONSTANT
  red boxes (gap.ts)               static 162..162    CONSTANT
```

1. **Every instrument that reasons about static geometry reads
   `staticColliders()`** — the six above; the scope argument for the rest is
   below and it is measured, not assumed.
2. **A citizen walking into a measured gap changes no verdict** — all three
   static columns are flat across 12 samples with **6 citizens on the measured
   pavement bands the whole time**. The unfiltered columns swing in the same
   frames, which is the defect shown live rather than argued.
3. **A real static trap beside them is still caught** — planted, all three
   verdicts move and stay constant, and the shipped check itself goes red:

```
FAIL  and none of it is a trap to squeeze through: 1 sections under 0.95 m:
      0.72 m at z -50.5 on the east walk                          (exit 1)
```

That was a **source** mutation in `ct/bodega-corner.ts`, byte-verified
(`git diff --numstat` → `5 0`) and reverted; `builtlane.mjs` returns to
`narrowest 1.12 m`, all PASS, and `--selftest` still catches 3 of 3.

## THE HEADLINE: THIS WAS NOT HYGIENE, IT WAS A LIVE FALSE-FAILURE PATH

**`builtlane.mjs`'s unfiltered narrowest is 0.72–0.77 m — below its own 0.95 m
trap line.** The hand-rolled filter was the only thing standing between a
registered check and a *failure* every time a citizen paused on the east walk.
And 0.77 m is the exact figure `03d90436` once reported as *"a 0.50 x 0.50 post
standing mid-pavement … no citizen involved"*. It is a person; `notes/` has
carried the correction since, and the check has been one paused pedestrian away
from re-reporting it ever since.

`w24-chamfer-walk.mjs` gives the same story in counts: its filter reported
**513–514 static of 520**, and the accessor reports **508**, every time. The
difference is five or six citizens who happened to hold still for the sampled
second.

## `builtlane.mjs` lost a whole section, and its own comment asked for that

Deleted: a third snapshot 8 s later, a "ghost" list, a full re-scan without them,
and an assertion the two scans agreed. Its closing paragraph read:

> *"The better fix is not mine … so 'is this a mover' becomes a DECLARATION
> instead of an inference from two frames. That is ct/props.ts's call, and it
> would retire this whole section."*

The declaration landed with item 81. The same comment also recorded that the
guard **"IS NOT WATCHED FAILING"** — nobody could manufacture a citizen that held
still through the short window and moved later — so it was seventy lines and an
8 s wait that had never once fired. Deleting a guard is normally wrong; deleting
it *together with the defect it guarded* is the point of the migration. It is
replaced by an assertion that can actually fail: `assertStaticColliders` refuses
a world that separated nothing.

## What I did NOT migrate, and why — this is the part to check me on

**`scripts/crowd-walk.mjs` must keep `colliders()`, and this is the one I would
have got wrong by following the item literally.** Its lane check is *"a citizen
who STOPS must not seal the walk"* — the stopped citizen's own box **is the
subject of the measurement**. Filtering actors out would delete the thing it
measures and turn a real invariant into a check that cannot fail. That is
BUILDER-BRIEF §7's "never fix a failing check by loosening it", and the item's
"every instrument" wording points straight at it.

**The interior and lot checks** — `interiors-walk`, `seats-walk`, `spots-walk`,
`mirror-walk`, `door301`, `lot-frontage`, `lot-kerb-seam`, `lot-layout`,
`lotwalk`, `civic-doors-walk`, `steps-walk`, `w21-roof-climb` — were left, for
two measured reasons:

1. **No actor ever reaches them.** Over 4 s of sampling, every actor box stays
   within **x −6.25 .. 6.25**. The interior belt is out near **x 600**. They were
   never exposed to the defect. (Measured in the probe, not assumed — the
   assumption is exactly the kind this project keeps paying for.)
2. **Several of them `push()` their mutation onto `__ct.colliders()`, which
   returns the live array BY REFERENCE. `staticColliders()` returns a COPY.**
   Migrating those push sites would make their selftests silently no-op — a
   mutation test that mutates nothing and passes. This is a real trap for the
   next person and it is worth a GOTCHAS line.

**`scripts/ghosts.mjs`** is unregistered and its *subject* is the snapshot
filter — it exists to compare a short window against a long one. It is obsolete
now rather than wrong, and rewriting it would delete its only content. Worth
deleting outright, which I did not do because the item does not name it.

**Not swept:** ~140 further files under `scripts/probes/` call `__ct.colliders()`.
They are one-shot historical probes (BUILDER-BRIEF §7a), not instruments, and I
did not audit them individually.

## Derived or copied?

**Derived throughout.** Nothing here restates an actor's size, kind or position:
the split comes from the world's own `actorBoxes`, built at the two registration
hooks, and every migrated call site asks the accessor. The acceptance probe
imports `trapAgainst` from `ct/gap.ts` rather than reimplementing the corridor
maths, and takes builtlane's walk bands and unstick-walk's gap threshold from the
same literals those files use — copied, and cited here, because they are private
to each script; hoisting them is a separate item.

`ct/gap.ts` was **not edited**, as the item requires. `trapAgainst` is pure over
whatever array it is handed, so there is no correct edit to make in it — the
choice lives entirely at the call sites, which is where all of this landed.

## Verified

- All six migrated instruments green on the dev server (4180) **and on the
  rebuilt bundle** (4181), except `w24-chamfer-walk.mjs` and the acceptance
  probe, which dynamically import `ct/gap.ts` as source and are dev-only by
  construction.
- `scripts/side-walk.mjs` reports one pre-existing failure — *"bodega door still
  reachable along the north walk — got within 3.46 m"*. **It fails identically on
  the unmodified file** (checked by stashing my edit), so it is not mine. Worth
  queueing; I did not chase it.
- `node scripts/bugsweep.mjs` on the built bundle: **0 STATION MISS, 0 COVERAGE**,
  no new console errors.
- No world file changed. Both source mutations were byte-verified and reverted;
  `git status` is clean of `src/`.
