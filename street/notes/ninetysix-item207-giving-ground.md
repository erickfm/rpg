# Item 207 — citizens give ground to a car. Done, with one of the item's own
# acceptance criteria rejected on measurement.

Worker ninetysix. The behaviour change sixtyfour, sixtynine and ninety each
declined to write is written, measured and watched.

---

## What the user asked for

> *"people still get stuck. they should back up and allow the car to pass."*

Reported **twice**. Both halves of that sentence are now true and both are
tested; a fix that only does the first half has taught the crowd to run away
from cars.

---

## The one line, confirmed

`ct/crowd.ts` builds seven placement candidates and **every one advances**:

```ts
const nt = t + step;      // constant across all seven; only the lateral offset varies
```

So "back up" was not a behaviour the file could express at any tuning. That much
the previous three notes had right, and I did not re-derive it.

## What they did NOT have, and what it cost to get

**Ordinary traffic is not a repro, and neither is a car driving at somebody.**
Sixtynine measured 100 s of ordinary traffic: max jam 0.03 s. I measured the
other half — `scripts/probes/w96-deadlock.mjs` drove a taxi at a walker who was
mid-crossing, five trials, and **the taxi got past on 5 of 5**, held 0–2.1 s. It
brakes (`ct/traffic.ts:343`), the walker finishes, it goes. A moving car is not
the bug and no amount of watching one shows it.

**A car can only pin somebody in the ROAD.** `scripts/probes/w96-where-can-a-car-reach.mjs`:
a vehicle body on the main straight sits at x = 1.50 with a 2.30 m box
(x 0.35…2.65). Citizens walk at |x| 6.05–6.39 and the walk is |x| 5.0–7.0. **A
vehicle cannot touch a walker who is on the walk** — the only ground they share
is the carriageway, which pedestrians enter only on a crossing. That is what
makes the repro constructible: park a taxi on the main crossing (z = −90.2,
derived from `JUNCTION_CROSSINGS.main`, not retyped) and walkers meet it.

The dwell is held through `__ct.drive('NE','taxi', s)`, which re-puts the taxi at
a route position. Nothing is monkey-patched and no box is planted — `citAvoid()`
returns a **mapped copy** (GOTCHAS 74).

## Before / after, same scenario

| | before | after |
|---|---|---|
| blocked episodes pinned | **10 of 10** | 0 |
| longest stand against the car | **5.6 s** | 0.0–0.7 s |
| ground given | **0.00 m, every episode** | 1.5–1.6 m |
| crosses once the taxi leaves | — | **5/5** |

---

## The change

1. **A backwards candidate**, run **back along the route edge** rather than down
   a raw heading. That is what makes it safe: the edge is the crossing the walker
   stepped onto, so retreating walks it back toward the kerb it came from instead
   of sideways into the lane. Vetted by the same `clearAt`/`clearOfPeople` the
   forward step uses.
2. **Gated on `movers`** — boxes seen at two different positions. Backing off a
   tree is a walker reversing down the street; backing off a car is the ask.
   **"Has EVER moved", not "moved this frame"**: the case is a taxi *dwelling*,
   so a frame-to-frame test goes blind exactly when it is needed. Vehicles idle
   at x = 999 and are driven in, so one is marked the instant it reaches the
   block.
3. **A Schmitt trigger on the look-ahead** — engage at 3.4 m, release at 5.0 m.
4. Retreating is **not counted as progress**, so the existing ladder (stand → go
   round → give ground → `reroute` at `JAM_GIVE_UP`) stays ordered and this
   rule's worst case is bounded at `BACK_MAX` = 2.5 m.

### The gate was checked against ground truth it deliberately does not use

`crowd.ts` cannot ask "is this a vehicle" — `citAvoid` is one flat list. But
`crosstown.ts` tags actor boxes and `__ct.citAvoid()` publishes the flag, so
`scripts/probes/w96-movers-are-vehicles.mjs` checks the heuristic against it,
**both signs**: 192 boxes, **1 ever moved, actor-tagged, 0 false positives**, and
it fails vacuously if nothing moves at all.

---

## ⚠ MY FIRST CUT PASSED EVERY PASS/FAIL I HAD AND WAS STILL WRONG

Worth more than the fix. It reported: 0 pins, longest stand 0.9 s, 21.78 m of
ground given — a triumph. The **trace** is what caught it:

```
walker 4  x=-3.18  z=-90.20  gave=0.02  jam=0.38
walker 4  x=-3.19  z=-90.20  gave=0.03  jam=0.40
walker 4  x=-3.18  z=-90.20  gave=0.02  jam=0.38     … for 65 SECONDS
```

The taxi's box edge was **3.53 m** away and the look-ahead was **3.4 m**: at
3.53 m the wall test did not fire so the walker stepped forward, at 3.40 m it did
so it stepped back. **21 direction reversals, and because it never held still for
a single sample every stand-timer read it as perfectly healthy.** Walker-frames
in the roadway went 592 → 5787 — the crowd had moved into the road to vibrate.

The latch I had written latched the *retreat*. What needed latching was **the
decision to stop advancing**. Hysteresis fixed it: after, a monotonic
x −3.38 → −4.65, and reversals 21 → 0.

**A pass/fail cannot see a limit cycle. Print the trace.**

## The four ways this could have made the world worse — all measured

`scripts/probes/w96-watch-the-retreat.mjs`, taxi dwelling:

| | result |
|---|---|
| pushed into the traffic lane | **0.000 m** of retreat went toward the road centre |
| pushed off the kerb / into scenery | **0** samples inside any prop or vehicle box |
| pushed inside another citizen | closest two walkers **0.47 m** vs the 0.46 floor |
| oscillating | **0** direction reversals |

**Watched it**: `shots/w96-retreat-*.png` — taxi across the zebra, walker waiting
on the far kerb. (The first four shots were of a **bedroom**: the player spawns
inside apartment 301, GOTCHAS 51, and my teleport call had silently done nothing.
`warp` is the published mover.)

---

## THE ITEM'S THIRD ACCEPTANCE CRITERION IS WRONG. Do not implement it.

> *"`escapeFrom` handles being beside a box as well as inside one"*

**Measured against the pre-fix build** (`scripts/probes/w96-is-the-pin-illegal.mjs`,
150 s): 170 frames with a walker up against the parked taxi —

```
INSIDE the box  (gap < 0.28, illegal, escapeFrom acts):     0
BESIDE it       (gap >= 0.28, legal, escapeFrom is null): 170
of those, genuinely jammed (jam > 0.5 s):                  95
closest any walker got:                                 0.286 m
```

**Zero.** A pinned walker is never inside the box — 0.286 m is just outside the
0.28 m footprint, exactly as the geometry predicts. It is in a **legal** position,
so `escapeFrom` returning null is correct, and `unstick` recording it as fine is
correct. Making it push anyway would break the property at `crowd.ts:318-320`
that stops a walker **resting legally against a wall** from being shoved — a real
regression traded for nothing.

The note in `w69-car-pins-citizen.md` is right that `stuckT` resets and wrong
that this is why the freeze persists. The walker was not stuck *illegally*; it
was trapped *legally*, and the fix for that is the ability to retreat.

---

## A pre-existing defect this turned up. NOT item 207.

**`scripts/crowd-walk.mjs`'s last two legs are flaky**, and I nearly reported my
own change as a regression on the strength of one run of each build. Five runs
per build (`scripts/probes/w96-seal-spread.mjs`):

```
without the fix:  0, 62, 317, 0, 0 sealed   (2/5 runs seal)
with the fix:     0, 78, 301, 0, 0 sealed   (2/5 runs seal)
```

Same spread, same spot, same tightest gaps; per-run sample counts track each
other. The crowd draws errands with `rnd()` at runtime, so who is standing where
in a 25 s window differs every run.

**The real finding underneath it: a citizen stopped at (6, −50.45) seals the walk
outright — 0 m gap, and the 2 m lane is sacred.** It reproduces without my change.
Worth a row.

---

## Verification

- typecheck **clean**; `npm run build` clean.
- Verified on the **built bundle**, port **4520** (`ss -ltn`, `--strictPort`).
- `node scripts/health.mjs` → **WORLD OK**, exit 0.
- `npm run sweep` → **0 STATION MISS, 0 COVERAGE**, exit 0.
- `scripts/crowd-walk.mjs` → **all crowd checks pass** (0 sealed, tightest 1.92 m).
- `w96-dwell-pin.mjs` → **PASS**, 5/5 cross once the taxi leaves.
- `w96-movers-are-vehicles.mjs` → **PASS**, 0 false positives.

`fp`/`fpdiff` deliberately **not** used: this changes no geometry, but it also
changes no textures, and GOTCHAS 75 makes it the wrong instrument for behaviour.
The comparison that matters is the before/after table above.

## Not done, for the desk

- **(6, −50.45) seals the walk** — pre-existing, reproduces on mainline.
- **`crowd-walk.mjs`'s seal legs need a repeat count**, or they will keep
  accusing whoever touches `ct/crowd.ts` next. `w96-seal-spread.mjs` is the shape.
- `BACK_MAX` 2.5 m is tuned for the 10 m main street. If a vehicle ever dwells
  somewhere with a wider crossing, that number is the one to revisit.
