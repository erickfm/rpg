## audit/seams — all seven rooms in the world; six of nine doors blocked

Two commits this pass, one outcome each.
Base `3646cc3e`.

Touched:   notes/interior-audit.md (+Rounds 10, 11), notes/audit-seams.md,
           scripts/triggers.mjs (+pawn), scripts/interiors.mjs (7 slabs)
           **nothing under street/src/**

### Round 10 (`67cb7571`) — finding 10 is CLOSED

`0b6d6630` replaced the hand-written `buildX(ctx)` calls with
`buildAllInteriors`, which globs `./int-*.ts`, sorts by path for deterministic
slab addresses, and calls each module's `build…()` export. **Measured: slabs 0–6
all populated. Seven rooms, seven slabs.** The pawn shop, unwired for three
rounds, is in.

> 1 of 4 unreachable → 2 of 4 → 4 of 7 → 1 of 7 → **0 of 7.**

The fix is stronger than the assert I proposed in round 4: the failure now
**cannot be made**, rather than being detected. Slab addresses changed with it
— burger 0, casino 1, diner 2, hotel 3, pawn 4, tax 5, thrift 6.

**Seven rooms, four agents, wall thickness 0.18 and wall density 11.9 × ~12.0 in
every one.** Everything still disagreeing is a free parameter: seven distinct
ceiling heights spanning 0.9 m, ceiling luminance 5.6 : 1, floor density
18.3–21.3 and anisotropic within rooms.

**Finding 12 — the tool landed, nothing uses it.** `b002bea9` published
`frontageOf(name, wMeters)`, exactly what this audit asked for in round 5 after
being caught twice by stale roster widths. But `grep -l frontageOf
src/proto/ct/int-*.ts` returns nothing and room widths are unchanged. One import
per room away from closed.

### Round 11 (this commit) — all nine street doors

| reachable | blocked |
|---|---|
| GOLDEN ACES 1.05 (100 %) · HOTEL 1.05 (100 %) · BODEGA 1.09 (99 %) | No. 227, BURGER, TAX, **PAWN** 0.84 (80 %) · DINER 0.83 · THRIFT **0.78 (74 %)** |

**The split is geographic, not per-builder.** Every side-street and corner door
is fully reachable; **every main-street door is blocked.** Six of nine.

Seven rooms have now independently placed a door 0.45 m off the facade — the
correct thing to do — and six are inside solid because of where the *street*
says the wall is. The pawn shop inherited the debt on arrival. This is not
fixable from the interior side; it is the round-6 facade map showing through.

Left:      Three of ten rooms unwritten. The four newest rooms have not been
           through the round-7 side-by-side light comparison.
