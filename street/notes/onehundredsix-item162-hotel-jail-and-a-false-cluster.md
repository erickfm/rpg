# Item 162 — the ratchet is green again, the worst face in the world is gone, and the next cluster is an instrument artifact

Worker onehundredsix. `src/proto/ct/int-hotel.ts`, `src/proto/ct/jail.ts`,
`notes/texdensity-baseline.json`. Commits `997f0aec8`, `ceb6d8578`, `0a823aa21`.
Measured on the **built bundle**, port **4620** (free by `ss -ltn`, never `curl`
— GOTCHAS 81; bound with `--strictPort`).

**This item is NOT finished.** It is a 155-face backlog row. I took the two
things three previous builders had handed forward, and I am handing forward a
correction to what the next one should take.

---

## The row's numbers are still stale, and now differently stale

w104 released this row saying all three of its figures had rotted. They had, and
they have moved again since. **Do not navigate by the row text.**

| the row says | measured today, build `879924f36` |
|---|---|
| "the **188** gross-density faces" | **162** on arrival, **155** on exit |
| "worst offenders: **civic 39**" | **civic 11** |
| "`interior:bank` 32" | **32 — still correct, still the largest owner, still untouched** |
| "a 30 × 0.22 m face drawing 0.27 px/m at (-7.1, 0.1, -83), worth looking at first" | **does not exist.** Fixed by ninetyfive |

---

## Done 1: the hotel's upholstery — this is what was holding the board RED

`interior:hotel: 3 -> 9`, the only *regression* (as opposed to backlog) in the
check, live across **three builders' sessions**. Both w102 and w104 diagnosed it
correctly and both declined to fix it, for the same good reason: item 96 had
landed hours earlier and its author might still be in the file. That is no longer
true, no in-flight item names `int-hotel.ts`, and `claim.sh --stale` showed items
255/260/261 held — none of them in this file.

**Root cause in one line: item 96 sized the CANVAS correctly and never fixed the
MAPPING.**

`fabric()` builds one `slabTex` sheet from the box's two largest dimensions —
which is the right choice of canvas, and the commit's own comment defends it
well. But three gives a `BoxGeometry` per-face 0..1 UVs, so that single 1:1 sheet
stretches independently to fit each of the six faces. The chairs' 0.1 m arm ends
drew **250 × 48 px/m** against a declared 48.

`boxFaces` (`ct/paint.ts`, item 163) is the fix, and `slabTex`'s **own docstring
names this room as the case it was written for**. One line: build the texture,
hand it to `boxFaces(t, w, h, d)` with the same `make` callback. All six call
sites already pass the exact box dimensions, so it is a drop-in.

`joint: 0` is what makes it safe. A face larger than the sheet on one axis (the
sofa's +y is 0.85 × 2.1 against a 2.1 × 0.85 sheet) now tiles **2.46×** — which is
invisible in pure grain and would be a visible seam grid on a jointed surface.
**If anyone reuses this recipe on a jointed texture, that is the trap.**

| | before | after |
|---|---|---|
| `interior:hotel` gross faces | 9 | **3** (its baseline) |
| `texdensity.mjs` | **exit 1** | **exit 0** |

### The colour survived, and I checked it with pixels rather than by asserting it

`slabTex` fills the authored colour INTO the canvas, so the material reads
`#ffffff` and no census can tell you the bottle-green is still bottle-green.
w97's own note says so. `scripts/probes/w106-hotel-fabric-look.mjs` shoots both
stations and reports the mean RGB of a centre patch:

```
suite    before [85.58, 55.22, 54.87]    after [84.68, 54.51, 53.79]
chairs   before [94.30, 40.27, 47.07]    after [94.45, 40.37, 47.16]
```

Deltas of 0.1–1.1 out of 255, and triangle counts identical (42842, 44900). That
was a **falsifiable prediction, not a reassurance**: I changed `repeat` only, the
canvas is byte-identical, so a pure-grain sheet's mean colour *must* hold. If it
had moved I had broken something.

I looked at all four PNGs. The green wing-back is still green, the tan and maroon
chairs still mismatched — which is the room's thesis and two of those colours are
things the user asked for. 0.0% black on every frame, captured after
`waitPainted` (GOTCHAS 78/80 — the predecessor probe
`w96-hotel-suite-look.mjs` still uses `waitForTimeout(1400)` and can photograph a
black frame under load).

## Done 2: the jail threshold — the worst face in the world, 184.8x

`jail.ts:647`. A 2.4 × 0.05 m strip drawing **8.33 × 1540 px/m** — five times
worse than anything else in the world, and the "next worst single face" ninetyfive
named on the way out.

Same mechanism: `slabTex` sized a 20 × 77 canvas for the threshold's 0.66 × 2.4 m
**top** and the ±x **edge** got it unchanged — 20 texels smeared along 2.4 m, 77
packed into 5 cm.

**What makes this one worth recording is that the call site had already
considered and rejected the fix:**

> *"The box is only 0.05 m tall, so one mapped material on all six faces (rather
> than a top-only array) is enough — the sides are a sliver nobody sees edge-on."*

That argument is about **size** and the defect is about **aspect**. A face being
small does not make a texture stretched across it any less stretched. And the
face is not a hidden sliver: it is the strip you look straight down at while
walking up to the sally port — I stood there and photographed it
(`shots/w106-jail-down-after.png`).

| | before | after |
|---|---|---|
| worst face in the world | **184.8x** | **36.07x** |
| owner `jail` | 1 | **0** |

## Done 3: the baseline is ratcheted 169 → 155

w102 deliberately left the baseline at 169 rather than bless a board that was red
for a reason that was not his. That reason is now **fixed rather than blessed**,
so the number can legitimately come down. It also finally records props 14 → 11
and civic 21 → 11, landed by earlier builders and never written down.

**Both signs of the ratchet were observed live on the real world, not by
mutation** — `exit 1` with the hotel at 9, `exit 0` with it at 3. `--selftest`
still catches both its cases ("that face is in the list at 5x", "declared 32,
drew 192.35×192").

---

## ⚠ THE NEXT-WORST CLUSTER IS AN INSTRUMENT ARTIFACT — DO NOT "FIX" IT

With the jail threshold gone, the top of the list is **8 faces at 23–36x** across
three owners (`tex-ground` 4, `street` 2, `?` 2), all the same shape: a 16 × 16
canvas, `rep 1×1`, on a face 0.65–1.01 m wide and **0.028 m** tall.

They are the frame rails of `floorDrain` / the sidewalk grate in
`ct/tex-ground.ts`, wearing `castTex()`. **The stretch is deliberate and correct.**
Read in the source (`tex-ground.ts:611`, BUILDER-BRIEF §7 — the source is the
answer, not the script):

```js
g.fillStyle = '#46413a'; g.fillRect(0, 0, 16, 16);
g.fillStyle = '#565046'; g.fillRect(0, 0, 16, 1);     // worn bright along the top arris
g.fillStyle = '#332f2a'; g.fillRect(0, 15, 16, 1);
dither(g, 16, 16, 26);
```

Every row is uniform along `u` apart from 26 dither pixels in 256. **It is a 1-D
vertical gradient**: 16 texels standing for 2.8 cm of frame edge so the worn
arris reads as a ~1.75 mm bright line along the top. Stretching that along `u`
costs nothing, because there is nothing along `u` to stretch.

Squaring these texels would **destroy the arris** — it is the whole point of the
canvas. This is the aspect heuristic doing what `ct/paint.ts`'s own header admits
it does: it "catches a stretched face and cannot catch a face that is uniformly,
squarely, wrongly dense", and the converse is that it flags deliberate anisotropy
as a defect. Half of all "defects" here are the instrument (§7); this is one.

**Suggested row: give `declareSurface` a way to say "anisotropic on purpose"**, so
these 8 can be excluded honestly rather than by lowering the tolerance (§7 —
never loosen a check until it passes) or by silently living in the backlog
forever as the top item everyone bounces off.

## Also found and NOT fixed

- **The jail threshold renders as a flat BLACK quad** — and it was added
  specifically so it would not be a flat quad (*"a flat quad here is exactly item
  0a's defect class"*). `MeshBasicMaterial({ color: STEEL_DK, map })` multiplies
  an already-dark `#26282c` map by a dark colour and the grain disappears
  entirely. **Pre-existing, not mine — proved it**: before and after shots are
  both 6.5% black and visually identical (`shots/w106-jail-down-before.png` vs
  `-after.png`). It is a colour judgement, outside this row's subject. Worth a row.
- **`interior:bank` (32)** is the largest owner and still completely untouched.
  I opened it and stopped. The dominant cluster is **16 faces on one 48 × 40
  `concreteT` canvas**, and it is NOT a plain `boxFaces` job: `concreteMat` tiles
  at `Math.max(1, Math.round(m / 1.3))`, and that `max(1, round())` is the actual
  bug — a 0.28 m end cap cannot get the 0.215 repeat it wants and is clamped up to
  1. Removing the clamp fixes the slivers and **shifts form-board band alignment
  on walls the player sees**, so it needs a visual pass, not a one-liner. That is
  a judgement in someone else's room and I did not want to half-do it.
- **`interior:jail` (20)** is second largest and the row has never mentioned it.
- **`?` (19 unattributed)** — you cannot ratchet what you cannot attribute. Still
  wants its own row, as w104 said.
- **The ratchet's re-attribution flaw** (ninetyfive: a room moving relabels a face
  and reads as a regression) is still there. I hit no case of it.

## Derived, not retyped

Every dimension I passed to `boxFaces` is the same expression already passed to
the `BoxGeometry` on the adjacent line — `JAIL.RECESS + 0.06`, `JAIL.DOOR_W`, and
the hotel's `w, h, d` parameters. **No number was copied.** `BOX_FACE_DIMS` and
the 48 px/m come from `ct/paint.ts` and `FABRIC_PPM` by import, not by hand
(BUILDER-BRIEF §8).

## Green

`tsc --noEmit` **0** · `npm run build` **0** ("built in", checked — GOTCHAS 77) ·
`texdensity.mjs` **exit 0**, 155 gross, "no owner got worse" · `--selftest` both
cases caught · `health.mjs` **exit 0**, WORLD OK · `bugsweep.mjs` **exit 0**,
96 shots, **0 STATION MISS, 0 COVERAGE**.

**Geometry proven unchanged rather than screenshot.** `fp`/`fpdiff` cannot
possibly work here — my change adds **21 texture clones**, which shifts the seeded
`Math.random` stream `generateUUID` draws from (GOTCHAS 75). So
`scripts/probes/w102-geomdiff.mjs`, which asserts on the multiset of geometry
signatures:

```
8615 objects before, 8615 after
IDENTICAL as a multiset — no mesh added, removed or resized.
5 of 8615 position entries differ — Mesh@±6.00,0.14,z, drifting 1 cm
unique textures 1690 -> 1711  (+21 clones)
```

**Those 5 are exactly the documented noise floor** — the same 0.42 m puddle planes
on the x = ±6 sidewalk lines, at the same 1–3 cm, that w102 measured by dumping
the *same* build twice. Not 4–6 pigeons; 5 puddle planes. Same class, same
magnitude, same coordinates.

**I did not walk anything, and here that is a conclusion rather than an
omission.** Both changes are texture coordinates only; the geometry multiset is
identical and no collider, seat or floor expression was touched, so collision and
floors are unchanged *by construction* and a walk could only have re-measured the
world's pre-existing state. The threshold is a walked surface, which is why I
stood on it and photographed it — but its box is byte-identical.
