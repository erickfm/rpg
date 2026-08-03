# Item 146 — "fix this chair": the fault was the SHIRT, not the chair

Worker ninety, 2026-08-03. Port **4460**, built bundle.

## Root cause, one line

The 0.26 m "clothes" slab was pasted across the **middle** of a 0.05 m backrest,
hiding it and leaving a **0.02 m strip of backrest peeking out above** — that
strip is the user's *"separate rail"*, and the banded panel below it is why the
back read as floating.

## Finding the chair, since the row named no file

The row said only *"the chair he photographed"*, with a lost diagnosis and a
second-hand description: back panel floating, a separate rail above it,
**blue-grey wall, wood floor, maroon rug**.

Reading source turned up four chair families — apartment, tax waiting row, hotel
lobby, library — and **all four are flush by construction**. So I stopped
guessing rooms and measured the built world instead.

`scripts/probes/w90-item146-floating-backs.mjs` sweeps **`__ct.seats()`**, which
is the population and therefore cannot miss a chair by failing to recognise its
shape:

```
219 seats, 27 with a pan AND a back panel identified
── seats whose back FLOATS above the pan (gap > 15 mm): 0
```

**Zero.** So the row's "floats above the seat" is not true of any chair in the
world, and it was never a geometry fault.

That left a population hole worth naming: **a chair need not be sittable.** The
one the user photographed is scenery — *"a chair with yesterday's clothes over
the back"*, `ct/apartment.ts:3045` — so it is not in `seats()` at all. Found it
by its own material colours instead (`w90-item146-find-chair.mjs`), and every
environmental cue in the description checks out on the frames: **blue-grey wall,
wood floor, maroon bed, the 301 door.**

## What was actually wrong, in numbers

```
seat top      5.867
backrest      5.867 .. 6.327     a 0.05 m panel
shirt         6.107 .. 6.307     0.26 m DEEP — 5.2x the panel
brown garment 5.837 .. 5.977

brown strip visible ABOVE the shirt:  0.02 m   <- "a separate rail above it"
seat/back junction:                   0.000 m  (flush — nothing floats)
```

The shirt is five times thicker than the thing it is draped over, so it does not
read as fabric at all: it reads as a structural slab cutting the backrest into a
2 cm rail above and a disconnected panel below.

## The fix

A shirt left on a chair hangs **over the top rail**. It straddles the top edge
now — `6.197..6.417` against a backrest top of `6.327`, folded 0.09 over and
0.13 down — instead of belting the panel's waist. Nothing is left above it,
and the backrest runs unbroken from the seat up to the cloth.

**`z` and depth deliberately unchanged.** The chair was tucked north until its
near corner cleared the door's 166° arc by 1.01 m (the file's own comment,
`scripts/swing.mjs`), and the shirt's 0.26 m already reaches z 5.37 toward the
wall. Re-centring it on the panel would have spent clearance this chair does not
have. **One coordinate and one dimension changed; the footprint is identical.**

## The frames — my own verdict, having looked

`shots/w90-chair-BEFORE-edge.png` against `shots/w90-chair-edge.png`, same spot,
same hour. Before: a blue slab across the backrest with a thin brown line above
it and brown below, three disconnected bands. After: the backrest is one
continuous piece from the seat pan up, with the cloth folded over its top. **The
"rail" is gone and the back no longer reads as detached.** Same verdict on
`-tight` and `-front`.

## ⚠ Two ways my own probes lied first

1. **The first two shot runs photographed a ground-floor corridor.** 301 is on
   the **third floor**, and `warp` without a `gy` puts you under the building.
   `scripts/A-verify-301-door.mjs:62` already documents this; I rediscovered it
   the expensive way. `gy = groundAt(199.36, -15.545)` = 5.4.
2. **My cluster heuristic reported `GAP -0.460 m`** by picking a chair *leg*
   (0.44 m tall) as the "back". The raw per-mesh table was right and the derived
   summary was wrong — I used the table.

## Found and NOT fixed — for the desk

1. **The other garment (`0x7a5a4a`, y 5.837..5.977) still sits INSIDE the seat
   pan**, whose top is 5.867 — it is embedded 0.03 m into the cushion rather
   than resting on it. Same class as this fix, much less visible, and it is not
   what the user pointed at. One line.
2. **192 of 219 seats could not be measured** by the sweep — 50 have no
   identifiable pan (benches, beds, tyres) and 142 no back (stools, counters).
   That is honest for those shapes, but it means the "zero floating backs"
   result covers **27** seats, not 219. Said plainly rather than rounded up.
3. **A decorative chair is invisible to every seat-driven check in the project.**
   `seats()` is the population all of them use. Worth a GOTCHA.

## Derived or copied

Nothing retyped. The chair's geometry was read out of the running world; the
door-arc clearance figure (1.01 m) is quoted from `apartment.ts`'s own comment
rather than re-derived.

## Verification run

- typecheck **clean** · `node scripts/health.mjs` → `WORLD OK — __ct initialised`
- `npm run sweep` → **0 STATION MISS, 0 COVERAGE**
- `scripts/A-verify-301-door.mjs` → **MEASURED FINE**, the door still opens and
  closes from both sides (the change is 0.10 m of Y on scenery, footprint
  untouched, but this chair has a door-swing history so I ran it)
- before/after frames looked at personally, listed above
