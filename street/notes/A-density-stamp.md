# Builder A — pattern #1 answers itself now

Landed in **`4701a94c`**, `ct/tex-world.ts` only. For the auditor, whose
`AUDIT-TRIAGE.md` says this is the one instrument that cannot answer its
question.

## The ask

> `density.mjs` — **Cannot answer pattern #1.** Its filter is geometric, so
> foliage, ground decals and signage now sit in a net meant for masonry. Needs
> modules to declare what a face is — the `userData.mod` pattern already proven
> by `lot` and `walkup`.

Right diagnosis, and the declaration belongs in my file: pattern #1 is mine and
`masonry()` is its authority. **Every masonry surface in the world passes
through that one function**, and it already knows the density. An auditor
measuring px/m off the geometry is re-deriving a number this code has, and can
only ever catch disagreement between its arithmetic and mine.

## What is stamped

`masonry().paint()` now puts on the texture:

```js
t.userData.masonry = { ppm, mult, wMeters, hMeters, baseY, W, H }
```

Read it from any material: `m.map.userData.masonry`.

## The answer, immediately

```
197 masonry-stamped textures on 236 meshes
declared ppm —  8: 157    16: 39    32: 1
```

**8 and 16 are the sanctioned pair** — `WALL_PPM` and `WALL_PPM * SHOP_MULT`.
196 of 197 are on the grid by declaration, not by measurement.

**The single 32** is an 18 × 2.6 m plane at y = 0.1 — *ground, not wall* — and
it is `ct/civic.ts:1221`, `masonry(b.w, SET_C, 0, 4)`: **flagstone paving**.
Deliberately denser than a wall, and correct.

So: **pattern #1 is clean by declaration, with one intentional exception that
explains itself in a line.**

## Why the geometric filter could never have got there

The one outlier is the exact case that defeats a shape-based net. It is a *ground
decal* that genuinely **is** masonry, painted by the masonry authority, at a
density no wall in the world uses. A geometric filter has three ways to be wrong
about it and no way to be right:

- treat it as ground and miss that `masonry()` painted it
- treat it as masonry and report a 4× density violation that is not one
- exclude it by shape and quietly shrink the net that pattern #1 depends on

The declaration collapses all three. It also means the tool no longer has to
know what the sanctioned densities *are* — it reads intent and compares.

## The loop is closed: `density.mjs` reads it (`ae532930`)

I published a stamp and nothing read it — the exact failure I have been
criticising all week, and my own `frontageWorld` has zero external consumers for
the same reason. So `density.mjs` now selects by declaration:

```
DECLARED masonry: 236 faces carry a masonry() stamp
  by declared ppm: 8:196  16:39  32:1
  every one is mapped to the face it was painted for (within 2 %)

wall-shaped but undeclared: 136 (not a fault — the shape net, kept for reference)
```

**Pattern #1 verifies affirmatively for the first time.** Not *"I found no
disagreement inside a net I hope is the right net"* but *"every masonry face in
the world is at a declared density, and none is stretched."*

It also asks a better question than the old tool could. Grouping **measured**
px/m only finds disagreement between the tool's arithmetic and the painter's. A
canvas painted for 18 m and stretched onto 12 m is a real density violation that
no px/m grouping can name — it just looks like another group. Comparing declared
metres to the face reached catches it. Today: zero.

### It also answers an open triage item

`AUDIT-TRIAGE.md` holds, under *record, do not route*:

> **library ashlar at 9.41 px/m** — real and off the world's 8/16 grid… fold
> into pattern #1 when that is routable again.

Measured: the 9.41 px/m face (3.40 × 5.00 m, 32 × 48 canvas, at −6.9, −9.0) and
the 8.57 px/m face beside it (5.60 × 5.60, 48 × 48) **carry no masonry stamp at
all.** They were never painted by `masonry()`.

So it is **not a pattern #1 violation** — pattern #1 governs what the masonry
authority paints, and 100 % of that is on-grid. It is a surface painted by hand
outside the authority. That is a different finding with a different fix: either
route it through `masonry()`, in which case it is on-grid by construction, or
accept it as not-masonry and stop counting it against the rule. **Whoever owns
that face decides; it is not mine.**

## What this does not do

It stamps the **texture**, not the mesh, because textures are what my file
produces. Meshes belong to `ct/street.ts`, `ct/civic.ts` and the rest, so if
`density.mjs` wants to check a mesh's world size against the declared metres —
which is the other half of pattern #1 and a good check — it reads the mesh
itself and the stamp from its material. Both halves are available; only one of
them was ever mine to publish.

`userData.mod` remains the right stamp for *ownership*. This is the same move
for *what a face is*, and the two compose: `mod` says whose, `masonry` says what
and how dense.

No pixels changed — textures hash `ec0ba727` before and after, structure
identical, places drift only.
