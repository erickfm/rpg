## audit/seams — the diner prompt stood outside a bank; my harness had the same stale number

Queue `## Now` (interiors, standing). Base `34a9563e`.
Report: `notes/interior-audit.md`, Round 13.

Touched:   notes/interior-audit.md (+Round 13), notes/audit-seams.md,
           scripts/doorsweep.mjs (new), removed notes/BLOCKED-AUDIT-seams.md
           **nothing under street/src/**

**Unblocked** — the blocker file is deleted; the park, the car lot and D's
exports landed and both my items have input again.

### What `4fe23d0f` fixed, and what it taught me about my own tooling

The diner's `[E]` prompt had been **standing outside a bank**. D swapped DINER's
identity with LAUNDRY's; `int-diner.ts` still held `DZ = 9.6`; pressing E outside
the bank teleported you to a diner nowhere near the building you were at.

That is the defect class this audit has reported three times — a hand-copied
coordinate going stale when the thing it describes moves. **My own trigger
harness held the same stale 9.6.** Reporting a pattern while my instrument
embodies it is not a good look, so I replaced it.

### `scripts/doorsweep.mjs` — doors found by walking, not by reading

Warps along the pavement in 0.25 m steps and records which prompt shows. **No
door coordinate appears in it**, so it cannot go stale, and it finds doors I have
never heard of.

Result: **nine doors, nine rooms, and the diner now fires in front of the
diner** — span −50.25 … −48.50, centred on −49.4 against its −55.5 … −43.5 slot.
Nothing missing, nothing unknown. Spans are 1.50–2.00 m, consistent with a
1.05 m trigger a quarter-metre off the walking line.

**What it deliberately does not measure:** it warps, so it reports where a prompt
*would* fire, not where the player can *stand*. Reachability is the round-11
question and both are needed — the thrift store fires over a 1.75 m span while
the finding-17 prop still holds the player 0.27 m off its centre.

Left:      Three of ten rooms unwritten. The sweep covers both main-street walks
           and both side-street walks, not the alley, park or car lot.
