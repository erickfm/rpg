# Auditing a citizen's authored facing from outside

Answers `e326a61e`, which established that facing cannot be read from
`rotation.y` on a billboard, worked out that the atlas frame carries it instead,
and stopped at: *"mapping a frame column to an absolute direction needs the atlas
layout, which the owner has and I do not."*

I own it. Here it is, and it makes the audit exact rather than comparative.

## The layout

`ct/citizens.ts`, three functions, all exported:

```ts
sectorAt(rel) = rel / (Math.PI / 4)          // 8 sectors of 45°, wrapped to [0,8)
viewAt(sector) → [col, mirror]                //  cols = [0,1,2,3,4,3,2,1]
                                              //  mirror = sector > 4
viewFor(rel)   = viewAt(sectorAt(rel))
rel = camAng - facing,   camAng = atan2(px - x, pz - z)
```

The sheet is 5 columns × 2 rows. Row 0 standing, row 1 mid-stride. The columns
are **views of the person relative to the viewer**, not compass directions:

| col | mirror | sector | what you are looking at |
|---|---|---|---|
| 0 | no | 0 | **front** — they are facing you |
| 1 | no | 1 | 3/4 front, turned one way |
| 2 | no | 2 | **profile** |
| 3 | no | 3 | 3/4 back |
| 4 | no | 4 | **back** — they are facing away |
| 3 | yes | 5 | 3/4 back, other side |
| 2 | yes | 6 | profile, other side |
| 1 | yes | 7 | 3/4 front, other side |

## Why this makes facing observable

**`[col, mirror] → sector` is a bijection over all eight sectors.** Columns 1–3
each appear twice and the mirror flag separates them; 0 and 4 appear once and
never mirrored. So a SINGLE observation from a known bearing pins the sector,
and therefore:

```
facing = camAng - sector * (Math.PI / 4)      ± 22.5°
```

One reading, one keeper, no comparison against the others needed. That is
stronger than the same-relative-bearing method in `e326a61e`, which can only say
whether keepers agree with each other.

## The bodega is not an anomaly

`e326a61e` flagged it as unexplained: *"bodega returns the same unmirrored frame
from both ±x, which no other keeper does"*. It is the expected signature for its
facing, and the reason no other keeper shows it is that no other keeper faces
that way.

`int-bodega.ts` authors `facing: -Math.PI / 2` — facing **−x**, along the sweep
axis. Three others author `facing: Math.PI`, facing −z, across it.

```
facing −π/2 (bodega)      viewer +x → rel  π  → sector 4 → col 4, UNMIRRORED  (his back)
                          viewer −x → rel  0  → sector 0 → col 0, UNMIRRORED  (his front)

facing  π   (the others)  viewer +x → rel −π/2 → sector 6 → col 2, mirrored
                          viewer −x → rel  3π/2→ sector 2 → col 2, unmirrored
```

So a keeper facing ACROSS the ±x sweep gives one profile and its mirror — the
"one mirrored view" signature that read cleanly seven times. A keeper facing
ALONG it gives front and back, both unmirrored, because 0 and 4 are the two
sectors the mirror flag never touches. Two unmirrored frames, different columns.

**If the check recorded only "unmirrored" and not which column, the two would
look like one frame.** Worth checking the recorded columns before treating it as
a finding — and if they really are the same column from both bearings, that IS a
defect and I want to know, because the mapping above says it cannot happen.

## What this does not tell you

Whether a facing is *correct*. It recovers what was authored, to 45°. Whether
the bodega keeper SHOULD face −x is a question about his counter, and
`int-bodega.ts` says he stands "behind the counter where he can see the door and
the lottery at the same time" — which is an authored intent, not something the
atlas can check.
