# Builder A — one masonry density for every wall (seam pattern #1)

Branch `feat/split-2b` @ `34fc7b7`. One file changed: `src/proto/ct/tex-world.ts`.
No caller was touched, no signature was broken.

## What was actually wrong

Measured from source before changing anything, not eyeballed:

| painter | px/m across | px/m up | brick course |
|---|---|---|---|
| `facadeTex` | 8.00 | **10.94 / 11.08 / 11.17** (varies with floor count) | 0.457 / 0.451 / 0.448 m |
| `shopfrontTex` | 8.00 | 12.38 | 0.404 m |
| `resGroundTex` | 8.00 | 10.00 | — |
| any building < 8 m wide | **10.67** | as above | — |

Five different vertical densities. Texels 1.38:1 anisotropic on every wall in
the world. And the `Math.max(64, …)` clamp meant FLOWERS — 6 m — wore brick 25 %
smaller than CHOP SUEY and BODEGA either side of it, which is the one place the
defect is visible in a single frame.

There was a second, quieter bug underneath it: `facadeTex` painted **2.53 m
storeys onto 2.4 m ones** (28 px at 11.08 px/m), so the window bands drifted
against the building's real floors, a little more on every storey up.

## What it is now

```
WALL_PPM = 8          texels per metre, BOTH axes, every wall
COURSE_M = 0.5        one brick course — 4 texels at 1x, survives mipmapping
FLOOR_M  = 2.4        the real storey street.ts builds, not a painted guess
```

Two rules, and they are the whole fix:

1. **One density**, with painters allowed an *integer multiple* when they carry
   fine content. The shopfront and residential bands run at 2× because they
   render text and one-texel stone arrises, and 0.65 m letters are 5 texels at
   1×. An integer multiple keeps texels square **and** keeps the course grid
   commensurate — a 0.5 m course is 4 px at 1× and 8 px at 2×, landing on
   exactly the same world lines.
2. **Courses are phased off world Y**, never off the mesh's own top edge. That
   is what makes the bond continue across a party wall between buildings of
   different heights (pattern #2).

Every feature is now expressed in metres and converted once. Grime and dither
counts became per-square-metre — they were a flat count per canvas, so a 6 m
shop got the same 500 specks as an 18 m block.

## Findings closed

| finding | status | evidence |
|---|---|---|
| 3 — shop band vs wall courses | **closed** | `shots/look-shop2.png` |
| 7 — courses break on floor-count change | **closed** | `shots/look-join-hw-tax.png` (3-storey ∣ 5-storey, courses and window bands run straight through) |
| 12, 13 — narrow-shop clamp | **closed** | `shots/seamA-flowers.png` — CHOP SUEY ∣ FLOWERS ∣ BODEGA, identical brick, one frame |
| R3 — 1.0 m band step at No. 227 | **partly** — see below | `shots/seamA-227-band.png` |

## What I could NOT close, and why

**The pattern as written is half a signature change I am not allowed to make.**
The queue says "offset derived from world position". The wall painters are
called only from `ct/street.ts`, which is D's file, and they are never told
where in the world their mesh sits. So:

- **Vertical phase — done.** Courses only need a *y* datum, and every upper wall
  starts at its ground-floor band top. Defaulting that to `SHOP_BAND_H` is
  correct for all but one building on the block, and the exception (No. 227,
  which sits at `ENTRANCE.BAND_H` = 3.2) happens to be exactly 1.0 m lower —
  two whole courses — so it lands in phase anyway. That is arithmetic luck, not
  design. `facadeTex` takes an optional `baseY` for when it stops being lucky.
- **Horizontal phase — NOT done.** Perp (vertical) joints still restart at each
  building's own left edge, so the bond does not half-lap across a party wall.
  Fixing it needs the mesh's world x/z, i.e. a new argument at every call site
  in `street.ts`. Visible in `seamA-flowers.png` if you look at the piers. It is
  much less noticeable than the course break was, because neighbours have
  different brick colours anyway.

**So pattern #1 was slightly mis-stated**, and the queue asked me to say so if
it was. It was written by analogy to `tex-ground.ts`, where surfaces tile in two
dimensions and genuinely need a full world-space offset. Walls are not that:
they need **one density and a y-datum**. Everything that matters for a party
wall is covered by those two, and both fit inside `tex-world.ts`. The residue —
horizontal perp phase — is real but cosmetic, and it is the only part that
requires the desk to coordinate a signature change across `street.ts`.

**R3 is not mine.** The 1.0 m step at No. 227 is `bandOf()` in `street.ts`
giving shops 4.2 m and the walk-up 3.2 m. My change makes the *courses* cross
that join correctly, but the ground-floor datum line and the window bands still
step, because the building's storeys genuinely are 1.0 m lower than its
neighbours'. That is a `street.ts` decision (D) or a desk call, not a paint fix.

## Verification

`npm run fp before` → change → `npm run fp after` → `npm run fpdiff`.

```
objects    591 → 591      identical
textures   282 → 282      identical count
places     591 → 591      2 differ  (pigeons — the noise floor)
structure  591 → 591      256 differ (material sigs embed texture hashes)
```

Textures: **51 resized out, 51 resized in — a clean 1:1 swap** of exactly the
wall canvases (facade 116/144/172 → 85/104/123; shopfront 52 → 67; resGround
144×32 → 288×51; FLOWERS 64→48 across, the clamp gone). Nothing created,
nothing destroyed.

A further **147 same-size textures changed pixels only**. Worth understanding
before anyone re-runs this: changing the *number* of `dither()` calls shifts the
seeded `Math.random` stream the fingerprint harness installs, so every texture
painted *after* the first wall drifts in grain. It is invisible in the shipped
world (grain is unseeded there and different every load, GOTCHAS §1) but it
means **`fpdiff`'s texture count alone cannot isolate a paint change** — compare
the canvas *dimensions*, which is what the 51/51 figure above is.

`node scripts/health.mjs` OK. `npm run sweep` — 48 shots, no page errors, only
the standing THREE.Clock deprecation and the WebGL perf warnings.

## For the desk

1. **`notes/OWNERSHIP.md` is stale and `scripts/ownership.sh A` fails because of
   it.** My queue (`a8dd629`) transfers `ct/tex-world.ts` and `ct/paint.ts` from
   DESK to A; `OWNERSHIP.md` (`528a717`, one commit earlier) still lists both as
   `= DESK`. I did not edit it — it is your routing record, and a drive-by edit
   to it is the exact failure mode the doc warns about. Please move those two
   lines so the check passes for whoever picks this up next.
2. **The horizontal perp phase needs you**, not a builder: one new argument on
   `facadeTex`/`shopfrontTex`/`resGroundTex` and the matching call sites in
   `street.ts`, in a single commit across both files.
3. The auditor re-verifying this should shoot `seamA-flowers.png`'s camera
   first — CHOP SUEY ∣ FLOWERS ∣ BODEGA is the tightest single-frame test of
   the whole pattern.

## Not started

`## Next` in my queue — the build stamp in the HUD, and the artifact republish.
Neither begun.
