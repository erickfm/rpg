# Item 225 — `prop-landing`, the guard over item 219's self-push fix

Worker **eighty**, 2026-08-03. Port **4360**, `vite preview` over `dist/` — the
**built bundle**, GOTCHAS 28. Landed as `2cb4ad1ee`.

---

## What was missing, in one line

**Nothing anywhere asserted that a dropped prop stands where it was put down**,
so item 219's repair was one careless edit from reverting in silence — and
`footprint.mjs` would not have caught it *and was right not to*, because the
crate was pushed OUT into clear pavement, which is a legal place for a crate.

## THE ROW'S "DONE WHEN" IS TOO STRONG AS WRITTEN — measured, not argued

> *"Assert authored-vs-landed for every dropped prop"*

Read literally that says nothing ever moves, and **that is false on mainline and
should be.** Three pieces land off the coordinate `drop()` was handed:

| kind | authored | placed | landed |
|---|---|---|---|
| flattened cardboard | ( 6.66, −76.00) | ( 6.527, −76.00) | ( 6.527, **−76.455**) |
| flattened cardboard | ( 6.58, −26.50) | ( **6.513**, −26.50) | ( **6.493**, −26.50) |
| flattened cardboard | (−9.40, −42.40) | (−9.400, −42.40) | (**−9.332**, −42.40) |

**Two stages move a prop and they answer different questions.** `drop()` itself
applies `clearOfKerb` and the building-line clamp — deterministic, per-piece, and
the reason *authored* and *placed* differ in the middle column. `dimWorld`'s
push-out pass (`ct/props.ts:1240`) runs much later and exists to keep litter out
of **buildings**: *"the footprint rule tests against GROUND SURFACES, it has
nothing to say about a wall"*. A sheet of cardboard stepping off a stallriser is
that feature working.

**Item 219 was never "litter moved". It was "litter moved for no reason outside
itself"**, and that is what the check asserts.

## The invariant, and why it needs no history

Worker seventyeight's own note names it: **a prop may not be moved by itself.**
The props that *can* be are identifiable from the world with no reconstruction at
all — **a prop whose own geometry clears `dimWorld`'s `h >= 0.25` solid gate**
would have entered its own obstacle set under the pre-fix node-only test. Today
that is the three milk crates and nothing else, which is precisely why crates
alone suffered: cardboard and newspaper lie flatter and never enter the set.

## `scripts/prop-landing.mjs` — registered, default tier, 1.6 s, five legs

1. **Population floors** — 14 litter groups (floor 12), 3010 world solids, the
   authored coordinates present, and **≥ 3 props able to self-push**. Each is a
   separately-failing population; a miss is **exit 2**, "I could not measure",
   never exit 1.
2. **Every self-pushable prop stands exactly where `drop()` placed it** — *the
   guard*. 3 props, all 0.000 m.
3. **The full displacement set matches a recorded baseline.** Leg 2 only watches
   props that can self-push; this watches the rest, so a **new** mover is red even
   when it is flat and the move is legal. This is the
   `notes/texdensity-baseline.json` pattern — fail on a CHANGE, not on a
   threshold somebody chose. It is a baseline, not an allow-list: an allow-list
   says *these may move by any amount*, which is what the bug did; this says
   *these move by exactly this much*.
4. **Nothing is left floating** above the ground it was seated on. The push-out
   re-resolves ground under a street piece when it slides it in x
   (`ct/props.ts:1339`) and gets no chance to for an alley piece.
5. **The two user-approved alley crates are pinned** at (−11.639, −39.60) and
   (−11.016, −40.35).

### The crate pin is a deliberate hand-typed copy, and it has to be

`ct/props.ts:3614-3615` states those two x values with a comment saying they are
not free to tidy. **Deriving them from `props.ts` would defeat the purpose**: the
risk is somebody "cleaning up" −11.639 to −11.60, and a check that reads its
expectation out of the very line it guards cannot see that happen. Cited per
BUILDER-BRIEF §8 rather than silently duplicated.

## One source change: `ct/props.ts` `drop()` now records where it was asked and where it put it

```
o.userData.authoredX / authoredZ   the literal argument at the call site
o.userData.placedX  / placedZ      after clearOfKerb and the building-line clamp
```

Four numbers on a group that already carries four other fields; nothing reads
them at runtime. The alternative was **fourteen hand-typed coordinate pairs in a
harness** — §8's "single most expensive habit" — that would stop matching the day
somebody nudged a piece. **`ct/props.ts` is the only world file this item
touched, and only additively.**

## Two proofs, and they fail apart

| | |
|---|---|
| `--selftest` | displaces a self-pushable prop **chosen at runtime from the ones that have not moved** by the exact 0.561 m item 219 measured. Leg 2 goes red, and the selftest names the leg it targets so a stray red cannot launder a miss |
| `canfail litter-self-push` | puts the bug back **in source** — `up === o &&` on `ct/props.ts`'s ancestry walk, which is the pre-fix node-only test exactly — rebuilds, and re-runs. **CAUGHT.** Every mutated file restored byte-for-byte |

Registered with both: `['prop-landing', …, true, [], false, ['litter-self-push']]`.
Through the runner, `--only prop-landing --selftest` prints two green rows, one
per proof. That is the `masonry`/`masonry-blind` argument: *the verdict can go
red* and *the actual bug is caught* are two claims, and one of them certifies
half a guard.

## Every population floor watched go red — none of them was taken on trust

| mutation | result |
|---|---|
| `o.userData.litter = undefined` in `drop()` | **exit 2**, "0 litter groups … this is not a pass" |
| `o.userData.authoredX` line deleted | **exit 2**, "14 of 14 groups carry no authored/placed coordinate" |
| `MIN_SELF_PUSHABLE` raised to 5 | **exit 1**, leg 1 red, reporting the real count of 3 |

**Stable: 5/5 runs, 5/5 legs, 3 movers matching baseline every time**
(`scripts/probes/w80-prop-landing-stability.sh`).

---

## Found and NOT fixed — for the desk to queue

### 1. The alley cardboard is displaced 0.068 m and I cannot name what moved it

`scripts/probes/w80-what-moved-the-cardboard.mjs`. My first cut of the check
asked the *general* property — "put every mover back where `drop()` left it; is a
non-litter solid there to explain the move?" — and it reported the alley
cardboard placed at (−9.40, −42.40) as **shoved 0.068 m by nothing**. At the
put-back position, of 13 non-litter meshes within a metre, **none overlaps in
3D**; the nearest candidate is a 0.072 m-wide, 0.824 m-tall post at
x −10.036…−9.964, which clears the cardboard by **0.200 m in x**.

**It is not the item-219 bug.** The piece is 0.061 m tall, cannot enter its own
obstacle set, and lands at −9.332 identically in seventyeight's *pre-fix* and
*post-fix* dumps — so it predates item 219 entirely.

**So the reconstruction is what is wrong, not the world** (BUILDER-BRIEF §7:
half of all "defects" here are the instrument). The likeliest cause, not
confirmed: `dimWorld` calls **`Box3.setFromObject` on each MESH**, and in three.js
that also swallows the mesh's **children** — while every harness that reads it
back, including seventyeight's and mine, boxes each mesh's own geometry alone. A
parent mesh with children therefore has a **bigger box in the placer than in any
check**, which would make an overlap real at build time and invisible afterwards.

**I did not ship the assertion I could not explain**, and the general property is
worth having if somebody settles this. Both the failed design and the reason are
recorded in `scripts/prop-landing.mjs`'s header rather than deleted.

### 2. `drop()` returns SILENTLY for a name not in the CATALOGUE

`ct/props.ts:3499` — `const make = CATALOGUE.find(…); if (!make) return;`. A typo
in a litter name removes a piece with no warning anywhere. The new check's
`MIN_GROUPS` floor catches a catastrophic loss, not a single one.

### 3. Carried forward from item 219, still unrouted

- `canfail.mjs` is vacuously green on an unknown `--only` name — `node
  scripts/canfail.mjs crowd` selects zero cases, prints *"0/0 checks caught their
  mutation"*, exit 0. `checks.mjs:52-56` already refuses this deliberately.
- The 0.40 × 0.40 post in the west walk at x −5.55…−5.15, z −65.2…−64.8, taking
  that cross-section to 1.32 m (seventyseven's finding).

---

## Verification run

| | |
|---|---|
| `tsc --noEmit` | clean |
| `node scripts/health.mjs` | `WORLD OK`, exit 0, build `bb7f45461` |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, exit 0 |
| `scripts/footprint.mjs` | exit 0 — nothing clips the kerb, no litter inside a building |
| `scripts/trash.mjs probe` | 6/6 OK — 14 groups, 14 distinct yaws, all five approved types |
| `prop-landing` | 5/5, five runs, exit 0 |
| `checks-registered` | exit 0 (157 registered) |
| `checks-can-fail` | exit 1 — **same three names as mainline**, no new accusation |
| `mutations-quote-real-source` | exit 1 — **pre-existing**, the same 4 dead cases in `bank.ts`/`props.ts`; the new `litter-self-push` needle matches 1× |

**No geometry was added or removed** — the change is four `userData` fields — so
every prop's landed position in the table is identical to seventyeight's
post-item-219 dump, and the cat's approved alley frame is untouched by
construction.
