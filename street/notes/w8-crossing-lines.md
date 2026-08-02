# w8 — item 5h, the yellow centre line through the crosswalks

## Root cause, in one line

`crosstown.ts` drew each street's dashed centre line as ONE `PlaneGeometry`
spanning the street's whole length, so it had no way to know a crossing
existed anywhere along it and painted straight through both of them.

## What changed

`src/proto/crosstown.ts`, the block that used to build `line`/`line2`
(previously two single meshes, `lineT`/`lineT2` textures): replaced with two
small helpers (`zLineSeg`, `xLineSeg`) that each build one dashed segment
between two coordinates, and four calls — two per street, one on each side of
that street's junction crossing.

- **Main street** (`line`, ran z `SIDE_Z0..36` in one piece): now
  `zLineSeg(SIDE_Z0, XA_Z - XA_HW, ...)` and `zLineSeg(XA_Z + XA_HW, 36, ...)`.
- **Side street** (`line2`, ran x `6..54` in one piece): now
  `xLineSeg(6, XB_X - XB_HW, ...)` and `xLineSeg(XB_X + XB_HW, 54, ...)`, same
  fault C's own comment on `crossingStripes` had already flagged ("check the
  side street's line (line2) for the same fault") — confirmed real, not just
  suspected, before fixing it: `line2` spans x 6..54, the side-street crossing
  sits at x 9.3..11.9, well inside that span.

**Dash pitch is derived, not retyped.** Each street's original
`length / repeat` (134 m / 38 for the main street, 48 m / 22 for the side
street — the two differ, so I kept them separate rather than assuming one
pitch for both) is computed once as `LINE_PITCH`/`LINE2_PITCH`, and every
segment's texture repeat is `segmentLength / pitch`. Splitting a plane into
shorter pieces without this would have squeezed the dashes denser on every
segment (repeat count stays literally the same regardless of the mesh's own
length) — checked this would happen before writing the fix, not after.

## The gap values: copied, with a citation, not imported

`ct/tex-ground.ts:1351-1352` (as of `705b78b74`, this branch's base) declares
`XA_Z = -90.2, XA_HW = 1.3` (main-street junction crossing: z centre,
half-width) and `XB_X = 10.6, XB_HW = 1.3` (side-street junction crossing) as
consts **local to `buildGround()`'s own closure** — nothing in that file
exports them, and this item's grant is `crosstown.ts` + **read**, not edit,
`tex-ground.ts`. So these four numbers are copied into `crosstown.ts` with a
line-number citation in the code comment, not derived by import.

**This is exactly the fragility BUILDER-BRIEF §8 warns about** — "a hand-typed
gap stops matching the moment a crossing moves" — and it is real here: if
`XA_Z`/`XA_HW`/`XB_X`/`XB_HW` ever change in `tex-ground.ts`, `crosstown.ts`'s
copy goes stale silently and the centre line drifts back to painting through
the crossing (or leaves an unnecessarily large gap) with no error anywhere.

**Follow-up for the desk to queue:** ask whoever owns `ct/tex-ground.ts` to
export these four numbers — a named `JUNCTION_CROSSINGS` constant, or similar
— so `crosstown.ts` can import instead of duplicate.

## Verified

- `npx tsc --noEmit` clean.
- `npm run build` clean (pre-existing dynamic-import/chunk-size warnings only,
  unrelated to this change).
- **Structural check**, not a screenshot (BUILDER-BRIEF §10: screenshots are
  for looking, not proving). Queried the live scene via `window.__ct.scene()`
  for every `PlaneGeometry(0.5, …)` mesh and confirmed the four segments'
  actual geometry/position match the intended math exactly:
  - main-street segment 1: `h=6.5` at `z=-94.75` — i.e. `SIDE_Z0..XA_Z-XA_HW`
    = `-98..-91.5`, length 6.5, centre -94.75. Matches.
  - main-street segment 2: `h=124.9` at `z=-26.45` — i.e.
    `XA_Z+XA_HW..36` = `-88.9..36`, length 124.9, centre -26.45. Matches.
  - side-street segment 1: `h=3.3` at `x=7.65` (rotZ 1.571, i.e. the
    side-street orientation) — i.e. `6..XB_X-XB_HW` = `6..9.3`, length 3.3,
    centre 7.65. Matches.
  - side-street segment 2: `h=42.1` at `x=32.95` — i.e. `XB_X+XB_HW..54` =
    `11.9..54`, length 42.1, centre 32.95. Matches.

  So the gap each segment leaves is exactly `XA_HW*2 = 2.6` m /
  `XB_HW*2 = 2.6` m wide, centred exactly on the crossing — no residual
  overlap, no unintended extra gap.
- Looked at it too, for my own sake (not as proof): screenshots from a
  ground-level approach on both streets show the yellow line stopping cleanly
  before the crosswalk stripes and resuming cleanly on the far side, dash
  spacing reading the same as before on both sides of the gap.
- `node scripts/bugsweep.mjs` on dev AND the built preview: 0 STATION MISS, 0
  console errors both times.
- `node scripts/health.mjs`: world initialises clean, both dev and preview.

## Found but not fixed

Only the one follow-up above — hoisting `XA_Z`/`XA_HW`/`XB_X`/`XB_HW` (or
equivalent) as a named export from `ct/tex-ground.ts`. Nothing else was found
wrong in this area; the only other painted crossing call site in the file is
the same two (`crossingStripes` is called exactly twice, both accounted for).
