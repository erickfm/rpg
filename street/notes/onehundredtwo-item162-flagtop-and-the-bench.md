# Item 162 — the two faces the general fix did not reach, and one red that is not mine

Worker onehundredtwo. `ct/civic.ts` + `ct/props.ts` + `notes/texdensity-baseline.json`.
Measured on the **built bundle**, port **4580** (4580/4581 were free; `ss -ltn`,
never `curl` — GOTCHAS 81).

**This item is NOT finished.** It is a backlog row. I took two clusters, hit a
mid-flight collision with item 163, and found a regression that is not mine.

---

## Where the number went

| | gross | note |
|---|---|---|
| start of my session | 187 | as worker ninetyfive left it |
| my civic work (pre-merge) | 169 | **discarded — see below** |
| my bench work | −3 | survived |
| after merging 163 | 165 | 163 re-did the civic sides more generally |
| **after my `flagTop` fix** | **162** | civic 14 → 11 |

`notes/texdensity-baseline.json` is blessed at **169** and I did **not** re-bless
it down to 162. Deliberate: the board is red for a reason that is not mine and
blessing would bury it. See "the red" below.

---

## The collision with item 163, and what survived it

The desk resolved my `ct/civic.ts` hunks in favour of HEAD because **item 163
(`51c5e9301`) landed the same per-face derivation while I was working**, and
did it better than I had — a shared `BOX_FACE_DIMS` table in `ct/paint.ts`
rather than my inline helper. **That was the right call and I have not
re-applied it.** We reached the same diagnosis independently ("a correct number
applied to faces it was not authored for", the park kerb bug again), which is
duplicated effort and not a mistake by either of us.

### But 163 did not reach the tread TOP, and I re-applied that one

163 changed **which materials the stone faces get**. The tread top is not a
stone material — it is a `plazaTex` **canvas** — so the general fix went
straight past it. Measured on the merged build, *after* 163:

```
29.8x   5.87 x 175 px/m    face 4.6x0.84 m  canvas 27x147  civic  (9.2, 0.3, -79.5)
15.1x   8.26 x 124.58      face 4.6x1.18 m  canvas 38x147  civic  (9.0, 0.2, -79.5)
 9.1x  10.65 x 96.71       face 4.6x1.52 m  canvas 49x147  civic  (8.8, 0.1, -79.5)
```

**Root cause in one line: `flagTop` took its x-range from `u` and its z-range
from `v` unconditionally, but `put` maps them the other way round for an
axis-`'z'` flight.**

`put` places a box at `(ox + dir*u, oz + v)` for axis `'x'` and `(ox + v,
oz + dir*u)` for `'z'`. The call site used to hold a ternary whose two arms were
**byte-identical** — that is where the intended swap went missing. It is the
same trap 163's own comment flags for the side faces (*"±x IS DEPTH ACROSS, ±z
IS WIDTH"*), one level up, on the top face.

This was **the worst visible face in civic's backlog** — the church forecourt
paving, which the player walks over and looks straight down at. Everything else
in that cluster was a buried underside. After: **31.96 × 32.2 px/m**, square.

`scripts/probes/w102-flagtop-axis-swap.mjs` reproduces all three measured
canvases **and both ppm axes** from the swap on paper, so the diagnosis is the
code rather than a guess.

## The bench seat wore the backrest's board

`ct/props.ts`, three faces at **48.0x**, the cheapest win ninetyfive named.

`slatT` (48 × 12) is authored for the **backrest** and only the backrest: over
its 1.80 × 0.44 m face that is 26.7 × 27.3 px/m, square to within 2%, with its
gap lines running along the 1.80 m — which is what a slatted back looks like.
The seat slats were handed the same canvas on a face that is **0.15 × 1.80 m**:
u and v swapped *and* twelve times the aspect, drawing **320 × 6.67 px/m**. It
also drew cross-bench "slat gaps" onto a board that is itself one slat.

The seat now gets its own board. **8 × 96 is exactly 0.15 : 1.80**, so one
derived repeat lands 32 px/m on both axes of the top *and* of the 0.15 × 0.05 m
sawn ends. Drawn deterministically rather than with `rnd()` — that is the shared
LCG this module draws prop **positions** from, and spending it here would move
every prop placed afterwards.

---

## ⚠ THE RED IS NOT MINE: `interior:hotel` 3 → 9

`texdensity.mjs` **exits 1** on the merged build. I did not bless it away
(BUILDER-BRIEF §7: never fix a failing check by loosening it).

**Proved it is mainline's, not this branch's:** reverted my `props.ts` to
mainline, rebuilt, re-measured — **168 gross, same `interior:hotel: 3 → 9`
regression**. `ct/civic.ts` and `ct/props.ts` are my only code changes and
neither can touch the hotel.

**It arrived with `a60a6e8f5`, "Item 96: the hotel's upholstery has a weave; it
was flat colour"** — which gave previously-untextured furniture a `slabTex` map.
**The commit's own comment names the hazard it then shipped:**

> *"⚠ SIZED TO THE LARGEST FACE, NOT TO THE TOP. `slabTex` sizes from a w×d and
> maps 1:1, and a backrest's TOP face is a 0.1 m sliver…"*

That is exactly the bug: one map sized for the largest face, applied 1:1 to all
six faces, so the slivers draw at 250 px/m. The nine faces:

```
9.2x   5.45 x 50 px/m     face 4.4x1.12 m   (869.8, 0.6, 8.4)  x2  (+x and -x)
6.3x  53.33 x 333.33      face 0.6x0.06 m   (877.3, 0.4, 9.4)
5.3x    250 x 47.37       face 0.1x0.38 m   (878.5, 0.7, 9.4)
5.2x    250 x 47.73       face 0.1x0.44 m   (877.3, 0.7, 8.4)
5.2x    250 x 48          face 0.1x0.5 m    (876.2, 0.7, 9.4)
4.0x     50 x 200         face 0.5x0.12 m   (876.4/878.3, 0.4, 9.4) and (877.3, 0.4, 8.6)
```

**The fix already exists in the tree: `BOX_FACE_DIMS` in `ct/paint.ts`, landed
by 163.** This is the same one-material-six-faces bug it was written for. I did
not do it — `ct/int-hotel.ts` is not named by my item and item 96 landed hours
ago, so its author may still be in the file (§9). **Worth its own row.**

---

## My own probe lied three times first — all caught by its own guards

Worth recording, because every one was the instrument and not the world.

1. **A world-frame region box** around the church flight selected **one** object
   and the **population floor** failed the run. Cause: `scenedump` records
   `o.position`, which is **LOCAL**, while `texdensity`'s `at` column and
   `getWorldPosition` report **WORLD** — and the civic block sits in a rotated
   group. I dropped regions entirely rather than convert frames and hope.
2. `w102-where-are-the-flights.mjs` looked for `map.userData.kind`; the field is
   **`userData.surface`** (`ct/paint.ts:35`). It read 0 treads and said so.
3. `w102-what-drifted.mjs` matched only 2 of 8 — because those objects drift
   between **any** two runs, which turned out to be the answer, not a fault.

### The control that made `places` readable

`fp`/`fpdiff` are useless here: +148 texture clones shift the seeded
`Math.random` that `generateUUID` draws from. **Dumping the SAME build twice**
gives identical `textures`/`structure`/`tints` and a **different `places` hash**
— 5 of 8612 entries, the same 0.42 m `mod:props` puddle planes on the x = ±6
sidewalk lines, drifting 1–3 cm. My before/after showed 8 of the same class at
the same magnitude.

So I asserted on the multiset of **geometry signatures** instead (type + params
+ vertex count — no material, no position, no random): **8612 objects before and
after, IDENTICAL**, across both changes. `scripts/probes/w102-geomdiff.mjs`.

**The brief's "4–6 pigeons is the noise floor" is right in spirit and wrong in
detail here — they are puddle planes, not pigeons, and the floor is 5.** Measured,
not invoked.

---

## Green

`tsc --noEmit` 0 · `npm run build` 0 · `health` WORLD OK · `sweep` 0 STATION
MISS · `bugsweep` 0 STATION MISS 0 COVERAGE · `texdensity --selftest` still
catches its 5x mutation.

**Walked, not screenshotted** (`scripts/steps-walk.mjs`): library **5.64 m up,
gy 0.14 → 0.99** and back down; church **2.69 m up, gy 0.14 → 0.55** and back
down; *"the steps climb and descend, and nothing sinks"*.

**The bench is a seat, so it was sat on**: `seats-walk.mjs` 110/219, **11 FAILs,
none of them the bench** — all 11 are interiors at x 880–1082 and pre-existing.

Looked at `shots/church-treads-close.png` and `shots/library-treads.png`: the
flags read square with joints both ways at a consistent scale, 0.0% black,
captured after `waitPainted` (GOTCHAS 78/80).

---

## Left for whoever takes this next

- **`interior:hotel` 9 faces** — above. The check is RED until this is fixed.
  `BOX_FACE_DIMS` is the tool.
- **`interior:bank` 32 faces** — still the largest untouched category, exactly
  as ninetyfive left it. Worst is `2400 × 78.26 px/m` on a 0.03 × 0.46 m face.
- **`civic` 11 remaining** — all unrelated to `flight()`. The worst two are
  `33.2x` at (7.2, 0.3, -73) and `16.5x` at (7.1, 0.3, -83.5): a 0.3 × 0.62 m
  face wearing `rep 6.633×0.413`, both `brick`, both now **declaring 32 px/m and
  drawing 1061 × 32** — so 163's declaration API can see them and they are a
  clean next target.
- **`WPM` is not exported.** `tex-ground.ts:181` owns 32 px/m as a
  module-private constant. I copied it into `props.ts` as `PPM` **with a
  citation** (BUILDER-BRIEF §8) rather than edit a file my item does not name.
  **Hoisting it to a shared export is a one-liner and would remove a standing
  invitation to retype it** — worth a row.
- **The ratchet's re-attribution flaw** ninetyfive documented is still there and
  still unfixed; I hit no case of it this session.
