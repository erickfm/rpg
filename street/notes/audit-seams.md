## audit/seams — pattern #1 is CLOSED, measured

Queue `## Next` → "Re-verify pattern #1 AGAIN once builder A's cross-file fix
lands" is **done**. Written up as **Round 4** in `notes/seam-audit.md`.

Touched:   notes/seam-audit.md (+Round 4), notes/audit-seams.md,
           scripts/reverify2.mjs (new)
           **nothing under street/src/**
Verified:  `scripts/density.mjs` over every textured face in the world, then the
           headline corners re-shot (`shots/rv2-*.png`). Measured, not eyeballed.
Base:      1b990d7 · A's commit `a848b9d`

### Result

| finding | before | after | verdict |
|---|---|---|---|
| 2 — bodega canted bay | 11.50 × 11.70 | **8.13 × 8.02** | closed |
| 12 — bay shopfront | 24.0 × 12.38 | **15.91 × 15.95** | closed |
| 9 — east cross building | 7.33 × 7.65 | **8.00 × 8.01** | closed |
| 19 — alley rear wall | 11.43 × 11.72 | **8.00 × 7.97** | closed |
| civic ashlar | 8.00 × 11.75 | **8.00 × 8.03–8.06** | closed |
| 1 — untextured `endM` | flat `#53382e` | unchanged, 5 sites | **still open, correctly outside A's mandate** |

**Every masonry surface in the world is now 8 × 8 or 16 × 16 within canvas
rounding.** The only non-conforming faces left are the roads and the alley floor
— pattern **#5**, a different root cause, still open — plus non-masonry (lamp
pools, tree sprites, sign faces).

Pattern #1 is the first in this audit trail to go all the way: instance → root
cause → restatement → complete closure.

### Two things worth the desk knowing about how it closed

**A found instances I missed, and the reason is instructive.** My list came from
walking the world; A's came from grepping the painters. Three custom shop bands
(BURGER BARN, PAWN, A-1 TAX) sat at 8 × 12.38 against 18 neighbours at 16 × 15.95
and I never logged them, because I shot the joins either side rather than the
bands themselves. Independent confirmation they are fixed: **the 16 × 15.95 group
grew from 18 faces to 21.** A walk finds what is conspicuous; a grep finds what
is uniform. This pattern needed both, and it is worth pairing them deliberately
next time rather than by luck.

**The pattern reasserted itself mid-fix.** A rebased and found a new
non-conforming painter — `partyTex` in E's courtyard, `Math.round(FLANK_H*11.2)`
— written *after* the pattern was documented. Now 8 × 8. That is the argument
for the shape adopted: a shared `masonry()` helper makes the next one impossible,
where a list of corrected instances is stale the day it is written.

### Still open, for routing

- **Finding 1**, untextured `endM` party walls — 5 sites in `ct/street.ts`,
  visible above every height change. Not a density defect; needs brick on the
  exposed flank.
- **Pattern #5**, ground surfaces: roads (19.2 × 14.33 and 18.58 × 12.8) and the
  alley floor (9.7 × 9.85) still each carry their own ad-hoc repeat. Same shape
  of fix, different subsystem, nobody assigned.
