## feat/ground — the sidewalk, the kerb, the gutter, and a real street corner

The ground is the surface the whole game is walked on and it was the least
detailed thing in the world. Rebuilt from construction references, not memory.

**Base:** `1aba540`
**Commits:** `9c9b640` (walkTex split) · `47823fd` (the ground) · `7298f6c` (red kerb by rule, thin-face rules, colliders)

---

### What the player sees

- **The kerb face** is textured, cast in 3 m segments, and *darker and greyer
  than the sidewalk it caps*. It was `0x97928a` — literally brighter than the
  walk's `#84817a` — which is why it read as pale plastic trim on the edge.
- **The top edge is chamfered**, never a sharp 90°, matching the 1–1½ in
  arris radius on the NYSDOT 609 curb details.
- **A concrete gutter pan** runs between kerb and asphalt on both sides of
  both streets — the missing piece that made the kerb read as a bare
  rectangle on tarmac. Cross-sloped ~2.7% to the flow line, with its own
  longitudinal score and transverse joints aligned to the kerb's.
- **The corner turns on a radius** and the sidewalk follows it.
- **A kerb ramp** on the corner return, and **catch basins** at the two low
  points the gutters drain to.
- **Red no-parking kerb**, placed by rule (below).
- **The parked cars** are no longer a machined row.
- **Citizen colliders** ±0.30 → ±0.25, so bodies stop reading a shade too wide.

### Research it was built from

Numbers are in the header comment of `ct/tex-ground.ts`:

| detail | source | what we used |
|---|---|---|
| kerb reveal / top width | NYC SDM integral curb & gutter (6 in top, 7 in reveal) | keeps `KERB_H` 0.14 |
| arris radius | NYSDOT 609 curb sheets, R = 1–1½ in | 6.25 cm chamfer |
| joint spacing | 10 ft typical, 6–20 ft across DOTs | one every 3 m |
| gutter pan width | 6–24 in (NYC 6–12; combination C&G 24) | 0.45 m |
| gutter cross-slope | 4% standard | 2.7% (the road plane is flat at y=0) |
| corner return radius | 10–25 ft at minor city intersections | 3.5 m outer, 2.0 m inner |
| kerb ramp | 1991 ADA: 36 in clear, 1:12 run, 1:10 flares | 1.2 m wide, ≈1:10 |
| no detectable warning | truncated domes are post-2000 | plain ramp — correct for '97 |
| catch basin | 2 ft × 3 ft cast grate + hooded curb inlet | 0.6 × 0.9 m |
| no-parking distances | hydrant frontage / corner clearance | 3 m and 4 m (tight block) |

### How the corner actually works

The kerb is **one continuous filleted path** around the roadway (`KPATH`),
walk always on its left, every vertex filleted with
`C = P + R*(d_out − d_in)`. CROSSTOWN is an L-bend, so the four corners are
not the same kind:

- **The bodega corner (5, −98)** is the *outside* of the bend — the walk's
  convex corner. A 3.5 m return **cuts the walk back**, so the roadway grows
  into it: an asphalt wedge that *abuts* the two road planes along x=5 and
  z=−98 and never overlaps them.
- **The other three** are the *inside* of the bend, where the road's corner
  is the convex one. A 2 m fillet there **adds** walk — the sidewalk noses
  out on a radius over roadway that already exists, so no new asphalt.

Walk surfaces at each return are a triangle fan from the walk's back corner
out to the arc, which is what makes the ramp fall out for free: drop the
arc-edge vertices and the fan *is* a diagonal ramp with flared sides.
`ground.gy()` solves the same fan analytically, so the ground height ramps
with the geometry rather than stepping.

### Making the sidewalk line up

Every walk surface now maps **one shared sidewalk sheet in world space**
(`u = x/8`, `v = (0.5−z)/8`) instead of each mesh restarting the grid at its
own corner. The phase preserves the existing main-street grid *exactly* —
joints on integer x and half-integer z — so the tree pits still sit on their
joints. The side-street walks were half a slab out of step and are now in it.

### Two rules worth keeping, both learned the hard way here

**1. Thin faces (< ~0.3 m) cannot carry fine detail.** The kerb face is
0.14 m; end-on it is a couple of screen pixels tall. Anything
high-frequency in it aliases, and a nearest-*mipmap* lookup turns that
aliasing into a band that crawls as you walk. So, for those strips:

- derive the sheet from the surface's real **metres** so texels stay square
  (same lesson as `asphaltTex` in `bdffcb6`);
- **no dither, no fine noise** — only features many texels wide;
- `minFilter = NearestFilter`, `generateMipmaps = false` (the `thin()` helper);
- build at the resolution the surface needs, don't reuse a big sheet.

This bit twice. First the arris was UV-mapped to the top **one texel row** of
the kerb sheet, stretching every dark pixel in that row across the full 6 cm
of the chamfer. Then the red paint randomised top/bottom/fade **per pixel
column** — as high-frequency as it is possible to be. Both read as speckle.

**2. Red kerb has a meaning, so it is placed by rule, never by hand.**
It marks no-parking, so every place on the block that meets a condition gets
the same treatment:

- **hydrant frontage** — 3 m either side of a hydrant;
- **intersection approach** — the whole of each kerb return at the main
  street / side street junction, plus 4 m back along **both** its legs.

Both resolve to **arclength ranges along the kerb path**, so they follow the
corner geometry and a junction return necessarily paints both of its legs —
the two sides of a corner cannot disagree. The closed east end of the side
street is not an intersection and gets none. The earlier version was two
hand-typed z-ranges on the east kerb only, which is exactly why red turned up
on one side of the corner and not the other. Rules and distances are in the
comment block above `HYDRANTS` in `ct/tex-ground.ts` — extend `HYDRANTS` or
flip a `KJUNC` entry and the paint follows automatically.

### Verification

| check | result |
|---|---|
| `npm run build` | clean |
| `npm run sweep` | 48 shots, **no page errors** (only the pre-existing THREE.Clock deprecation + teardown/ReadPixels warnings) |
| fingerprint | 395 → 408 objects, 222 → 230 textures |
| blast radius | **exactly the ground** — 5 walk boxes replaced, 18 ground meshes added, 4 old 64×64 walk tiles out, the new kerb/arris/gutter/paint/grate/hood/walk sheets in. Nothing else in the world changed structurally. |
| walkability | walked, not asserted — `node scripts/kerb.mjs walk` |

**Reading the fingerprint:** `fpdiff` reports ~171 textures differing. That is
*phase, not content* — this branch changes how many `walkTex` canvases get
drawn, which shifts the unseeded `Math.random()` paint stream, so every
downstream texture gets different grain at identical dimensions. To see the
real blast radius, compare textures by size and strip the pixel hash out of
the structure signature; done that way it is 5 out / 18 in, all ground. If
that check is worth keeping it belongs in `fpdiff.mjs` as a `--grain` flag,
but that file isn't mine.

### Shots to look at

- `shots/kb-ramp-low.png` — **the corner**, from the roadway. Look here first.
- `shots/kb-corner-road.png` — the junction; red kerb on both sides of it.
- `shots/kb-return-over.png` — the return from above; the radius and the slab grid following it.
- `shots/kb-return-off.png` — the corner from across the street.
- `shots/kb-face-near.png`, `kb-along.png` — kerb face and gutter mid-block, close.
- `shots/kb-paint-hydrant-along.png` — the hydrant fire zone.
- `shots/kb-parked-row.png` — the parked cars.
- `shots/kb-bend-in.png` — the inside of the bend, where the walk noses out.
- `shots/kb-night.png` — night/rain; the kerb joins the wet registry so it
  darkens with the walk and gutter instead of staying dry above a wet gutter.

### Things you should know / decide

- **`fp.ts` RADIUS is still 0.42 in this worktree.** You said you'd taken it
  to 0.36 in the main tree; I didn't touch `fp.ts`. The "0.61 m to squeeze
  past a person" figure only holds once both land — locally it's 0.67 m.
- **I kept the noise reduction on the plain kerb face** (dither dropped,
  staining widened, no mipmaps) rather than restoring the exact sheet that was
  praised. It follows the thin-face rules and is strictly *less*
  high-frequency content, so it can only reduce crawl — but it is a change to
  something already approved. One-line revert if you disagree: put
  `dither(g, KW, KH, 90)` back at the end of `kerbTex()` and return `t`
  instead of `thin(t)`.
- **Pre-existing walkability pinch, not mine, worth a round.** The payphone's
  collider in `ct/props.ts` is `x ∈ [−6.95, −5.95]` — half the 2 m walk — and
  with the rig radius it blocks −7.37…−5.53. With the lamp poles (blocking out
  to −6.17) there is no straight through-lane on the west walk at z≈−11; you
  must step kerb-side. **It reproduces identically on the baseline**
  (`kerb.mjs walk` on `9c9b640` stops at the same 6.0 m), so this branch
  didn't cause it — but the user specifically values fitting past obstacles.
  `props.ts` is yours.
- The east-walk through-lane is only ~11 cm wide (lamp poles block to x≈6.17,
  the wall bites at x≈6.28). It walks, but it is tight. Also pre-existing, and
  your `RADIUS` change will widen it.

### Left undone

- Corner returns use the same rectilinear slab grid as everywhere else. Real
  returns are scored *radially*. It looks right and it lines up, but radial
  scoring on the fan would be more correct.
- Tree pits overhang the new chamfer by ~6 cm at the kerb edge. Invisible in
  practice; `props.ts` owns the pits so I left them.
- No ramp on the inside-of-bend corner opposite the bodega. The nose there is
  only ~0.8 m deep, so a ramp would run at ~17% — it needs the straight kerb
  cut, which needs the walk boxes subdivided. Deliberately out of scope.
- Did **not** touch the bodega corner chamfer (`ct/street.ts`, another owner),
  `ct/props.ts` (litter/trash is yours), `FEATURE-REQUESTS.md`, or `fp.ts`.

### Note on ports

The brief said 4179. **The desk's own preview server had already taken it** —
its `--port 4177` auto-bumped through 4178 to 4179 — so for a while every
fingerprint and probe I ran was silently reading the desk's build instead of
mine, and reported "no change" for changes that were really there. Worked on
**4279 with `--strictPort`**. Strongly recommend `--strictPort` in
`PARALLEL-WORKFLOW.md` §5: without it a busy port fails *silently* into
serving another agent's world, which is worse than not starting.

### Files

```
street/src/proto/ct/tex-ground.ts   NEW — walk/kerb/arris/gutter/paint textures + buildGround()
street/src/proto/crosstown.ts       walks replaced by buildGround(); groundY defers to it;
                                    parked[] table; citizen collider ±0.25
street/scripts/kerb.mjs             NEW — shots | probe | walk
```
