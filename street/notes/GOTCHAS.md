# Landmines in this codebase

Things that have cost real time. Read before your first change; most are not
discoverable from the code alone.

---

## 1. The paint layer uses UNSEEDED `Math.random()`

`dither()` and 13 other paint sites call `Math.random()` directly, so **every
page load paints different grain**. Two runs of identical code differ in ~20% of
pixels.

Consequences:

- **You cannot diff screenshots.** Not "it's noisy" — 173 of 222 textures differ
  every load.
- To prove a change didn't move the world, use the structural fingerprint:
  `npm run fp before` → change → `npm run fp after` → `npm run fpdiff`.
  It seeds `Math.random` in the harness only. Textures + structure must come
  back identical; 4–6 pigeons drifting is the noise floor.
- Screenshots are for **looking**, never for **proving**.

## 2. There is ONE seeded `rnd()` stream and its ORDER is load-bearing

`ct/rng.ts` exports a single LCG. Tree heights and pigeon placement draw from
it at construction. **Inserting a new `rnd()` call anywhere shifts everything
downstream** — every tree height and pigeon position in the world changes.

Rule: append new draws at the END of a module's build, never in the middle.
`ct/props.ts` says so in a comment for exactly this reason.

## 3. Anything lying on the ground must be a top-down DECAL, not a billboard

`board()` creates a billboard that **rotates to face the camera**. A crushed can
drawn in side view therefore stands up on end as a flat card the moment you look
down at it. Ground litter, puddles, paper: draw them viewed from above and place
them as flat planes (`flatDecal`).

## 4. A surface 1–2 texels tall cannot hold detail

The kerb face is 0.14 m ≈ 1–2 texels at this world's ~8 px/m. Any dither, fine
noise or gradient on it **must** alias, and `NearestMipmapNearest` at grazing
angles turns that aliasing into a crawling band. This produced three separate
"the kerb looks bad" reports.

For faces thinner than ~0.3 m: no dither, no fine noise. Only large features
many texels wide, and `minFilter = NearestFilter` so there is nothing to crawl.

## 5. Texture repeat must derive from the surface's REAL METRES

`asphaltTex` once hard-coded `repeat(3, 30)`, tuned for the tall/narrow main
road. Reused on the wide/short side street it stretched each tile to ~21 m × 0.33
m and smeared the whole corner. Always compute repeat from the plane's actual
dimensions so texels stay square.

`ct/tex-ground.ts` is the model to copy: it takes **world extents** in and
returns repeat + offset, which also makes the slab grid continuous across
neighbouring surfaces.

## 6. Coplanar surfaces must ABUT exactly, never overlap

This world z-fights whenever two coplanar faces overlap — it has happened at the
corner roads, the sidewalk corner, and the chamfer. Make surfaces meet edge to
edge. `git log --grep=z-fight` for previous instances.

## 7. Floor height in the apartment comes from a PICKER, not from colliders

`ct/apartment.ts` owns `ground(x, z)` — a floor picker with hysteresis, because
four stacked storeys have to work for a 2D walker. It is the only thing that
knows which floor you are on.

So "add a floor" or "change the stair pitch" means **re-deriving that function**,
not adding a mesh. Get it wrong and you fall through or cannot climb. Always
verify by walking up and back down, never from a screenshot.

## 8. Colliders can silently eat `[E]` triggers

The bodega became un-enterable because the produce crates' collider box was
generous enough to swallow the door's interaction spot. Anything that owns an
`[E]` spot needs its approach corridor treated as reserved space.

## 9. The 2 m sidewalk lane is sacred

The player capsule is `RADIUS = 0.36` (`fp.ts`). The user checks constantly that
he can walk past props. Any new collider must leave a clear lane — walk it to
prove it, do not eyeball it.

Related geometry: building facades sit at x = ±7.0, tree trunks at ±5.4. A tree
canopy wider than ~1.45 m half-width punches into the facade and gets clipped.

## 10. Double-sided planes render MIRRORED from behind

Signs are planes with `side: DoubleSide`. Viewed from the back face the texture
is mirrored — and symmetrical letters (H, O, T, A, M, V, W, X) hide it
completely. A `HOTEL` blade sign shipped mirrored because only the E and L gave
it away. Always verify signage with asymmetric text.

## 11. `crosstown.ts` is the WIRING, and that makes it contended

It is only ~580 lines but it is touched by 23 of the last 120 commits, four
times more than files twice its size. Every prop registers a collider there,
every interactive object registers an `[E]` spot, every module has its update
hook called there.

Treat it as desk-owned. See `PARALLEL-WORKFLOW.md` §15 for the registration
pattern that would fix this properly.

## 12. Interior walls are single planes

Every opening in the walk-up is a hole cut in paper with zero visible depth.
Known issue, partially addressed. If you add an opening, give it a jamb.

## 13. Worktree plumbing

- `node_modules` is a **symlink** per worktree. `.gitignore` needs the
  no-trailing-slash form (`node_modules`) — `node_modules/` does not match a
  symlink, and the symlinks then block every merge.
- A `git reset --hard` in a worktree can delete that symlink and silently break
  its dev server. If a world stops serving, check the symlink first.
