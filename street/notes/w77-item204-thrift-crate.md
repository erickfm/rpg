# Item 204 — the trash crate in front of the thrift store

Worker seventyseven. Port **4330**, verified free with `ss -ltn` and bound with
`--strictPort`. All numbers below are off the **built bundle** at build
`481da878f`, not dev.

> *"get rid of the trash crate in front of the thrift store. or move it
> somewhere else."* — `FEATURE-REQUESTS.md:3062`

**MOVED, not deleted.** `src/proto/ct/props.ts:3617`.

---

## What it was

`drop('milk crate', -6.74, -58.2, 0.55)` — one line, in the "blown up against
the building line" group. It resolved to **(-6.12, 0.140, -58.20)**, which is
**1.12 m from the THRIFT door spot** at (-6.25, -59.32). `shots/w77-thrift-
frontage-before.png` shows it sitting in open pavement in the middle of the
frontage; `-after.png` is the same frame with it gone.

w74's scoping located it correctly and warned that its own frontage shot faced
the wrong way. It does. These are aimed with an explicit `atan2` from the
standing point to the target and I have looked at every one.

## Why MOVE and not DELETE — he offered both

`props.ts:3556`, eighteen lines above the placement, rules deletion out in its
own words:

> *"The count is unchanged at 14 so the litter population stays where it was —
> `scripts/footprint.mjs` floors it, and **thinning by deletion would have traded
> one complaint for another**."*

And `props.ts:3568`, three lines above, already says where a crate belongs:

> *"the alley, round the dumpster — crates live here, not on a sidewalk"*

So the street had exactly one crate breaking its own file's stated rule, and it
was the one he complained about. It went to the alley. Count stays 14.

## THE ROOT CAUSE IS NOT THE SHOPFRONT — the crate is pushed out of ITSELF

`props.ts:1245` blames the frontage — *"grows into the stallriser … A has since
made those shopfronts project further"* — and the queue row repeats it as a
lead. **It is wrong, and it is wrong in a way that will keep producing this
bug.** Measured with `scripts/probes/w77-what-pushed-it.mjs`, which re-runs the
`dimWorld` push-out pass's own overlap test with its own filters:

- `:1268` skips a solid with `o.userData?.litter`, but **`drop()` sets that tag
  at `:3519` on the GROUP, never on the panels inside it**. The crate's four
  uprights therefore land in `solidsNear`, the group's box overlaps them by
  construction, and the pass shoves the group clear of its own sides.
- It bites **only crates** because of the `:1271` height gate `h < 0.25`.
  Cardboard and newspapers are flatter and their meshes never enter the set. A
  milk crate's panels are 0.25 m exactly.
- **The evidence is that every crate shifts by one crate width and no flat piece
  shifts at all:**

  | authored | lands at | shift | half-extent |
  |---|---|---|---|
  | -12.20 | -11.64 | +0.56 | 0.298 |
  | -11.55 | -11.02 | +0.53 | 0.283 |
  | -6.74 | -6.12 | +0.62 | — |
  | flattened cardboard -10.60 | -10.60 | 0.00 | 0.467 |
  | folded newspaper -12.60 | -12.60 | 0.00 | 0.246 |

- The spot my new line asks for overlaps **nothing real**: the probe reports 0
  solids there once ancestry is tested the way `scripts/footprint.mjs:113`
  already tests it. It still moved +0.42 m.
- On the street the push is **aimed**: the `towardRoad` weighting (0.45) prefers
  a move toward x 0, so a crate against the west frontage is shoved **out into
  the walk**. That is how it arrived in his doorway. Nobody put it there.

### Why I did NOT fix it — this is a decision, not a tidy-up

The fix is one line (test ancestry, not `o.userData`). It also **moves the two
alley crates 0.55 m west, back to their authored spots** — and those two are
landmarks in a frame the user personally signed off. `ct/cat.ts:239-300` records
**seven** placements settled against his own screenshots, and lists *"both
crates"* among the things that must read from the alley mouth. Fixing the push
regresses an approved composition, and the crates cannot move independently of
it. **Queued for the desk; do not let someone "correct" it in passing.**

## Where it is now

`drop('milk crate', -9.30, -37.45, -0.29, ALLEY_Y)` → lands at **(-8.88, 0.006,
-37.54)**. The +0.42 m is the self-push above. **I did not compensate with a
magic offset** — the request stays honest and the outcome is recorded, because a
second hand-typed number to cancel a bug is exactly what BUILDER-BRIEF §8 is
about.

Clearances, measured (`scripts/probes/w77-alley-room.mjs`, `-what-pushed-it`):

| | |
|---|---|
| 0.90 m | from the dumpster's east face — a crate beside the bin |
| 0.54 m | from the payphone hood's west jamb |
| 0.32 m | off the alley's north wall |
| 3.44 m | from the nearest other crate |
| 4.94 m | from the cat |
| 0 | solids clipped at the landed spot |

`shots/w77-alley-crate-after.png` — my verdict on the image: it reads as a crate
put down beside the bin against the wall, which is what a service yard looks
like. Not marooned in open floor.

**The cat's frame is untouched.** `shots/w77-cat-frame-before.png` and
`-after.png` are the same picture — KOBRA left, SNAK right of the corner, both
crates, the grate below centre, the cat standing on the paper. The new crate is
124° off that camera's axis and cannot enter the shot.

## Nothing was orphaned

- **colliders: 0.** Not in `staticColliders()` and **not in `citAvoid()`** either
  — checked both, because they are different lists (`crosstown.ts:1752` vs
  `:1784`). ⚠ **This answers item 198's coordination note: the crate contributes
  nothing to pedestrian routing, so moving it changes nothing there.**
- **`[E]` spots: 0** within 1.0 m, before or after.
- **the cat: 4.94 m away**, and it is not anchored to anything — `ct/cat.ts`
  places it on two hard-coded spots, neither referencing litter.

## Verification

Built bundle, port 4330.

| | |
|---|---|
| `scripts/probes/w77-thrift-crate.mjs` | PASS — 0 litter within 3 m of the door (was 1 crate at 1.12 m), 14 groups, 512 colliders |
| **5 runs** | identical: `(-8.88, 0.006, -37.54)` yaw 0.05, exit 0, all five |
| `scripts/probes/w77-look-and-walk.mjs` | PASS — **4 walked legs**, x -6.00 and x -6.55, both directions, 14.16/14.40/14.18/14.54 m, every leg arrived |
| `scripts/probes/w77-what-pushed-it.mjs` | PASS — 0 clips at the landed spot, 3010 solids |
| `scripts/trash.mjs` | all 6 OK — 14 groups, **14 distinct yaws of 14**, all five approved types present |
| `scripts/footprint.mjs` | all OK — 25 litter meshes vs floor 15, **0 inside a building or a prop** |
| `scripts/builtlane.mjs` | all 8 PASS — narrowest 1.12 m at z -92.5, "the lane is still 2 m of nothing" |
| `scripts/crowd-walk.mjs` | all 10 OK — 0 sealed of 489 samples |
| `npm run sweep` | **0 STATION MISS, 0 COVERAGE**, 96 shots |
| `node scripts/health.mjs` | exit 0, `WORLD OK` |
| `npx vitest run` | 17/17 |
| `npx tsc --noEmit` | clean |

Pre-existing reds seen and not caused by me: `[interior:hotel] NO BUILDING NAME`
in the sweep, the THREE.Clock deprecation, the Canvas2D `willReadFrequently`
notes.

### Where my own probes lied, and what I did about it

Three of them, which is the point of writing this section:

1. **The lane check demanded 2.00 m and went red on a 1.32 m section the
   registered check calls fine.** "The 2 m lane is sacred" is the width of the
   BAND (`ct/rng.ts`: walk x 5.0…7.0), not a floor every cross-section must
   clear. What the project asserts is `ct/gap.ts`'s **PASSABLE = 0.95**, quoted
   by `builtlane.mjs:68-71`, and builtlane passes this street at 1.12 m. A probe
   inventing a stricter rule than the world's own and then reporting the world
   broken. Corrected to 0.95, with the 2.00 m figure still printed.
2. **The walk's north-bound leg walked south.** I paired key `s` with yaw π and
   double-negated: he went from z -66 to **-86.8**, twenty metres the wrong way,
   and the run printed *"covered 20.81 m"* as a success. Now every leg is 'w'
   with the yaw carrying the direction, and progress is **signed**.
3. **`w77-what-pushed-it` reported the crate clipping four solids** — its own
   panels, because it copied `dimWorld`'s `o.userData?.litter` test verbatim.
   That is how the real bug was found, so it is worth keeping: the probe had to
   test ancestry to stop reporting the false clip, and the fact that `dimWorld`
   does *not* is the finding.

Every assertion carries a population floor and a negative case: a canary group
planted at the door must be detected; a crate planted inside the dumpster must
register an overlap; standing still with no key held must not read as a walk
(0.000 m of drift, measured).

---

## FOR THE DESK — two things I found and did NOT fix

1. **`ct/props.ts:1268` — litter is pushed out of its own geometry.** Root cause
   above. One-line fix, **but it moves the two alley crates 0.55 m and re-opens
   `ct/cat.ts`'s user-approved frame.** Needs a ruling, not a builder.
2. **A 0.40 × 0.40 post stands in the west walk at x -5.55…-5.15, z -65.2…-64.8**
   (`scripts/probes/w77-frontage-pinch.mjs`). It takes that cross-section from
   2.27 m to **1.32 m** — the narrowest point on the THRIFT frontage — and the
   x -6.55 walking lane pauses ~1 s beside it in both directions. **Pre-existing:
   measured identically with the crate present and removed.** Above PASSABLE, so
   `builtlane.mjs` is right to pass it; it is still the tightest squeeze in front
   of a shop door on that block.
