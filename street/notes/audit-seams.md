## audit/seams — interiors round 6: four of seven finished rooms are unreachable

Queue `## Now` (interiors, standing) re-walked at `499892c7`.
Report: `notes/interior-audit.md`, Round 6 appended.

Touched:   notes/interior-audit.md (+Round 6), notes/audit-seams.md,
           scripts/facade.mjs (new — maps the reachable limit along both facades)
           **nothing under street/src/**
Base:      499892c7

### Route first: the unwired-room count is growing, not shrinking

| | round 3 | round 4 | **round 6** |
|---|---|---|---|
| written | 4 | 4 | **7** |
| in the world | 2 | 2 | **3** |
| unwired | casino | casino, hotel | **casino, hotel, pawn, tax** |

`buildCasino`, `buildHotel`, `buildPawn`, `buildTax` — all exported, none called.
Slab 3 measures empty. **Four of seven finished rooms are unreachable, and the
count has risen in each of the three rounds since I first reported it.** Two
builders have each now shipped two rooms no player can enter.

That is no longer plausibly a builder oversight. It is the mechanism from round
4: the kit made a room's *contents* self-registering and left the room's *own
existence* as one hand-written line in the most contended file in the project,
with nothing checking it. **The kit already knows every id it handed a slab to;
comparing that list against the ids it was asked to build is a build-time assert
and it would have caught all four.**

### Finding 13 differentiated — and it gives D a one-number acceptance test

The thrift store now measures **0.01 m closest / 1.04 m margin / reachable**,
where in round 5 it was 0.21 / 0.84 / blocked — with no change to its door
coordinate. So I mapped the reachable limit along both facades every 4 m
(`scripts/facade.mjs`):

| stretch | limiting x | |
|---|---|---|
| west wall, z ≥ −68 | −6.29 … −6.34 | still inset 0.3 m |
| west wall, z ≤ −72 | **−6.64** | at the true facade — converted |
| east wall, whole length | 6.28 … 6.34 | still inset 0.3 m |

> **D's "collision follows geometry" has reached the west facade south of about
> z = −70 and nowhere else.**

That is exactly why thrift came good (its door is at z = −74.94, inside the
converted stretch) and the diner, burger barn and No. 227 did not. Acceptance
test for the remainder: **the limit should read ±6.64 everywhere a facade
stands.**

### A correction I had to make mid-report, again

I drafted the new-rooms section claiming pawn and tax both fill their frontage
and that "the three low ones are the three oldest" — then read the roster and
found **PAWN is 15 m, not the 12 m I assumed**. Corrected, seven rooms read 67,
71, 75, 76, 94, 95, 95 %, and round 5's finding survives unchanged: room widths
are 8.0–12.0 m against frontages of 11.55–16 m with **no relationship between
them**. Rooms that "fill their frontage" are the ones behind narrow buildings.

Second time in two rounds a stale roster width has caught me. Worth stating as a
standing caution: **roster widths move, so any hand-copied frontage number older
than one rebase is suspect** — which is also the argument for `RoomSpec` taking
the frontage rather than a builder copying it.

Left:      Four of seven rooms source-only — ceilings, densities, light, doors
           and colliders unmeasured for those. Three of ten unwritten. Ceiling
           spread still 0.9 m (2.50 → 3.40).
