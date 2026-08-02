# w35 — item 66: is CONFIRMED a number the desk can trust?

**Port 4191** (proved free: `curl` returned `000` before I started; 4188 was
already serving somebody else's world and I did not use it). Built bundle,
`vite preview`, servers shut down at the end.

## The answer

**19 of 20 hold. Sample pass rate 95%.** One demotion, and it is not a defect
in the world.

That number is worth less than the two things under it, so they go first.

## The one demotion — L260, and why

**Row:** *"why does the lighting catch..."* — the wall-pooling taper. Demoted
**CONFIRMED → LANDED**.

**Not because the world is wrong. Because the row cannot be falsified.**

Its own auditor had already written, in the cell, *"CANNOT VERIFY with the
instruments available"*, named the fix, and flagged that `scripts/wallpool.mjs`
**reimplements** the smoothstep rather than reading the world's value. I checked
whether any of that had changed since. None of it has:

- `userData.sizeW` is carried by **0 of 8,324 objects**; the string is not a
  userData key anywhere, and no `__ct` affordance exposes the pooling registry.
  `props.ts:786` computes `sizeW = tw*tw*(3-2*tw)`; `props.ts:802` stores it on a
  registry internal to the module.
- `wallpool.mjs:78-80` carries its own hand-typed copy of that same formula.

So `wallpool` **agrees with itself**. If `props.ts` changed the rule tomorrow it
would keep printing the old answer and look right doing it. My run of it is
green and that green is not evidence about the world. A row confirmed on an
instrument that cannot distinguish the world from its own copy of the rule is
not confirmed — BUILDER-BRIEF §7, and this is the shape it warns about.

**One line re-confirms it:** publish `sizeW` on the slot mesh's `userData` the
way `printed` and `payphone` already are. Then the taper is a query instead of
an inference. I did not do it — `props.ts` is not named by this item.

Note also its SHA `5b1b8e0d4` is recorded UNRECOVERABLE, so the original
measurement cannot be re-reached either.

## The near-miss that would have been a false demotion

**L187, the cat.** I projected the cat and **the nearest floor litter** through
the live camera from the user's own station and got *"the cat is LEFT of it"* —
a clean, confident demotion of a row three people had confirmed.

It was wrong. **The nearest litter is not the paper.** `ct/props.ts:3142-3144`
drops three pieces in that alley — flattened cardboard at (−10.60,−41.45) and
(−9.40,−42.40), and the folded **newspaper** at **(−12.60,−42.05)**. Both pieces
near the cat are cardboard. Projected properly: **paper 377.5, cat 546.3,
cardboard 622** — paper left, cat middle, cardboard right, exactly the ordering
the row's own shot records.

This row is already famous for *"an offset is only right in the frame it was
computed for"*. It has a sibling, and I paid for it: **an object is only "the
paper" if you checked which drop it came from.** Selecting by proximity is
selecting by assumption.

## Are the greens real? 8/8 mutations caught

The whole point of this item is that green may mean nothing, so I mutation-tested
the checks the verdicts lean on rather than trusting their exit codes:

`facade-run` · `footprint` · `footprint-water` · `rulings-cat` · `rulings-atm` ·
`wetness` · `rain-memory` · `faces-bands` — **8 of 8 CAUGHT**, every mutated file
restored byte-for-byte. So the 19 holds rest on checks that can go red.

## The 20 rows

Drawn with `scripts/probes/w35-ledger-sample.mjs`, **seeded (20260802) and
reproducible** — re-run it and you get the same 20. Hand-picking would have
tested my mental model, not the ledger.

| row | verdict | measured |
|---|---|---|
| L80 puddles | HOLDS | `footprint`: 0 standing puddles |
| L82 isSelfLit | HOLDS | 2,719 materials: 81 selfLit, 35 printed, **0 both** |
| L106 ATM | HOLDS* | recess, 3 rakes, fascia 0.750, screen top 1.580 |
| L121 thrift facade | HOLDS | `facade-run`: 56 facades, 0 off centre, 0 off wall |
| L122 see-through | HOLDS | 16 shopfronts + bodega bay, no pavement through any |
| L125 thrift thin | HOLDS | ranks **11 of 12** from the thin end, 1.09 props/m² |
| L163 park/gazebo | HOLDS | shelter roof 4.2×4.2 at y 2.47, (−35.9,−83) |
| L167 crates | HOLDS | both z −96.685…−96.135, **stagger 0.000** |
| L187 cat | HOLDS | paper 377.5 · cat 546.3 · cardboard 622 in the user's frame |
| L195 kid's face | HOLDS | p1 (hs 0.91) head joins as one shape, all 5 views |
| L197 wetness lasts | HOLDS | road 0.2596 → 0.5822 (+1.2 s) → 0.7332 (+13 s) |
| L198 drive entrance | HOLDS | drive **21 distinct heights**, plain kerb **2** |
| L204 church crucifix | HOLDS | **exactly one**, 0.23×2.61×0.09 at (760,−11.84) |
| L215 pawn alley | HOLDS | `D-pawnalley-walk` 5/5, walked |
| L218 park benches | HOLDS | 25 seat slats, **worst tilt 0.000°** |
| L226 alley detail | HOLDS | 42 / 120 meshes in the two slots |
| L245 window corner | HOLDS | 14 reveal solids, **0 overlapping, 0 coplanar tops** |
| **L260 wall pooling** | **DEMOTED** | see above |
| L274 hermit | HOLDS | `hermit.mjs` 12/12, never seen to disappear |
| L320 library | HOLDS | 27 colliders, **0 red pairs** under the world's `gapRule` |

\* L106 holds on all four of the user's words but **this cell has a stale
number**: the apron rake is **−25.8°** where the cell records −21.3°. Also,
there are now **two** ATM installations (z 7.288 and 8.238) where the cell
describes one.

## Found and NOT fixed — for the desk to queue

1. **`wetness.mjs` still prints "puddles 2/2 showing"** during the storm, for
   objects the desk removed on 2026-07-25 and which `footprint.mjs` on the same
   build independently counts as **0**. Its own cell flagged this and it is still
   there. Two instruments on one build disagree about whether a deleted feature
   exists. The verdicts do not rest on it — but this is precisely how a wrong
   verdict gets made later.
2. **Publish `sizeW` on the slot mesh's `userData`** (`ct/props.ts`). One line,
   and it re-confirms L260 and retires a check that can only agree with itself.
3. **L106's apron rake** (−25.8° vs the recorded −21.3°) and the second ATM —
   evidence repair, not world work.
4. **`ledger-intact.mjs`'s segment check is load-bearing and it caught me.** My
   first pass appended into an interior empty cell on row 245, collapsing a
   literal `||`. The row got **longer**, so every length check passed; only the
   per-segment count saw it. It reported "2 → 1 accounts" and was right. Worth
   knowing that this guard is not decorative.

## Closed, incidentally

The auditor recorded on L195 that it **could not prove the citizen it
photographed was p1**, because all six walker meshes share a 1.9 m geometry
height. They do — but `__ct.people()` publishes the per-person scale, the six
read `[1.09, 0.91, 0.97, 1.05, 0.94, 1.02]`, and the row's "kid" is
unambiguously **index 1 at hs 0.91**. The limit was in where it asked, not in
the world.

## Instrument notes

- A probe shooting at 900×600 immediately after `warp` produced a **black frame
  twice**, which I nearly read as a dark alley. The world was fine at 13:00 with
  `nightFactor 0`; the recipe that works is bugsweep's — 1280×720, and wait for
  the world to have rendered before the first shot. A frame you cannot see is
  not evidence, and *"I took a screenshot"* would still have been true.
- `rain.mjs` and `wetness.mjs` **refused to run** against a build older than
  HEAD and exited 3 rather than answering. That is the which-world guard doing
  its job; I rebuilt and restarted rather than overriding it.
- `node scripts/health.mjs | tail` reports `$?` of `tail`. Read it unpiped.

## Scripts

All in `scripts/probes/`, all seeded or aimed, none needing a second run:
`w35-ledger-sample.mjs` (the seeded draw), `w35-verify-sample.mjs` (the bulk of
the structural predicates), `w35-cat-and-face.mjs`, `w35-kid-face.mjs`,
`w35-sizew-reachable.mjs`, `w35-record-verdicts.mjs`, plus `w35-explore*.mjs`
and `w35-shot-check.mjs` / `w35-clock-check.mjs` from working out the two
instrument faults above.
