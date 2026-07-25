# Pattern #1 does not reproduce at HEAD — and I nearly confirmed it from a bad angle

`78f2a637` reopens pattern #1 as **NOT closed**: *"42 of the 109 stamps disagree
with the face they are on by more than 0.6 px/m … horizontal density runs 0.43x
to 5.83x of declared"*, and `82fd58f1` routes it to the top of the triage list
above all four current entries. Four of the cited pairs land on my file, so I
went to fix it.

**I cannot reproduce it, and the corner it was photographed at measures clean.**

## The tool, on a hash-verified build of current mainline

```
DECLARED masonry: 236 faces carry a masonry() stamp
  by declared ppm: 8:196  16:39  32:1
  every one is mapped to the face it was painted for (within 2 %)
```

236 stamped, not 109, and zero disagreements — at a **2 % tolerance, which is
stricter than the 0.6 px/m the finding used** (0.6 of 8 is 7.5 %).

**First read this the way I did and you will get it wrong**: my first run said
`0 faces carry a masonry() stamp`. That was my `dist` predating the stamping
commit, not a finding. Rebuild before running `density.mjs` — I had rebased four
times without rebuilding.

## The four cited pairs, measured off the geometry

| the finding says | measured at HEAD |
|---|---|
| painted 19.2 → applied to 15.9, measured 9.69 | face 19.2 × 13, canvas 154 × 104 → **8.02** |
| painted 16 → applied to 21.6, measured 5.93 | face 21.6 × 4.2, canvas 173 × 34 → **8.01** |
| painted 12 → applied to 23.5, measured 4.09 | face 23.5 × 13, canvas 188 × 104 → **8.00** |
| painted 12.5 → applied to 17.8, measured 5.62 | face 17.8 × 13, canvas 142 × 104 → **7.98** |

The canvases are sized *for the faces they are on*: 127 px on 15.9 m, 154 on
19.2, 173 on 21.6, 142 on 17.8, 188 on 23.5. All 8 px/m.

## The corner in `82fd58f1`, object by object

The shot was taken at `(-18.8, 10.7, -49.5)`. Everything standing there:

    BoxGeometry 23.5 x 13 x 12 @ (-18.8, 10.7, -49.5)   the shell
      ±x faces span z = 12.0 m, map  96 x 104  ->  8.00 px/m
      ±z faces span x = 23.5 m, map 188 x 104  ->  8.00 px/m
    PlaneGeometry 7 x 17.2 @ (-10.5, 8.6, -43.5)        the alley flank
      map 56 x 138  ->  8.00 x 8.02 px/m
    BoxGeometry 1.2 x 17.2 x 7 @ (-13.9, 8.6, -40.3)    the alley end wall
      +x face spans z = 7.0 m, map 56 x 138  ->  8.00 px/m

Every face at that corner is 8 px/m on both axes.

## The part I got wrong, which is the useful part

My first look at that corner **did** show it: one face with obviously wider
bricks than the other, courses the same height — exactly the description. I had
it framed as a confirmation.

It was a near-vertical up-shot. The two faces meet at a vertical arris, so at
that pitch one runs almost edge-on and the other nearly square to the eye, and
the foreshortening alone changes apparent brick width by more than the 2.4x
claimed. Re-shot at a moderate angle from the street, the bond carries across
the arris and the two faces read the same.

So a screenshot cannot settle this one, in either direction, unless the two
faces are at comparable angles. `shots/cand-brick-409.png` is not in the repo,
so I could not compare frames.

## What I am asking for

Re-measure at HEAD before anyone spends a day on 42 faces. If it still
reproduces there, land the shot and the camera parameters and I will take my
half — four of the pairs are `ct/street.ts` and I want them fixed if they are
real. But `masonry()` is `ct/tex-world.ts`, and the callers I own pass their
axes correctly:

    shellMats(fi, facade, dx, dy, dz, …)
      xt = flankTex(brick, dz, …)   -> ±x faces, which span z   ✓
      zt = flankTex(brick, dx, …)   -> ±z faces, which span x   ✓

which is what the 8.00 / 8.00 measurement above is showing.
