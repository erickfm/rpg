# w107 — item 273, *"some bookshelves are flat?"*

Worker **onehundredseven**. Port **4188**. Measured on the **BUILT BUNDLE**.
`src/proto/ct/int-library.ts` only.

---

## The row's stated cause is wrong, and it matters which

The row points at `ct/int-library.ts:302-308` — the ±π/2 book-plane rotation
this file was bitten by once before and wrote down. **Every book plane in the
room is oriented correctly.**

`scripts/probes/w107-library-blank.mjs` reads all **123** of them and reports
their world normals: **103 face along x** (across an aisle, where a
free-standing bay's books belong) and the **20 that face along z are the
back-wall run's**, which is where *its* books belong. **Not one is on the end of
a bay pointing down an aisle.** All three `wallRun` call sites pass the correct
`along`/`face` pair, including the one item 115 moved. That bug is fixed and
stayed fixed.

## The root cause, in one line

**The bay END is `BoxGeometry(0.52, 1.95, 0.06)` in flat `wood` — 1.01 m² of
untextured colour with nothing painted on it — and there are twenty of them,
standing square across the mouth of every aisle.**

- Census before: **47** blank untextured panels in the room; the twenty bay ends
  are **20.2 m²**, the largest blank thing in the room after the gallery deck.
- `shots/w107-lib-before-end.png` is three of them in a row across three aisle
  mouths. `shots/w107-lib-before-cross.png` is two of them filling the frame.

### …and item 115 doubled them, hours ago

Cutting the 1.70 m cross aisle was the right fix and its own measurements hold.
But **splitting five runs into ten stacks turns 10 end panels into 20**, and it
puts ten of them square across the route it had just built. The user's complaint
arrived after that relayout, and this is why.

## The fix — no depth, no box, no widening

The row is explicit and so is the previous author: the books are planes on
purpose and stay planes. What was wrong is that a face nothing painted was left
to be read as a face. Two things, both using tools this file already owns:

1. **Grain**, from A's `slabTex`, on the two big faces. This file's own note at
   `:218` says *"any large blank surface left in the room takes A's slabTex"* —
   the bay ends are the surfaces it was written about and never got it.
   **One shared material**: every end in the room presents the same
   0.52 × 1.95 m face, so 40 faces need one texture, not forty.
2. **A Dewey range plate.** Grain alone makes a nicer blank panel. A stack end
   in a real branch carries the band it holds, and that is what makes the object
   read as *the end of the 800s* rather than as a board — and it turns item
   115's cross aisle into something you can navigate **by** rather than only
   walk through. **0.36 × 0.22 m on a 54 × 33 canvas — exactly 150 px/m on both
   axes**, derived from the metres rather than accepted from a default (§7b),
   and denser than the room's walls for the same reason `shelfTex` is: it is
   read from a metre away.

Ten bands over ten stacks, ascending west to east and, within a run, from the
half you meet walking in from the hall to the half behind the cross aisle.
The `DEWEY` table is indexed by the loop, so a sixth run would fail to compile
rather than silently repeat the 800s.

**One signature widened:** `box()` now takes a material **array** as well as a
single material, which `THREE.Mesh` has always accepted. A bay end needs grain
on two **opposite** faces, which is one face more than `boxFace` can express and
no reason for a third helper.

**The wall runs' ends** take the same shared grain and **no plate** — a wall run
is not a range you walk into, and a sign on one would be a label on a wall.
Which face pair gets it depends on the run's axis (`ax ? endMatsX : endMatsZ`),
because a run along x is a (0.06, 1.95, 0.52) box whose big faces are ±x while
along z it is (0.52, 1.95, 0.06) and they are ±z. Both present the same two
metres, which is why one texture serves.

---

## How it was proved

| | |
|---|---|
| `scripts/probes/w107-library-stacks.mjs` | **11/11, five runs, zero spread** |
| blank untextured panels in the room | **47 → 23** |
| blank bay ends in the stack block | **20 → 0** |
| aisle width, from the colliders | **1.55, 1.55, 1.55, 1.55** — unchanged |
| five walked routes | **5.19 – 5.36 m** |
| `npx tsc --noEmit` | clean |
| `node scripts/health.mjs` | `WORLD OK`, exit 0 |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, no new console errors |

`fp`/`fpdiff` **not run and not quotable**: this adds 20 meshes, so GOTCHAS §75
says it would report a catastrophe that is not there.

**The aisles are defended by measurement, not by assertion.** Item 115's note
says they must not be widened again, and this change stands 8 mm of plate proud
of a panel — so the check reads the collider pitch out of the world rather than
trusting the source constant.

### The plate check exists because you cannot see this bug by looking

`ctx.flat` is **not** double-sided. A plate turned the wrong way is
**invisible**, not backwards — GOTCHAS §41's mirrored-pair trap in its worst
form. So the check dots each plate's world normal against the direction away
from its own stack.

### I watched every assertion fail before I believed it

| mutation | result |
|---|---|
| **A** — bay ends back to flat `wood` | **10/11**, `blank bay ends: 20` |
| **B** — every plate at `rotation.y = 0` | **10/11**, and it names the **exact ten** that would be invisible, each with `dot −1` |
| **C** — `STACK_PITCH` 2.15 → 2.35 | **8/11**, `narrowest measured 1.75` |

All three reverted; the tree re-verified **11/11 on five consecutive runs**.

Mutation C's two extra failures are honest collateral and worth naming: the
probe derives `RUN_X` from the **cited** 2.15 pitch, so two runs fall outside
its ±0.4 m window and it finds 12 plates instead of 20. It is not pretending the
plates vanished — it is saying the runs are not where the source says they are,
which is also true.

## My own verdict on the after-frames

- `shots/w107-lib-before-hall.png` → `after-hall.png` — his vantage. Before: a
  row of blank brown slabs between the runs. After: every stack end carries a
  small white plate and the panels have timber grain; the block reads as a set
  of numbered ranges.
- `shots/w107-lib-before-end.png` → `after-end.png` — **the one I would show him
  first.** Three blank boards become `100–199 PHILOSOPHY`, `300–399 SOCIAL SCI`,
  `500–599 SCIENCE`.
- `shots/w107-lib-before-cross.png` → `after-cross.png` — standing in item 115's
  cross aisle. The two slabs that filled the frame are now `100–199 PHILOSOPHY`
  and `000–099 GENERAL`, readable and correctly handed on both sides.
- `after-aisle.png`, `after-westwall.png` — unchanged, as intended. The
  periodicals run already read well and was never the complaint.

**Honest reservation:** the plate is 0.36 m wide and the band is legible from
about 4 m; from the reading tables at the far end of the hall it reads as *a
white card*, not as a number. That is right for a stack-end sign and I would not
make it bigger, but it means the frame from the hall shows the fix as texture
rather than as text.

## Found and NOT fixed — for the desk

1. **The gallery is now the room's largest blank surface**: two panels of
   **16 m² each** at (1086.94, 3) and (1089.86, 3) in `#4a3826`, plus **7.8 m²**
   at (1086.99, 2.25) — the deck's fascia and stair cheeks. They are the top of
   the census now that the bay ends are painted, and they are in shot from the
   hall (`shots/w107-lib-after-hall.png`, right-hand side). Same class as this
   item, different object, and **not named by this row**.
2. The remaining blank panels in the census are all **hidden by construction**
   and want nothing done: the two wall runs' back boards (10.14 m² and 8.58 m²,
   against their walls) and the ten 5.85 m² spine boards inside the bays.
