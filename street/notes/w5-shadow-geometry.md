# w5 — item 0a, the shadow-geometry census

**Root cause, one line:** the audit's own census predicate ("131 meshes,
~1092 m2") flagged a mesh if *any* submaterial lacked a map, so it counted a
box's dark, deliberately-flat *riser sides* as offenders even when the top
face — the only one anyone sees, the one `slabTex`/`walkTex` actually paints
— was correctly textured. That single bug inflated the count by roughly 4x
(the west sidewalk slab alone, one box, 245 m2, was 100% false positive) and
is why nobody had fixed anything against this number before: most of what it
pointed at wasn't the bug.

## What I did

1. Wrote `scripts/w5-shadow-census.mjs`, reproducing the audit's predicate
   (largest face horizontal, world y in [-0.35, 0.55], area >= 1 m2, no map)
   but reading the **top-facing material specifically** — index 2 of a box's
   6-entry array, matching the rule `scripts/flat-ground.mjs` already proved
   outdoors — and running it **world-wide** (indoor + outdoor), since the
   item said "world-wide" and the audit's own indoor figure (~92 meshes) was
   never swept.
2. That corrected run found **121 meshes, 271 m2** (vs. the stale 131/1092).
   Investigated every outdoor hit and the largest indoor ones by hand (not by
   guessing from the census row — by reading source and, for the two biggest,
   screenshotting).
3. Fixed the four that are real:
   - `ct/int-pawn.ts` — the "worn where people stand" floor decal, a flat
     `#7c7268` plane laid over the shop's real textured floor (20.2 m2).
   - `ct/int-church.ts` — the altar dais top face, flat `#9a9488` right next
     to the nave's grained flagstone floor (16.6 m2).
   - `ct/vice.ts` — the casino entrance runner, `#7a2028` — the file's own
     comment already names this colour as the wet-tint outlier and it was
     still flat and unmapped (4.5 m2).
   - `ct/jail.ts` — the door threshold plate, flat `#26282c` (1.5 m2).
   All four now use `slabTex()` from `ct/paint.ts`, keeping their original
   colour so nothing else that reads it (`vice.ts`'s `registerWet`, which
   captures `.color` at registration) changes behaviour.
4. Added a second, principled exclusion to the census: strips under 0.3 m in
   their narrow in-plane dimension (GOTCHAS 4 — too thin to hold texture
   detail without aliasing). This dropped 13 "street" hits (17 m2) that
   turned out to be 0.09-0.20 m wide facade trim/belt-course bands, not
   ground.
5. Re-ran the corrected census after the fixes: **75 meshes, 172 m2**
   remaining, and it agrees exactly between dev (`4184`) and the built
   preview bundle (`4194`).

## What's left, and why I did not touch it

- **Indoor, 74 meshes / 155 m2, all `(unattributed)`.** I sampled the
  largest ones by hand (identify each mesh's position, dims, colour, then
  read the owning source file) rather than trusting the census row, per
  GOTCHAS 55/56. Every one I checked was **furniture with a flat horizontal
  top**, not ground: church pews (`int-church.ts`'s own `woodM`, a
  deliberate flat wood colour — confirmed in source, not guessed), library
  shelving/stacks (repeated boxes at the library's x-range), casino gaming
  tables, jail cell fittings, thrift racks. These sit inside the y-band and
  have a horizontal top face, so the predicate catches them, but retexturing
  a wood pew as paving stone would be a real visual regression, not a fix.
  I did not walk all 74 individually — that would be a further, narrower
  sweep (something like "furniture height range 0.35-0.55 m AND box, exclude
  by default" as a predicate refinement), and I'm flagging it rather than
  guessing at a blanket rule.
- **`ct/tex-ground.ts`'s DRIVES[0] apron skirt, 16.7 m2, at the car lot's
  east kerb (x=6, z=2.6).** Real by the predicate (a single-material,
  flat, unmapped box), but I screenshotted it from 8 angles
  (`scripts/curbcut-shots.mjs` against my server) and it does not read as
  the shadow-geometry defect: the apron surface on top is properly grained
  and jointed, and the flat skirt is a legitimately hidden backing plate
  (the file's own comment: "the dark edge under it, so the apron does not
  float at the kerb"). Left it alone on purpose — per BUILDER-BRIEF 7,
  loosening a check to make a false alarm quiet is different from leaving a
  correct-but-not-actionable finding correctly flagged as such.
- **The earlier audit's "12 flat 11.6 m2 car-lot bay slabs" claim is
  stale/false**, and was already resolved before I started: `ct/lot.ts`'s
  bay markings are `PlaneGeometry(0.09, 5.0)` decal lines, not 11.6 m2
  slabs — this is the exact example BUILDER-BRIEF 7 cites as a debunked
  finding. My live census confirms it: `lot` does not appear in either
  outdoor or indoor results at all. No action needed; the ledger row for
  this can be closed.

## Verification

- `SHOT_URL=http://localhost:4184/ node scripts/w5-shadow-census.mjs` — dev,
  75/172 m2, after fixes.
- Same script against `http://localhost:4194/` (built `vite preview`) —
  identical 75/172 m2.
- `node scripts/bugsweep.mjs` on both dev and the built bundle: zero
  STATION MISS, no new console errors (only pre-existing THREE.Clock /
  Canvas2D / GPU-stall warnings present before my change).
- `npm run build` (`tsc --noEmit && vite build`): clean.
- Individually confirmed via `scripts/w5-identify.mjs` that each of the four
  fixed meshes' material array now carries a map at the position the census
  originally flagged.

## Derived vs. copied

The four base colours (`#7c7268`, `#9a9488`, `#7a2028`, `#26282c`) are
copied from the meshes' existing `MeshBasicMaterial({ color: ... })` calls at
the exact line I edited — not retyped from the census output, so there is no
independent copy to drift. The y-band, area threshold and "largest face
horizontal" logic are copied from `notes/AUDIT-shadow-geometry.md`'s stated
predicate with one correction (top-face-only) cited above; the 0.3 m
narrow-strip threshold is GOTCHAS 4's own number.

## Reusable

`scripts/w5-shadow-census.mjs`, `scripts/w5-identify.mjs` (dump a mesh's
material/geometry/ancestry by world position) and `scripts/w5-rooms.mjs`
(dump `roomDims()`) are left in `scripts/` — the census in particular is the
corrected instrument going forward; the stale 131/1092 number should not be
quoted again.
