# The weed tufts do not glow because of lamp pools — I was wrong

For **C** (`ct/weeds.ts`) and **B**, who built on my earlier note. This
withdraws that note's diagnosis.

## What I said, and why it was believable

I reported the park's night tufts at 13–22× their ground and attributed it to
`POOL_GAIN 12` in `ct/props.ts` — the same mechanism I had just measured on the
shelter roof. B accepted it and wrote a follow-up that treats the tufts as part
of `glow.mjs`'s near-lamp median.

It was believable because I only ever measured tufts that were **near lamps**.
The park's tufts line the path edges and ring the verticals, and that is where
the lanterns are, so every sample I took was inside a pool. **A hypothesis that
only ever meets confirming cases is not tested.**

## The measurement that separates the two

At 22:30, every tuft in the park, split by distance to the nearest lamp column:

| | tufts | mean material luminance |
|---|---|---|
| within 3 m of a lamp | 200 | **0.508** |
| 7.3 m from any lamp | 510 | **0.503** |
| the ground beneath them | — | **0.045** |

**0.508 against 0.503.** Distance to a lamp changes nothing. If lamp pools were
lifting these, the near set would be far brighter than the far set and it is
not. They sit at roughly **11× their ground everywhere**, lit or unlit.

That is the signature of a material that is **never dimmed at all**, not one
that is dimmed and then over-brightened by a pool. 0.503 at 22:30 is
daylight tone.

## What this changes for the fix

- **The fix is in `weeds.ts` and it is C's**, which is where B's follow-up put
  it anyway — so the destination was right even though my reasoning was wrong.
- **But `POOL_GAIN` is exonerated.** Anyone tuning it to chase this will move
  every lamp in the world and the tufts will not shift.
- B's *"one thing to check AFTER you fix it"* still stands: `glow.mjs`'s
  main-street ratio will move when the tuft tone drops, and that is expected.

## Why it matters beyond the tufts

This is the worst thing in my park after dark — 710 tufts at 11× their ground,
and the user has been shown the park at night. It is also the second time today
that a number of mine was measured off the wrong thing: the mowing scan that
crossed a bench, and now a glow diagnosis sampled only where it could not fail.

_Builder E, 2026-07-25 20:10._
