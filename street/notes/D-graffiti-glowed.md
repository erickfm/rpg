# The alley graffiti glowed at midnight, and no shot existed to show it

`3ef0654f` found that the vice pair's brief was nocturnal and no shot was. The
same gap was in my area and worse: **all eight alley shots were 13:00.** The
alley is the most enclosed space on the street, it has no lamp of its own, and
nobody had ever photographed it after dark.

Shot it. The tags were glowing.

## Measured

```
            13:00                 23:00
tags        1.0  1.0  1.0         1.0    1.0    1.0      <- unchanged by night
alley walls 1.0  1.0              0.062  0.062
```

Spray paint at **sixteen times** the brightness of the wall it is on.

## Cause — the same one that nearly caught my lit windows

`ct/props.ts`: `isGlass = m.transparent && !(m.alphaTest > 0)`, and `dimWorld`
skips anything that test calls glass. A transparent decal with no `alphaTest` is
glass by that definition, so the three tags were **never offered to the dimmer at
all** — `userData.graded` false, colour pinned at 1.0 through the night.

This is the second time that predicate has misfiled something of mine. The first
was the lit window sheets, which were *correctly* excluded for the *wrong*
reason and now declare `userData.selfLit`. These were incorrectly excluded.

## Fix

`alphaTest: 0.5` on the tag material. Not a rendering preference — it is what
makes `isGlass` false so the grader takes them. Safe because the art is
hard-edged: `placaTex` is `fillRect` on a transparent ground, every texel fully
opaque or fully clear, so a cutout renders identically to a blend.

```
            13:00                 23:00
tags        1.0  1.0  1.0         0.394  0.115  0.115
alley walls 1.0  1.0              0.062  0.062
```

Day identical. At night they now sit just above the brick, which is what pale
paint on dark masonry should do. The 0.394 one is nearest the alley mouth and
catches the street lamp — `dimWorld` grades by elevation and lamp pools, so that
is the system working rather than a leak.

## For B: five more, same cause, in `ct/props.ts`

The same probe found **five `mod=props` materials in the alley still at
luminance 1.0 at 23:00, `graded` false** — at `(-11.6,-39.6)`, `(-11,-40.4)`,
`(-10.6,-41.5)`, `(-9.4,-42.6)`, `(-12.6,-42)`. Those are the crates and litter,
and in the night shot they read as vivid blue against near-black brick.

Not mine and not touched. The fix is likely the same one line. **The wider
question is whether `isGlass` should mean glass** — it is currently doing duty as
"do not grade this", and two different kinds of thing have landed in it by
accident.

## What this says about checks

No check would have caught this. The tags were exactly as bright as they were
built to be, every assertion about them passed, and `alleycheck` is green
throughout. **It took pointing a camera somewhere nobody had pointed one.**
