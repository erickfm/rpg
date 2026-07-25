## audit/seams — doors clean, facade reach regressed, masonry still on the grid

Four commits this pass, one outcome each. Base `7148e296`.

Touched:   notes/interior-audit.md (+Rounds 13, 14), notes/seam-audit.md
           (+Round 5, +regression check), notes/audit-seams.md,
           scripts/doorsweep.mjs, scripts/flanks.mjs
           removed notes/BLOCKED-AUDIT-seams.md — **unblocked**
           **nothing under street/src/**

### The one to route: finding 18 — the facade reach has regressed

The **−6.64 stretch on the west facade south of z = −70 is gone.** It does not
appear once across 25 samples; the tally is now −6.24 … −6.34 everywhere, on
both walls.

That stretch was round 6's evidence that D's "collision follows geometry" had
begun reaching the main street, and it was why the thrift store was briefly the
only main-street door whose trigger centre a player could stand on. **Every
main-street door is inset again**, by slightly more than before.

I cannot attribute it from here — `7148e296` (parked draw, new `ct/gap.ts`,
`sidestreet.ts`) is the obvious candidate, but the park or the car lot could
equally have changed what stands where. **Wants D.** Acceptance test unchanged
since round 6: **the limit should read ±6.64 wherever a facade stands.**

### Finding 1 is CLOSED — the last instance from the original sweep

`e466c43c` added `flankTex()`: a blind party wall painted from the **same brick
as the front**, same density, same world-Y datum. Flat-colour `endM` sites 5 → 1;
flank faces measure 7.94–8.02 × 8.00–8.10 px/m.

Its reasoning is better than mine and I have said so in the report: *a blind
party wall IS correct — what it must not be is a different **material**.* I
logged it as "untextured" for eleven rounds when the defect was the missing
brick, not the missing windows.

### Pattern #1 has stopped being reachable

`4ce8355d` gave buildings real depth: **107 wall faces → 277.** Every one is on
the grid. A 2.5× increase in painted wall area produced **zero** new instances.
And `5403232a` refactored the shopfront painters onto a shared band table —
re-measured, behaviour-neutral, band group still 17 faces at 16 × 15.95.

### The diner prompt had been standing outside a bank

`4fe23d0f` fixed it. **My own harness held the same stale coordinate**, so I
replaced it with `scripts/doorsweep.mjs`, which finds doors by walking the
pavement — no door coordinate in it. Nine doors for nine rooms, none unknown,
and the doors are byte-identical after the collider work.

### Still unassigned

- **Pattern #5** — roads and the alley floor still carry ad-hoc repeats.
- **Lighting/signage anisotropy, now six light pools**, the coarsest 32 × 32 px
  over 9.5 × 11.5 m = **3.37 × 2.78 px/m**, the coarsest surface in the world.
