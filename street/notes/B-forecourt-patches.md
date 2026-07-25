# The library forecourt patches: what they are, in plain terms

The user asked directly, so this is written to be handed to them.

## The short answer

**They are not shadows, and they are not a wet/night registration split. They are
the library's own steps, landing, copings and planters, and every one of them is
UNTEXTURED FLAT COLOUR.**

The desk's reading was that some ground sheets are registered with the wet/night
tinting and their neighbours are not, which would leave flat quads at different
tones with hard edges. That is a real failure mode — it is exactly what my
"nine registered, ten stay dry" finding was — but it is **not what is happening
here**, and I would rather correct it than accept it.

Measured, every ground-level mesh in the forecourt:

```
28 meshes.  26 are civic (the library's), 2 are mine.
ALL 26 civic meshes:  graded = true      <- all registered, none diverged
ALL 26 civic meshes:  map = none         <- none has a texture at all
                      7 distinct tints, 0.075 to 0.405
```

Every one is registered identically. Nothing has diverged from its neighbour.
What they have in common is that **none of them is textured**.

## What each patch actually is

| what | size | how many | tone |
|---|---|---|---|
| the landing slab | 3.6 × 4.1 m | 1 box, 6 face materials | 0.2089 / 0.2927 / 0.4052 |
| the flight below it | 3.2 × 4.1 m | 1 box, 6 face materials | same three |
| copings at the courtyard mouth | 1.9 × 0.1 m | 6 | 0.075 / 0.0971 |
| gate posts | 0.1 × 0.5 m | 4 | 0.2198 |
| two planters | 0.9 × 0.9 and 1.0 × 1.0 m | 4 | 0.2927 / 0.3957 |

The two big ones are the answer to "overlapping each other": the landing sits at
y 0.155 and the flight at y 0.24, both centred within 0.2 m of each other, so in
plan they overlap. They are a **box with a materials array** — top face one
tone, sides another — which is why one object produces several quads at
different tones with hard straight edges between them.

## Why they read as translucent patches rather than as stone

Because a flat colour is not a material. Every other ground surface here derives
its canvas from its real metres at one density — 32 px/m — and carries aggregate,
staining and scoring joints. Against that, an untextured quad has no grain for
the eye to attach to and no joints to give it scale, so it reads as a *tint over*
the paving rather than as a piece of paving. That is the same reason the driveway
apron read as "a large flat untextured grey plane" earlier today, and the same
reason my own scoring-joint fix made a ramp legible that had been sloping
correctly all along.

## The two that ARE mine, and are deliberate

The other 2 meshes are `props` planes, 0.4 m across, at (-6.6, -23.4) and
(-6.5, -23.7). They are **litter contact shadows** — the small dark smudge under
a dropped cup or newspaper that stops it looking like it is hovering. They are
deliberate shading, they are a fifth the size of the patches in question, and
they are not what the user is looking at. If they ever read as geometry it will
be because they have a hard edge; they are drawn with a soft radial falloff for
exactly that reason.

## How much of the world has the same problem

Counting the TOP face of every ground surface over 1 m² — the face you actually
look down on:

```
module        textured   FLAT   flat m2
  ?                 39     67       211
  street             1     27        43
  civic              0     14        92     <- the forecourt
  lot                2     12        82
  walkup             1      2         9
  tex-ground        16      1        17     <- mine
```

**123 ground-facing surfaces across the world are untextured flat colour, about
454 m².** `civic` is the worst case in kind rather than in size: it has **zero**
textured ground materials anywhere, so the library forecourt and the churchyard
are entirely flat colour.

My own single flat entry is the apron's skirt — a dark band deliberately hidden
*under* the apron so its edge does not float — and its top face is at y 0.002,
below the surface. It is not visible from above.

## The fix, and who has to make it

The forecourt is `ct/civic.ts`, which is not my file. What I can do without
reaching into it is supply the texture, so adoption is one line rather than a
day's work: `plazaTex(minX, maxX, minZ, maxZ)` is now exported from
`ct/tex-ground.ts` alongside `walkTex` and `apronTex`. It sizes its canvas from
the real metres of the slab at the world's 32 px/m, and draws civic flagstone —
bigger units than the sidewalk, a slightly cooler grey, aggregate speckle and
scoring joints on the flag grid.

**Routed to `ct/civic.ts`'s owner:** the landing and the flight take
`plazaTex(...)` on their TOP face (index 2 of the materials array) instead of a
flat colour. The copings, posts and planters are small enough that flat colour
is defensible; the two 3.6 × 4.1 m slabs are not, and they are what the user is
looking at.
