# For I and the desk: the "0.03 texels/m" figure is not a measurement

I published it, the desk carried it into a routing message, and it is now the
stated reasoning on a **CONFIRMED** ledger row. So this is the retraction and
the replacement numbers, together, rather than a correction buried in a commit.

## What I did wrong

I looked for stretched ground sheets by taking each mesh's **bounding box** and
dividing its texture size by it. Four meshes came back at 60 × 124 m running
0.03–0.11 texels/m along z, and I reported them as the pavement.

They are not sheets. They are the **kerb face, the arris, the gutter pan and the
red kerb paint** — four strips about 0.15 m tall that wrap the entire roadway.
A strip that turns four corners has a bounding box the size of the block:

```
  bbox 60.0 x 124.5 m     51.9 m2 of actual surface   0.69% fill   kerb face
  bbox 60.1 x 124.6 m     24.5 m2                     0.33%        arris
  bbox 60.0 x 124.5 m    159.4 m2                     2.13%        gutter pan
  bbox 17.5 x 114.9 m      7.7 m2                     0.38%        red kerb paint
```

Dividing a texture size by that box measures nothing at all.

## The real numbers

Re-measured at build `e008cff51`. `scripts/kerbwalk.mjs` now sums the triangles
and **refuses to report a density for anything filling under 5% of its own
footprint**, so this class of mistake cannot be made with it again.

```
  32.0 / 32.0   west walk    1.94 x 126.5 m     256x256 rep [0.242, 15.813]
  32.0 / 32.0   east walk    1.94 x  92.8 m     256x256 rep [0.242, 11.600]
  32.0 / 32.0   south walk  60.13 x   1.94 m    256x256 rep [7.516,  0.242]
  32.0 / 32.0   north walk  48.50 x   1.94 m    256x256 rep [6.063,  0.242]
  32.0 / 32.0   mouthGrain  11.0  x  14.0 m     352x448
  19.2 / 14.3   main carriageway  10 x 134 m    64x64 rep [3, 30]
  18.6 / 12.8   side street       62 x  10 m    64x64 rep [18, 2]
```

**Every walk sheet in the world is at exactly the mandated 32 texels/m in both
axes.** The carriageways are at 13–19 — under the mandate, worth knowing, but
they are **tiled 64 × 64 maps**, not stretched cross-sections, so the "a
carriageway does not vary along its length" story does not describe them either.

## What I am not claiming

**I have not re-derived I's original finding and I am not calling it wrong.** I
am saying the number *I* handed the desk to support it is worthless, and my note
`B-kerb-and-flags-one-root.md` claiming one shared root cause behind four
reports is withdrawn — it accounted for none of them. The user's actual fault
was the driveway apron's scoring, which is written up in
`notes/B-the-apron-was-the-report.md` and is fixed.

If the apron/lot-mouth work was justified on the 0.03 figure anywhere else,
**re-measure before acting on it.**

## One thing the corrected sweep did find, and it is not mine

```
  4.30 / 4.05   14.88 x 15.81 m sheet at (22, 0.152, 3.2)   64x64 rep [1, 1]
```

A 235 m² surface in the **car lot** carrying a single 64 × 64 tile — the lowest
real density left on any ground surface in the world, and about an eighth of the
mandate on both axes. Genuinely stretched, unlike the ribbons. Not my file, and
I have not touched it: routing it rather than fixing it.
