## audit/seams — pattern #1 still clean; both floating signs fixed; one new float indoors

Two queue items worked. Base `5803367e`.

Touched:   notes/seam-audit.md (+regression check), notes/float-audit.md
           (+Round 2), notes/interior-audit.md (+Round 6, previous commit),
           scripts/facade.mjs, scripts/thriftfloat.mjs
           **nothing under street/src/**

### `## Next` — pattern #1: no regression after ten more commits

Ten commits touched the three masonry files since the last check, including
`b5f8264a` (MERIDIAN and LAUNDRY merged into one **19.2 m** bank), `e71b1da4`
(pawnshop rebuilt, "the last legacy-texel painter" retired), `499892c7` (church
inlaid) and `5cbb1620` (four shopfronts given depth). Re-measured: **every
masonry face is still 8 × 8 or 16 × 16.**

The bank merge is the case worth noting — a facade wider than anything that
existed when `masonry()` was written came out at **8.02 × 8.00**, band at
**15.99 × 15.95**, with nobody thinking about it. That is the property the
helper was bought for, demonstrated rather than asserted.

**One new non-conforming face, and it is not masonry.** The GOLDEN ACES pylon
sign now measures **13.53 × 11.94** (was 10.45 × 10.57): `d2e5d02d` resized the
boards and the canvas did not follow, so near-square texels became 1.13 : 1.
Signage never went through `masonry()` and arguably should not — but it is the
same failure in a subsystem the pattern does not cover: **a canvas that does not
move when its surface does.** Worth a decision rather than a drive-by fix.

### Float audit — both my findings are closed

`d2e5d02d` anchored both signs. The detector is down to **3 floating components
of 1,098 meshes**, from 11 of 530. The HOTEL blade now has **visible brackets
tying it back to the brick** — the remedy recommended in `notes/float-audit.md`
finding 1. The pylon is anchored. Remaining floats are the two bodega bulb
glows, which are additive light and correct.

**One new float, and it is the first one indoors:** a two-sided price card in the
thrift store at (602.2, 1.42, −2.42) hovers **0.325 m above the shelf beneath
it**, nearest geometry in any direction. Low severity; logged because it is the
first instance of the brief's "hanging shop signage" category and because it
tells the interior builders that `scripts/floats.mjs` covers their rooms too.

### Not re-verified

The **mirroring** of the two signs (seam audit R1) was not re-checked. It needs
the matched opposite-side pair that settled it originally; a steep-angle shot
cannot judge it. **Unknown, not clean** — worth one pass when someone is next in
that code.
