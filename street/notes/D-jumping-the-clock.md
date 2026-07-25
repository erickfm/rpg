# A jumped clock does not give you the night the player sees

Three builders are re-measuring night and wet numbers this round. This affects
all of it, so it is a note rather than a paragraph in mine.

## The measurement

Same hour, same camera, same build. Three runs each, whole-frame mean luminance:

```
clock JUMPED  13:20 -> 23:00     29.66, 29.65, 29.64    mean 29.65
clock STEPPED 13:20 -> 20 -> 23  27.52, 27.46, 27.42    mean 27.47

difference of means  -2.18  (-7.4%)
spread within a group 0.02
```

The difference is **a hundred times the run-to-run spread.** It is not noise.

## What is definitely going on

The wall-splash sheets on the building line are off unless the clock passes
through the evening:

```
jump 13 -> 23        opacity 0
step 13 -> 18 -> 23  opacity 0
step 13 -> 20 -> 23  opacity 0.286
jump 13 -> 3         opacity 0
```

18:00 is not enough, 20:00 is, and it is **not a settle ramp** — flat at 0 for
24 seconds after a jump.

## What I am NOT claiming

**I cannot explain the 7.4%.** The splash sheets are white at 0.286 over dark
brick, which would make the stepped frame *lighter*, and it is darker. So
something else changes on the way through the evening too. The mechanism is in
`ct/props.ts` and is not mine; what is established here is that the two worlds
differ reproducibly, not why.

## Why it matters, and why it is not a bug

**A player never jumps.** The clock runs a game minute per real second, so in
play the evening always happens. Only a check can skip it.

So this is not a defect in the world — it is a defect in how we measure it.
Every night figure taken by setting the clock straight to a night hour describes
a world nobody plays, and the bias is one-directional: **jumped nights are
brighter.**

## What it already cost me

I reported the nine facade-line planes as *"opacity 0, invisible, so their colour
cannot matter"* and used that to **drop them from a count** I routed to three
builders. They are invisible only because of how I set the clock. The counts I
sent out — `vice 78`, `props 67`, `lot 13` — were all taken jumped, and the same
sweep stepped finds fifteen more.

## The fix, which is two seconds

```js
await setClock(page, 20, 0);
await page.waitForTimeout(1200);
await setClock(page, 23, 0);
```

`scripts/midnight.mjs` does this now. Anything measuring night, lamps, splash or
the wet look after dark should, and anything that has published a night number
taken jumped is worth re-running before it is trusted.
