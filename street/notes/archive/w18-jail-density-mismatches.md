# w18 — the 39 jail density mismatches (queue item 27)

**Root cause, one line:** they were never defects — a face that is not a whole
number of texels cannot draw at exactly its declared px/m, and `masonry.mjs` was
comparing against the density that was *asked for* instead of the one the
whole-texel canvas *achieved*, which the stamp has published all along.

**`ct/jail.ts` needed no change. The jail masonry is correct.**

## The count

| | |
|---|---|
| as filed | 39 |
| re-measured now (build `64b63cf5a`) | **16** |
| of those, whole-texel canvas rounding | **16** |
| **faces actually authored at the wrong density** | **0** |

The seam work *did* land and *did* help — `d3770c506` (*size every masonry face's
texture to the face it is on*), `45a93b7a9` (*derive the trim's density from the
wall, not a chosen 32*) and `d1847bb20` closed 23 of the 39. The residual 16 are
a different thing entirely and no amount of jail work will move them.

## Two things the item got wrong

1. **The named script is not the one that produces this number.** The item names
   `scripts/seampairs*`. `seampairs.mjs` compares a face against *its neighbour*;
   it currently reports `brick vs brick, a real seam question: 0` and
   *"no two faces that should draw the same brick draw different brick"*, and its
   `--selftest` passes. The declared-vs-mapped number comes from
   **`scripts/masonry.mjs`**, which the item does not name.
2. **"Possibly one underlying jail-masonry cause rather than two"** — no. There
   is no jail cause at all. The clustering at the jail is a red herring: the jail
   is simply where the thin faces are.

## Why 16 of 16 are arithmetic, not defects

`tex-world.ts:153` sizes every masonry canvas as `W = round(wMeters × ppm)`. All
sixteen are reproduced exactly by that one expression:

```
at 62.9,11.5,-103 | face 14×0.6   | canvas 224×10  | ideal 224.00×9.60   | rounded? true
at 69.8,2.3,-109.9| face 0.2×4.6  | canvas 3×74    | ideal 3.20×73.60    | rounded? true
at 69.8,12.4,-96.1| face 0.2×2.4  | canvas 3×38    | ideal 3.20×38.40    | rounded? true
   … 16 of 16, no exceptions
```

A 0.6 m band at 16 px/m wants 9.6 px and gets 10, so it measures 16.67. You
cannot paint 9.6 pixels, so **there is no world change that fixes this.**

And the residual error is bounded by `0.5 / faceMetres` — which is why a *fixed*
0.6 px/m tolerance is the wrong **shape**, not merely the wrong number. On the
0.2 m jamb the quantisation floor alone is 2.5 px/m, so that face must be
reported broken no matter how correctly it is authored.

## This was already ruled on, and the ruling predicted this row

`665629c5a`, 2026-07-25, *"Desk ruling on masonry rounding"*:

> THAT 1.79% IS THE FINDING. […] rounding noise alone sits a whisker inside the
> tolerance — **one unluckier face and that check goes red on a surface behaving
> exactly as the desk just ruled it should. The tolerance would then get widened,
> which is how a check stops being able to catch the thing it exists for.**

That is this item, called a week early. The same commit shipped the remedy:

> `userData.masonry = { ppm, ..., ppmW: W/wMeters, ppmH: H/hMeters }`
> `ppm` is what was asked for; ppmW/ppmH are what the whole-texel canvas got. **A
> checker wanting to catch a face authored at the WRONG density compares against
> ppmW/ppmH** and keeps the declared value for "what was intended".

`masonry.mjs` was the one checker that never did. So I did **not** widen the
tolerance — the ruling explicitly names that as the trap. I changed which field
is compared.

## What I changed

`scripts/masonry.mjs` only:

- carries `ppmW`/`ppmH` into each row (read from the stamp, not re-derived);
- adds the verdict **`FACES ACTUALLY AUTHORED AT THE WRONG DENSITY`**, measured
  against achieved density — currently **0** — while still printing the 16 and
  labelling them as rounding, because that number is real information;
- adds `--selftest` and an **exit code**, so it can guard instead of only narrate.

Verified: `--selftest` doubles one face's `repeat.x` and the verdict goes to 1
(`achieved 8.02×8, measured 16.04×8`) while the 16 stay classified as rounding —
so the new check discriminates rather than just counting. Without the mutation it
is 0 and exits 0.

## What I did NOT do

- **I edited a file my item does not name.** The item grants
  `scripts/seampairs* + ct/jail.ts`; the fix belongs in `scripts/masonry.mjs`.
  I took it because the item's whole acceptance test is about a number only that
  script produces, no queue item names it, and the change is the direct
  application of a landed desk ruling. Flagging it rather than burying it.
- **`declared OFF the 8/16 grid: 1`** — `32 px/m at (8.3, 0.1, -77)`. Untouched,
  unexplained, and not part of this row. It is the single `mult 4` stamp. Worth
  a one-line item to confirm it is intended.
- **The 22 UNJUDGEABLE faces in `seampairs`** (undeclared surfaces touching
  masonry, all off-grid) are still unjudgeable; `seampairs` names the three faces
  and the one-line `declareSurface(...)` fix. Not mine, not this row.
- I did not verify the historical **39** myself — it would mean building and
  serving a pre-seam tree. The 16 and their cause are measured on this build.

Ports: 4193 (dev). My assigned 4197 was already serving another builder's world.
