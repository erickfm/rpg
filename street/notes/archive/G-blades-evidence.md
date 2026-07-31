# `casino + hotel blades read correctly` — the evidence, in a note as well as a cell

**Why this file exists.** The auditor's sweep found this row of mine CONFIRMED on
**32 characters** — *"both directions, from the street"* — with no station, no
build and no predicate. I re-evidenced it in the ledger cell, and **a rebase merge
then dropped it**: the cell is back to 34 characters and the auditor's own
`ledger-evidence.py` still lists me at 32.

That is exactly the lesson the auditor drew after losing three verifier segments:
*"This is why a finding that matters goes in a NOTE as well as a cell. Two of the
three I lost were recoverable only because I had written them into commit
messages, and the one I had not would have been gone without trace."* Mine was
cell-only. So it lives here now, where a conflict resolver cannot reach it.

Re-verified on build `26de02da6`, 2026-07-26.

## The property, stated so it can be falsified

A blade is read from **both ends of the street**, so it must be **two
single-sided planes back to back — never one `DoubleSide` plane, which renders
its far face MIRRORED.** That is how a HOTEL sign shipped backwards here once
already. GOTCHAS 10.

## Structure, read from the source

All three signs on this pair are built that way, each as two meshes at
`rotation.y = ±π/2` with `neonOld`, which is `side: THREE.FrontSide` — so a face
physically cannot render its back:

| sign | `ct/vice.ts` |
|---|---|
| the SEVENS blade | ~858 |
| the ORPHEUS blade | ~1170 |
| the NO VACANCY box | ~1183 |

And the artwork is **identical on both faces on purpose, NOT pre-mirrored.** A
plane's u runs local −x to +x; at `+π/2` that is world +z to −z and at `−π/2` it
is −z to +z, and each viewer's screen-right runs the same way, so **the two
mirrors cancel.** Painting one face flipped un-cancels them, which is exactly
what made the west face read backwards last time. This is the part that is easy
to get wrong, because pre-mirroring the rear face is the standard fix everywhere
else.

## The predicate that catches it going false

`scripts/G-vice-walk.mjs`, two clauses:

- **`every street-facing sign is a back-to-back PAIR, none left single`** — pairs
  faces by matching x within 0.6 m, **opposite `sign(rotation.y)`** and matching
  height; requires ≥ 3 pairs and **0 orphans**, so replacing a pair with one
  `DoubleSide` plane fails it.
- **`the two faces of each blade carry the SAME texture, not a mirrored one`** —
  compares the canvases **pixel for pixel** *and* compares the sampling transform
  (`repeat`, `offset`, `rotation`, `center`), because `repeat.x = -1` with
  `offset.x = 1` mirrors the SAMPLING and leaves the canvas untouched, so a pixel
  compare alone would guard only half the bug.

**Positive control, run today:** `node scripts/G-vice-walk.mjs --selftest`
inverts the identity assertion and it duly **FAILS** (16/18, the named clause
red). So the check is measuring identity and is not passing vacuously. It also
**exits 3 rather than 1** if it finds no blade faces at all, so "no orphans" can
never be satisfied by finding nothing — GOTCHAS 32 and 34. Normal run: **18/18.**

## And I looked, from both ends, on asymmetric letters

Symmetric text hides this completely, which is why the last one survived. SEVENS,
HOTEL and ORPHEUS are all asymmetric.

**Stations** — the four canonical street views in `scripts/G-vice-shots.mjs`,
camera then look-at:

| shot | camera | looking at |
|---|---|---|
| SEVENS blade, east face | (56.5, −101) | (51.2, −95) |
| SEVENS blade, west face | (30, −101) | (51.2, −95) |
| ORPHEUS blade, east face | (56, −100) | (44.4, −96.8) |
| ORPHEUS blade, west face | (30, −100) | (44.4, −96.8) |

What they show: `shots/G-vice-day-blade-from-east.png` reads **HOTEL** over
**ORPHEUS**, pink over cyan, top to bottom; `-blade-from-west.png` reads the same
on the opposite face with **SEVENS** in red staggered behind it;
`-aces-from-west.png` reads **SEVENS** down the blade. **No mirrored glyph on any
face.**

## One thing that would invalidate this note

The SEVENS blade lettering was re-set on 2026-07-25 when the building was renamed
from GOLDEN ACES — new canvas, one word, `hardLayer` for hard-texel glyphs. If
either blade's artwork is redrawn again, the *predicate* still holds (it compares
the two faces to each other, whatever they say) but the **shots above are stale**
and want retaking before anybody leans on them.
