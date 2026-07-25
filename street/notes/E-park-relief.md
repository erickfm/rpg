# Topography in the park

The third of the three items. The loop and the mowing landed earlier; this is
the ground itself.

## What is there

Three gaussians in `ct/park.ts`, and nothing else:

| | height | σ | where |
|---|---|---|---|
| a **mound** | +0.33 m | 3.1 | the middle of the field, with a tree and a bench on it |
| a **dish** | −0.09 m | 2.6 | 4.4 m in from the north-east corner of the grass |
| a **corner fall** | −0.10 m | 5.2 | the ground dropping away to the south-east |

Measured on the composite, on a 0.2 m grid: **steepest 1 in 12**, floor never
below **0.056 m**, and **0.0 mm** of step where the grass meets the paths.

## It uses F's registry, and only F's registry

`register(ctx)` in `ct/park.ts` calls `ctx.ground(fn, BUILD.SITE)` exactly as
`ct/civic.ts` does for the courtyard. Nothing was needed from the entry point —
`groundPick` in `crosstown.ts` already asks the registered grounds *before* the
`[street.park, street.lot]` flat-site rule, so a registered answer inside the
field wins and everywhere else falls through to `site.y` unchanged. **No desk
action required**, which is the answer to the question the brief told me to ask.

## The discipline that made it safe

One function, two consumers. `relief(x, z)` displaces the field mesh's vertices
AND is what the floor picker returns. The shape you see and the height you walk
on cannot be two descriptions of the same thing or they drift, which is the
whole of GOTCHAS §7.

Everything that sits on the grass was routed through the same function rather
than left at `KERB_H`: the benches, the trees, the litter, and the desire lines,
which are subdivided along their length and **draped** — a worn line that stops
at the foot of a mound is not a worn line.

## Three things I got wrong, all caught by measuring

1. **The rim mask has its own slope.** The relief is faded to zero over the last
   3 m so the grass meets the paths flat. My first set of numbers put a 0.45 m
   mound where that fade bit into it, and the mask took 0.4 m out over 3 m — a
   1-in-6 bank, three times steeper than the gaussian it was smoothing. Slope is
   a property of the *composite*, and I had only ever computed it per feature.
2. **The dish read 0.15 — above the level ground it was meant to dip below.**
   At 4.6 m from the mound its skirt is still +0.11 m there, which cancelled the
   dish outright. Moved to 9 m clear. The walk found this; no drawing would have.
3. **A -0.13 m dish on a 0.14 m kerb puts the floor 8 mm above the roadway.**

## And one that only looking could catch

It walked correctly and was **invisible**. Every material in this world is
`MeshBasicMaterial` — unlit — so a slope is exactly the same colour as level
ground, and a gentle mound reads as nothing at all until you are standing on it.

Two cues, both baked into vertex colours on the field mesh:

- **slope shading**, one fixed sun, gain 5.5. Not physical: 1 in 12 tilts a
  normal by 5°, and 5° of lambert on a mid-green is about 2%. Deliberately zero
  at flat ground, so the level three quarters of the field keeps the mown
  texture's own colour and the stripes are not washed out.
- **a height tint** — dry and yellow on the crown where it drains, dark and
  green in the hollow where it does not. This is the one that works from every
  angle; slope shading changes with where you stand and mostly vanishes when you
  are on the crest.

The alternative was a taller mound, and I costed it: at 0.52 m the composite
grade goes to **1 in 6**, because the rim has to lose more height over the same
3 m. Steeper ground to make gentle ground visible is the wrong trade in a brief
that says *gentle* twice, so the exaggeration went into the shading, where it
costs nothing underfoot.

## Verification

- `E-park-walk.mjs` — 16/16, against my own preview build on 4194. The old
  "every sample reads 0.14" check would now fail by design and has been replaced
  by four: the paths and perimeter are still dead level (66 samples off the
  grass, all 0.14); the mound is under your feet (gy 0.45 at the crest); the
  dish would hold a puddle (gy 0.06); nothing is steep enough to trip on
  (steepest half-metre 0.04 m, 1 in 12). Plus a walk **straight over the mound**,
  which is the only test that proves the picker and the mesh agree.
- `seats-walk.mjs` — 57/57 sit, lock and stand clear, the mound's bench included.
- `nightgrade.mjs` over the park box — opaque 0.128 → 0.024, alphaCut 1 → 0.201.
  Vertex colours dim with the world; no §22 breach.
- Shots in `shots/E-mound/`.

_Builder E, 2026-07-25._
