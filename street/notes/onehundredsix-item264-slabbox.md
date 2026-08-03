# Item 264 — `slabBox(w, h, d)`, and the reason it is not one `slabTex` per face

Worker onehundredsix. `src/proto/ct/paint.ts` (the tool) + `src/proto/ct/jail.ts`
(the fifth instance, adopting it). Commit `23cc65283`. Measured on the **built
bundle**, port **4620**.

**DONE by the row's own four conditions**: `slabBox` exists, a real call site
adopts it, the adoption is proven not to move geometry, and the adoption count is
below.

---

## The headline finding: the obvious implementation is silently wrong

The row asks for "the ergonomic wrapper: `slabBox(w, h, d)` that hands a box its
per-face maps so a caller CANNOT get this wrong", and item 259's note proposes it
as "the generalisation of what `fabric` now does privately" — one fresh 1:1
`slabTex` per face.

**I built that first and measured it, and it is not sufficient. It is worse than
the bug it replaces on exactly the faces this bug lives on.**

`slabTex` sizes its canvas `Math.max(8, Math.round(metres × ppm))` on both axes.
The clamp is correct — a surface 1–2 texels tall cannot hold detail, GOTCHAS 4 —
but it means **a face thinner than `8 / ppm` metres (0.25 m at the default 32,
0.17 m at the upholstery's 48) gets 8 texels whatever you ask for**, and its
density comes out at `8 / faceMetres` rather than at `ppm`.

Not reasoned — **mutated and measured.** Forcing the naive path (`const thin =
false`) and rebuilding:

```
 4.987x   32.08 × 160 px/m   face 2.4×0.05 m    canvas [77, 8]   jail  (61.3, 0.2, -103)
 4.987x   32.08 × 160 px/m   face 2.4×0.05 m    canvas [77, 8]
 4.880x   32.79 × 160 px/m   face 0.61×0.05 m   canvas [20, 8]
 4.880x   32.79 × 160 px/m   face 0.61×0.05 m   canvas [20, 8]

REGRESSION — these owners gained stretched faces:  jail: 1 -> 4      (exit 1)
```

**The naive wrapper takes owner `jail` from 1 gross face to 4** — worse than the
single-shared-sheet bug — while looking like a fix. The docstring predicted
"32 × 160 px/m, a 5× stretch"; the world said 32.08 × 160 at 4.987x. That is the
negative case, and it is the reason the function has two paths.

## So `slabBox` routes per face

- **fat enough for its own sheet** → a fresh 1:1 `slabTex` at exactly its metres.
  No tiling, no cropping, exact density. This is the primary path and it is what
  item 259's `fabric()` does privately.
- **too thin** → a clone of the largest face's sheet with a derived `fitRepeat`,
  which lands exactly `ppm` on both axes **at any thinness**.

Canvases cached per distinct face size, so a box costs at most three and usually
two.

### On item 259's objection to `boxFaces`, which is half right

> *"`boxFaces` … clones ONE texture and sets `repeat` — right for a tiling sheet,
> wrong for `slabTex`, whose output is `ClampToEdgeWrapping` and 1:1 by contract;
> repeating a clamped texture smears its edge texels."*

The conclusion is right and **the stated mechanism is not**: `fitRepeat`
(`paint.ts:119`) sets `t.wrapS = t.wrapT = THREE.RepeatWrapping` before it
touches `repeat`, so the clone is not clamped and nothing smears. Smearing only
happens if you raise `repeat` and leave the wrap mode alone.

The real cost of the clone path is different and I have written it at the
function: **it tiles, and `slabTex` draws its joint grid from the canvas origin
over a canvas that is not generally a whole number of joints across**, so a tiled
sheet can show a seam where the grid restarts. Irrelevant for grain (`joint: 0`),
and a joint grid on a sub-0.25 m sliver is meaningless anyway — which is why the
thin path is *warned* rather than forbidden. Forbidding it sends the caller
straight back to one-sheet-for-six-faces.

**So neither helper is simply "the wrong one".** `boxFaces` is right below the
8-texel floor, a fresh sheet is right above it, and the whole value of `slabBox`
is that the caller no longer has to know the floor exists.

## Adopted at the fifth instance

`ct/jail.ts:661`, the jail threshold — the fifth hand-fix, done with `boxFaces`
under item 162 an hour earlier and now converted. It is the ideal adoption
because **one box exercises both paths**: the 0.625 × 2.4 m top takes a fresh
sheet, and the 0.05 m edges are below the floor and borrow.

`slabBox` reproduces the hand-fix **exactly**: 155 gross, `jail: 1 -> 0`,
`texdensity` exit 0. The four call sites already passed the box's own `(w, h, d)`
so nothing else moved. I re-shot the threshold after the swap — identical 6.5%
black to both the before and the `boxFaces` after.

## How many sites could follow, and what it would take off the count

Measured off `shots/texdensity.json`, not estimated:

| | |
|---|---|
| gross faces in the world | **155** |
| …on a `BoxGeometry` | **146 (94%)** |
| …of those, carrying `rep 1×1` — a 1:1 sheet on a box, the literal target | **103** |
| distinct box **meshes** involved | **108** |
| distinct **canvas + owner** groups (≈ call sites) | **41** |
| not a box at all (out of scope for this family) | **9** |

**So up to 41 call sites could adopt the box-per-face family, covering 146 of the
155 gross faces.** The split matters: `slabTex` is called at only **9 sites
outside `paint.ts`** (`int-hotel` ×2, `vice`, `lot`, `int-pawn`, `int-library`,
`int-church`, `int-bodega`, `civic`), so **`slabBox` is the tool for those and
`boxFaces` + `declareSurface` is the tool for the rest**, which are hand-drawn
`pixTex` canvases with no density declared.

**⚠ 146 is a CEILING, not a forecast, and one chunk of it is already known not to
be real** — see below. The row's own warning against retrofitting blind is right:
four of the five instances were found because someone measured a face the user
could see.

## FOUND AND NOT FIXED

- **8 of the 155 are an INSTRUMENT ARTIFACT, and they are at the top of the
  list** (23–36x, `tex-ground` 4 / `street` 2 / `?` 2). They are `floorDrain`'s
  frame rails wearing `castTex()` (`tex-ground.ts:611`): a 16 × 16 canvas that is
  **a 1-D vertical gradient**, uniform along `u` apart from 26 dither pixels in
  256, whose 16 texels over 2.8 cm *are* the worn top arris. Squaring those texels
  destroys the detail. **Do not "adopt slabBox" here.** Full argument in
  `notes/onehundredsix-item162-hotel-jail-and-a-false-cluster.md`; wants a
  `declareSurface` "anisotropic on purpose" flag, not a fix.
- **`interior:bank` (32), the largest owner, is NOT a plain `slabBox` job.** Its
  dominant cluster is 16 faces on one 48 × 40 `concreteT` canvas, and the bug is
  `concreteMat`'s `Math.max(1, Math.round(m / 1.3))` — a 0.28 m end cap cannot get
  the 0.215 repeat it wants and is clamped up to 1. Unclamping fixes the slivers
  **and shifts form-board band alignment on walls the player sees**, so it needs a
  visual pass.
- **`interior:jail` (20)** is second largest and no row has ever named it.
- **The jail threshold renders as a flat BLACK quad** — pre-existing, proven not
  mine (identical 6.5% black before and after), and ironic, since it was made a
  `slabTex` specifically so it would not be a flat quad. `color: STEEL_DK` ×
  `#26282c` map is too dark to show grain. Colour judgement; worth a row.
- **`fabric()` in `int-hotel.ts` could now BE `slabBox`** — it is the same
  function, privately. I did not touch it: item 259 landed hours ago, `int-hotel.ts`
  is not named by this row, and the row explicitly says to adopt at the fifth
  instance rather than retrofit the four already fixed (BUILDER-BRIEF §9).

## A collision worth recording

**Item 259 and my item 162 fixed the hotel upholstery independently, within the
same hour**, reaching the same diagnosis by different routes — the second time
this has happened on this exact bug (w102 collided with item 163 the same way).
On merge I took mainline's `int-hotel.ts` wholesale and dropped my version:
theirs was landed, mine was not, and **theirs is the better implementation above
the 8-texel floor**. My commit `997f0aec8` is therefore superseded and should not
be read as live. The duplicated effort is a dispatch cost, not a mistake by
either builder — but *three* collisions on one bug shape is the argument for this
row existing.

## Derived, not retyped

`SLAB_MIN_PX = 8` is declared **in `paint.ts` next to the `Math.max(8, …)` it
describes** — same file, same module, so it is one authoring and not a copy. Every
dimension passed to `slabBox` at the jail is the same expression already passed to
the adjacent `BoxGeometry`. No number was copied across a module boundary.

## Green

`tsc --noEmit` **0** · `npm run build` **0** ("built in", checked) ·
`texdensity.mjs` **exit 0**, 155 gross, "no owner got worse" · `--selftest` both
cases caught · `health.mjs` **exit 0** WORLD OK · `bugsweep.mjs` **exit 0**,
96 shots, **0 STATION MISS, 0 COVERAGE**.

**Geometry proven, not screenshotted** (`w102-geomdiff.mjs`, because `fp` cannot
survive a texture-count change — GOTCHAS 75):

```
8615 objects before, 8615 after
IDENTICAL as a multiset — no mesh added, removed or resized.
4 of 8615 position entries differ        (noise floor is 5, measured)
unique textures 1711 -> 1711  (+0)
```

**Both `health` and `bugsweep` returned exit 3 on my first attempt** — "nothing
measured", because I had committed after building and the preview was serving a
stale bundle. That is GOTCHAS 32 working correctly and it is worth saying out
loud: **exit 3 is not a failure of the world, it is the instrument refusing to
lie.** Rebuilt, re-ran, both green.
