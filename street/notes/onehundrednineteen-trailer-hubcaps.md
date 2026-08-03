# Item 292 — the trailer's wheels get hubcaps, at TEN segments not twelve

Worker onehundrednineteen, 2026-08-03. Port **4750**, built bundle.
Files changed: `src/proto/ct/cars.ts`, `src/proto/crosstown.ts`.

The user: *"[screenshot] fix the wheels on the trailer."* Half of that was item
253's — the wheels standing 0.113 m proud of the deck. This is the other half:
**the trailer's were the only wheels in the world with no hubcap.**

---

## What it looks like, which is the point

- `shots/w119-292-trailer-{before,after}-flank.png` — 3 m off the near side,
  standing in the carriageway, which is where a player passes it.
- `shots/w119-292-trailer-{before,after}-vdebug.png` — the same view with `V`.
- `shots/w119-292-trailer-{before,after}-wheel.png` — 1.4 m, at the axle.

**My verdict, having looked at all six:** in the BEFORE the trailer wheel is a
featureless black disc — *"a dark blob detached from the vehicle"*, and the
sedan's own wheel one metre to its left has a silver cap with four spoke marks,
so the two read as different objects. In the AFTER they match. The `V` overlay
shows the deck collider still green and still continuous with the car's boxes:
**nothing red, and the hitch is intact.** The before shots are a real rebuild at
`HEAD~1`, not a memory.

## THE ROW SAYS "USE `tyreGeo`" AND AT THE EXISTING SEGMENT COUNT THAT WOULD HAVE BROKEN IT

This is the part worth reading. The row is right about the tool and it would have
cost the one thing on this rig that was already perfect.

`tyreGeo` adds `thetaStart = π/segs`. After `rotation.z = π/2` the ground contact
is at θ = 270°, and a vertex is there only if `(270 − phase°)` divides evenly by
`360/segs`:

| | | |
|---|---|---|
| segs 12, phase 0 (what shipped) | 270 / 30 = 9 | **vertex** ✓ |
| segs 12, phase π/12 | 255 / 30 = 8.5 | **FLAT** ✗ |
| segs 10, phase π/10 | 252 / 36 = 7 | **vertex** ✓ |

**Measured, not argued.** I built it at 12 and read the lowest transformed vertex
off the live scene graph: **gap 0.00750 m**, which is exactly `r(1 − cos 15°) =
0.22 × 0.03407`. Then reverted.

And `ct/cars.ts`'s own docstring names *these wheels* as the evidence the whole
phase argument rests on — *"the trailer's wheels are the only pair that measured
`gap 0.0000`, and the reason is that they happen to be phased onto a vertex"*.
Applying the fix at the wrong segment count would have undone the proof the fix
was derived from.

**Ten is also what the fleet uses** (`tyreGeo(0.34, …, 10)` on a car,
`tyreGeo(0.44, …, 10)` on the bus), so the trailer now matches in phase, in facet
count and in materials — which is what "matching the fleet" should mean.

## The numbers, before and after

`scripts/probes/w119-292-trailer-wheels.mjs`, off the live scene graph:

| | before | after |
|---|---|---|
| geometry | 12-gon, `thetaStart 0` | **10-gon, `thetaStart 0.314159`** |
| materials | **1** | **3** |
| hubcap | **no** | **yes** |
| tread `noLight` | no | **yes** |
| ground gap | 0.00000 m | **0.00000 m** |
| deck overhang | −0.0070 m | **−0.0071 m** |

The overhang moves 0.1 mm — floating point in the corner transform, not a design
change; it is still tucked, which is what item 253 left.

## Two exports, and why one of them is a triple

`ct/cars.ts` now exports `tyreGeo`, `flatTex` and `fleetWheelMats()`.

**Exporting `hubcapTex` alone would have been the trap.** The caller would still
have had to know four unguessable facts: that a wheel wears three materials in
the order `[side, top, bottom]`; that the tread is `0x101114`; that it carries
`userData.noLight` (a black tyre under a sodium lamp is still a black tyre — the
trailer's old local material did **not** have this, so it was being lit); and
that the cap must go through `flatTex` or it shimmers. All four were already
true four times over in that file. So the fleet publishes the **answer**, not the
ingredients — memoised, because nothing about a wheel varies per vehicle and this
world runs ~3,800 draw calls.

`flatTex` is a hoist, not a new thing: `makeCar` and `makeBus` each carried a
**byte-identical** four-line `flatT` closure. Both now delegate to the one at
module scope. Verified identical before merging them.

## Verification, and a deliberate NON-check

Per the new §10a: **I added no registered check for this item.** The probes are
deterministic scene-graph reads — a material count, a segment count, a
transformed vertex — with no timing, no N-runs, no pixels, and they live in
`probes/`. The measurement is in the table above; the fix is nine lines. A
harness for it would have cost more than the fix and could only have gone red for
reasons that are not this bug.

| | |
|---|---|
| `npm run typecheck` | **0** |
| `npm run build` | **0** |
| `scripts/carstate.mjs` | **0** — all car variant checks pass |
| `scripts/H-flare-silhouette.mjs` | **0** — 0 of 23 cars carry a mesh outside the silhouette |
| `scripts/I-archcheck.mjs` | **0** — every tyre has bodywork past its top |
| `scripts/I-rows.mjs` | **0** · `scripts/park-repro.mjs` **0** |
| `node scripts/health.mjs` | **0**, `WORLD OK` |
| `npm run sweep` | **0**, `0 STATION MISS, 0 COVERAGE`, no console errors |

## ⚠ THE ROW'S CLAIM "`w29-sedan-climb` PASSES TODAY" IS FALSE

It is the row's own DONE WHEN, so this matters. **It is red on plain mainline**,
with `src/` checked out at `add-stick-and-city98` and rebuilt:

```
ok    1. trailer deck    feet 0.500 (want 0.50)  at 3.79,-7.85
MISS  2. boot lid        feet 0.500 (want 0.93)  at 3.79,-9.21
FAIL: three attempts, never completed the route
```

**Byte-identical before my change, after my change, and on mainline** — same
three attempts, same stall at z = −9.21, same numbers. So it is not mine, and I
have not chased it: it is a movement/step-up matter, not a wheel one.

What it says, for whoever takes it: the deck is reached correctly at 0.500 m, and
the check's own budget line passes (*"rise deck → boot lid 0.430 m (budget
0.52)"*). The walker then stops at z = −9.21 against a boot lid whose near edge
is −9.569 — **0.36 m short, which is exactly `blocked()`'s pad** — and never
makes the 0.43 m step. So the geometry is right and the *climb* is not being
performed. It is also not registered in `checks.mjs`, so nothing has been
watching it.

## FOUND AND NOT FIXED

1. **`w29-sedan-climb` red on mainline**, above. Not in the suite either.
2. **`scripts/gaps.mjs` exits 1 standalone with 5 FAILs**, all in the car lot
   (8.5,8.2 / 8.2,8.8 / 8.1,8.6 / 26.9,5.1 / 26.7,0.1) — **and the full
   `npm run checks` run earlier today showed `✓ gaps`.** Confirmed red on plain
   mainline too, so it is pre-existing and not mine, but the suite and the
   standalone script disagree about the same world and one of them is wrong.
3. My change **adds no collider** — the wheel is a mesh on a group — so it cannot
   move any trap-band number, and the trailer's own in-world trap warning
   (`[sedan-climb] trailer leaves a … trap-band gap`) printed nothing.

## Values: derived or copied

- `WHEEL_R` / `WHEEL_T` / `WHEEL_X` — **untouched**; `WHEEL_X` still derives from
  `DECK_HW`, which is what keeps the overhang at −0.007 m.
- the segment count — **chosen by measurement** (both 10 and 12 built and the
  ground gap read), and it is the fleet's own.
- the wheel materials — **imported**, not rebuilt.
