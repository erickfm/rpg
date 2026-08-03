# Item 291 — the door outranks the furniture, and the calendar stops standing in the doorway

Worker onehundredtwentyone, 2026-08-03. Ports **4188** (dev) and **4189**
(`vite preview`, the built bundle). Commits `0b0908ad6`, `79f71d0b6`, and the
probe commit after them.

> *"just make the door high rank pls."* — the user, 2026-08-03

## The short version

**It needed BOTH halves, and the desk's brief said rank was a closed road.**
It is not closed; it is insufficient on its own. Measured on `w40-bed-vs-door`:

| tree | red legs |
|---|---|
| mainline | **3** |
| rank only | **2** — the 0.42 m stride flipped from *"read the calendar"* to *"close the door"* |
| rank + stand-point | **1**, and that one is red on mainline too |

So rank is not the no-op the row supposed. Ranking cannot win inside an `onIt`
overlap — that part of worker onehundredsixteen's finding is correct and I
re-derived it — but the overlap covers a 0.36 m ball, and rank decides everything
outside it.

### …AND THEN I TESTED THE FOURTH CELL, WHICH NOBODY HAD, AND IT CHANGES THE STORY

I isolated rank by setting `WAY_OUT = 1 -> 0` and rebuilding — every declaration
still in place, the ordering code still running, just nothing outranking anything.

| tree | w40 red legs | the 301 acceptance poses |
|---|---|---|
| **stand-point only, no rank** | **1** (the flake) | **all green, 1/1 walked** |
| stand-point + rank | 1 (the flake) | all green, 5/5 walked |

**For flat 301, the stand-point move alone is sufficient. The desk was right that
the fix is one number, and I should say so plainly rather than let the size of my
diff imply otherwise.**

Rank is therefore justified on its own terms, not as part of the 301 repair:

- it is the user's **explicit, literal instruction**, and §6a says his words
  outrank a diagnosis — including mine;
- it is what makes the answer **general**. The stand-point move fixes one
  calendar in one flat; `WAY_OUT` on the interior kit means the next room's door
  outranks the next room's furniture without anyone measuring anything. The item
  asked for exactly that;
- it does real work elsewhere: **196 poses** across the world now offer the way
  out where they offered a mailbox, a stool or a booth.

If the desk wants the smallest possible change to 301, `apartment.ts` alone is
it and the rank commit can be reverted independently (`0b0908ad6` is the only
commit touching `fp.ts`/`ctx.ts`/`interior.ts`). I do not recommend that — the
user asked for the rank in as many words — but it is a clean seam and somebody
should know it is there.

## Where the desk's account and mine differ, with the source

The row (and the mid-flight message) says **`onIt` is unbeatable by
construction**. Read `fp.ts` before this item: it was not. `onIt` only ever
**admitted** a spot to tier 1 without an aim test —

```ts
if (near && (looked || onIt)) { if (d < bestNearLookedKey) { … } }
```

— and tier 1 was then ordered by **distance alone**. A spot you were standing in
won because `d ≈ 0` is the smallest number in the room, not because any rule said
so. My change makes `onIt` an explicit first key, so the invariant the desk was
relying on is **true for the first time** rather than emergent. That mattered: it
is what let rank be added without touching the guard rail.

**The stated cause was also wrong about which spot was broken.** The row, and the
comment in the source, both reason about the CALENDAR VERSUS THE DOOR. The
failure is not door-shaped. `w40`'s AIM leg fails with **no door involved at
all** — three strides facing the BED offered *"read the calendar"*. The real
fault:

> `SOUTH_Z + 0.90` at `CAL_X` put the calendar's stand-point **0.036 m off the
> straight line from the bed seat to the door stand-point, 0.79 m along it.**

It was not near the door. It was **on the route**. You did not stand at it, you
walked through it, and `onIt` then handed you the calendar for the middle of the
room in both directions. That is why moving it fixes the bed leg as well, which
no ranking scheme could have.

The stale comment is worse than the row said: it claimed the door was 0.58 m
away and it is **0.468 m** (re-measured today, `w116-calendar-vs-door-spots`) —
but both numbers are beside the point, because the door was never the competitor
that broke it.

## What changed

**1. `Pickable.rank` and `WAY_OUT` in `fp.ts`.** Rank orders **within** a tier,
after `onIt`, before that tier's own key. Two other shapes were considered and
both are recorded as measured-wrong:

- **across tiers** — onehundredsixteen measured it: a ranked door in tier 3 stole
  the press from a bed the player was aimed at. Rank must never beat aim.
- **above `onIt`** — beats the calendar you are nose-to-nose with, i.e. the
  user's own guard rail.

Comparison is a `(rank, key)` pair, not a weighted sum: a weight big enough to
dominate silently becomes a tier.

Declared in the **interior kit** (`ct/interior.ts`), so all 13 rooms' way in and
way out inherit it without their authors knowing the field exists, plus 301's
door pair, No. 227 and the lobby exit. **28 spots carry it.**

**2. 301's calendar stand-point moves 0.60 m along the wall.** `x: CAL_X -
CAL_STAND_DX`. The 0.90 m off the wall is untouched — that number is about
reading and was never the fault. **The calendar mesh does not move**: same wall,
same size, same *"a bit to the right"* the user asked for.

**3. `__ct.spots()` publishes `rank`**, so a probe can see the whole decision.

## Proof

**Blast radius — the whole world, `w40-resolver-map`, 283 stations × 192 poses:**

```
54336 poses; 196 changed (0.4%) — every one a way out beating furniture
  114x  open your mailbox — 3 letters  ->  out to the street
   32x  sit down                       ->  out to the street
   16x  sit at the slot                ->  out to the street
   12x  take a booth seat              ->  out to the street
spots winnable from at least one pose: 255 before, 255 after — none became unreachable
```

**Did any seat lose its own press?** "Winnable from some pose" is weak, so I
counted per-spot wins across both maps. **Nothing dropped to zero.** Worst loss
is the mailbox bank at 715 → 602 poses (−16%), which sits beside the lobby door
and is exactly what the user asked to happen. Every seat loses between 1 and 16
poses out of 150–230, under 9%.

**The two acceptance facts, walked in a browser, 5 runs:**
`probes/w121-door-vs-calendar-walk.mjs` — **5/5 green**, two routes for the door
(across the room, and off the bed) at three stand-offs each, plus the calendar.

> ⚠ **My first draft of that walk was wrong and its failure was right.** It read
> `[E] sit on the bed and watch TV` 5/5 at "1.2 m from the door" — because 301 is
> 1.27 m end to end, so 1.2 m from the door is **0.07 m from the bed seat**. The
> player was standing IN the bed, where the guard rail says the bed must win. The
> stand-offs now clear the bed's capsule. A test that walks you into one spot and
> complains you were not offered another tests nothing.

**`w40-bed-vs-door`, 5 runs, the check itself byte-unchanged**
(`git diff add-stick-and-city98 -- scripts/w40-bed-vs-door.mjs` is empty):

- `END TWO` (facing the door) — **5/5 ok**, was 0/5
- `AIM` (facing the bed) — **5/5 ok**, was 0/5
- `END ONE(a)`, `END ONE(b)`, both walk-happened legs, the bed-fires leg — ok
- **the door-fires leg — 1/5.** See below.

**The seated case, which is the one real hazard in ranking tier 2.** A seated
player has NO tier 1 (`near` is switched off by `opts.seated`), so tier 2 is the
whole contest — and rank now orders tier 2 ahead of aim-centredness. If a way out
took a seated `[E]`, the press would fire a `jumpTo` out of the chair, which is
BUILDER-BRIEF §11 territory. Measured across the whole population,
`probes/w69-seated-offers.mjs` on the shipped build:

```
only standing up on offer : 126      something ALSO on offer : 0
opened a machine, [ESC] out: 93      NO WAY OUT              : 0
                            (219 of 219 accounted for)
ok — every seat in the world names its exit while you are on it
```

**Zero seats anywhere offer a way out while you are sitting on them**, and the
exit is named on all 219. The hazard is real in the code and absent in the world,
because a seated `looked` is bounded by `s.r + REACH_MARGIN` and no threshold in
this world is that close to a seat.

**Other suites, on the built bundle:** `D-look-selects` 12 pass / 0 fail ·
`interiors-walk` 365/369, 4 declared known-open, 0 unaccounted (apt301's clear
run 2.2 m, the sacred lane intact) · `bugsweep` 96 shots, **0 STATION MISS, 0
COVERAGE** · `health` WORLD OK · `tsc --noEmit` clean.

## NOT DONE — `w40-bed-vs-door` is not fully green, and here is why it is not mine

The **fire leg** — *"the offered door actually acted"* — is red 4 runs in 5 on my
tree. **It is red on MAINLINE too: 3 of 3 runs I took there, plus 2 passes
earlier in the session, so it is a coin flip on both trees, not a regression.**

I measured the mechanism rather than guessing
(`probes/w121-fire-point.mjs`). The leg reaches its firing pose by holding **W
straight into the bed's collider** and taking whatever `unstick` slides it to.
That position is **not in the band the leg says it is in**, and it moves ~0.9 m
run to run:

| tree | fire point | m from door | bed off-axis | verdict |
|---|---|---|---|---|
| mainline | (199.257, −15.710) | 1.65 | 42° | door ✓ |
| mainline | (199.215, −15.813) | 1.65 | 42° | door ✓ |
| mine | (199.305, −15.637) | 1.82 | 38° | door ✓ |
| mine | (199.458, −16.137) | 1.32 | 69° | door ✓ |
| mine | (198.397, −15.961) | 1.78 | **22°** | **bed ✗** |

The look ceiling is **25°** (the user set it today, item 98). So the leg passes
or fails on whether a slide it does not control happens to leave the bed inside
or outside that cone. **The check is wrong here, not the world** — it fires from
1.3–1.8 m from the door while its own comment says "from a spot in the band".
**I did not loosen it and I did not touch it.** The fix is to make it *walk* to
its firing pose instead of bouncing off a collider, and that is a change to a
registered check which this item does not name — **please queue it.**

## DECLARED GAP — `seats-walk` has no baseline, and I chose not to buy one

`scripts/seats-walk.mjs` is the direct instrument for "did ranking cost a seat
its press". **I do not have a trustworthy reading of it and I am saying so rather
than quoting a number I cannot stand behind.**

- Run 1 straddled a preview restart. Void.
- Run 2 I invalidated myself: I rebuilt `dist/` under it — including the
  `WAY_OUT = 0` isolation build — while it was running. That is the build-race
  in BUILDER-BRIEF §10, self-inflicted. Void.
- Run 3 is clean (build `431c367a0`, nothing rebuilt under it) and takes ~25 min.

**And even a clean run is uninterpretable without a mainline baseline**, which is
another ~25 min: run 2 reported 115 failures of which **89 were "no stand up when
seated — a MACHINE seat is in its own overlay"**, and `w69-seated-offers` has
since shown all 93 machine seats DO name their exit under `[ESC]`. So that
category is the check's own model of machine seats, not a defect, and telling the
real residue from the noise needs before-and-after.

**50 minutes of instrument for a question I have already answered three cheaper
ways** — per-spot win counts across 54,336 poses (nothing lost all its poses,
worst seat −9%), the 219-seat seated census (0 way-outs stealing an `[E]`), and
`D-look-selects` 12/12. Under the user's rule that is the wrong trade, so: **the
gap is declared, not covered.** If the desk wants it closed, the shape is
`seats-walk` on mainline and on this branch back to back, on builds nobody
touches, and the only number worth reading is `another [E] spot answered instead
of the seat` (8 on the void run).

## Also found and NOT fixed — a second instance of the same defect

`probes/w121-standpoint-overlap.mjs` is the general guard the item asked for, and
it found one immediately:

```
0.410 m  "steal 101's package" (200.25, -17.32)
         stands inside the way out "close the door" (200.64, -17.45)
```

— for all four flats. **I left it alone deliberately.** It is not the calendar's
bug: a parcel's spot is registered **at the parcel**, a physical object where it
physically is (`pkgPos`, `ct/apartment.ts:2431`), and moving it moves the prompt
off the thing it names. The parcel still wins at its own position because `onIt`
outranks rank, and the map confirms it did not become unreachable. It is
recorded as a **named baseline of 4** so the guard still fails on a fifth.
**Worth a row of its own; it is a design question about parcels, not a number.**

## On the testing rule (BUILDER-BRIEF §10a)

The standing guard I committed is a **`__ct` read**: one page load, no camera, no
strides, deterministic, seconds. It asserts the stand-point geometry against
`playerRadius()` and both of the item's acceptance poses through
`pickSpot()`/`spots()`. The five-run walked harness stays in `probes/` as a
one-shot, **called by nothing** — I ran it to satisfy myself and kept the
numbers, which is what was asked.

**What the cheap form cannot see, declared rather than hidden:** `pickSpot`
carries no line-of-sight filter (the hook cannot supply one — `update()`'s
raycast starts at the player's own eye), and it samples poses, not routes. A
regression that is purely occlusion, or purely about how a stride lands, passes
it and needs the walk.

## Derived vs copied

`RADIUS`, `TOUCH_MARGIN`, `WAY_OUT` and `lookTolerance` are all imported or read
off `__ct`; no number is retyped. **One exception, declared:** `CAL_STAND_DX =
0.60` is derived by hand from `2 × RADIUS` (clear of the door's stand-point) and
`RADIUS + TOUCH_MARGIN` (clear of the bed-to-door route) — the route is the
binding one; `2 × RADIUS` from the door alone leaves the route clipping it by
0.021 m. It is not imported because `ROOM_STAND_X`/`STAND_Z` are locals of the
door block ~2,350 lines up and the bed seat is a local of the flat's block.
**Hoisting those three to module scope is the follow-up**, and until it happens
`w121-standpoint-overlap.mjs` fails if the world disagrees with the constant.
