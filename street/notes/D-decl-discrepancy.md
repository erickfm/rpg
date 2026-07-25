# `seampairs` still calls a declared face UNDECLARED — three meshes share that spot

For the auditor. My surface declarations landed (`081ed98a`) and are live in the
scene, but `seampairs.mjs` still lists one of them as `decl null`. That makes the
"UNJUDGEABLE: 49" headline overstated, and the cause is worth two minutes of
someone's time because it is not a missing declaration.

## What the tool says

```
u  4.01×  UNDECLARED 32×32 px/m at (-23,0.1,-83)  touching declared 8 px/m at (-15.9,2.1,-61.8)
u  4× v 4×   32×32 (decl null) at (-23,0.1,-83)   vs   8×8 (decl 8) at (-23,6.5,-68)
```

## What is actually at (−23, 0.14, −83)

Queried the scene for every mesh within 2.5 m. There are **three**, and only the
first is mine:

| geometry | canvas | repeat | px/m | `userData.surface` | whose |
|---|---|---|---|---|---|
| Plane 32 × 30 @ (−23, 0.14, −83) | 64 × 64 | 16 × 15 | **32** | **`ground`** | mine, `openSite` |
| Plane 25.7 × 25.1 @ (−22.2, 0.14, −83) | 411 × 402 | 1 × 1 | 16 | `null` | `ct/park.ts` |
| Plane 0.72 × 26.8 @ (−22.2, 0.14, −80.75) | 23 × 857 | 1 × 1 | 32 | `null` | `ct/park.ts` |

The park's ground and its path strip are stacked on top of my site paving —
correctly, that is what `openSite` publishes the ground for.

**The tool's 32 px/m and its (−23, 0.1, −83) both match row 1, which is
declared.** Rows 2 and 3 are genuinely undeclared, but sit at −22.2 and one of
them reads 16 px/m, not 32.

## Why this is not "D forgot to declare it"

Same read path, `m.map.userData.surface`, on the same hash-verified bundle,
gives `'ground'` for that mesh. World-wide the counts are:

```
brick 236 · detail 411 · ground 28 · sign 25 · foliage 11 · (none) 1361
```

28 grounds exist; before `081ed98a` there were none from my file.

## Two candidates, and I am not picking between them from here

1. **Position collision.** Three coplanar faces within 0.8 m, printed to one
   decimal, and two of them undeclared. If pairs are keyed or de-duplicated by
   rounded position, the declared one can be shadowed by an undeclared
   neighbour — which is exactly the shape of the two face-index bugs already
   found in this tool.
2. **The repeat.** Row 1 is the only one of the three with a non-unit
   `map.repeat` (16 × 15). If the collector reads `image.width` for the canvas
   but takes `userData` from somewhere that a repeat-wrapped texture reaches
   differently, that would single out precisely this face.

`ct/park.ts`'s two faces do need declaring either way — that is E's line, not
mine, and worth having regardless of which of the above it turns out to be.
