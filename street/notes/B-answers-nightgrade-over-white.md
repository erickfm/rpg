# B answers nightgrade's "grade multiplied past white"

`05694164a` ran the full suite and recorded, under nightgrade, something it
reported but correctly did not fail on:

> Also reported but not failed on: 5 materials past 1.0 at 23:00, the grade
> multiplied past white, which clamps invisibly but not to anything reading the
> colour back.

That is my grade, and the answer is: **deliberate, bounded, and now asserted.**
Writing it down because "reported but not failed on" is exactly the state in
which somebody eventually tidies it away, and tidying this one is a regression.

## It is a decision, not a leak

`ct/props.ts` carries

```ts
const WARM_R = 1.15, WARM_G = 1.05, WARM_B = 0.85;
```

with the reasoning above it: sodium light **warms** a surface, it does not
repaint it. The base colour is MULTIPLIED by that factor rather than lerped
toward amber, because lerping dragged every dark texel — glass, wheel arches,
tyre rubber — up toward brown, and that read as a graphics bug. Multiplying
cannot do that: near-black × 1.15 is still near-black. The cost of the technique
is that a near-white tint lands at 1.15 and clips at render, which is the
behaviour being reported.

I had this filed as a defect in my own notes for several rounds — "158/161
materials over 1.0 at ramp hours" — and it was wrong. I had not read the note
above my own constant.

## The numbers, at HEAD, across all 24 hours

Measured over every material in the scene, not only the ones `dimWorld` grades,
which is why my counts are larger than nightgrade's five:

```
09:00-17:00       0 / 5536
ramp hours    156-166 / 5536   worst 1.0803
through night      20 / 5536   worst 1.1497
```

846 material-hours over 1.0 across the sweep, peak **1.1497**. Day is clean
because the night curve is zero; the ramp hours are the widest because a full
ambient and a live warm term overlap there.

## And it is bounded, which is the part worth having

`mul` is capped at 1 (`Math.min(1, amb * (1 + k * POOL_GAIN))`) and `base` is an
authored colour captured at build time, so the most the grade can produce is
exactly `WARM_R`. `scripts/grade-sane.mjs` asserts that, reading the constant
out of `ct/props.ts` rather than repeating it, so retuning the warm factor
retunes the check and renaming it fails the parse loudly:

```
grade ceiling from ct/props.ts: WARM 1.15/1.05/0.85 -> nothing may exceed 1.155
OK   nothing exceeds the 1.155 the grade can produce — nothing is warmed twice
```

Anything **above** that ceiling is the real fault this class can have: a second
writer on a material `updateLit` owns, an uncapped pool gain, or a warm term
applied to an already-warm colour. `canfail`'s `grade-twice` applies the factor
a second time — 1.32 — and grade-sane goes red. Nothing else in the suite would
catch it: it is not NaN, not negative, and it clamps at render, so the frame
merely looks slightly hotter.

## So, concretely

- **Nothing to fix in the world.** The five materials nightgrade saw are inside
  the ceiling.
- **Do not clamp the grade to 1.0** to make the report go away. That would flatten
  the sodium warmth on every light surface under a lamp, which is the effect the
  user asked for across four rounds of night work.
- **If you read colours back in a check, use 1.155 as the bar, not 1.0.** That is
  the number the grade can actually produce, and grade-sane already holds the
  line at it.

One correction to my own record while I am here: nightgrade's other finding, the
degenerate 0.00 x 0.00 material at 48.8, 3.8, -97.7, is in the vice quarter and
is not mine. I am not claiming it.
