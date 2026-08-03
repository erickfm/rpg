# Item 162 — the worst face in the world, and what the rest of the backlog is made of

Worker ninetyfive. `src/proto/ct/park.ts` + `notes/texdensity-baseline.json`,
commits `30c9c631e` and the bless below. Measured on the **built bundle**, port
4510.

**This item is NOT finished.** It is a 188-face backlog; I took the single face
the row named as the priority, diagnosed the two categories behind it, found a
flaw in the ratchet itself, and left the check GREEN at the improved number so
the next builder starts from 187 rather than from a red board. Details below are
written so the next person does not have to re-measure any of it.

---

## Done: the 16363x face (the row's own "look at this first")

`(-7.1, 0.1, -83)`, a 30 × 0.22 m face drawing **0.27 × 4363 px/m** — about four
thousand times coarser along its length than the room standard, and by a
distance the worst single face in the world. It is the **park kerb**
(`ct/park.ts:377`).

**Root cause in one line: it was a correct number applied to the wrong faces.**

`kerbT` is authored for the kerb's TOP — an 8 × 64 canvas standing for 0.25 m of
width and 2 m of run, `repeat(1, W/2)` — which on the top face is 33 px/m across
and 32 px/m along. Square, and that **32 px/m is where this kerb declares its
density**. But a `BoxGeometry` with ONE material hands the same mapping to the
±x faces, whose axes are the 30 m LENGTH and the 0.22 m HEIGHT, so `u` spread 8
texels over 30 m and `v` packed 960 into 0.22 m.

Each pair of faces now takes a material whose repeat is derived from that face's
own metres at the same 32 px/m (§7b), via a `kerbFace(w, h)` helper. Group order
is `[+x, −x, +y, −y, +z, −z]`. The top keeps `kerbT` untouched.

**The side canvas draws its 1 m joints along `u`, not `v`** — on the side the run
is `u` where on the top it is `v`. Reusing the one canvas for both is exactly
what would lay the joints *across* the kerb instead of along it, which is the
trap in this kind of fix.

| | before | after |
|---|---|---|
| gross faces | 188 | **187** |
| owner `?` | 21 | **19** |
| worst face in the world | 16363x | 184.8x (the jail's) |

Two faces fixed; the net is −1 because of the re-attribution below.

## The ratchet has a flaw: re-attribution reads as regression

The check was **already red before I touched anything**, on
`interior:jail~: 0 → 1`, while `?` went 21 → 20 and **the total stayed at 188**.

`texdensity.mjs:174` labels a face by its NEAREST room when it falls outside
every room box — `'~'` means "just outside its box". So a room landing in
mainline (`apt301` is new) moved one face at `(999, 2.6, 994.4)` from `?` to
`interior:jail~` without anything about the face changing.

**The ratchet compares per-owner counts, so any owner relabelling trips it as a
regression even when the total falls.** That is a real weakness in a guard that
is otherwise doing its job, and it will happen again every time a room is added
or moved. Worth a row; I have not fixed it, because the fix is a judgement about
what the ratchet should key on (total? owner? a stable face identity?) and that
is the desk's call, not mine.

**I re-blessed at 187** — legitimate under the baseline file's own rule ("raise a
number here only with a reason"), since the total went DOWN and the only owner
that gained did so by relabelling. The board is green (`exit 0`, "no owner got
worse") so the next builder is not staring at a red they did not cause.

---

## NOT done, measured and scoped for whoever takes it next

### `civic` — 39 faces, and they are NOT the same bug as the kerb

`ct/civic.ts` **already has the right helper**: `stoneFace(t, wM, hM)` derives
`repeat` at 32 px/m from a member's own metres (`civic.ts:435`). The problem is
that its outputs are built **once**, for one assumed size:

```
treadM    = stoneFace(SCORED, 1.4, 4.1)
riserM    = stoneFace(RISER,  1.4, 0.19)
stepSideM = stoneFace(DRESSED,1.4, 1.4)
```

and then every step in every flight shares them. The cluster at `(−10.x, 0.x, −13)`
is five treads of increasing width — 2.16, 2.52, 2.88, 3.24, 3.6 m, all × 4.1 —
wearing a material built for 1.4 m.

**Most of them are faces you cannot see.** `rep 0.933×0.127` is exactly
`stoneFace(_, 1.4, 0.19)` = `riserM`, and the group indices are `BoxGeometry/3`
(the −y **underside** of a step) and `/4`, `/5` (the ±z ends buried in the
cheeks). So the fix is not a retune, it is giving `flight()`'s `put()` a
per-face material array sized from the box it just computed — which is a real
refactor of geometry **the player walks on**. The 2 m lane and the step
walk are sacred, so whoever does it must walk the flight, not screenshot it.

### `interior:bank` — 32 faces, untouched

I did not open it. Worst is `2400 × 78.26 px/m` on a 0.03 × 0.46 m face at
`(444.4, 0.3, 2.2)` — a 0.03 m sliver, which is the "0.2 m end caps wearing a
9.65 m run" family named in BUILDER-BRIEF §7b.

### The next worst single faces after the kerb

```
184.8x   8.33 × 1540 px/m    2.4×0.05 m   ground  jail          (61.3, 0.2, -103)
 48.0x   320 × 6.67 px/m     0.15×1.8 m   detail  props         (5.1/5.3/5.5, 0.6, -35)   x3
 36.1x   15.84 × 571.43      1.01×0.028   detail  tex-ground    (4.4/5, 0, -92.5) +2 more
```

The three `props` faces at `(5.x, 0.6, −35)` are one object's three siblings and
look like the cheapest remaining win after the kerb — same shape of bug, one
canvas over three narrow members.

## Green

`tsc --noEmit` 0 · `npm run build` 0 · `texdensity.mjs` **exit 0**, 187 gross,
"no owner got worse".

**I did not walk anything for this item** — the kerb change is texture
coordinates only, no geometry moved, so collision and floors are untouched by
construction. The civic work above is the opposite and must be walked.
