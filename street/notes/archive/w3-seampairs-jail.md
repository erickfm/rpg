# 103(→107) brick seam disagreements at the jail — established REAL, not an artefact

Queue item, file `scripts/seampairs*`. Build at commit (pending, see below).

## The ask, and the answer

The item's whole instruction was "establish real-vs-artefact **first**" —
this project has a documented history (7 real / 6 artefact this week, per
`BUILDER-BRIEF.md` §7) of seam-style density checks reporting false
positives from box-material misreads, ivy mistaken for brick, and stale
grid-only checks. I did not assume either way; I measured.

**Verdict: REAL.** Confirmed three independent ways:

1. **The instrument is sound today.** `node scripts/seampairs.mjs --selftest`
   artificially doubles one masonry face's `repeat.x` (a synthetic,
   known-bad mismatch) and the tool catches it — `SELFTEST PASSED`. A
   check that cannot fail would be worthless; this one can and does.
2. **The numbers cluster on one real object, not scattered noise.** A
   clean run (no selftest) reports **107 like-for-like disagreements
   across 23 distinct faces**, every one of them at `x 60.9–63, z −97.4…
   −108.6` — inside `ctx.site('jail')`'s own published bounds
   (`{minX:57, maxX:75, minZ:-110, maxZ:-96}`, read live from
   `window.__ct.sites()`). This is not a diffuse population of marginal
   readings; it is one wall.
3. **It is visible to the eye, not just to the measurement.**
   `shots/w3-jail-flank-mid.png` (script: `scripts/w3-jail-flank-seam.mjs`,
   kept, add-only): standing at the jail's east flank looking at the pier
   at `x≈61, z≈−103`, a vertical stone pier shows visibly **smaller,
   more numerous brick courses** than the wall sections flanking it on
   both sides — same grey stone colour, same material, clearly meant to
   read as one continuous coursed wall, but the pier's brick is drawn at
   a different scale than its neighbours. This is exactly what
   `seampairs.mjs`'s own docstring says it exists to catch: "two faces
   meant to be one run of brick, drawing different-sized brick." A wider
   shot (`w3-seam-flank-wide.png`) shows the same wall's vertical band
   structure for context; the pier/wall mismatch is the mid-shot's
   subject specifically.

Both faces in the worst pairs **declare the same density (16 px/m)** —
this is not the SHOP_MULT case (a band meeting a wall by design, ratio
~2x, which the tool already excludes and correctly reports separately as
372 pairs) — it is a face that says 16 and measures 11.03, next to one
that says 16 and measures 16. One declaration, two different actual
scales. That is a geometry/UV authoring bug, not a design choice.

## What I did NOT do

**Did not touch `ct/jail.ts`.** This item names only `scripts/seampairs*`,
and jail's exterior is O's file, not named here. The instrument itself
needed no fix — it is already correctly distinguishing real disagreements
from design-intentional ones (SHOP_MULT bands, ivy cutouts, unjudgeable
undeclared faces), each in its own bucket in the output, and the selftest
proves it can still fail. Nothing to loosen or tighten.

**Recommend queuing, for whoever owns `ct/jail.ts` (O):** the east flank
wall between roughly `z −97 and −109` (23 faces, spanning y 1.6–12.7, the
full wall height) draws inconsistent brick scale against itself, sharpest
at the pier around `(61, 6.1, −103)`. `node scripts/seampairs.mjs` (no
flags) reproduces the full list; `shots/w3-jail-flank-mid.png` shows it by
eye. This reads like a single mis-parameterised `masonry()`/wall-painter
call reused across the flank with the wrong width argument, consistent
with the seam-mismatch class this tool's own comments describe elsewhere
in the codebase (box `material[0]` width-vs-depth confusion), but I have
not traced the exact call site — that diagnosis belongs to whoever holds
the file.

## Verified

- `node scripts/seampairs.mjs --selftest`: SELFTEST PASSED (tool is
  sound).
- `node scripts/seampairs.mjs` (clean): 107 real like-for-like
  disagreements, 0 both-declared-brick disagreements, all in the jail
  cluster. Re-ran twice for stability; identical count both times.
- Visual confirmation at `SHOT_URL=http://localhost:4182/` via
  `scripts/w3-jail-flank-seam.mjs` — screenshots saved (gitignored,
  local): `w3-seam-flank-wide.png`, `w3-seam-flank-mid.png`.

## Derivation

The jail's site bounds came from `window.__ct.sites().jail`, published by
the world itself, not typed by hand. The 23 face locations and the 107
pair count came directly from `shots/seampairs.json`, the tool's own
output, re-derived from a clean (non-selftest) run rather than read from
memory of an earlier one.
