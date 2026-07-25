## audit/seams — interiors round 8: six rooms in the world; a prop re-blocked a fixed door

Queue `## Now` (interiors, standing) at `fb99b135`.
Report: `notes/interior-audit.md`, Round 8.

Touched:   notes/interior-audit.md (+Round 8), notes/audit-seams.md,
           scripts/interiors.mjs (regions to 7 slabs), scripts/triggers.mjs
           (+3 doors), scripts/newdoors.mjs (new)
           **nothing under street/src/**
Base:      fb99b135

`0e00db8c` wired the casino, hotel and tax office — **finding 10 acted on**.
**PAWN is still unwired** (`buildPawn` count 0): 1 of 7, down from 4 of 7.

### The result that matters most

Six rooms, four agents, all measured in the world: **wall thickness is 0.18 and
wall texel density is 11.9 × ~12.0 in every single one.** Six for six. Every
disagreement in the set is in a parameter the kit leaves free — ceiling spread
0.9 m over six distinct values, ceiling luminance spanning **5.6 : 1**, floor
density 18.3–21.3 and still anisotropic within rooms. The kit's owned half is
flawless and its free half is where all the drift lives. That has been this
audit's claim since round 1 and it now has six independent data points.

### Finding 17 — the round-2 prediction came true, with a worked example

Round 2 said the entry-trigger margin is *"a shared budget with no owner, spent
by anything a props builder puts outside a door."* It has now happened to the
one door that had been fixed:

- THRIFT was **0.01 m closest / 1.04 m margin / reachable** in round 6.
- It is now **0.27 m / 0.78 m / blocked.** Door coordinate unchanged.
- Cause: a `BoxGeometry` **0.36 × 0.62 × 10.5 m at (−6.82, 0.45, −73.55)** — a
  10.5 m run of low furniture against the facade, placed by `cc7e0e76`. It
  occupies x −7.00 … −6.64, so the 0.36 m capsule stops at **−6.28**; the door
  spot is at −6.55; the difference is **0.27 m**, the regression exactly.

Nobody did anything wrong — a bench against a wall, a door 0.45 m off the
facade, a collision refactor that made the stretch reachable. Three correct
decisions and the door went back inside solid, because **no one owns the number
that says whether a door is still reachable.** That is the build-time assert
this audit proposed in round 2, now with a case to point at.

### A false positive I caught before filing

My batch probe reported the GOLDEN ACES door showing `[E] into the HOTEL
ORPHEUS`. Standing on each new spot and reading the HUD directly gives the right
label on all three. The batch reading was my own script retaining a prompt seen
mid-approach. Third time this audit a batch measurement has needed a direct
check before it was safe to report — worth stating as a standing caution about
my own instruments.

Left:      PAWN source-only; three of ten rooms unwritten. The three newly wired
           rooms have not been through the round-7 side-by-side light comparison.
