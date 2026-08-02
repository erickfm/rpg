# w19 — the tyre's top is 0.66, and 0.68 is the circle nobody drew

Queue item 48. Commit `ea3353ff1`. Port 4184 (4180–4199 all occupied).
**Part (1) done. Part (2) BLOCKED — the file does not exist in this tree.**

## Root cause, one line

`0.68` is exactly `2 × TYRE_R`, so it was computed from the radius instead of
measured off the mesh — and a tyre is a low-segment cylinder, whose silhouette
is a polygon inscribed in that circle and short of it by the sagitta.

## Part (1) — measured, and the row was right

`scripts/probes/w19-tyre-top.mjs` selects tyres the way `K-tyre-has-arch` does —
a cylinder whose radius matches the car's own published `userData.tyre`, so two
unrelated filters have to agree — and reads the world bounding box:

    22 cars publish a tyre radius
      #8a5a5a   R 0.34   4 tyre mesh(es)
          tops    0.8034
          bottoms 0.1566
          heights 0.6467   (= 2R if it is a full circle: 0.68)
    tyre top, across 8 distinct values: min 0.8034  max 0.8034

Those cars stand on the lot's paving at `KERB_H = 0.14` (confirmed separately —
`groundAt` over a lot car returns 0.14), so **the top is 0.8034 − 0.14 =
0.6634 m above the ground it is parked on**, and the mesh's own height is
**0.6467**. Every one of the 22 cars is identical to four decimal places, so
this is not a sample with spread — it is the number.

**The row's 0.66 is right and the file's 0.68 was wrong by 20 mm.**

### Three sites, not two — and two more that are a different quantity

The row says 0.68 appears "in two places". It appears in **five**, and they are
not all the same claim, which is the part worth carrying forward:

| line | text | verdict |
|---|---|---|
| 200 | "tyre **0.68 m tall**" | height → **corrected to 0.65** (0.6467) |
| 244 | "THE TYRE'S TOP IS AT **0.68**" | top → **corrected to 0.66** |
| 948 | "tops out at **0.68**" | top → **corrected to 0.66**, and its "stands 18 cm proud of the floor" follows to 16 cm |
| 232 | "a tyre 0.68 m **across**" | **left** — nominal diameter |
| 251 | "for a **0.68 m** tyre" | **left** — nominal diameter |

The last two are the same trap as `REACH_MARGIN` 0.6 versus `seat-facing`'s
`REACH` 0.80, one item ago: **two different quantities wearing the same number.**
Rewriting them to 0.65 would have been wrong in the other direction — 0.68 *is*
the nominal diameter the arch geometry is derived from in code. They are now
labelled as such rather than silently left to be "fixed" by the next reader.

I recorded the whole finding at `g.userData.tyre` — where the radius is
published — because that is where somebody will next be tempted to write
`2 * tyre` and get 0.68 again.

### Why 20 mm mattered enough to be an item

Item 47 costs the first step of a climbing route onto a car at a **28 mm**
margin and the next at **31 mm**. An error of 20 mm is most of the thing it is
being compared against. This is the number that item would have reasoned from.

## Part (2) — BLOCKED, and it is the third item tonight with this root

`scripts/w13-bed-check.mjs` **does not exist in this checkout.** Nor does the
`maxY` it is said to test: `src/proto/fp.ts:9` defines
`AABB = { minX, maxX, minZ, maxZ }` — colliders here are 2D rectangles with **no
height at all**, so there are no "5 standable boxes" to disambiguate between and
no box to flatten.

That is the same absence that blocked items 46 and 47 (`notes/BLOCKED-w19.md`):
w21's standable-surface work has not reached `add-stick-and-city98`.

**I did not confirm w21's tag change "is right and complete", because there is
nothing here to confirm it against.** Reading a diff I cannot run is not
confirming it, and saying otherwise would be the silent workaround.

## Found and NOT fixed

- **The tyre does not touch the ground.** Bottom at world 0.1566 against paving
  at 0.1400 — it floats **16.6 mm**. `eaec0710f` is titled "Jacked car: grounded
  wheels touch down like the rest of the fleet", so this looks like a real
  residue of the same class rather than an intended clearance. Not mine, not in
  the item, and it is smaller than the facet error I just corrected — but it is
  the same order as item 47's margins, so somebody costing a climb should know.
- **The five-way split above is why this item existed at all.** A grep for
  `0.68` in `cars.ts` cannot tell a height from a diameter, so the next sweep
  will re-flag lines 232 and 251. They now say why they are correct.

## Verdict

Comments only in `cars.ts`; no code line changed. `npm run build` clean,
`K-tyre-has-arch` still green ("all good"), the probe re-measures identically
after the edit, and `scripts/aimed.mjs` is green. No after-images apply — the
world is untouched by construction.
