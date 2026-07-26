# Flat-colour ground: who to route, and what I could not measure

The desk asked me to fix the CLASS rather than the instances, start with what
the user pointed at, publish helpers so owners adopt in one line, and say who to
route. Here is the routing answer and an honest account of the measurement.

## The helpers already exist. Nobody has adopted them.

B built three, all the same contract — `(minX, maxX, minZ, maxZ) → Texture`,
canvas sized from real metres at the world's 32 px/m, mapped 1:1:

```
walkTex    the sidewalk sheet
apronTex   the driveway apron — its joints run ACROSS the direction of travel
plazaTex   1.5 m civic flags, cooler and greyer than the walk, joints both ways
```

**`plazaTex` was written specifically for the library forecourt** — B's own
docstring names the two big offenders, *"a 3.6 x 4.1 m landing and a 3.2 x 4.1 m
flight, each a box with a materials array, which is why one object shows several
tones with hard straight edges between them."*

**And `ct/civic.ts` imports nothing from `ct/tex-ground` at all.** Its imports
are `three`, `../fp`, `./ctx`, `./paint`, `./rng`, `./tex-world` — measured, not
skimmed. So the helper for the surface the user complained about has been
sitting unused since B published it.

> **ROUTE E** — adopt `plazaTex` on the library forecourt landing and flight.
> One import and one material per surface. B wrote it to E's dimensions; this is
> not a day's work, it is a line.

### The exact change, and I checked that it works on a BOX

B's painters return a texture for a *plane*, and civic's two offenders are **box
top faces in a materials array** — so "one line" needed proving before I sent
anyone to do it. Measured, off the geometry rather than assumed: a
`BoxGeometry`'s **+Y face UVs span the full 0..1 on both axes**
(`spansU [0,1]`, `spansV [0,1]`). `plazaTex` is `ClampToEdgeWrapping` and
mapped 1:1 with no repeat, so it covers that face exactly.

```ts
import { plazaTex } from './tex-ground';

// the materials array is [+x, -x, +y, -y, +z, -z] — index 2 is the top
const top = new THREE.MeshBasicMaterial({ map: plazaTex(minX, maxX, minZ, maxZ) });
const mats = [side, side, top, side, side, side];
```

Pass the slab's **world extents** in metres; the canvas is sized from them at
32 px/m, so the flags come out 1.5 m whatever the slab measures.

**One thing not to worry about:** the box's top-face V axis need not run the
same way as world Z. It does not matter here — `plazaTex` lays its joints on a
square grid at the same pitch both ways, so the flag pattern is symmetric under
that flip. It would matter for `apronTex`, whose joints deliberately run across
the direction of travel.

## What is NOT this class, so nobody should be routed for it

**Park paths are already textured.** `ct/park.ts:140` defines
`surfaceTex(wM, dM, 'path' | 'dirt')` and the path meshes at `:321` use it. So
*"park paths reading as road"* is a complaint about **character** — colour,
grain, edge — not about an untextured quad, and routing it as part of this class
would send someone to fix something that is not broken in the way described.

**`ct/civic.ts` is not wholly untextured either.** It has its own private
`pavingTex` (`:521`) and a `flagTex` yard (`:1399`). The untextured civic
surfaces are specific pieces — the step boxes B named — not the whole module.

## What I could not measure, said plainly

**I could not reproduce B's census of 123 surfaces / 454 m², and I am deferring
to B's number rather than publishing mine.** Three predicates, each wrong:

| attempt | counted | what it swept in |
|---|---|---|
| ground-facing, `y <= 1.6` | 307 / 1871 m² | roofs (a 19.7 x 18 slab at y 1.6) and the interior rooms out at x 680-1000 |
| tightened to `y <= 0.7`, block only | 61 / 842 m² | **cars** — 1.8 x 4.5 m at y 0.59 in green, red and blue |
| — | — | and it still missed civic entirely, because civic's offenders are BOX TOP FACES in a materials array and I was reading `mats[0]` |

The third failure is the instructive one: the module the desk called the worst
case is the one my probe could not see at all. **A census I cannot get right is
worse than B's, which was done by someone who knew the module** — so this note
carries no number of my own, and I have not built a check on that predicate.
A guard whose predicate is wrong files false faults against other people's
modules, which is the most expensive thing I could produce here.

## Why I have not painted anything

The desk said *do not repaint anyone's approved artwork*, and every remaining
surface in this class belongs to a module that is not mine — `civic.ts` is E's,
`lot.ts` and `park.ts` theirs, `tex-ground.ts` is B's and already holds the
pattern. Adding a fourth painter beside B's three would be a second answer to a
question B has already answered well.

**The gap is adoption, not tooling**, and adoption is one line in a file I do
not own.
