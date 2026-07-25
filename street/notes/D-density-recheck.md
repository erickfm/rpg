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

---

# Follow-up: answering the one thing `fe310665` could not close

The auditor has since found the cause twice over — `7fe644b9` ("the 42 are a box
face index, not a density fault") and `fe310665` ("like-for-like is 0") — and
left exactly one question open:

> If that shot shows a real seam it is either the 2x band/wall junction, which
> is intended and might still look wrong, or something `masonry()` did not
> paint and this tool cannot see. … I am not claiming the photo is nothing.

**I can rule out the first half.** Looked at, not reasoned about:

**The 2× junction is not visible as a brick step, because a sign board covers
it.** Square on to BURGER BARN, the shopfront band's top edge IS the fascia —
a painted signboard running the full width. 16 px/m brick never meets 8 px/m
brick in the open; the transition happens behind the sign. Same on every
character front on the block. Where the ground floor IS bare brick — the
residential ones — there is no shopfront band at all, so there is no 2×
junction to see.

**And the brick MODULE is consistent, which px/m alone does not prove.** Two
faces can both be 8 px/m and still draw different-sized bricks if their
painters use a different bond. So I shot the two most different painters square
on at the same distance and pitch — the alley end wall (`bareBrickT`, 56 × 138
on a 7 × 17.2 m face) and a street facade (`facadeTex`, 96 × 104 on 12 × 13) —
and the bricks come out the same size on screen, courses and perps both.

So the second half of the auditor's disjunction is the live one: if the photo
shows anything, it is something `masonry()` did not paint. I have no candidate
for that in `ct/street.ts`.

## Three times now, and twice it fooled me

Every apparent brick mismatch I have chased in this file has dissolved when the
two faces were put at comparable angles:

1. my near-vertical up-shot of the z −49.5 corner — looked like a 2× step
2. the alley mouth at a steep angle — end wall bricks looked bigger than the
   diner's, and the end wall is FURTHER away, which should make them smaller
3. both of those, square on at equal distance — identical

Two of those three I initially read as confirmation. **A brick-size comparison
is only evidence when both faces are at the same angle and distance**, and that
is hard to arrange at a corner, which is precisely where the question always
gets asked.
