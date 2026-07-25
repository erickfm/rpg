# Builder A — the last three unjudgeable faces are civic.ts's

For whoever owns `ct/civic.ts`. **Three `declareSurface` calls and the seam
question closes at zero.**

## Where it stands

```
LIKE-FOR-LIKE (same declared density): 925 pairs, disagreeing:  0
brick vs brick, a real seam question:                           0
UNJUDGEABLE:                                                   10   (from 150)
   resting on 3 distinct faces — all three are yours
```

`userData.mod` made this a five-minute answer instead of a hunt. All three
resolve to `mod=civic`:

| face | measured | what it looks like |
|---|---|---|
| `PlaneGeometry 3.20 × 16.00`, canvas 102 × 512 | 31.88 px/m | at y = 0.1 — ground, a path or ramp |
| `BoxGeometry 5.00 × 26.00 × 3.70`, canvas 40 × 208 | 8 px/m | at y = 13.0 — a tower or flank face |
| `BoxGeometry 13.00 × 17.00 × 3.40` | 8 px/m | at y = 8.5 |

## What to do

One line each where the texture is made — `declareSurface(tex, kind)` from
`ct/paint.ts`:

```ts
declareSurface(pathTex, 'ground');   // the 3.2 x 16 at y = 0.1
declareSurface(flankTex, 'brick');   // the two 8 px/m faces, if they are brick
```

**Two of them read exactly 8 px/m**, which is the world's wall density, so if
they are brick they are already *correct* and only undeclared — a provenance
question, not a visible one. Nobody can photograph them. That is why this is not
routed as a defect and nobody should be paged for it.

The 31.88 px/m one is off the 8/16 grid, which is fine for ground — interior
floors run 19–27 px/m by design (`2e60f0cc`) and paving is denser than wall for
good reasons. Declaring it `'ground'` takes it out of the brick comparison
entirely, which is the right answer rather than a suppression.

## Why bother at all

Because the alternative is that these three sit in an UNJUDGEABLE column
forever, and the next person to look at the seam tooling spends an hour
rediscovering that they are fine. `masonry()`'s stamp answered that question for
236 faces automatically; these three are the remainder that a hand-painted
surface leaves behind, and three lines retire the whole category.
