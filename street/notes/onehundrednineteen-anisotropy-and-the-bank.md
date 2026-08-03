# Item 266 — anisotropy is declarable, and the bank's cluster was not the clamp

Worker onehundrednineteen, 2026-08-03. Port **4750**, built bundle.

Files changed: `src/proto/ct/paint.ts`, `src/proto/ct/tex-ground.ts`,
`src/proto/ct/int-bank.ts`, `scripts/texdensity.mjs`,
`notes/texdensity-baseline.json`.

---

## The honest count the row asks for

| | |
|---|---|
| before | **155** gross faces (baseline 156) |
| **after** | **135** gross faces |
| of which | **8 are anisotropic BY DECLARATION**, counted and printed in their own category — not hidden |
| and | **12 were a real fix** in `interior:bank` (32 → 20) |

`IMPROVED since 2026-08-03: jail 1→0, tex-ground 6→2, interior:bank 32→20,
street 4→2, ? 19→17.` No owner got worse. Baseline re-blessed at **135**, so the
ratchet now holds the new floor.

---

## (1) `declareAnisotropic(t, why)` — and the reason is mandatory

`ct/paint.ts`. Worker onehundredsix was right: the eight worst faces in the whole
world are `castTex` drain rails at **36.1x, `15.84 × 571.43 px/m` on a
1.01 × 0.028 m rail**, and every one of them is correct. The sheet is three
horizontal bands — a bright worn row along the top arris, grit, a dark row —
**uniform across the rail by construction**, so the horizontal density is
arbitrary and the vertical density *is* the drawing. Sixteen rows over a 2.8 cm
arris is what makes the worn edge a 1.75 mm bright line. "Fixing" it would have
dropped the backlog by eight and thrown away the only detail on the kerb inlet.

**Design decisions worth arguing with:**

- **A REASON, never a boolean.** A bare flag is an off switch and gets reached
  for the moment a face is inconvenient; a sentence has to be true and the next
  reader can disagree with it. `texdensity` prints it verbatim.
- **It excuses ASPECT and nothing else.** A face that also declares a `ppm` is
  still enforced against it — being deliberately 1-D says nothing about being the
  right density.
- **The excluded faces are LISTED AND COUNTED**, with the line *"Delete the
  `declareAnisotropic` call and the face comes straight back into the count
  below. Nothing is hidden."* A silent exclusion is this guard going to sleep,
  which is the failure its own header is written about.

### MY FIRST SELF-TEST FOR THIS COULD NOT FAIL, and that is the useful part

I first asserted that stripping the declarations takes `gross` up by exactly
`excused.length`. **That is a tautology**: `gross + excused` *is* `stretched`,
and deleting a `userData` field cannot change how many faces are stretched. It
printed a confident green and proved nothing — the exact "check that cannot fail"
family this file's header exists to prevent, reproduced inside the guard against
it.

What has to be proved is **causation**. The test now re-applies `isExcused` — the
same rule that ships, hoisted into one place so it cannot drift — to a second
census of a scene with every declaration deleted, and requires:

```
selftest(266): 8 face(s) excused by 5 declaration(s). With every declaration
deleted: excused 8 -> 0, gross 148 -> 156 of 156 stretched.
selftest(266): caught it — the DECLARATION is what excuses those faces, and
nothing else is
```

**Watched red**, by mutating the shipping rule to leak
(`!!r.aniso || r.canvas[0] === 16`):

```
selftest(266): 13 face(s) excused ... excused 13 -> 13, gross 143 -> 143
SELFTEST FAILED — 13 face(s) are still excused with every declaration deleted,
so something OTHER than the declaration is excusing them.          exit 2
```

Reverted; green again. The other two verdicts' self-tests still pass unchanged.

---

## (2) THE ROW'S STATED CAUSE FOR THE BANK IS WRONG, and here is the measurement

The row: *"`interior:bank` (32 faces, the largest untouched cluster) IS NOT a
`slabBox` job. The bug is `concreteMat`'s `Math.max(1, round(m / 1.3))` clamp."*

**Half right and mostly wrong.** `texdensity --all`, grouped by canvas:

| canvas | faces | |
|---|---|---|
| **48×40** | **15** | the concrete |
| 64×20 | 6 | |
| 96×42 | 4 | |
| 72×36 | 4 | |
| 24×96 | 2 | |
| 24×64 | 1 | |

So the concrete is **15 of 32, not 32**. And of those 15, **12 never went through
`concreteMat` at all** — they came from `concreteM`, the plain *unrepeated*
material, `rep 1×1`, on the safe-deposit nest:

```
0.16 × 1.95 m  ->  300    ×  20.51 px/m   14.6x   (×6, the nest ends)
2.92 × 0.16 m  ->   16.44 × 250    px/m   15.2x   (×2, a nest top/bottom)
0.16 × 2.52 m  ->  300    ×  15.87 px/m   18.9x
0.16 × 1.60 m  ->  300    ×  25    px/m   12.0x   (×2)
```

`concreteM`'s own comment claimed those faces were *"never more than ~0.2 m of
any one, never what a player is looking at"*. **The ±y faces of that box are
`len` long, and `len` is up to 2.92 m** — wrong by an order of magnitude, and
that comment is why nobody looked again.

Only **3** of the 15 are `concreteMat` faces, and the clamp is not floored to 1
on any of them — they are the roof edge (`rep 3×2` on a 3 × 0.18 m face) and two
0.28 m jambs, i.e. **a repeat derived from a different face of the same box**,
which is a different fault from the one the row names.

### What I did: fixed the 12, and documented the clamp as deliberate

The DONE WHEN allows either. **I did not unclamp**, and the row's own warning is
why: whole repeats are what make the form-board pattern **close** at the top and
bottom of a wall run instead of cutting a board in half at the ceiling line.
Unclamping moves the band pitch on the east wall from 0.1875 m to 0.1625 m — the
"shifts band alignment on visible walls" the row warns about, and a change nobody
asked for on a surface the player stands in front of.

So there are two now, chosen per surface rather than per module:

```
concreteMat   a WALL.  Whole repeats; the bands close.
concreteFit   an EDGE. Exact fractional repeat; the density is right, and there
              is no band pattern on a 16 cm strip to close.
```

`sdbNest` now takes `concreteFit` per face. **The material order is the trap**
and it is the one this repo has paid for twice — `[+x,-x,+y,-y,+z,-z]`, where
`+x` spans DEPTH × HEIGHT and `+y` spans WIDTH × DEPTH — so every call reads
`BOX_FACE_DIMS` (`ct/paint.ts:136`) off rather than retyping the box's own
w/h/d. All twelve land at **36.9 × 30.77 px/m**, which is what the wall beside
them draws.

`concreteM` is deleted rather than left lying about: it existed only for this,
on a claim that was false.

### And I looked, from a standing position inside the vault

`scripts/probes/w119-266-vault-shot.mjs`, five stations from the vault centre,
before **and** after, the before from a real rebuild at `HEAD~1`:

- `shots/w119-266-vault-{before,after}-1-nests-w.png`
- `shots/w119-266-vault-{before,after}-2-nests-n.png`
- `shots/w119-266-vault-{before,after}-3-nests-e.png` ← the one that shows it
- `shots/w119-266-vault-{before,after}-4-tops.png`
- `shots/w119-266-vault-{before,after}-5-wall.png`

**My verdict, having looked at all ten:** the nest's end cap goes from a pale
band carrying two or three enormous aggregate blotches to a fine even grey that
matches the wall behind it — which is the defect and the fix. **And the vault
walls are unchanged in every frame**, which is the assurance the row actually
wanted: `concreteMat` was not touched, so no band alignment moved.

(The probe's first cut stood 1.1 m off a nest and filled the frame with bronze
doors — the one face of that box item 266 does not touch. It shoots from the
centre now. It also walked to a 7.68 m plane in the casino before the geometry
filter required `depth` to exist and the mesh to be past x 400.)

---

## Verification

| | |
|---|---|
| `npm run typecheck` | **0** |
| `npm run build` | **0** |
| `scripts/texdensity.mjs` | **0** — 135, baseline 135, no owner worse |
| `scripts/texdensity.mjs --selftest` | **0**, all three verdicts; the new one watched red at **exit 2** |
| `scripts/M-bank-int-walk.mjs` | **0** — **54 of 54 passed** |
| `scripts/density.mjs` | **0** |
| `node scripts/health.mjs` | **0**, `WORLD OK` |
| `npm run sweep` | **0**, `0 STATION MISS, 0 COVERAGE` |

## FOUND AND NOT FIXED

1. **The bank still has 20 gross faces and they are FIVE other canvases** —
   64×20 (6), 96×42 (4), 72×36 (4), 24×96 (2), 24×64 (1), plus the 3 remaining
   concrete. Worth a row each, or one row that says "the bank's remaining 20 are
   not one bug".
2. **The 3 remaining `concreteMat` faces are the `boxFaces` case, not the clamp
   case**: one material sized for a wall handed to a 0.18 m roof edge. `boxFaces`
   in `ct/paint.ts` is exactly the tool, but it needs `concreteT` to declare a
   `ppm`, and declaring one makes `texdensity`'s DECLARED verdict start judging
   every concrete face against it — including the wall faces the clamp
   deliberately rounds. That is a real decision, not a mechanical change, and it
   is the next thing to do here.
3. **`declareAnisotropic` is used once.** `barTex` and `throatTex` in
   `ct/tex-ground.ts` are the same shape of drawing and may deserve it, but
   neither appears in the gross list today, and declaring anisotropy on a face
   nothing is complaining about is loosening a check for its own sake (§7).
   Left alone deliberately.
4. **The row's "146 of 155 gross faces sit on a BoxGeometry with 103 carrying
   `rep 1×1`" is a ceiling, and it just went down by 12** — every one of those 12
   was a `rep 1×1` BoxGeometry face, and none of them wanted `slabBox`. The next
   builder should re-derive that number rather than working from the row's.

## Values: derived or copied

- the drain rails' reason string — **written**, and printed by the checker.
- `concreteFit`'s tile — **the existing `CONCRETE_TILE_M`**, not a new number.
- every face size in `sdbNest` — **read off `BOX_FACE_DIMS`**, not retyped.
- 155 / 147 / 135 / 32 / 20 / 15 / 12 / 3 — all **measured** with
  `texdensity --all` on the built bundle, before and after.
