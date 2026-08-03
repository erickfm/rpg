# Item 98 — measured. The aimed tier is a CONE below 4 m, and `lookTolerance` is not what makes it one.

**Worker eightynine, 2026-08-03. Released to TODO. `src/proto/fp.ts` UNTOUCHED.**

Read `notes/eightysix-item98-the-corridor-already-exists.md` first — this does
the one thing that note said to do next (*"Re-measure the dead ring first and
find out what actually bounds it"*) and does not repeat its argument.

Third release on this row. **I am not releasing because I agree it is unsafe in
the abstract — I am releasing because the measurement changed what the item is
for the second time, and the new shape does not match either surviving
prescription.** Everything below is measured on the built bundle, port 4450.

---

## The decisive experiment, and why it is decisive

`looked = d < reach && offAxis < lookTolerance(s.r, d)`.

**At `offAxis` exactly 0 the tolerance term cannot fail** — `0 < atan2(r, …)` is
true for every positive `r`. So aiming dead-on removes `lookTolerance` from the
question entirely, and anything that still goes dead is bounded by something
else.

Subject: **`"enter No. 227"`, r = 1.05, at (6.55, −44.0)** — chosen because it is
**isolated**, no other ground-floor street spot within 8 m. That matters: my
first run picked the bank ATM, which sits on top of the bank *door*, and most of
its "dead" readings were **the door winning a contest**, not the ATM failing a
predicate. *The prompt reports which spot WON; on a contested spot it cannot
distinguish "not a candidate" from "outranked".* 15 of the world's 34
ground-floor street spots are isolated by that test.

## 1. eightysix was right — the cone does not make the outer edge

Aimed dead-on, the spot is offered **continuously from 0.3 m to ~3.9 m**. The
outer edge is not created by `lookTolerance`.

## 2. THE NEW FINDING: below 4 m the binding constraint is NOT `lookTolerance`

Largest off-axis angle still offered, swept at 1° resolution:

```
  d      measured   lookTolerance(1.05, d)   measured lateral = d·tan
 0.50      89°           71.6°                 (tier 1: d < r+TOUCH_MARGIN = 1.20)
 1.00      89°           46.4°                 (tier 1)
 1.50      16°           35.0°                 0.430
 2.00      15°           27.7°                 0.536
 2.50      15°           22.8°                 0.670
 3.00      15°           19.3°                 0.804
 3.50      15°           16.7°                 0.938
 4.00      15°           14.7°                 1.072
 4.50      13°           13.1°                 1.039
 5.00      12°           11.9°                 1.063
 5.50      11°           10.8°                 1.069
```

Two regimes, and the boundary is **4 m**:

- **d ≥ 4 m — measured tracks `lookTolerance` to within a degree.** The predicate
  is the binding constraint here, and it behaves exactly as eightysix described:
  a corridor of constant lateral half-width ≈ r (1.04–1.07 against r = 1.05).
- **d < 4 m — measured is PINNED AT ~15° while `lookTolerance` would allow up to
  35°.** At 1.5 m the world is **more than twice as tight as the predicate.**
  `lookTolerance` is not what is refusing these; it is not even close to binding.

**This inverts the row's premise.** The row says the cone *"pinches shut as you
arrive, which is the dead ring."* Measured: far away it is a well-behaved
corridor, and **close in something else clamps it to a fixed ~15° cone.** Editing
`lookTolerance` cannot move the 1.5–4 m band at all, because it is not the
constraint that binds there.

## 3. The refusal is NULL, not a label change

Across the edge at d = 1.5 / 2.5 / 3.5 the prompt goes **`<<NULL>>`** — it does
not switch to another spot's label. So this is **a predicate or `canSee`
refusing**, not a ranking contest. (`w89-item98-edge-null-or-contest.mjs`.)

Combined with §2, the candidate causes are whatever else can refuse a spot that
is inside reach and inside the cone. `canSee` remains the obvious one and I did
**not** confirm it — see §5.

## 4. Confirmed in passing: the tier-1 boundary

89° (i.e. offered at any aim) at d = 0.5 and 1.0, then it collapses by 1.5 m.
That is `touching = d < s.r + TOUCH_MARGIN` = 1.05 + 0.15 = **1.20 m**, matching
`fp.ts` and the corrected `reachMargin` docstring at `crosstown.ts:1630`.

## 5. ⚠ MY INSTRUMENT HAS ONE UNEXPLAINED SELF-CONTRADICTION. Do not skip this.

`w89-item98-edge-null-or-contest.mjs` read **`+0°` as `[E] enter No. 227` and
`−0°` as `<<NULL>>`**. `yaw0 + 0` and `yaw0 − 0` are the same number, so that is
one pose with two answers, and I could not explain it.

I chased it: `w89-item98-is-the-read-deterministic.mjs` warps to that exact pose
6 times at each of 2/4/8/16/30 settle frames. **Stable and correct at 2, 4, 8 and
16 frames** (the sweeps used 8). **At 30 frames it flips** — one read came back
`[E] sit at the stop`, a *different* spot. So a longer settle lets the world
change under the probe rather than settling it.

That does not explain the ±0 pair, and **I am not claiming the numbers in §2 are
sound until it is.** They were taken at 8 frames, in the stable band, and the
two-regime split is far too clean and too monotonic to be noise — but "too clean
to be noise" is not a measurement. **Whoever takes this next should re-run §2
first and confirm the 15° plateau reproduces.**

Three of this project's false verdicts came from a probe reasoning off its own
artifact, and this is the file where that would be most expensive.

## 6. What I did NOT do, and why

**I did not touch `fp.ts`.** The row's live instruction is *"CAP THE AIM-TIER
REACH"*, and §2 says the aim tier's reach is not what is refusing anything below
4 m. Capping it would make the 4 m+ corridor shorter — the half of the feature
the user asked for by name, which `fp.ts:994` records already being tried and
rejected and which `D-look-selects` exists to hold — **while leaving the 1.5–4 m
band exactly as it is, because `lookTolerance` does not bind there.** That is a
regression bought for nothing.

I also did not touch `w40-bed-vs-door.mjs`. Its failing assertion is downstream
of a cause that is still not identified.

## What the next builder should do

1. **Re-run `w89-item98-what-bounds-the-ring.mjs` and confirm the 15° plateau.**
   If it does not reproduce, everything in §2 dies and that is the finding.
2. If it does: find what refuses a spot that is inside reach, inside the cone,
   uncontested, at 1.5–4 m. Test `canSee` directly — instrument `seeRaw`'s
   `intersectObject` and print the blocking mesh's name. GOTCHAS 88 is the
   precedent (a spot at an object's centre blocking its own line, ray 0.382 m
   against a face at 0.364 m) and the No. 227 doorway is exactly the geometry
   where that recurs.
3. **Only then** decide whether anything in `fp.ts` should move. On this
   evidence, nothing in `lookTolerance` should.

## Instruments left behind (all in `scripts/probes/`, committed)

| file | question |
|---|---|
| `w89-item98-what-bounds-the-ring.mjs` | the two-regime sweep; picks an isolated subject by measuring, not assuming |
| `w89-item98-edge-null-or-contest.mjs` | at the edge, is it NULL or another label? |
| `w89-item98-is-the-read-deterministic.mjs` | is the oracle stable? answers: yes at ≤16 settle frames, no at 30 |

## Inherited state

`npx tsc --noEmit` clean. No source file changed by this item, so the sweep and
health results recorded for item 155 still stand.
