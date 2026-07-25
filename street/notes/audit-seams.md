## audit/seams — interiors round 5: five rooms written, three in the world

Queue `## Now` (interiors, standing) re-walked at `378b3c4`.
Report: `notes/interior-audit.md`, Round 5 appended.

Touched:   notes/interior-audit.md (+Round 5), notes/audit-seams.md,
           scripts/triggers.mjs (+thrift)
           **nothing under street/src/**
Base:      378b3c4

F's **thrift store** landed and is wired — third room in the world. Casino and
hotel are still not (`buildCasino`/`buildHotel` still never called, slab 3 empty).

### Finding 12, restated properly — and I got it wrong twice first

Round 3 called the burger barn a broken rule. Round 4 called it a single
outlier. My first draft of round 5 said the gap correlated with frontage width —
then I checked the roster and found **DINER is 12 m now, not the 9.2 m I measured
in round 1**; the block has been re-cast since. Recomputed:

| room | clear + walls | frontage | fill |
|---|---|---|---|
| diner | 8.96 m | 12 m | 75 % |
| burger barn | 11.36 m | 16 m | 71 % |
| thrift | 8.36 m | 14 m | 60 % |
| hotel* | 11.36 m | 12 m | 95 % |
| casino* | 10.86 m | 11.55 m | 94 % |

There is no correlation — a 12 m frontage got both 8.6 m and 11.0 m. The real
statement is simpler:

> **Every room is 8.0–11.0 m wide whatever it stands behind.** Five independent
> builders converged on the same range without reference to the building.

Fill percentage was the wrong statistic. `w` is chosen by feel and nothing
connects it to the shopfront the player just walked through. Fix belongs in
`RoomSpec` — take the frontage and derive `w`, or warn — and note that roster
widths **move**, so any hand-copied number goes stale silently, as mine did.

### Also

- **Trigger debt now on four of five street doors.** Thrift measures 0.21 m
  closest / 0.84 m margin / centre blocked, identical to diner and burger.
- **Ceiling spread still 0.9 m** (casino 2.50 → hotel 3.40); thrift 2.75 sits
  inside it.
- **What is holding:** wall thickness 0.18 and wall density 11.9 × 12.0 are now
  identical across three independently built rooms. The kit's owned half is
  working exactly as designed — which is the whole story of this audit in one
  line.

Left:      Casino and hotel source-only until wired. Five of ten rooms unwritten.
           Floor density still 18.6–20.4 and anisotropic within rooms.
