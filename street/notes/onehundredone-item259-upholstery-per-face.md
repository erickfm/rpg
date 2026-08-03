# onehundredone / item 259 — the upholstery sheet, per face

**DONE.** `texdensity` **exits 0** and the baseline is re-blessed at the true
count. `interior:hotel` is back to **3**.

Root cause in one line: **`slabTex` maps 1:1, a material is shared by all six
faces of a box, and a box has three distinct face sizes — so one sheet is
correct for at most one of them.**

---

## Choosing which face to be wrong about was never the choice

Item 96's own comment named the hazard and then shipped it:

> *"⚠ SIZED TO THE LARGEST FACE, NOT TO THE TOP. `slabTex` sizes from a w×d and
> maps 1:1, and a backrest's TOP face is a 0.1 m sliver — sizing to that and
> letting it stretch across the 0.52 × 0.5 face you actually look at is
> BUILDER-BRIEF §7b's '0.2 m end caps wearing a 9.65 m run' with the numbers
> reversed. So the two biggest dimensions of the box are what the sheet is
> built for."*

The reasoning is right and the conclusion does not follow. A box authored
`(W, H, D)` has **±x = D×H, ±y = W×D, ±z = W×H** — **three** sizes. Sizing to
the largest avoids stretching one of them and hands that same 1:1 sheet to the
other four. The slivers drew **250 px/m against a declared 48**.

This is the **fourth** instance of the same shape found in one night (the church
treads, the bench seat, the park kerb, this), which is exactly why item 163
landed `BOX_FACE_DIMS` as the one written copy of that table.

## The fix — inside `fabric()`, nothing else touched

`fabric(col, w, h, d)` now returns **six materials**, one per face, each with its
own 1:1 `slabTex` sized to that face's own two metres, cached per distinct size
(so a box costs at most three canvases and usually two). `bx()`'s signature
widened to accept a material array. **All four call sites already passed the
box's own `(w, h, d)`**, so none of them changed.

**`boxFaces` was the wrong helper here and that is worth writing down.** It
clones ONE texture and sets `repeat` — right for a tiling sheet, wrong for
`slabTex`, whose output is `ClampToEdgeWrapping` and 1:1 **by contract**;
repeating a clamped texture smears its edge texels. `BOX_FACE_DIMS` is the half
of item 163 that applies, and it is the half the item told me to use.

**The appearance is not changed**, as the item requires: same `base`, same
`ppm: 48`, same `grain: 0.09`, same `joint: 0`. The `grain < 0.14` constraint
item 96 discovered the hard way (above it `slabTex` scatters 2 px pebbles — *"a
velvet sofa wearing gravel"*) is untouched and still noted.

---

## Measured

| | before | after |
|---|---|---|
| `interior:hotel` gross | **9** | **3** |
| world gross | 162 | **156** |
| declared faces ≥4× their declared density | 19 | **13** |
| `texdensity` exit | **1** (`REGRESSION — interior:hotel: 3 -> 9`) | **0**, `no owner got worse` |

Baseline re-blessed at **156**, with `civic: 21 → 11` and `props: 14 → 11`
folded in — those are worker onehundredtwo's improvements, which had been held
un-blessed on purpose so blessing would not bury this red. **That is why the
bless is part of this item and not of theirs**, and it is done only now that the
hotel is fixed, exactly as the row instructs.

## My verdict on the frames, which I have looked at

`shots/w101-hotel-{suite,chairs}-{before,after}.png`, standing eye height on the
customer floor, clock pinned to 13:00.

- **suite** — before, the sofa's tall back carries a visibly *finer* speckle
  than its own seat, because that face was wearing a sheet built for a different
  one. After, the grain is the **same size on the back and the seat**. Same
  bottle-green, same velvet character.
- **chairs** — all three still carry an even weave on seat and backrest, and
  **they still do not match each other**, which is the room's stated thesis and
  something the user asked for. Nothing was restyled.

## Verification

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `node scripts/texdensity.mjs` | **exit 0**, baseline 156, no owner worse |
| `node scripts/health.mjs` (built bundle) | `WORLD OK`, exit 0 |
| `scripts/interiors-walk.mjs hotel` | **29/30** (the 1 FAIL is the world-wide served-spot debt) |
| `node scripts/bugsweep.mjs` | 96 shots, 0 STATION MISS, 0 COVERAGE |

## FOUND AND NOT FIXED

1. **13 declared faces still draw ≥4× their declared density**, none of them the
   hotel's. They are newly *visible* rather than newly broken — item 163's
   declaration made them sayable — and each is a call passing a nominal size
   instead of a face's own.
2. **156 gross faces remain**, worst owners `interior:bank` 32 and
   `interior:jail` 20. Item 162's territory.
3. **`slabTex` cannot warn about this itself**, which is the real reason it keeps
   happening. It returns a texture with no idea what geometry it will land on. A
   `slabBox(w, h, d, opts)` in `ct/paint.ts` returning six materials — the
   generalisation of what `fabric` now does privately — would make the correct
   thing the shortest thing to type. **Fifth instance is the one to build it
   on**; four have now been fixed by hand.
