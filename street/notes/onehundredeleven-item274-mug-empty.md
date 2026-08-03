# onehundredeleven / item 274 — "mug should be empty."

**Landed in `c45f523c5`. The entire functional diff is one colour literal.**

```
-      new THREE.MeshBasicMaterial({ color: 0x4a3524 }));
+      new THREE.MeshBasicMaterial({ color: 0x6d6e6f }));
```

---

## Root cause, one line

**The mug was not full because of its geometry — it was full because of its
tone.** `0x4a3524` is (74, 53, 36): warm by **+38 R-over-B** at **value 54**.
That combination *is* what a liquid looks like. An empty mug still has a dark
mouth, but it is the shadow of white ceramic, and shadow is neutral.

`0x6d6e6f` is (109, 110, 111) — the body tone `0xd8d2c4` taken down to ~53% and
neutralised. Warmth **−2** at value **110**.

## The disc is NOT deleted, and that was the whole risk

The item was right to flag it and I confirmed it in the source: the cylinder has
a **solid top cap**, so with nothing dark up there the top is a disc of body
colour and the object goes back to reading as a peg — the older complaint. The
self-test proves this rather than asserting it: **hiding the disc drops
`interior vs RIM` from 292 to 0**, because the cap shows through in body colour.
That case is in the probe as a standing negative.

## Measured, in his pixels, from his spot

The station is **derived, not typed**. The bed spot is read out of `__ct.spots()`
by label, the mug out of the scene by geometry signature, and the station placed
on the mug→bed bearing at the range that makes the pitch come out at 22°. The
probe then **asserts the HUD really reads `[E] sleep until morning`** — the item
quoted that from his frame, and if it is not up, this is not his vantage and the
frame is not evidence. It is up: `shots/w111-mug-final-main.png`.

```
eye 7.020   mug top 6.333   drop 0.688   →   22° wants 1.70 m
stand (197.66, −15.28), INSIDE the bed spot (197.40, −15.80) r 0.75
```

**Channel-sum contrast** — the same metric item 167 was held to (it accepted 122
for handle-vs-sill, and recorded the cup's own 149):

| | before | after |
|---|---|---|
| interior vs **RIM** (`#d8d2c4`) | 459 | **292** |
| interior vs **SILL** (`#a8a091`) | 310 | **143** |
| warmth @ value | **+38 @ 54** | **−2 @ 110** |
| fill of the projected disc | 0.880 | 0.880 |

**Both contrasts went DOWN and that is the point.** The interior had far too much
separation because it was a *different material*, not a shadow. 292 and 143 are
both comfortably clear — the cup's own body only manages 149 against that sill
and reads fine.

## My own verdict on the after-images, which I looked at

`shots/w111-mug-{before,after,neutral,final}-main-zoom8.png` are the **same
pixels he is shown**, magnified 8× nearest-neighbour — not a closer camera,
which would flatter the object.

- **Before:** unmistakably a cup of coffee.
- **First attempt, `0x6b7078`:** correct in every number, and **I rejected it by
  eye.** It is blue, and the window glass in the same frame is `#8a95a0` — the
  same blue family. A blue mouth reads as a liquid surface reflecting the
  window, i.e. it fixed the colour and kept the meaning. Numbers alone would
  have shipped it.
- **Shipped, `0x6d6e6f`:** a clean neutral shadow. Reads as an empty white mug.

## What I evaluated and did NOT ship

The item invited *"a hint of the inner wall catching light"*. I tested it rather
than reasoned about it (`scripts/probes/w111-mug-gradient-look.mjs`, which
mutates vertex colours **live in the page** — no build, no source churn), at ±16%
and ±30%: `shots/w111-grad-{flat,spread16,spread30}-zoom8.png`.

**Rejected.** The mouth is ~20 × 7 px; the gradient's gain is not visible at that
size, and at ±30% the lightened far edge starts reintroducing the sheen I had
just removed. It would also have cost a vertex-colour attribute and broken the
probe's modal-colour reading for no gain the user could see.

Worth recording, because it looked like a finding for ten minutes: the first
run of that probe produced a **near-black** mouth. `vertexColors` **multiplies**
`material.color`, so baking the base tone into the attribute squares it. It was
arithmetic, not the world. The probe now says so in a comment.

## The instrument

`scripts/probes/w111-mug-empty.mjs`. Pixels are read **in the page** off the live
canvas — this repo has no PNG decoder in its dependencies (`pngjs`, `sharp` and
`jimp` are all absent), and `w60-mug-shot.mjs` already uses the same
`drawImage(canvas)` route for its blackness gate.

**Population floor, DERIVED:** the disc's own 12-gon is projected through the
real camera and its screen-space polygon area computed (149 px here). The
interior must cover ≥ 0.4 of it. Without this, all three colour assertions are
vacuously true over zero pixels — which is exactly how a check passes a world
where the feature does nothing.

**Self-test, both signs, 5 cases — 5 CAUGHT, 0 SLEPT**, and the positive sign
still passes after restore:

| mutation | reddens | reading |
|---|---|---|
| interior ← sill colour | interior vs SILL | 0 |
| interior ← old coffee | not coffee | +38 @ 54 |
| interior ← body colour | interior vs RIM | 0 |
| interior hidden (cap shows: a peg) | interior vs RIM | 0 |
| turn 180° away | fill of projected disc | 0.000 |

**One case was re-aimed rather than kept, and the reason matters.** I first
expected *hiding the disc* to redden **fill**. It did not — fill stayed at
**0.987**, because the cup's solid top cap shows through and is uniform. The
`*** SLEPT ***` was correct. So the case now names its real catcher, and **fill**
got the negative it was always for: an instrument pointed at nothing.

**Five runs, zero spread** — every figure identical (`scripts/probes/w111-five-runs.sh`).
Expected: the world is unlit `MeshBasicMaterial` and the station is a warp, so
there is nothing stochastic in the path.

## Verification

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `node scripts/health.mjs` | **0** — `WORLD OK`, build `c45f523c5` |
| `npm run sweep` / `bugsweep.mjs` | exit 0, **0 STATION MISS, 0 COVERAGE**, no console errors |
| verified on | the **built bundle** via `vite preview`, port **4672** |

`health.mjs` earned its keep here: it caught my first run against a **stale
`dist/`** with exit **3** and named the cause exactly. Not a defect — the
instrument working.

## Not fixed, for the desk

- **`fp`/`fpdiff` were not used and could not be.** No geometry changed, so `fp`
  would in principle have been valid — but it is the wrong instrument for a
  question about a single material colour, which a texture-hash comparison
  cannot see at all. The pixel measurement above is the direct evidence.
- **The `willReadFrequently` Canvas2D warning** appears 12× in `bugsweep`. Mine
  passes the flag; these are from elsewhere in `scripts/`. Cosmetic, unqueued.
