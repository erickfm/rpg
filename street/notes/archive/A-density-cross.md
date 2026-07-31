# Builder A — pattern #1 finished across tex-world, street and civic

Cross-file mandate from the desk (`notes/queues/A-shared.md`, `## Now`).
One commit, three files: **`a848b9d`**. Already picked up by the merge train.

## What the pattern became

The auditor's restatement, which is what this implements:

> Every surface that paints masonry derives its canvas from the surface's real
> metres at the world's one density. The defect is not that a painter computes
> density badly; it is that any painter computes it at all.

`ct/tex-world.ts` now exports **`masonry(widthM, heightM, baseY, mult)`** — the
one place a masonry canvas is sized. It returns the canvas, a metres→texels
converter, the world-Y course grid, and `paint()`. Every masonry painter in the
world goes through it.

## What changed, by file

**`ct/tex-world.ts`** — added `masonry()`; routed `facadeTex`, `shopfrontTex`
and `resGroundTex` through it (their output is unchanged — they were already
correct). Two additive params on `facadeTex`: `minCols`, so a 2.8 m canted bay
is one window wide rather than two; and `sill0`, so a face that runs to the
ground can still line its windows up with the elevation.

**`ct/street.ts`**

- **`bodegaBrick` deleted, not corrected.** Its own comment said it existed
  because `facadeTex` clamped width at 64 px. I removed that clamp in the first
  pass, so its reason for existing was already gone. The corner now uses the
  shared painter — 11.5 × 11.7 → 8 × 8.
- `bayFrontT`, the two alley flanks, the alley rear wall: converted.
- **The two cross buildings** — the auditor's "breaks tex-world's stated
  contract". Built 13.6 m but painted for `wallHeight(4)` = 13.0, and the east
  one's 24 m face painted as 22. Both now pass their real extent.
- **The three custom shop bands** (BURGER BARN, PAWN, A-1 TAX) — **not in the
  auditor's list.** I measured them at 8 × 12.38 against 18 neighbours at
  16 × 15.95. Same defect, and BURGER BARN is 16 m of main-street frontage, so
  leaving them would have recreated exactly the "misses made conspicuous by
  tidied neighbours" problem. Included.

**`ct/civic.ts`** — library, nave, gable and tower canvases through `masonry()`;
the ashlar bond restated in metres. Stone courses are legitimately taller than
brick: what has to match across a civic-to-shop party wall is the **density**,
not the course height. The tower's 3.7 m side face wore the 5 m front's canvas
at 10.81 px/m; its uv now maps the same stone at 8.

Plus one instance that **did not exist when I started**: see below.

## The pattern reasserted itself mid-task

I rebased before starting, as the queue instructed. Eight commits landed while I
worked — including E's library courtyard and D's church move, in the two files I
was editing. The rebase conflicted in one place (E's courtyard `CZ0/CZ1` line
next to my canvas derivation); resolved keeping both.

Re-measuring after the rebase turned up a **new** non-conforming group at
8.12 × 11.17 — `partyTex` in E's courtyard code, `Math.round(FLANK_H * 11.2)`.
A painter written *after* the pattern was documented, deriving its own density
again. Folded into the same commit.

That is the argument for the helper in one line: the fix is not correcting five
painters, it is making the sixth impossible to write wrong.

## Verification — measured, not eyeballed

`scripts/density.mjs` across all 106 exterior wall faces. **Every masonry face
now lands at 8.00 × 8.00, or an exact 2× at 16 × 15.95.** Nothing else remains.

Structural, around the change: **683 objects and 683 places unchanged** (8
differ — pigeons), 310 textures with **18 canvases resized out and 18 in**, a
clean 1:1 swap. `npm run build` clean, `health.mjs` OK, `npm run sweep` 48 shots
with no page errors beyond the standing THREE.Clock and WebGL warnings.

Cameras: `shots/x-bay.png` is the corner the user originally complained about —
the canted bay's brick now matches both wings with courses running round it.
Also `x-bodega-corner`, `x-civic-library`, `x-church`, `x-burger`, `x-alley`.

## `scripts/density.mjs` mis-measures anything inside a rotated group

**Important for whoever re-verifies.** The tool takes face width from a world
bounding box, so for a mesh in a rotated group the x/z extents swap and the
reported px/m is wrong. Three places are affected now:

| reported | actually | what |
|---|---|---|
| 11.5 × 8.02 | **8.13 × 8** | bodega canted bay (`CFW` = 2√2 = 2.828 m, group at −135°) |
| 22.5 × 15.95 | **15.91 × 15.95** | the bay's shopfront |
| 10.81 / 5.92 / 30.59 across | **8.00** | church tower + nave (D's `placeChurchEast`, group at −90°) |

I verified each from the source dimensions rather than assuming. Worth teaching
the tool to use the mesh's LOCAL geometry parameters and its world scale, rather
than a world AABB — it would have saved me an hour and it will mislead the next
person. That is a `scripts/` change, so mine; not done, because the mandate was
one commit of three files and nothing else.

## Left deliberately

- **Two painters keep their legacy texel coordinates**, re-based onto the
  correct canvas by `ox`/`oy` rather than restated in metres: the alley flanks
  and the three shop bands. Same world positions, one derivation, no painter
  carrying a px/m — but the art is still written in the coordinates it was drawn
  in. Restating it properly is a bigger edit than those files could safely take
  with D live in them. Worth doing next time the alley or the shopfronts are
  open; there is a comment at each site saying so.
- **Not masonry, so not touched:** the alley floor (9.7 × 9.85 — that is the
  audit's ground pattern #5, not #1), the facade props at 14.12 and 9.41, trees,
  cars, roads. The courtyard paving at 31.87 × 32 is the `tex-ground` family and
  correct at its own documented density.
- **R3** (the 1.0 m band step at No. 227) is still `bandOf()` in `street.ts`.
  Courses cross it in phase; the datum line and window rows still step, because
  the storeys genuinely are 1.0 m lower. A `street.ts` decision, not a paint fix.

## For the desk

1. `scripts/ownership.sh A` flags `street.ts` and `civic.ts` — it has no notion
   of the grant. Expected, and worth a line in `OWNERSHIP.md` or the script if
   mandates become a recurring thing.
2. **Port 4188 is still not mine.** Builder E's dev server (launched `--port
   4182`) has been squatting it all session; I worked on 4191. `strictPort` now
   stops the silent walk-up for anything started fresh, but E's server predates
   it.
3. The density tool fix above is the highest-value follow-up — it is what the
   auditor will re-verify with.

## Next in my queue

Republish the playable artifact — not started.
