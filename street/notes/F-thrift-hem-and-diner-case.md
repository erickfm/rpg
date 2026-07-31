# F — thrift coat-rack hem, and the diner's pastry case

Both bugs from `SESSION-STATE.md`'s "Two defects, both found by eye on
2026-07-31," both in files I own (`OWNERSHIP.md`: `int-thrift.ts`,
`int-diner.ts`). Neither touched room geometry, walls, doors or seating —
both were pure material/texture faults on existing props.

## 1. Thrift coat racks — the torn hem

**Root cause:** `dblT` (the second-tier "doubled" rail texture) and `coatT`
(the sagging coat-rail texture) each draw a column of garment colour with a
RANDOM height per column, and neither one fills the canvas background first.
`dither(g, w, h, n)` (`ct/paint.ts:167`) then runs over the FULL canvas
rectangle regardless — including the strip below each column that was never
painted and is still fully transparent (alpha 0).

Canvas 2D's own compositing is exact here: `source-over` of a translucent
fill onto an alpha-0 destination yields back the SOURCE colour at the SOURCE
alpha — so `dither`'s `rgba(0,0,0,0.16)` / `rgba(255,255,255,0.1)` dots land
on that strip as literally pure `#000000` and pure `#ffffff`, just at low
alpha. Both of these textures feed a plain `MeshBasicMaterial` with no
`transparent`/`alphaTest` set, so the renderer never reads that alpha back
out — it shows the pure black/white RGB outright. That is the "ragged strip
of alternating black and white pixels" instead of a clean hem: it was never
fabric, it was unpainted canvas getting dithered as if it were opaque.

`garmentT` (the primary rail block) was never affected — its columns already
fill the full 32-row height, so it had no unpainted strip for `dither` to
catch. That is also why the fix is two textures, not three.

**Fix:** fill the canvas with an opaque colour before drawing the columns, in
both `dblT` and `coatT`. The gap below a shorter garment now reads as the
intended shadow beneath a packed rail, and `dither` blends against an opaque
colour there the same way it already did everywhere else in this room —
ordinary subtle grain, no salt-and-pepper fringe. Column heights, positions
and the "uneven hem" look (different garment lengths) are unchanged; only the
unpainted strip's colour changed, from "undefined" to "shadow."

`src/proto/ct/int-thrift.ts` — the two `pixTex(...)` callbacks for `dblT`
(~line 327) and `coatT` (~line 350).

## 2. The diner's pastry case — the milky haze

**Root cause:** the case was a closed `BoxGeometry(0.55, 0.55, 0.5)` — six
faces — carrying ONE `MeshBasicMaterial` with `transparent: true,
opacity: 0.9, side: THREE.DoubleSide`. `DoubleSide` exists for a single OPEN
plane that might be seen from its back (GOTCHAS §10); on a fully enclosed box
every face already points outward on its own account, so `DoubleSide` only
un-culls the FAR faces along the same view ray — the inside of the back
face, the far edge of the top. three.js does not depth-sort triangles within
one mesh, so those extra un-culled layers land in whatever order the GPU
happens to draw them — exactly the cost GOTCHAS §22 already names: "it moves
the mesh into the sorted transparent queue, where DoubleSide geometry picks
up sorting artifacts it would never have had — the far face painting over
the near one." Two (sometimes three, at a grazing angle) copies of the same
~90%-opaque pastry texture then stack in an unpredictable order, which is
what read as a milky, near-opaque haze with the pies washed to faint blocks.
It was not a badly tuned opacity value — it was genuinely doubled transparent
geometry.

**Fix:** every other display case in this codebase — this file's own
`tillGlass` equivalent in `int-thrift.ts`, the bodega deli case
(`int-bodega.ts`), the bank teller screen (`int-bank.ts`), the jail visiting
glass (`int-jail.ts`) — is a single forward-facing `PlaneGeometry`, not a
box, for exactly this reason. Did the same here: `PlaneGeometry(0.55, 0.55)`
in place of the box, positioned where the box's own front face already sat
(`CZ + 0.25`, no other coordinate changed). Kept `DoubleSide` — a lone plane
has no second face to sort against itself, and every other case in the
codebase keeps it too, which is why the bundled bug sweep's `diner-far`
station (an off-player-path view from the staff side of the counter) still
sees the case rather than nothing. Dropped the redundant `opacity: 0.9`
multiplier: the texture already carries its own alpha (0.35 on the glass
background, 1.0 on the shelf and pies), and that alone is now what controls
translucency.

`src/proto/ct/int-diner.ts`, ~line 178 (`pieT` / `pie`).

## Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — clean (pre-existing chunk-size and dynamic-import
  warnings only, unrelated to these files).
- Re-shot both rooms with `scripts/bugsweep.mjs` (`SHOT_URL` pointed at my
  own port, per GOTCHAS §26/§48) against BOTH the dev server (port 4182) and
  a `vite preview` of the built bundle (port 4183), per GOTCHAS §37 — a
  dev-only pass proves nothing about what ships. Same result both times, zero
  `STATION MISS` for `thrift-*` or `diner-*` (the two `jail-*` misses in the
  sweep's own output are the pre-existing collider bug filed in
  `3c1439537`, unrelated to this work, not touched here).
- **Looked at all of it myself**: `thrift-entry`, `thrift-far`, `thrift-wide`,
  `diner-entry`, `diner-far`, `diner-wide`, before and after, both builds.
  The hem now reads as a clean dark edge under the garments, no fleck. The
  pastry case is a small, distinctly-tinted glass box with the pie/cake
  colours clearly visible through it, not a haze.
- Did not run `npm run fp` — both files are mine alone
  (`OWNERSHIP.md`), nothing shared was touched, and no room shell, collider,
  door, or seat position changed. `git diff --stat` against `add-stick-and-
  city98` confirms the diff is contained to `int-thrift.ts` and
  `int-diner.ts`.

## What did NOT change

Room dimensions, walls, the door, the counter, the till, the stools, seating,
colliders (`solid(...)` calls), and every other prop in both rooms are
untouched. This was two texture/material faults, nothing else.
