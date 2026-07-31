# The seated pose, first real use: what actually went wrong — for H and J

**The report:** *"the seated figure is intersecting the stool"*, casino slot
stools, `ct/int-casino.ts`. Fixed. Below is the cause, because the desk was right
that what turns up in the first adoption matters beyond the one figure.

## It was NOT the atlas, and it was NOT the placement rule

H's rule is right and needs no change. The hip offset of 0.445 m is right.
**Nothing to do at H's end, and no room that adopts the pose after me inherits a
bad number.**

The proof is inside the failing room, which is why I am confident rather than
merely hopeful. The casino has **five** seated figures:

| figure | seat registered | true top face | result |
|---|---|---|---|
| 4 slot players | 0.640 | 0.675 | **sunk 3.5 cm** |
| 1 entry banquette | 0.440 | 0.440 | **on the seat** |

Same atlas, same helper, same file, same one-line placement. The only difference
is **whether the seat told the truth about its own height**.

## The cause: one stool height authored twice

The stool cushion is a `CylinderGeometry(0.21, 0.21, 0.07)` placed at `y 0.64`.
So it spans 0.605 → 0.675 and its **top face is 0.675**. But `ctx.seat({ h: 0.64 })`
and the sitter both took **0.64 — the cylinder's CENTRE**.

A figure placed correctly on a seat that under-reports itself by half a cushion
sinks by half a cushion. That is the whole bug, and it looks exactly like a pose
problem from the outside.

**I added no y fudge**, per H's warning. The fix is that `STOOL_TOP` is now
declared once as the TOP face and the cushion is derived *downward* from it, so
the mesh, `ctx.seat()` and the sitter read one number and the cushion's thickness
can change without the seat height silently moving. Same for the taller stools at
the game tables, which had it too (0.08 cushion at 0.72, top 0.76).

## The sweep, as asked — and one finding that is not mine

`scripts/G-seated-check.mjs` compares, for every seated figure in the world,
`origin_y` against both the registered seat height and the true top face of the
solid under it.

**Checked every seated figure in all ten rooms. Wrong: 7. Now wrong: 3, none of
them mine.**

- **casino — 4 wrong, all fixed** (the above)
- **library — 3 still wrong, `ct/int-library.ts`, builder J.** Registered `h`
  **0.45** against a true top face of **0.475** — sunk **2.5 cm**, at world
  (914.4, −0.35), (917.6, 1.55), (922.6, 2.95). **Identical class to mine: the
  seat is registered half a cushion below its own top face.** J, this is a
  one-constant fix at your end and it is not H's pose.
- church, hotel, tax, diner: their seated figures measure **on the seat**.

**So it is not the placement rule** — 2 of the 9 real seats in the world
mis-report their own height, and the rule worked everywhere the seat was honest.

## Verified by sitting, at the station he used

- took the seat: prompt goes `[E] sit at the slot` → `[E] stand up`, so
  `rig.seated` flipped. **`pos()[1]` is a constant eye height by design and
  cannot answer "did I sit"** — I checked what I was measuring this time rather
  than reading a number that never moves as evidence.
- then stood in the avenue a stride away and looked at a sitter side-on, which is
  how he found it: `shots/G-casino-sitter-sideon.png` — hips on the cushion, legs
  down to the foot ring, no intersection.
