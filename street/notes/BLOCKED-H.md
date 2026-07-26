# BLOCKED — builder H

`scripts/live.sh H` reads **0 live, 1 awaiting a check**. I have nothing routed
to me that is not already built, and the four things I am waiting on are all
owed by someone else. Declaring BLOCKED rather than DONE because live.sh is not
empty, and rather than WORKING because I am not building anything — an
unreported block is the failure, not the block.

## 1. AUDITOR — the east-end road flag, and the blocker is now gone

The one CHECK row. The audit left it LANDED for a good reason: *"`netRoute`
exposes no net, nodes or edges, so an outside test cannot read an edge's road
flag"*, and it noted correctly that nothing being stranded there is consistent
with the fix but is not evidence of it — the flag governs lateral allowance,
not whether anyone gets stuck. That was my affordance being too thin.

**Fixed: `netRoute` now returns the edges it walked**, each with `road`, `half`
and `len`, plus a `crossings` count. It discriminates both ways:

```
s-east   -> ne-corner   road=true   half=1.30   the fix
n-corner -> w-corner    road=true   half=1.30   main crossing, for contrast
w-win1   -> w-alley     road=false  half=0.55   a plain walk
```

I may not mark my own work CONFIRMED. Ready for re-check.

## 2. D — the second alley's shell has not landed

`crosstown.ts` still declares only `AZ0 = -37, AZ1 = -43.5`. The desk asked me
to check that walkers and parked cars do not path or park across the new alley
between the pawn shop and No. 227; I cannot until it exists.

`notes/H-for-D-second-alley.md` says what I will measure and, more usefully,
the one thing that makes it pass by construction: **name the span.** The first
alley is safe only because the truck's z is derived from `AZ0`
(`truckZ0 = AZ0 + ALLEY_SIGHT + carHalf.pickup + PARK_SPREAD/2`). Inline the
new mouth as literals and the same bug returns silently. Named, I add it to the
keep-clear array — mine now — and `nudgeClear` handles it identically.

## 3. USER — the pickup's bed floor, the last non-uniform density

Every face on every vehicle is square-texel at 32 px/m, 0 off square. The bed
floor is the exception at **16.2 x 16.1**: square, so nothing is stretched —
simply half the resolution of the walls around it, with its ribs drawn to that
grid. Doubling it means redrawing the ribs, which is a **look change, not a
density fix**, so it wants an eye rather than my judgement.

## 4. B — a ramp and stripes for the east-end crossing

The graph edge is flagged `road` now, which is correct: it crosses ten metres
of the side street's carriageway. But a crossing there should look like the two
at the junction, and `ct/tex-ground.ts` flags KRAMP on the bodega corner return
only. Not my file.

---

**Delivered this pass, so nobody waits on me:** F has the single answer that the
BODEGA keeper is the one facing away (`notes/H-for-F-which-keeper.md`, and it
leads with *leave the burger keeper alone, it is already correct and would be
inverted if fixed to match*), and D has the note above.
