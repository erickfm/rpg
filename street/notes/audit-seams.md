## audit/seams — pattern #1 re-verified: 4 of 10 instances closed, and the miss is systematic

Queue `## Next` → "Re-verify the seam audit's pattern #1 after the desk's
density fix" is **done**. Written up as **Round 3** in `notes/seam-audit.md`.

Touched:   notes/seam-audit.md (+Round 3), notes/audit-seams.md
           scripts/density.mjs (new — measures px/m per mapped face)
           scripts/reverify.mjs (new — the 16 confirmation cameras)
           **nothing under street/src/** — check with
           `git diff --stat $(git merge-base add-stick-and-city98 HEAD)..HEAD -- street/src/`
Verified:  measured, not eyeballed. `scripts/density.mjs` pairs every texture
           canvas with the face it is mapped onto and reports px/m on both
           axes across all 103 exterior wall faces, so "one density" is read
           off the running world rather than off a constant. Then the ten
           logged instances re-shot at their original cameras
           (`shots/reverify-*.png`).
Base:      6976f13

### The result

**Closed: 3, 7, 13, and 17 as a side effect.** All upper walls are 8.00 × 8.00
px/m regardless of floor count; all shop bands 16.0 × 15.95, an exact 2×, so a
0.5 m course lands on the same world lines at both scales. FLOWERS at 6 m now
measures 7.93 across — the clamp is gone. Courses and window rows run straight
through the 3-storey ∣ 5-storey party wall.

**Still open: 2, 12, 9, 19, and 1.** And this is the part worth routing:

> Pattern #1 was written as if `tex-world.ts` were the only place masonry is
> painted. It is not. `bodegaBrick` and the alley flanks in `ct/street.ts`,
> `bayFrontT` on the canted bay, and the ashlar in `ct/civic.ts` all still
> compute their own density, and none imports `WALL_PPM`.

So a fix that was complete *within its file* closed 4 of 10, and **the ones it
did not reach are now the most conspicuous, because their neighbours were tidied
and they were not.** The bodega canted bay — the corner the user originally
complained about — still runs 11.5 × 11.7 against neighbours that are now a
clean 8 × 8, so that seam reads worse today than it did before the fix. That is
not a criticism of A's change; it is the predictable result of a per-file fix to
a cross-file pattern, and it should be finished rather than left.

**New instance in a file that did not exist when the pattern was written:**
`ct/civic.ts` paints the library and church ashlar at 8.00 × 11.75 px/m —
1.47 : 1 anisotropic, and not commensurate with the brick it abuts at every
civic-to-shop party wall.

### Restated pattern, for the desk

> Every surface that paints masonry must derive its canvas from the surface's
> real metres at the world's one density. The defect is not that a painter
> computes density badly; it is that any painter computes it at all.

One exported helper taking `(widthM, heightM, baseY)` and returning a canvas
makes all ten instances impossible, and the next one too. That is a desk change
across `tex-world.ts`, `street.ts` and `civic.ts` in one commit — the same shape
as the signature change A correctly declined to make alone.

### Two things A flagged that I can confirm

- **A's "arithmetic luck" on No. 227 is real and it holds.** The 1.0 m band
  difference is exactly two 0.5 m courses, so the brick crosses the join in
  phase. The band line and window rows still step, because the storeys genuinely
  are 1.0 m lower — that is `bandOf()` in `street.ts`, not a paint fix.
- **The two cross buildings break `tex-world.ts`'s stated contract.** They are
  built 13.6 m tall while `wallHeight(4)` is 13.0, so their facades are painted
  for the wrong height and come out at 7.65 px/m vertically. The comment in
  `tex-world.ts` warns about exactly this; nothing enforces it.

Left:      Findings 14, 15, 21–25 (interiors, gutter noise, awning, kerb ramp)
           not re-verified — unrelated files, unchanged. Interiors measured by
           density only, not walked. Daylight only.
           The float audit's finding 1 (HOTEL blade) is still unrouted; a
           one-line version for E is in this session's reply.
