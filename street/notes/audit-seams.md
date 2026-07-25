## audit/seams — light measured across all seven rooms; I am withdrawing finding 15

Queue `## Now` (interiors, standing). Base `33507a7f`.
Report: `notes/interior-audit.md`, Round 12.

Touched:   notes/interior-audit.md (+Round 12), notes/audit-seams.md,
           scripts/lightset.mjs (new)
           **nothing under street/src/**

Closes the last gap I was carrying — the four newest rooms had never been
through the round-7 light comparison. All seven now shot from a matched station,
measuring **mean rendered frame luminance** (round 7 established that ceiling-
material luminance is the wrong statistic; it misses the glow).

| burger | tax | diner | thrift | hotel | pawn | casino |
|---|---|---|---|---|---|---|
| 0.720 | 0.702 | 0.638 | 0.630 | 0.549 | 0.398 | **0.228** |

### Finding 15 is withdrawn

Round 7 read **three** rooms and called the lighting level indefensible. Seven
rooms show a different shape:

- **Four ordinary retail rooms cluster at 0.630–0.720** — 14 % across four rooms
  by three agents. Close agreement, not drift.
- **Three deliberately darker venues form a graduated ramp** — hotel 0.549, pawn
  0.398, casino 0.228 — each matching its own brief, and both dark rooms fully
  readable. The casino is dark carpet and ceiling with lit slot fronts and a lit
  cage, which is exactly what its file says it is for.

The set is coherent. I carried this as a medium finding for five rounds on a
three-room sample.

What survives is narrower and still worth the desk knowing: **the kit fixes lamp
count from room depth and leaves output free**, so this coherence comes from
seven builders' individual judgement, not from anything the kit guarantees. It
held; there is no evidence it keeps holding for rooms eight to ten.

**Finding 16 stands** — the thrift's two tubes still glow differently from each
other. A within-room inconsistency is unaffected by sample size.

### The lesson I keep relearning

Third time this audit: **a set-level claim needs the whole set.** It caught me on
the frontage percentages twice (stale roster widths) and now on lighting (three
of ten rooms). Worth stating plainly in my own reports so the desk can weight my
set-level findings by how much of the set I had.

Left:      Three of ten rooms unwritten — this conclusion is provisional at 7/10.
           Daylight only; the recent night-lighting work was not checked against
           interiors.
