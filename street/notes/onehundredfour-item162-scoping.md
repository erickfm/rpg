# onehundredfour / item 162 — SCOPED AND RELEASED, because the row's three numbers are all stale

**I did not do this item. I measured it, and every figure the row navigates by
has moved.** Released for the next builder with the real numbers, per
BUILDER-BRIEF §6 (*"a queue item is a hypothesis, not a finding"*).

Measured on the **built bundle**, port 4187, build `ad19f527a`.

---

## The row says three things. One is right.

| the row | measured today |
|---|---|
| "the **188** gross-density faces" | **168**. The ratchet's own baseline line reads `backlog: 168 gross faces (baseline 169, recorded 2026-08-03)` |
| "worst offenders: **civic 39**, `interior:bank` 32" | **civic is 14** — the run even prints `IMPROVED since 2026-08-03: civic: 21 -> 14`. `interior:bank` **32 is correct** and is now the largest single owner |
| "**a 30 × 0.22 m face drawing 0.27 px/m at (-7.1, 0.1, -83)** — worth looking at first because it is a single face" | **that face does not exist.** Zero faces in the world draw `0.27 px/m`. The nearest thing at that spot is `(7.1, 0.3, -83.5)` — note the **sign flip on x** — and it draws **528 × 32 px/m**, a different defect of a different magnitude |

**So the one target the row says to start with is gone, and the category it says
to start with second has already been cut by 64%.** Anyone working this row from
its text spends their first half hour hunting a face that was fixed.

## The real ranking, from the run

```
FACES DRAWING A STRETCHED TEXTURE (>= 4x): 168

by owner:  interior:bank 32 · interior:jail 20 · ? 19 · props 14 · civic 14
           interior:pawn 10 · interior:hotel 9 · interior:burger 9 · lot 8
           interior:casino 8 · tex-ground 6 · interior:diner 5 · street 4
           interior:church 3 · interior:thrift 3 · interior:bodega 2 · jail 1
```

Worst single face is now **184.8x** — `8.33 × 1540 px/m` on a 2.4 × 0.05 m
`ground` face in **jail** at `(61.3, 0.2, -103)`. That is the "single face worth
looking at first" the row wanted, updated.

**`?` = 19 faces with no owner attributed.** Worth a row of its own: you cannot
ratchet what you cannot attribute.

---

## ⚠ THE LIVE SIGNAL THE ROW CANNOT KNOW ABOUT: the ratchet is RED on a regression

```
REGRESSION — these owners gained stretched faces:
   interior:hotel: 3 -> 9
```

**Traced to `a60a6e8f5` — "Item 96: the hotel's upholstery has a weave", landed
today, 05:45.** It came in with mainline; it is not in-flight.

**And it is a DELIBERATE, DOCUMENTED TRADE, not a mistake — do not "fix" it
without reading the commit first.** w97 states the reasoning in the source:

> SIZED TO THE LARGEST FACE, NOT TO THE TOP. `slabTex` sizes from a w×d and maps
> 1:1, and a backrest's TOP face is a 0.1 m sliver — sizing to that and letting it
> stretch across the 0.52 × 0.5 face you actually look at is BUILDER-BRIEF §7b's
> "0.2 m end caps wearing a 9.65 m run" with the numbers reversed.

**The mechanism, read in the source rather than guessed** (`int-hotel.ts:283-287`):
`fabric()` builds **one** material from the two largest dimensions and hands it to
the **whole box**. three.js gives `BoxGeometry` per-face 0..1 UVs, so that one
sheet stretches to fit each face independently. For `fabric(0x3f5449, 0.85, 0.42, 2.1)`:

| face | sheet is 2.1 × 0.85, so |
|---|---|
| 2.1 × 0.85 | 1:1 — correct, and it is the face you look at |
| 2.1 × 0.42 | stretched ~2x on one axis |
| 0.85 × 0.42 | stretched |

w97 chose the visible face and accepted the slivers. **Given one sheet per box
that choice is right.** The gross count rose because the faces went from
*untextured* (unmeasurable) to *textured and stretched* (measurable) — which is
partly the instrument seeing more, not only the world getting worse.

**The correct fix, and it is squarely BUILDER-BRIEF §7b** (*"every textured
surface declares its density and derives its repeat from its OWN dimensions"*):
give these boxes a **six-material array**, one `slabTex` per face pair sized to
that pair's own dimensions. A box has three distinct face sizes, so it is **three
textures per box, not six**. Six call sites: `int-hotel.ts:597-600, 1033, 1036`.

**I did not do it**, and the reason is not that it is hard: it needs a visual
pass to confirm the bottle-green and the three deliberately mismatched chair
colours survive — w97's own note says *"once a map arrives the material reads
`#ffffff` and only a picture can tell you the green survived"* — plus a
`texdensity` re-run and a look at `w96-hotel-suite-look.mjs`. That is more than I
could verify honestly with what I had left, and half-doing it on another
builder's just-landed file is the cross-builder conflict PARALLEL-WORKFLOW §11
is about.

---

## What the next builder should be handed

1. **Restore the ratchet first**: `interior:hotel 3 → 9` is the only thing making
   the check red *as a regression* rather than as a backlog. Six call sites, one
   file, mechanism diagnosed above.
2. **Then `interior:bank` (32)** — the largest owner, and the row was right about it.
3. **`interior:jail` (20)** is second and the row never mentions it.
4. **Re-baseline the row's text.** 188 → 168, civic 39 → 14, and delete the
   `(-7.1, 0.1, -83)` face — it is fixed.
5. **`?` (19 unattributed faces)** wants its own item.

**Item 161's dependency is satisfied** — `texdensity` is registered
(`checks.mjs:261`, `true`), runs, and the ratchet against
`notes/texdensity-baseline.json` is live and firing in both directions
(it printed both an IMPROVED and a REGRESSION line on the same run).

**One instrument note, in its favour:** `texdensity` exits **3** with
`MEASURING THE WRONG WORLD — serving build X, this checkout is at Y` when the
preview is stale. It caught me doing exactly that. That is GOTCHAS 48 defended
properly, and it is worth other checks copying.
