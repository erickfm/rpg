# w4 — item 5c, "used car sign is completely flat" — FIXED

## Root cause (one line)
The pole sign's two artwork faces (`ct/lot.ts` ~1108-1128, `lot-pole-sign-street`
/ `lot-pole-sign-lot`) were, and remain, two single-sided `PlaneGeometry`
planes back-to-back at `px ± 0.19` — correct per GOTCHAS 10/35, since collapsing
them into one `DoubleSide` plane would mirror one side. But nothing ever
filled the 0.38 m gap **between** them: edge-on or from below, the sign was
two zero-thickness sheets with air in the middle, i.e. paper. (The item's
cited offset, `+/-0.03`, is stale — a prior fix already moved the faces to
`±0.19` to clear the mast; the "no thickness" complaint was never about the
offset, and is still true today at the current offset.)

## What I did
Added a single `BoxGeometry(CABINET_DEPTH, SIGN_H, SIGN_W)` cabinet mesh
(`ct/lot.ts`, `lot-pole-sign-cabinet`), centred at the same point as the two
faces, sized to fill the space between them with a 0.36 m depth (a 0.01 m
inset from each face, so nothing is coplanar with them — GOTCHAS 6 — matching
the same "1 cm proud" margin the glow tubes already use from the other side).
Its side faces (top, bottom, and both width-direction ends) are the visible
"returns" the item asked for. Left the two artwork planes and the glow
overlay completely untouched, per the item's instruction.

Material: a new flat `MeshBasicMaterial(0x54585f)`, deliberately darker than
the mast's own `postM` (`0x6e747b`) so the case reads as its own part rather
than "more pole." No `transparent`/`alphaTest` (GOTCHAS 22 does not apply),
no `selfLit` flag needed (a plain opaque colour, dims at night the same
ordinary way `postM` already does — verified nothing regressed by running
`bugsweep.mjs` clean, below).

## Verification
- **Structural** (`scripts/w4-polesign-depth.mjs`, new — named after what it
  asserts, checked `ls scripts/` first for `pole*` collisions per GOTCHAS 24,
  found `polesign.mjs`/`polelit.mjs` which check legibility/lighting, not
  thickness, so this is a new assertion, not a duplicate): finds the cabinet
  by name (GOTCHAS 20, "aim from the source"), and asserts (1) it has >0.2 m
  of real depth — measured 0.36 m; (2) it sits strictly between the two
  faces with no coplanar overlap — measured 0.01 m insets both sides; (3) its
  footprint matches the sign's own published `size` in
  `scene.userData.lotSign` — measured exact match, 6.00 x 4.50. All three
  PASS against the built preview (`vite preview`, not dev — GOTCHAS 28/37).
- **Visual, for looking only** (GOTCHAS 1 — never for proving): two shots at
  a genuine 3/4 angle, offset in both X and Z from the cabinet. My first
  attempt offset in Z only, which — confirmed by hand, projecting the
  cabinet's centre to NDC and sampling the rendered pixel — puts the viewer
  looking straight down the cabinet's own width axis and foreshortens the one
  dimension a depth check needs to see; that is a real trap worth naming for
  the next person aiming a camera at a thin box. `shots/w4-polesign-oblique.png`
  and `shots/w4-polesign-below.png` (not committed, `shots/` is gitignored)
  both clearly show a dark return/edge distinct from the artwork face — my
  own verdict is that it now reads as a lightbox with a case, not a flat
  panel, from both angles. `shots/w4-station-check.png` — the site's own
  already-published front-on `station` — also shows the return along the
  panel's right edge at oblique perspective, for a third look.
- **World health**: `npx tsc --noEmit` clean. `npm run build` clean (only the
  two pre-existing chunk-size / dynamic-import warnings, unrelated to this
  file). `SHOT_URL=http://localhost:4183/ node scripts/bugsweep.mjs` — exit
  0, zero STATION MISS, zero errors in the console log (only pre-existing
  headless-Chromium noise: THREE.Clock deprecation, canvas readback perf
  hints, a WebGL context-lost warning at teardown — none new, none errors).

## What I did NOT check
Did not re-verify the sign at every hour of the day/night cycle beyond the
existing `polelit.mjs` (unchanged, not touched, still governs the glow). Did
not check the cabinet from the far kerb — `polesign.mjs` already owns
legibility-from-distance and this change adds no material to either artwork
face, so that check's assertions are unaffected; I did not re-run it, on the
basis that nothing it reads about was touched, not because I looked and it
passed.

## Derivation
`CABINET_DEPTH = 0.36` is chosen, not derived — the item says "keep the two
artwork faces as they are," and their existing `±0.19` offset (a value
already in the file, not retyped by me) sets the only hard constraint: the
cabinet must fit inside `0.38` m without touching either face. `0.36` is that
budget minus 2x the same 0.01 m proud-margin convention already established
in this exact block for the glow tubes — cited, not reinvented.
