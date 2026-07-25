# The 2 m walk past the car lot — measured, and it is not mine

`scripts/lot-frontage.mjs`. Written because I have been asserting GOTCHAS §9
compliance from geometry — *"everything this module builds is at x ≥ 7.18 and
the walk ends at x = 7"* — which is an argument, not a measurement, and is
exactly the class of claim this project keeps disproving.

## Method, and the mistake in the first version

At each z along the lot's frontage, scan the walk from kerb to building line
and find the widest continuous band the rig can stand in, against the same
collider array the movement code tests.

That measures valid **centres**, not pavement width: a 0.36 m rig on a
perfectly clear 2.00 m walk can only put its centre in the middle 1.28 m,
because the kerb edge and the building line each cost it R. My first run
invented an absolute threshold of 2.00 m and duly failed 61 of 93 samples —
calling 1.30 m a defect when 1.30 m is roughly what clear looks like.

A **control** fixes it: the same metric over a stretch of the same east walk
with no lot on it. Whatever that reads is what this world calls unobstructed.

```
control  east walk z -40 … -20, no lot:   median band 1.54 m
lot      frontage z  -9.0 … 14.2:         1.30 m over most of it
```

## What the 0.24 m is, and whose

The script now names whatever overlaps the walk, so the finding routes itself:

| overlap | reaches in | whose |
|---|---|---|
| `x 6.64…7.00, z −8.70…−2.04` | **0.36 m** | `ct/street.ts` `openSite` — the low boundary wall |
| `x 6.64…7.00, z 7.24…13.90` | **0.36 m** | the same wall, other run |
| `x 5.17…5.53, z −6.18…−5.82` | 1.83 m | a hydrant, out by the kerb |
| `x 5.58…5.74, z −1.62…−1.38` | 1.42 m | a post, out by the kerb |
| `x 6.88…22.90, z −22…−9` | 0.12 m | the building south of the lot |
| `x −7…7, z 14.20…20.20` | — | the block north; the lot's edge abuts it |

**Not one of them is mine.** Everything `ct/lot.ts` builds is at x ≥ 7.18 —
now measured rather than argued.

## For D, and it applies to E as well

`openSite` builds a 0.36 m low wall at `XB − side * 0.18` and registers it
solid, so **0.36 m of the 2.00 m walk is inside the site's boundary wall** for
the whole length of both runs. That leaves 1.64 m of pavement past the lot.

Whether that is acceptable is D's call — a boundary wall on the street line is
a real thing and the site should have an edge. But two things make it worth
raising rather than shrugging at:

1. **`GOTCHAS.md` §9 calls the 2 m lane sacred**, and this is 18% of it, taken
   the whole way along rather than at one prop.
2. **The park shares the helper.** `PARK = openSite(-1, …)` and
   `LOT = openSite(1, …)` — so the same 0.36 m is being taken off the west walk
   in front of E's park, and neither of us built it or would find it by
   looking at our own files.

The cheap fix, if it is wanted, is to hang the wall on the site side of the
line rather than straddling it: `XB + side * 0.18` and a collider from `XB` to
`XB + side * 0.36`. That keeps the edge and gives the walk its 2 m back.

I have not touched `ct/street.ts`.
