# Item 201 — the graph crossed where there was no paint

Worker **seventyone**, 2026-08-03. `src/proto/ct/crowd-net.ts` only.

> The user: *"the pedestrians dont cross at the cross walk."*

## It is (A). And it is emphatically NOT (B).

The row asked which of two things was happening before anything was touched, and
warned that (B) — a freeze being read as a routing choice — was very live because
the two figures in his screenshot are **standing**. Measured over 240 s, per
frame, on the built bundle:

```
citizen-frames in a carriageway : 7817
                        MOVING  : 7738
              standing still    :   79   (1.0%)
```

**They were walking across the road on purpose, in the wrong place.** Not stuck.
This is not item 173/207's problem and I did not do 173's work under this name.

## Root cause, one line

`ct/tex-ground.ts` paints its stripes at **z −90.2** and **x 10.6**
(`JUNCTION_CROSSINGS`), and `ct/crowd-net.ts` pinned its two `road` edges to the
corner **nodes** — `n-corner`/`w-corner` at **z −97**, and `n-bodega` (x 8.7)
**diagonally** down to `s-win1` (x 6) — so the graph and the paint had never been
connected to each other by anything but memory.

**Measured in the built world, with the paint found in the scene rather than read
out of the same source file** (taking both from one file would beg the question):

| | paint | where they actually crossed |
|---|---|---|
| main street | z **−91.5 … −88.9** | z −98…−96, **5386 of 5623 samples** |
| side street | x **9.3 … 11.9** | x 6…10, most of it west of the paint |

**About 6.8 m south of the zebra, every time.**

## The comment that let this survive

The old note above the crossings said both were at the corner *"because that is
where the kerb has a ramp: ct/tex-ground.ts flags KRAMP on the bodega corner
return only. Anywhere else, stepping off the kerb would be jaywalking across an
unbroken kerb face."*

**That is stale, and it is the reason nobody moved these edges when the paint
moved.** `tex-ground.ts:1378-1381` now calls `pedCut` at each *painted* crossing —
both kerbs of the main street at `XA_Z`, both kerbs of the side street at `XB_X` —
so **all four feet already had a dropped kerb** and the corner had stopped being
the only legal place to step off. The ground module had moved the stripes *and*
the ramps; only this file was left behind. The comment is corrected in place.

## The change

Four crossing feet, on the paint, and the two edges relinked **foot to foot,
square to the kerb**:

```ts
const XMAIN_Z = JUNCTION_CROSSINGS.main.z;
const XSIDE_X = JUNCTION_CROSSINGS.side.x;
…
link(wCross, eCross, true);   // across the MAIN street, on z = XMAIN_Z
link(nCross, sCross, true);   // across the SIDE street, on x = XSIDE_X
```

**Derived from the paint's own export, not retyped** (BUILDER-BRIEF §8) — so if
the stripes ever move again the walkers follow them without anybody remembering
to. That absence of a link is the entire defect. `ct/tex-ground.ts` imports only
`./paint` and `./rng`, so the new import is **not a cycle** (GOTCHAS §28), and
`crosstown.ts:18` already imports the same constant for the kerb gaps.

**Neither edge is a diagonal any more.** The side crossing used to run from
x 8.7 to x 6 while crossing, drifting 2.7 m sideways, so even the part of it that
touched the stripes left them again.

`CROSS_HALF` (the lateral spread that lets people cross abreast) is **1.3**, which
is already exactly `JUNCTION_CROSSINGS.*.hw`. Left alone; noted because the two
agreeing is not an accident and a future change should keep them together.

## Proof

`scripts/probes/w71-where-do-they-cross.mjs`, 240 s, sampled per frame:

| | before | after |
|---|---|---|
| carriageway samples | 7817 | 9101 |
| **ON THE PAINT** | **0 (0.0%)** | **9101 (100.0%)** |
| off it | 7817 | **0** |
| standing still in the road | 79 | **36** |

The off-paint bins **before** name his spot exactly: **(0, −96), (−4, −96),
(4, −96)** — the main street at the corner — plus (8, −100), (8, −104),
(8, −108), which is the diagonal running down the side street west of the
stripes.

**Watched, not inferred.** `scripts/probes/w71-watch-a-crossing.mjs` stands on
the east pavement, aims at the crossing by **derivation** (`yaw = atan2(dx, −dz)`
— my first cut guessed and photographed a doorway 180° away), and waits for
walkers to be inside the painted rectangle: **4 separate crossings**, one with
**3 people on the stripes at once**. `shots/w71-crossing-after-4.png` shows them
on the bars; `shots/w71-crossing-before-1.png` is the same view with the zebra
empty and the walker away up the road at (4.65, −97).

Other checks: `crowd-walk` **all pass** (longest stall 0.0 s, 0 of 527 samples
sealed the walk); `side-walk` passes except the inherited parked-car red;
`H-eastend-route` still **4 hops, 16 m, 0 road hops** — the ring still closes on
pavement round the closed east end and nothing is orphaned; `npm run sweep`
0 STATION MISS 0 COVERAGE; `health` WORLD OK; `tsc` clean.

> ### MY OWN PROBE LIED FIRST, and it is worth recording
> Its first cut tested `x > ROAD_HALF` for the side street **with no upper
> bound**, and reported **556 samples at x 56–58 as jaywalking**. That is the
> **jail's footway** (`EWALK_X = SIDE_X1 + 1 = 56`) — pavement, at kerb height,
> where the ring legitimately closes. I nearly filed a regression against my own
> change. "In the road" is now asked of `__ct.groundAt` (road reads 0, pavement
> 0.14) rather than of coordinates, which cannot go stale if the kerb moves.

## Found and not fixed

1. **`side-walk.mjs`: *"3 parked cars, all on the road at y=0 (0 found)"*** — the
   same inherited red I triaged under item 198 and confirmed fails identically on
   mainline `54049141c`, while the screenshots plainly show parked cars. A broken
   census, not a missing world. Still open, still not mine.
2. **The crowd now uses two crossings the world has kerb ramps for, but the
   `act: 'corner'` marks on the four new feet are a guess at intent.** They give
   walkers a reason to pause at the kerb (`WAIT.corner` is [1.5, 4] s), which is
   what a crossing wants and matches the corner nodes they replace — but nobody
   has looked at whether four pause-points that close together reads as natural.
   Worth a glance next time someone is watching the junction.
3. **`CROSS_HALF` is still a hand-written 1.3** rather than derived from
   `JUNCTION_CROSSINGS.*.hw`, which is also 1.3. They cannot currently disagree,
   but nothing stops them. One line, and I left it because the two crossings
   could in principle want different widths and collapsing them to one constant
   would be inventing a rule the world has not asked for.
