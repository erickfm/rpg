# Item 171 — the park shelter's ceiling, and the check that could never have caught it

Worker **eighty**, 2026-08-03. Port **4360**, `vite preview` over `dist/` — the
**built bundle**, GOTCHAS 28. Landed as `72feb9a42`.

> The user: *"shelter roof is still bugged in terms of graphics."*
> Standing under the shelter, looking up: a dense high-frequency stripe grid.

**I did not delete, redesign, or move anything.** One texture's density and three
pitches. The geometry, the posts, the roof buffer, the bench and the apron are
untouched — `ct/park.ts:1755-1812` records this shelter being built three times
and deleted once, and the desk's ruling that it was the **execution** the user
disliked, not the thing.

---

## Root cause, in one line

**At 16 px/m a 0.16 m board is 2.56 texels, so its 1-texel joint shadow was a
third of the board — the ceiling drew as a 2:1 stripe instead of boarding.**

The arithmetic, from `ct/park.ts` as it stood:

```
canvas   Math.round(CEIL * 16)                    4.20 m × 16 px/m = 67 px
board    Math.max(3, Math.round(0.16 * 16))       round(2.56) = 3 px   ← and the floor also fired
face     board - 1                                2 px
joint    1 px                                     33% OF EVERY BOARD
rafter   Math.max(2, Math.round(0.07 * 16))       max(2, 1) = 2 px = 0.125 m, vs 0.07 m asked for
```

**Both `Math.max` floors firing is the code saying it has run out of pixels.** A
floor that is *reached* is a density that cannot draw its own content, and it
fails silently — nothing rounds visibly, nothing warns, the texels stay square.

## The fix — declare the density, derive every pitch from it (BUILDER-BRIEF §7b)

**32 px/m.** An *integer* multiple of the world's `WALL_PPM` of 8, which
`ct/tex-world.ts:67` requires by name — *"for surfaces that carry fine content …
integer keeps texels square and the course grid commensurate"* — and the density
`ct/civic.ts:404` already establishes for every jointed surface in the world:
*"every other ground surface here derives its canvas from its real metres at one
density — 32 px/m — and carries aggregate, staining and scoring joints."* A
boarded ceiling is a jointed surface.

Every pitch is now a **whole number of texels**, so nothing rounds and nothing
drifts across the span:

| | before | after |
|---|---|---|
| density | 15.95 px/m | **31.90 px/m** |
| canvas | 67 × 67 | **134 × 134** |
| board pitch | 0.1875 m (3 px @ 16) | **0.25 m** (8 px @ 32) |
| **joint as a share of a board** | **33%** | **12.5%** |
| rafter pitch | 0.625 m (10 px) | 0.625 m (20 px) — unchanged |
| rafter width | 0.125 m | **0.0625 m** (2 px) |

**The board goes 0.16 m → 0.25 m and that is the point, not a side effect.**
0.16 m boarding is finer than any density this world paints at, and drawing it
anyway is what produced the shimmer. The rafter pitch the source comment calls
*"what gives the ceiling scale when you are two metres under it"* is preserved
exactly, now landed on a texel.

The texture is also `declareSurface(…, 'detail')`'d, which it was not.

## My verdict on the after-images, which I have looked at

Four shots, all at world clock **13:00** (read back from `__ct.clockNow()`, not
from the HUD stamp — the corner stamp is not the world clock), black fraction
0.0% on every one, `waitPainted` before every shutter.

- `shots/w80-shelter-ceiling-before.png` / `-after.png` — **his vantage**,
  standing under the middle of the shelter, pitched 1.35 rad up. Before: bands of
  timber and shadow at roughly 2:1, no board face left. After: wide board faces
  with a thin dark joint line, slim rafters crossing them. It reads as a boarded
  soffit.
- `shots/w80-shelter-ceiling-oblique-before.png` / `-after.png` — **the one that
  settles it.** Straight up is the *magnified* case and cannot show aliasing; a
  stripe pattern shimmers when *minified*. So this stands at the south-east post
  and looks up the diagonal, the longest run of boards there is. **Before: the
  boards crowd into a shimmering ladder toward the far edge — the user's
  screenshot.** After: an even boarded ceiling, joints readable the whole way to
  the eaves, rafters half the width they were.

`scripts/probes/w80-shelter-ceiling.mjs` takes both, and reports every textured
mesh in the shelter with the px/m it actually draws at.

### The probe lied to me first, and I have left the reason in it

Its first cut located the shelter by a **box of coordinates I typed**
(x −50…−30, z −100…−60) and confidently reported *"THE CEILING: 30 × 13 m … 8 × 8
px/m"* — a backdrop plane on the other side of the park. That is GOTCHAS 48
indoors: an instrument aimed at the wrong object gives a clean bill of health it
did not earn, and this one would have had me report the ceiling as already
correct. It now finds the shelter by **the only 4.2 × 4.2 m `PlaneGeometry` in
the world**, and 4.2 is derived (`E * 2`, `E = SH_H + SH_OVER`), not typed.

---

## THE INTERESTING FINDING: `texdensity` could never have flagged this face

The row asked me to run it first and said that if the roof were **not** in the
188, *"that is a more interesting finding — it means the check has a blind spot
for this face and the check needs the fix, not just the roof."*

**It is not in the 188, and the blind spot is structural.**

`scripts/texdensity.mjs` judges an **undeclared** face on **texel ASPECT** —
`ppmX : ppmY` on the same face, gross at ≥ 4×. The ceiling measured
**15.95 × 15.95 px/m**: aspect **1.00**, perfectly square, sitting in the
`2926 × square (<1.05)` bucket. It was square while drawing a joint a third the
width of its own boards, and it is square now at twice the density. **No value of
the defect could have moved that number.**

The scale of the hole is in `texdensity`'s own output:

```
   327  faces carry a DENSITY declaration (userData.masonry)
  3826  faces DECLARE NO DENSITY AT ALL
        7.9% of the world's textured faces have a checkable density.
```

So for **92%** of textured faces the only available test is squareness — which
catches *stretching* and is blind to *absolute density* and to *a feature finer
than the texels drawing it*. This ceiling was the second kind.

**What would catch it, and it is not a threshold.** A surface that declares a
density can also declare the smallest feature it draws; a feature under ~4 texels
cannot carry a 1-texel joint without the joint becoming a third of it. The
signal is already in the source and needs no new instrument to read: **a
`Math.max` floor on a pitch that was computed from real metres is the author
recording that the density lost.** A grep over `Math.max(\d, Math.round(` in the
painters would find every one of these.

**Not built — rows 161 and 162 own `texdensity` and the item says not to
duplicate them.** Handed over precisely enough to queue.

---

## Verification run

| | |
|---|---|
| `tsc --noEmit` | clean |
| `node scripts/health.mjs` | `WORLD OK`, exit 0 |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, exit 0 |
| `scripts/texdensity.mjs` | **188 gross, baseline 188, "no owner got worse"** — unchanged, as expected for a face it cannot see |
| `scripts/w5-shadow-census.mjs` | exit 0, within baseline |
| `scripts/park.mjs` | exit 1 — **pre-existing**, and proved so: stashed my change, rebuilt, and mainline gives the identical `loop straights found: NONE`. My change is one texture; it cannot touch the loop |

`fp`/`fpdiff` deliberately **not** used: it is a pure-refactor tool and this
changes a texture, so it would report a catastrophe that is not there
(BUILDER-BRIEF §10). The proof is the measured px/m either side plus four images
I have opened.
