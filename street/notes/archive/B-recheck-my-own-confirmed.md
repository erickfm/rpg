# Re-checking my own CONFIRMED work, because CONFIRMED is not permanent

The ledger's own rule at the top of the file: *"CONFIRMED IS NOT PERMANENT.
Later work can break a row that was genuinely confirmed, and nothing detects
that automatically."*

My queue is empty and there is nothing on the board awaiting a check, so this is
that re-check. The world has moved a long way since I landed these — a bank was
inserted, every interior shifted +80 m, a jail was built, three new builders
started. Build `43d273df0`.

## All four hold

**The junction crossings** — I removed the paint from the side street's dead
east end and put two on the junction.

```
  2 painted crossings; the DEAD EAST END one (x > 50): gone
  A  x -5.00..5.00  z -91.50..-88.90     10.00 m, kerb to kerb
  B  x  9.30..11.90 z -108.00..-98.00    10.00 m, kerb to kerb
  all four ramp ends   0.0132   against 0.1100 three metres away
```

Unchanged from the day it landed.

**The alley back door** still reads `tint 0.0787` and carries `poolLit` — the
10× lift from 0.0079 is intact, and the world mean is 0.2547 against 0.2623 when
I measured it, so the street has got *darker* around it rather than brighter.
That matters: the whole point of the doorway pool was to light the door without
lifting the alley, and a later change has not eroded it.

**The payphone** is clear of the sacred lane by **0.07 m** and its header is
still held at **1.0 at 23:00** while the enamel drops to **0.12**. The
`lightSource` declaration is doing its job.

**The driveway apron** is the one that has *improved* without me: **10 readable
cross joints** at the user's own pose, against 8 when I landed the rescoring and
5 before it. I did not make that change, and I am not claiming credit for it —
recording it because a number moving in the right direction is still a number
moving, and if it ever moves back this is what it was.

## Nothing to route

No regressions, so there is nothing to file. The value of this pass is the
freshness stamp: these five rows were last known-good at build `43d273df0`, by
their own predicates, not by eye.

## What is still outstanding, and none of it is mine

- **A owes one line** for the ATM `[E]`. Still 0 of 511 spots. It blocks K's
  row, crashes M's bank check before its first assertion, and leaves M's loan
  money chain unreproducible on a row that is already green.
  `notes/B-one-missing-line-blocks-three-rows.md`.
- **F owes the seat fix.** The repro is deterministic and written up in
  `notes/B-seat-exit-REPRO-for-F-and-C.md`: while seated the prompt reads SIT,
  and that spot is dead, so E resolves to something that refuses to act.
