# Item 262 — nobody seals that walk, and the flaky instrument was a stopwatch, not an identity bug

Worker onehundredsix. `scripts/crowd-walk.mjs` + three probes. Commit `d949c49c1`.
Measured on the **built bundle**, port **4620**.

**`ct/crowd.ts` was not touched, and that is the finding.** The row's headline
defect does not reproduce, and the instrument fault behind it is a different bug
from the one the row predicts.

---

## 1. The seal does not reproduce — three instruments, one answer

The row: *"A citizen stops at (6, −50.45) and SEALS the walk — a 0 m gap."*

| instrument | result |
|---|---|
| gap scan at the row's exact coordinate | **1.34 m** |
| seal legs, 3 × 12 s runs | **0 sealed**, tightest stopped-citizen gap **1.08 m** |
| **walking it**, 5 runs each way | longest stall **1.0 s**, 16.6–20.2 m covered, coordinate crossed **5/5** both directions |

1.4 s is one give-way working as designed (`crowd-walk.mjs:209`), so a 1.0 s
stall is *below* a single legitimate encounter. Nothing held the player.

**Why it was true when ninetysix measured it and is not now: item 207.** The row
itself says item 207 landed a retreat that *"gives 1.5 m and clears 10 of 10
previously-pinned episodes"*. ninetysix measured this while fixing 207 — i.e.
before its own fix landed. This is BUILDER-BRIEF §6 exactly: **a queue item is a
hypothesis, not a finding**, and this one was overtaken by the work that found it.

### The control, because a green result from an unexercised check is worthless

`scripts/probes/w106-seal-negative-case.mjs`. Plant a wall across the east walk
at that z and require the **same** scan to report a seal:

```
CLEAN     gap at the row's (6, -50.45): 1.34 m
MUTATED   gap at the row's (6, -50.45): 0 m      <- it CAN see a seal
RESTORED  gap at the row's (6, -50.45): 1.34 m   <- and it is not a latch
```

**The mutation is pushed onto `colliders()`, which is live by reference.**
`staticColliders()` returns a copy and the push would have landed where nobody
reads it — the probe would still have printed 0 sealed and tested nothing
(GOTCHAS 74). That is the single easiest way to write a control that controls for
nothing, and it is why the file says so at the top.

## 2. The flakiness is the CLOCK. It is not an identity bug.

The row: *"the house cure is to key on identity rather than index or ordinal
position."* **I checked that first and it does not apply here.**

`ct/crowd.ts:269` builds `citizens` once; `:400` only ever pushes into it — no
`splice`, no `sort`, no `pop`. So `walkers()[i]` is the same person on every call
for the life of the world. Measured: the array length **never changed once** in
three runs. `crowd-walk.mjs`'s own item-218 comment (`:56`) had already
established this; I found it independently in the source and then found the
comment agreeing.

What actually varies is **how many frames fit in a fixed wall-clock window**:

```
frames   240 / 214 / 203
samples  131 / 103 /  92      <- in proportion
sealed     0 /   0 /   0      <- the VERDICT was stable all along
tight   1.08 /1.08 /1.08
```

That is GOTCHAS 30 — anything the render loop drives, timed with a stopwatch,
measures the machine's load. **The 0 / 62 / 317 / 0 / 0 figure the row quotes is
a SAMPLE COUNT, not a verdict**, and the two zeros are the branch below.

### The branch that made it look like a defect

```js
if (lane.samples < 40) {
  console.log(`  ??   only ${lane.samples} stopped-citizen sample(s) …`);   // and carry on
} else { …the two real checks… }
```

**A run that sampled nothing printed `??` and scored as not-a-failure.** That is
GOTCHAS 34 (*a check can pass because it found nothing to check*) and GOTCHAS 65
(*a guard that reports failure in PROSE exits 0*) in one place, and a reader
counting green runs could not tell a run that measured nothing from a world that
had been measured and was sound.

### What I changed, in `scripts/crowd-walk.mjs` only

1. **Budget 260 FRAMES, not 25 000 ms**, with a 40 s wall-clock cap left only as
   a safety net against a stalled rAF.
2. **The population floor is a `check()`**, so "measured nothing" fails.
   **Derived, not predicted**: 260 frames yields 222–252 samples on this tree
   (five runs), so 40 is far under the observed minimum and far above zero.

**Negative case, because a floor nobody has watched reject anything is an empty
promise:** `WANT_FRAMES = 1` → `FAIL the lane was actually tested — 0 samples in
1 frames`, **exit 1**. Restored → exit 0.

I did **not** touch the unfiltered `colliders()` the seal legs read. GOTCHAS 74 is
explicit that `crowd-walk.mjs` must keep it: *"its whole question is 'a citizen
who stops must not seal the walk' — the stopped citizen IS the subject."*

## 3. Five runs, same verdict

```
run 1  exit 0   242 samples   0 sealed   tightest 1.92 m at (-6, -69.59)
run 2  exit 0   252 samples   0 sealed   tightest 1.92 m at (-6, -69.55)
run 3  exit 0   246 samples   0 sealed   tightest 1.92 m at (-6, -69.57)
run 4  exit 0   230 samples   0 sealed   tightest 1.92 m at (-6, -69.59)
run 5  exit 0   222 samples   0 sealed   tightest 1.92 m at (-6, -69.6)
```

Sample spread was **317 wide and touched zero twice**; it is now **30 wide and
never zero**. The verdict was identical in all five.

## The row's four DONE WHEN conditions

1. *nobody seals the walk at that coordinate* — **yes, and nobody did**: 1.34 m clean, walked 5/5 both ways.
2. *the seal legs return the same verdict five runs running* — **yes**, above.
3. *say what was actually stopping that citizen* — **nothing is, now.** Item 207's retreat is the cause, and ninetysix's measurement predates its landing.
4. *the 2 m lane is measured clear* — tightest gap past a stopped citizen **1.92 m**; **1.34 m** at the named coordinate. Both over `ct/gap.ts`'s 0.95 m line and over the player's 0.72 m.

## A mistake worth recording, because its guard is the lesson

**My first walk run had the facing backwards** — I assumed `(sin yaw, cos yaw)`
meant `yaw = 0` walks +z; here `yaw = 0` walks **−z**. Both legs marched away from
the coordinate and never touched it.

**It cost nothing, because the probe asserts that it COVERED the coordinate it
was aimed at**, and reported `crossed the coordinate 0/5 — that is not a pass`
rather than a clean bill of health. A walk probe without that clause would have
certified 5/5 green on ground it never walked. It also turned up a **reproducible
5.5–6.0 s stall walking north from (6, −40)**, which I have not diagnosed — see
below.

## FOUND AND NOT FIXED

- **A reproducible 5.5–6.0 s stall walking NORTH from (6, −40)**, five runs out
  of five, ~3.7 m covered before it holds — i.e. around **z ≈ −36**, not the
  −50.45 this row is about. It may well be legitimate geometry (a shopfront, a
  stand) rather than a trap; I did not look, because it is outside this row and I
  found it by accident. **Worth its own row**, and it is a real coordinate with a
  real repro count.
- **`scripts/crowd-walk.mjs`'s other legs still use wall-clock waits**
  (`waitForTimeout(500)` × 12 in the walk leg). Same GOTCHAS 30 exposure; I
  changed only the seal loop, which is what this row named.

## Green

`node scripts/crowd-walk.mjs` **exit 0**, five consecutive runs, identical
verdict. Negative case exits 1. No world code was changed, so `tsc`, `build`,
`health` and `bugsweep` are untouched from item 264's run (all green there).
