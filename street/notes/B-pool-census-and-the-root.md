# The census: 295 surfaces stand in a lamp pool and cannot receive it

The desk asked for the number before the fixes. Here it is, and the three
reports are one bug.

```
  21 lamps.  1967 material-slots stand inside a 7 m pool.
  295 of them CANNOT receive it — 15%.

  excluded because span >= 6 m     85
  excluded because height >= 4.5 m 127
  the rest by selfLit / noLight flags

  module            in a pool   cannot receive
  (unattributed)        1445             141
  vice                    95              60
  props                  252              44
  street                  72              37
  civic                   78               7
  tex-ground              25               6
```

**My first census said 3% and was measuring the wrong thing.** I counted
`userData.graded`, which `dimWorld` stamps on nearly everything it traverses,
so it is not the gate at all. The gate is in `props.ts`:

```ts
const poolable = wy.y < 4.5 && Number.isFinite(span) && span < 6;
pool: poolable && !selfLit && !noLamp
```

Correcting that took the answer from 62 to 295. Worth saying because the first
number would have closed this as a non-problem.

## Why it produces three different-looking faults

Light reaches a surface by **three separate paths**, and which one you get is
decided per mesh:

| path | who gets it | decided by |
|---|---|---|
| pool | small, low props | `lit()`, which is OPT-IN, plus `span < 6 && y < 4.5` |
| wall splash | facades | a different registry again |
| ground decal | road and walk | painted, not lit |

A boundary between two paths is a hard edge, and its sign depends on which side
you are standing:

- **bodega facade** — lit sheet beside unlit brick → a bright rectangle.
  FIXED, and separately: that sheet was 0.083 hot, 92% masonry held at
  FLOOR_SIGN because 8% of it was a window. Bar raised 0.08 → 0.20.
- **alley back door** — unlit door beside lit brick → a black rectangle. The
  door is D's and has never been passed to `lit()`, so it cannot receive.
- **brick wall cropped at nothing** — a wall split into two meshes where one
  half is under the 6 m span limit and the other is over. The seam is invisible
  because both halves carry the same brick; the light stops dead at it.

`span < 6` is the sharpest of these. It exists so a 92 m road ribbon does not
take a point-sampled pool — sensible for the road, wrong for a wall, and it
means **the same wall lights or does not light depending on how many meshes it
was built from**. That is not a property anyone can be expected to remember.

## The root fix, and it is not hand-registering three meshes

The desk is right that opt-in is the fault, and it has now failed three times —
wet, printed signage, and this. **A surface inside a pool should receive it
unless it opts out.** Concretely, in `ct/props.ts`:

1. `dimWorld` already traverses every mesh in the world. It is the natural place
   to decide pool eligibility, and it needs no other module to remember a line.
2. Replace `span < 6` with a rule about the SURFACE, not the mesh: sample the
   pool at the point on the surface nearest the lamp rather than at the mesh's
   origin. A 92 m ribbon then lights correctly near the lamp and not at its far
   end, which is what the span test was trying to approximate.
3. Keep `noLight` as the opt-out — it already exists and already means "takes no
   lamplight".

That is a real change to the grade and it is mine. It wants doing carefully:
the lamp pools are CONFIRMED and liked, and the risk of a change here is
flattening them, which I did once already with a shared-material fix and had to
revert.

## For D — the alley back door. I GOT THIS WRONG FIRST; here is the measurement.

**Withdraw what I said an hour ago.** I told you the door is black because it
was never passed to `props.lit()`. That is false, and I published it before
measuring because it fitted the pattern of the other two.

Measured in your alley at 23:00, all 46 material-slots in the slot:

```
  every one of them   graded: true   poolable: true
  the only bright thing   lum 1.000 at (19.4, y 2.15), selfLit — your lamp itself
  everything else         lum 0.036 .. 0.059 — the night floor, correctly
```

**Nothing there is unregistered.** The door is dark because **no lamp pool
reaches it at all**: there is no street lamp within 7 m, and your wall lamp is a
`selfLit` sprite — it GLOWS but it does not CAST. It is not in the lamp registry,
so the grade has no idea it exists.

Which means the glow you see on the brick is painted into the wall texture, and
the door is a different mesh with no such painting. **Light drawn into a texture
stops exactly where that texture stops.** That is the bodega bug wearing a third
face: not registration, but light that lives in a sheet instead of in the grade.

`ctx.lit(doorMesh)` — the line I told you to add — would therefore do nothing
at all. Please do not spend the round on it.

**The fix needs something from me, not from you.** Lamp EMITTERS are registered
in `ct/props.ts` (stamped `lampPart: 'lens'`, which is how `glow.mjs` finds
them); there is currently no way for another module to declare one. Your wall
lamp should be a real emitter so the grade lights the brick and the door
together with a falloff. That is an addition to my file and I am naming it as
the next thing I do rather than leaving you a line that cannot work.

The alley being dark is confirmed and liked — this is about the door, not the
alley.
