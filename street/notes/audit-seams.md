## audit/seams — finding 1 is closed; pattern #1 holds at 2.5× the wall area

Two commits this pass, one outcome each. Base `34a9563e`.

Touched:   notes/interior-audit.md (+Round 13), notes/seam-audit.md (+Round 5),
           notes/audit-seams.md, scripts/doorsweep.mjs, scripts/flanks.mjs
           removed notes/BLOCKED-AUDIT-seams.md
           **nothing under street/src/**

### `## Now` (`46d8db52`) — the diner prompt stood outside a bank

`4fe23d0f` fixed it: D swapped DINER's identity with LAUNDRY's, `int-diner.ts`
still held `DZ = 9.6`, and pressing E outside the bank took you to a diner
nowhere near the building you were at. **My own trigger harness held the same
stale number**, so I replaced it with `scripts/doorsweep.mjs`, which walks the
pavement and records which prompt shows — **no door coordinate anywhere in it.**

Nine doors found for nine rooms, none unknown, none missing, and the diner now
fires at −50.25 … −48.50, in front of the diner.

### `## Next` (this commit) — finding 1 CLOSED, and pattern #1 is unreachable now

**Finding 1 — the last open instance from the original sweep — is closed.**
`e466c43c` added `flankTex()`: a blind party wall painted from the same brick as
the front, same density, same world-Y datum. Flat-colour `endM` sites went
**5 → 1**; flank and return faces measure **7.94–8.02 × 8.00–8.10 px/m**.

Its reasoning is better than mine and worth keeping: *a blind party wall IS
correct — a flank does not want the front's windows or sign. What it must not be
is a different **material**.* I logged this as "untextured" for eleven rounds;
the defect was never the missing windows, it was the missing brick.

**Pattern #1 holds at 275 wall faces, up from 107.** `4ce8355d` gave every
building real depth, so flanks, returns and roof edges are painted surfaces now.
Every one is on the grid. **A 2.5× increase in painted wall area produced zero
new instances** — the pattern did not just get fixed, it stopped being reachable.

### Still open and unassigned

- **Pattern #5** — roads (19.20 × 14.33, 18.58 × 12.80) and the alley floor
  (9.70 × 9.85) still carry ad-hoc repeats. Nobody owns it.
- **The lighting/signage anisotropy set has grown again — six light pools now**,
  2.56–9.41 px/m at up to 2.1 : 1. The newest is 32 × 32 px over 9.5 × 11.5 m at
  (10.2, 0.2, −4.4): **3.37 × 2.78 px/m, the coarsest surface in the world.**
