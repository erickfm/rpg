# ninetythree / item 246 — three probes aimed at worlds that do not exist

All figures on the **built bundle**, port **4490** (`ss -ltn` clean before
binding, `--strictPort`), plus a dev server on **4491** for the one comparison
that needs both sides. Builds `badc4e806` / `83d36accb`.

**No `src/` file was touched.** The diff is 4 scripts and one notes file, so no
geometry moved and `fp`/`scenedump` do not come into it.

---

## Headline: the row was right that all three lie, and wrong about why one of them does

| | the row's diagnosis | what I measured |
|---|---|---|
| **w64-lampwall** | `x > 300` filter aims it at a world that is not there | **the `x > 300` line drops nothing.** All 21 lamp heads are at x −34.8…+45. The probe is blind because it **never moves the player** and the world is region-culled |
| **w60-mug-geometry:137** | prints a false conclusion when 76% of the hole is open | confirmed. 76.2% by radial span, **85.9% by area**. The verdict was drawn from a 1-D span test |
| **interiors-walk** | cannot run on `vite preview`, conflicts with GOTCHAS 28 | confirmed, and worse than stated: it **exited 1**, a false red, not an abort |

---

## 1. `scripts/probes/w64-lampwall.mjs` — culling, not the x cut

### Root cause, one line

**The probe never warps, and the default spawn is indoors, so the region culler
had already hidden the entire street before it looked.**

`__ct.pos()` at load is **x 198.6, z −16.3** — inside apartment 301, out in the
interior belt. `__ct.cullInfo()` there reports `on: true, hiding: true`, and
**3,497 meshes with x < 100 carry `visible === false`**. The probe's own
parent-visibility walk then dropped every one of them.

### Why that is worse than reporting nothing

It reported the **walk-up's interior shell**, 160 m from the nearest lamp head,
as "tall meshes near the lamps" — and printed `pooled=false` on all eleven.
`pooled=false` on the wall behind a lamp is **exactly the evidence for the
desk's registration-gap hypothesis**, which was wrong; item 156 turned out to be
`wallSplashT`'s radial gradient overflowing a 32 px canvas.

Standing on the street instead (warped to the lamp centroid):

```
                             at the spawn        on the street
visible meshes within 12 m of a lamp head    0            2496
    …of those, carrying the pool patch       0            2233   (89.5%)
    …of those, >= 3 m tall                   0             225
wall-splash planes (3.4 x 5.0) visible       0               8
meshes still culled                       3559              62
```

**A probe that answers your question wrongly is worse than one that answers
nothing.** This one would have confirmed a false cause.

### The other two faults

- **`ud.lampList` and `ud.lamps` have never existed**, so `lamps:` printed
  `null` on every run this file has ever had. `scene.userData` publishes
  `addLamp` (a *registrar*: takes x/z, returns a remover) plus `lampHeadCount`
  and `lampHeadsUploaded`. Heads are findable from the scene instead —
  `ct/props.ts:1924` tags each `userData.lampPart = 'head'`. **21 tagged meshes
  against a registry count of 27**; the 6-head gap is legitimate (`addLamp` is
  open to any module and an interior light or a television builds no fitting)
  and the probe now says so rather than leaving it to be read as loss.
- **`h < 6` was the cut that actually mattered** once culling was fixed —
  lowered to a declared `TALL_M = 3`, because a shopfront pier is not 6 m and
  the splash quad it carries is 5.0 m.

### What it is now

Two passes. Pass 1 reads head positions **without** the visibility filter (a
culled mesh is still in the graph) and derives the station from the head
centroid — the old `x > 300` was a typed guess at the same thing that could not
state its intent. Pass 2 warps there, waits for the culler, and measures.
`NEAR_M`/`TALL_M` declared at the top; population floors of 10 heads and 20
facades, exiting 3. `--selftest` is the **negative control**: it skips the warp
and must find 0 visible meshes near a lamp. It does.

The header now says item 156 is DONE, that the hypothesis this file encodes was
disproved, what the cause actually was, and points at
`w87-item156-lightedge/ratiomap/whichmesh` — the night÷day probes that solved it.

**One thing that bit me, worth having in writing:** `lampHeadCount` and
`lampHeadsUploaded` are written by `updateLit` **once per frame**
(`ct/props.ts:1409`). Read off a freshly-loaded page they are `null`, which is
indistinguishable from "the registry is gone". Pass 1 now sets the clock and
waits 800 ms first — that is the difference between `27` and a false alarm.

---

## 2. `scripts/probes/w60-mug-geometry.mjs:137` — a verdict from a 1-D test

### Root cause, one line

```js
const clear = reach.holeLo >= bodyR;
… : 'PARTLY BEHIND THE CUP — the hole will not read'
```

`holeLo`/`holeHi` are the **radial span** of the daylight — nearest and farthest
from the cup's axis, one number each. `holeLo >= bodyR` therefore asks *"is
every last millimetre of the hole clear of the cup"*, and any overlap at all
failed it. What it then printed was not "some of the hole is occluded" but
**"the hole will not read"** — a claim about what a player *sees*, from a test
that cannot see anything.

### Measured

```
the HOLE spans 0.0280…0.0700 m from the cup axis
  of that RADIAL SPAN, 76.2% clears the 0.0380 m cup wall
  of the hole's AREA,  85.9% has a clear sightline through it   (17182/20000)
DOES THE HOLE READ: YES — 85.9% open, against a 35% bar
self-test  cup x20 -> 0.0% open (want ~0)   cup x0 -> 100.0% open (want ~100)   PASS
```

Area sampler: 20,000 area-fair samples (`r = rHole·√u`, golden-angle — a polar
grid stepping uniformly in radius over-weights the middle of the disc, which is
exactly the part the cup hides), each cast along the hole axis and tested
against the cup **cylinder**, whose radius is interpolated 0.034 → 0.038 by
height. Deterministic: five runs gave 17182/20000 every time.

**I derived 81.7% by hand first and the sampler said 85.9%. The sampler is
right** — I had used a constant 0.038 m cylinder, and the cup tapers, so the
lower half of the hole clears more than a constant-radius sum credits. Left in
the file as a comment, because the hand number is the one a reader would reach
for.

Bar declared at 35%, population floor of 1000 samples exiting 3, self-test in
**both signs** and exiting 2 if either fails.

**This mattered because of who reads it.** That verdict is what the next builder
sees before touching a mug that has already cost three user reports
(`notes/eightyseven-item167-mug-handle.md`), and it would have sent them to
re-cut a handle that is fine. Its author left it rather than loosen it, which
was right (BRIEF §7); this corrects it for the right reason.

---

## 3. `scripts/interiors-walk.mjs` — the exemption is now stated, and the red is honest

### Root cause of the harm, one line

Pointed at a bundle it died on an **unhandled** `Failed to fetch dynamically
imported module: /src/proto/ct/doors.ts`, and node turns that into **exit 1 —
"measured, and it is WRONG"**. Nothing was measured.

That is GOTCHAS 32's exact ambiguity, sitting in **the one suite the
verify-on-the-bundle rule points at most often**. A builder doing precisely what
BUILDER-BRIEF §10 tells them got a red against twelve rooms that are fine.

### What changed

- A **preflight** 400 lines before the first import site: probes the import,
  and on failure prints a plain paragraph (dev-only, why, how to re-run) and
  exits **3 — aborted, nothing measured**.
- A **banner at the top of the file** and a **new BUILDER-BRIEF §10 bullet**
  naming this as the one documented exception and explaining why the dev-only
  read is deliberate: on `vite dev` the ES module cache hands back *the same
  instance the app is using*, so the harness reads live declarations and a room
  added tomorrow is understood with no edit.

Verified: bundle → exit 3 plus the message; dev → `library` **29/29 passed**,
unchanged.

### Measured: the exemption is ONE value away from being liftable

`scripts/probes/w93-item246-iw-bundle-gap.mjs`, on dev, over all 12 declared
doors:

| the 4 dev-only import sites need | already on `__ct`? |
|---|---|
| `doorStandFor` | **yes — `__ct.doors()[].stand`, agrees 12/12 exactly** |
| `doorPointFor` | **yes — `__ct.doors()[].point`, agrees 12/12 exactly** |
| `roomWidthFor` → `r.W` | **irrelevant — `r.W` is assigned on one line and read nowhere.** `inRoom` uses lower-case `r.w`, measured off the colliders; the room builder uses `built.w` |
| `declaredDoors().at` → `r.at` | fallback only, the `\|\| { x: room.at, … }` arm |
| `ct/interior.ts` `PARTY` | **NO. 1 declared party wall, nothing publishes it** |

Self-test, negative sign: a stand displaced by 0.5 m is rejected. PASS.

**So three of the four sites are already redundant and the whole remaining
blocker is publishing `PARTY`** — one line beside `roomDims()` in
`src/proto/crosstown.ts`.

---

## FOUND AND NOT FIXED — for the desk to queue

1. **Publish `ct/interior.ts`'s `PARTY` on `__ct`.** One line in
   `src/proto/crosstown.ts` next to `roomDims()`. It makes `interiors-walk.mjs`
   bundle-runnable and closes the last standing conflict with GOTCHAS 28.
   **`crosstown.ts` is not named by item 246, so per BRIEF §9 I stopped and am
   reporting it rather than editing it.** Everything needed to do it in one
   sitting is in the banner at the top of `interiors-walk.mjs`.
2. **`r.W` in `interiors-walk.mjs` is dead** — assigned from `roomWidthFor` and
   never read. Deleting it removes one third of what the first import site is
   for. Left alone: it is inside my item's file, but it is a behaviour change to
   a 1,700-line harness on an item about probe honesty, and it is not worth
   bundling.
3. **`[interior:hotel] NO BUILDING NAME` kit warning is still live.** It is what
   takes an otherwise-clean `interiors-walk` run to exit 1 on dev (library
   29/29 pass, then this warning). **Inherited, not mine** — it also appears in
   `npm run sweep` on untouched mainline.

---

## Which of the five documented probe traps I hit — the honest answer: none of them, and two new ones

The row asked. Taking them in turn:

- **`roomDims()` is an ARRAY, so `dims.library` sweeps the world** — *avoided,
  because it was written down.* My gap probe uses `dims.find(d => d.id === …)`
  and prints the array-ness at the top.
- **`interiors-walk`'s room filter is positional, not `ROOM=`** — *avoided.* I
  ran `node scripts/interiors-walk.mjs library`.
- the vehicle selector, the box filter, and the live-world division were not in
  this item's path.

**But my own probes lied twice, and both are the same family.** Recording them
because the row is right that this is the pattern, not the individual bug:

1. **A `0 of 8` that looked like a finding.** My first gap probe paired each
   door with a `roomDims()` row by matching world coordinates and scored 0/8. I
   nearly wrote up *"roomDims disagrees with doors.ts"*. It does not: **a
   shopfront door stands on the street at x ≈ ±7 and the room it opens into is
   out in the interior belt at x 440–1300.** Same room, no shared coordinate.
   The 0/8 was the matcher. Kept in that file's header, because a zero that
   looks like a result is exactly how a probe gets believed.
2. **A count that went negative.** The same probe printed `-1 genuine reads` for
   `r.W`, because its write-counting regex `/\br\.W\b\s*=/` also matches
   `r.W === undefined`, so writes (3) exceeded mentions (2). Replaced with
   printing the lines — a two-mention symbol does not need arithmetic, and a
   count that can go negative is not a count.

Both were caught by looking at the number and asking whether it could be true.
Neither would have been caught by re-running.

---

## Verification

| | |
|---|---|
| `npx tsc --noEmit` | clean, exit 0 |
| `node scripts/health.mjs` (4490, build `83d36accb`) | `WORLD OK — __ct initialised` |
| `npm run sweep` (4490) | **96 shots, 0 STATION MISS, 0 COVERAGE**, no errors |
| `interiors-walk library` on dev 4491 | **29/29 passed** |
| `w60-mug-geometry` | 5 runs, identical: 17182/20000, self-test PASS both signs |
| `w64-lampwall` / `--selftest` | exit 0 / exit 0, negative control finds 0 |

Inherited reds, unchanged by this work: the `[interior:hotel]` kit warning, the
`THREE.Clock` deprecation, the Canvas2D `willReadFrequently` notices and the
WebGL `ReadPixels` driver messages — all present on mainline.
