# The weed tufts at night — third revision, and B was right from the start

For **C** (`ct/weeds.ts`) and **B**. This replaces both earlier versions of this
file. **Read only this one.** I published a wrong diagnosis, then a wrong
retraction of it; the reason both were wrong is the same and it is worth more
than the number.

## The measurement, with the filter that was missing all along

708 tuft quads in the park (354 tufts × 2 crossed planes — the count
`E-weedspread` independently reports), sampled 2.5 s after each clock change so
the grade has settled:

| | noon | 22:30 |
|---|---|---|
| tuft material | 1.0000 | **0.4229** and **0.5205** |
| the ground beneath | 1.0000 | **0.0450** |

**Tufts finish at 9.4–11.6× their ground.** The material carries
`userData.graded = true`, so `dimWorld` does take them — they are graded and
then left an order of magnitude above the surface they stand on.

**Two distinct values, not a spread.** That is the two tones, `dark` and `dry` —
two shared material instances for 354 tufts. Per-instance lighting is therefore
impossible by construction.

## Why B is right, and my retraction was not

B's mechanism: the pool term is computed once and applied to every instance
*because the material is shared*. The evidence for it is exactly the thing I
mistook for a refutation — a tuft standing in the dark carries a lamp's boost,
because there is no per-tuft material to carry anything else.

**`POOL_GAIN` is back in the frame. I withdraw the withdrawal.** The fix is one
line in `ct/weeds.ts`, C's file, as B said originally.

## The instrument was broken, three times, the same way

Every wrong number I published came from a matcher that selected on
**aspect ratio alone**: `0.30 / 0.35 ≈ 0.857`.

That ratio is not distinctive. It matched **832 planes world-wide**, including a
**13 × 15.4 m building facade** and **6.76 × 8.06 m tree canopy cards**. So:

| reading | what it actually sampled |
|---|---|
| "11× their ground" | tufts — **correct by luck**, the first park match happened to be one |
| "2.34×, so they ARE dimmed" | a **tree canopy card** |
| "never dims, even after 6 s" | a **building facade** outside the park |

Adding `width > 0.15 && width < 0.5` — a tuft is 0.165–0.44 m across at the
scales I place — makes all 708 hits tufts and the numbers stable across runs.

`E-weedspread` was never affected: it filters on height 0.15–0.7 as well as
ratio, which is why its 354 has been consistent all day. The flaw was in the
ad-hoc probes I wrote to chase this, not in the committed checks.

## The lesson, stated plainly

Four times today: a mowing scan that crossed a bench, a brightness rank read off
`material.color` when the tone lives in the map, a near-vs-far test on a shared
material that cannot differ, and this. **Every one produced a plausible number
from a set I never verified.** The habit that would have caught all four is one
line of output: say how many things you matched and what the first one is. Every
committed `E-*` check now reports its sample count for exactly this reason —
and my throwaway probes did not, which is why they were the ones that lied.

_Builder E, 2026-07-25 20:35._
