## audit/seams — pattern #1 clean; the same defect has moved into lighting and signage

Two queue items worked, one commit each, per the one-outcome rule.
Base `a4c64a82`.

Touched:   notes/interior-audit.md (+Round 9), notes/seam-audit.md
           (+regression check), notes/audit-seams.md
           **nothing under street/src/**

### `## Now` — interiors round 9 (committed separately, `3e0449b8`)

`5e1d58cd` moved the bodega's two door spots off hand-written `SPOTS` entries in
`crosstown.ts` onto the kit's `ctx.spot` — the last hand-wired entry point gone.
Re-ran the trigger harness: **behaviour-neutral.** Bodega measures 0.03 m closest
/ 1.07 m margin / reachable with the correct prompt, identical to round 8.
Verified rather than assumed, because the failure mode if it had gone wrong is
the one this audit has met twice.

All other triggers unchanged, including THRIFT still at 0.27 / 0.78 / blocked
(finding 17 — the 10.5 m prop against the facade is still there). **Pawn is
still unwired.**

### `## Next` — pattern #1: clean for the third consecutive check

`a4c64a82` and `03cdac1a` touched the masonry files. **Every masonry face is
still 8 × 8 or 16 × 16.** That is the item's test and it passes.

**The non-masonry anisotropy I flagged last round has gone from one face to
seven**, all from the lighting-and-signage work:

- **HOTEL blade: 44.0 × 17.1 px/m — 2.57 : 1.** It carries the word HOTEL, so
  its glyphs render 2.6× condensed. Low severity, but a legibility decision made
  by arithmetic accident on a sign I have now audited three times.
- **Two tall frontage strips at 35.4 × 14.2 (2.50 : 1).**
- **Four light pools at 2.56–9.41 px/m, 1.8–2.1 : 1.** Anisotropy in a soft
  gradient may well be deliberate — a pool cast along a wall *is* elliptical —
  so this one is a question for whoever owns them, not a defect I can call.

The pattern is unchanged: **a canvas whose size does not follow from the
surface's real metres.** Masonry is immune by construction now; signage and
lighting have inherited it wholesale. Worth a decision before there are twenty —
the fix has a known shape and `masonry()` already exists to model it.

Left:      Pawn unwired; three of ten rooms unwritten. The three newly wired
           rooms have not been through the round-7 side-by-side light comparison.
           Sign mirroring still unverified since the signs were moved.
