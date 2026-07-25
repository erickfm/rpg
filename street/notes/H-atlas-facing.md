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

## READING `offset.x` ALONE IS AMBIGUOUS — you need `repeat.x` too

`3ca7e6d0` builds a guard on `map.offset.x` with the table *"0.0 front, 0.2
three-quarter, 0.4 profile, 0.6 3/4 back, 0.8/1.0 back"* and a bar at 0.25. That
mapping holds for the unmirrored half only, because `ct/citizens.ts:425-426`
stores a mirrored frame as `repeat.x = -1/5` and `offset.x = (col + 1) / 5` —
the offset moves to the far edge and the repeat runs backwards.

So three of the five offsets mean two different things:

| `offset.x` | unmirrored (`repeat.x > 0`) | mirrored (`repeat.x < 0`) |
|---|---|---|
| 0.0 | front | — |
| 0.2 | 3/4 front | — |
| **0.4** | profile | **3/4 front** |
| **0.6** | 3/4 back | profile |
| **0.8** | back | 3/4 back |

**The live consequence:** a keeper showing a three-quarter front from the
mirrored side reads as `0.4`, which that guard classifies as profile and FAILS —
a keeper doing exactly the right thing, failed by the check written to protect
it. The other two collisions happen to land on the same verdict, so 0.4 is the
one that bites.

One term fixes it, and recovers the sector exactly:

```js
const off = m.map.offset.x * 5;
const sector = m.map.repeat.x < 0 ? 9 - off : off;   // 0 front … 4 back … 7 3/4 front
const facingness = Math.min(sector, 8 - sector);      // 0 = looking at you, 4 = away
```

`9 - off` because the mirrored sectors 5, 6, 7 carry columns 3, 2, 1 and so
offsets 0.8, 0.6, 0.4.

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
