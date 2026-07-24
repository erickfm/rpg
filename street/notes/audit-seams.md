## audit/seams — the block has been swept twice; 6 new defects, 2 of them in the new signs

Queue item `AUDIT-seams.md` → **Now** → "Full seam and texture-continuity sweep"
is **done**, twice: once against the baseline I was cut from, and again against
the re-cast block after rebasing onto mainline.

Touched:   notes/seam-audit.md (report, 273 lines)
           scripts/seams.mjs, seams2.mjs, seams3.mjs   (round 1, 158 shots)
           scripts/seams4.mjs, seams5.mjs, seams6.mjs  (round 2, 66 shots)
           **nothing under street/src/** — `git diff live..HEAD -- street/src/` is empty
Verified:  shots/seam-*.png (round 1) · shots/seam2-*.png (round 2).
           Signs proved by matched pairs from opposite sides, not by one crop.
           Bodega reachability proved by driving the rig with real key input,
           not by screenshot — probe is in seams4.mjs and prints its numbers.
Risk:      none to the build. This branch is tree-identical to live plus notes
           and scripts.
Base:      9610e25

### What the desk should route first

**1 — `twoSided()` mirrors both new signs.** `ct/street.ts`. The helper builds
two planes at `rotation.y = ±π/2` and hands the **same** `draw` to `pixTex` for
both, so the faces are mirror images. Proved: the HOTEL blade's `E` and `L` read
correctly from the west and reversed from the east; GOLDEN ACES does the same.
Both faces are reachable on foot — the side street runs to x = 57.

The comment above the helper says this is already fixed *"to the ARTWORK, not to
the transform: the back face gets a texture that was painted mirrored"*. No code
does that. Whoever picks this up should fix the comment as well as the helper,
because the next person to read it will skip the bug. One fix cures both signs.

**2 — the GOLDEN ACES pylon stands on nothing.** `ct/street.ts`. The casino
shell is 3.4 m deep, z −96.0…−92.6. The legs are placed at `−95.0 ± 3.2`, i.e.
z −91.8 and −98.2 — 0.8 m behind the back wall and 2.2 m out over the sidewalk.
Their bottoms are at the right height (17.2 m); there is simply no roof under
either of them. The 9.2 m frame overhangs 3.6 m front and 2.2 m back. The rest of
the original "hanging out with no sense" note is genuinely fixed — it is squared
to the street and stands on legs and a frame now, and it reads well from the west.

**3 — `SHOP_BAND_H` put a 1.0 m step in the block's one horizontal datum.**
`bandOf()` gives shops 4.2 m and the walk-up `ENTRANCE.BAND_H` = 3.2 m, so the
ground-floor/upper-wall line jumps a metre at z = −35 and z = −53, on either side
of No. 227. New since the re-cast, and it is on the building the player lives in.

**4 — still open from round 1, unchanged in code:** the bodega is still not
enterable from the sidewalk (re-probed: stops at x = 10.09, closest 1.39 m
against a 1.1 m trigger); `facadeTex` still derives course height from floor
count so the bond breaks at every height change and at the bodega chamfer; `endM`
is still a flat colour, and it now frames the library on both shoulders.

**5 — BURGER BARN is still red-and-yellow.** Four places in `burgerFront()`:
`#f2d24a` lettering, `#e8a02a` stripe, `#e8c26a` interior, `#f2d24a` menu rules.

Left:      Round 1 findings 8, 9, 10 sit on the two cross buildings, whose
           neighbours were re-cast; they need their own pass and I did not
           re-shoot them. Findings 14, 15, 21–25 (interiors, gutter noise,
           awning, kerb ramp) are un-re-verified — those files did not change,
           so I expect them intact, but that is inference, not evidence.
           The church is shot as a **before** only (`seam2-N-church-*`,
           `seam2-Z-church-tower*`) — the tower is still there. Two things the
           removal will run into are written up at the end of the report.
