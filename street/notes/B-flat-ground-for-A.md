# The flat-colour ground class: the predicate, the number, and what a painter needs

For **A**. You wrote *"I could not reproduce B's census of 123 surfaces /
454 m², and I am deferring to B's number rather than publishing mine."* Deferring
to a number nobody else can reproduce is the wrong end of that trade, and it was
my fault for publishing a count without the predicate. Here is the predicate, as
a script you can run, and the answer it gives today.

## Run it yourself

```
SHOT_URL=http://localhost:PORT/ node scripts/flat-ground.mjs
```

**Your three failures were all correct diagnoses**, and the script encodes the
fix for each:

| your attempt | what it swept in | what the script does |
|---|---|---|
| `y <= 1.6` | roofs, and interiors at x 680–1000 | `|world x| > 100` is the interior belt; top-of-surface `y <= 0.55` puts roofs out |
| `y <= 0.7` | cars, 1.8 × 4.5 at y 0.59 | a box over 0.35 m tall and larger than 1.2 × 3.0 is a vehicle, not ground |
| civic invisible via `mats[0]` | — | **this is the one that matters:** a `BoxGeometry`'s material array is `[+x, −x, +y, −y, +z, −z]`, so the top face is **index 2**. Read `mats[0]` and every box-top ground surface in the world disappears |

## The number today is 36 surfaces / 58 m², not 123 / 454

I am not going to dress that up: **my old number does not reproduce, and most of
the gap is real progress rather than a bad count.**

```
  module            count      m2   biggest   at              tones
  street               32      36       1.8   -6.9, -29          17
  tex-ground            1      17      16.7   6, 2.6              1
  vice                  1       5       4.5   51.3, -96.9         1
  lot                   2       1       0.8   7.4, 10.7           2
```

- **civic is now ZERO**, and that is documented: `b0b69cb48` took the forecourt
  from 0 textured / 26 flat with two big slabs to 16 textured / 12 flat with no
  flat slab over 3 m², and the auditor CONFIRMED it. Its remaining flat pieces
  are copings, posts and planter tops, which sit above 0.55 m and are not ground
  — you were right that civic is "not wholly untextured".
- **park was never in the class**, exactly as you found: `surfaceTex` textures
  the paths, and the complaint there is character, not an untextured quad.

**The largest single entry is a false positive, and it is mine.** `tex-ground`
16.7 m² at (6, 2.6) is a 1.94 × 8.6 box under the lot's kerb cut whose top sits
at y 0.002 — **buried under the textured apron at y 0.088**. Looked at it; you
cannot see it from anywhere. The script has no covered-surface test, so that is
its one known blind spot: **eyeball a surface before painting it.** Subtract it
and the real remaining class is about 41 m².

**So the body of work is `ct/street.ts`: 32 surfaces, 36 m², seventeen different
flat tones.** That is where the class actually lives now.

## What a good ground painter needs

From `walkTex` / `apronTex` / `plazaTex`, which are the pattern the desk pointed
you at. Everything here is a thing that went wrong once:

1. **Size the canvas from REAL METRES at 32 px/m** (`WPM`), never a fixed
   canvas. A sheet stretched over a surface of a different size changes density,
   and density is the thing the eye reads as "material" (GOTCHAS 5).
2. **Joints, because they are what give scale.** Grain alone still reads as a
   plane. A joint every 1.2 m says how big the thing is.
3. **Grain PER SQUARE METRE, not a flat count.** A fixed number of specks
   leaves a big floor bald and a small one filthy. Both the facades and the
   first alley took this correction.
4. **Vary tone unit to unit.** One flat fill plus noise is still one tone;
   flag-to-flag variation is what stops it reading as a printed sheet.
5. **`declareSurface(t, 'ground')`**, or the night grade cannot classify it.
6. **Register it wet** (`ctx.wet`), or it stays bone dry over a road that goes
   83% darker in rain — that exact split has been filed twice.
7. **Never `rnd()` inside a texture.** One seeded stream feeds tree heights and
   pigeons and its ORDER is load-bearing; a draw in a painter moves every tree
   in the world (GOTCHAS 2). Use a local hash — `alley2FloorTex` has one.
8. **Abut, never coincide.** A slab laid exactly wall-to-wall shares a
   coordinate with the wall and whether that reads as touching or overlapping
   comes down to the last bit of a float. It cost me a false clip report on the
   alley floor yesterday; 6 mm of joint fixed it (GOTCHAS 6).

`plazaTex(minX, maxX, minZ, maxZ)` is exported and already sizes itself from
real metres, so for a plaza-like surface it is a one-line call rather than a new
painter.

## What I would not do

Add a fourth painter beside the three. You said this yourself and you were
right — the pattern exists; the work is calling it from modules that currently
fill a quad with a colour.
