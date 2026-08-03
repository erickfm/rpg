# eightyseven / item 156 — the "invisible wall" is a gradient cut off by its own canvas

**The user, at night:** *"whats going on here with the light reflecting against
the invisible wall?"* — `[DIAGNOSIS LOST]`, `FEATURE-REQUESTS.md:2868`.

**Found, fixed, and it is a CLASS fix: one texture serves every lamp on the
building line.** All figures on the built bundle, port **4430**, build `6f3434518`.

---

## Root cause, one line

`ct/props.ts`'s `wallSplashT` — the additive quad that fakes lamplight on the
brick behind each street lamp — was

```js
createRadialGradient(16, 17, 1, 16, 17, 26)     // on a canvas 32 px WIDE
```

**A radial gradient reaches its last colour stop at its outer RADIUS, and 26 is
far outside this canvas's half-width of 16.** The farthest any pixel gets from
the centre horizontally is 16 — only **0.615** of the way along the ramp, where
the stops still interpolate to **alpha ≈ 0.14 against a 0.55 peak**. So the
falloff never reached zero before the texture ran out, and an **additive 3.4 m
quad ended mid-gradient**: a straight vertical edge of light down a brick wall,
which is exactly "light stopping against a surface that is not there".

The top edge (distance 17) was clipped the same way. Only the bottom (distance
30, past 26) ever faded properly — which is why the artifact reads as a **panel
of light with a soft lower hem and hard sides**.

## How it was found, because eyeballing could not do it

**A night frame is texture × lighting, and every masonry course, sign and window
reveal is an edge.** I proved that on myself first: the church's west face has a
crisp vertical boundary at night, I had it as the prime suspect, and brightening
it showed a **buttress**. It is genuine architecture, uniformly lit.

**So divide.** The pool is a multiply on the graded base (`POOL_FRAG`:
`diffuseColor.rgb *= …`), so for one fixed camera `night / day` **is the lighting
factor with the texture cancelled**. Texture edges are in both frames and divide
out; lighting edges survive. Both frames come from one page load at one camera —
two loads would re-roll the seeded dither (GOTCHAS 2/75) and a moved camera would
misregister the division outright.

`scripts/probes/w87-item156-lightedge.mjs` swept 16 facade stations. **One
cleared the bar: z −50 looking east, edge 0.303 against a noise floor of 0.030,
S/N 10.1.** `w87-item156-ratiomap.mjs` then drew the lighting field itself, and
the pool on the walk-up's wall was **a bright rectangle with straight vertical
sides** — not a radial pool. `w87-item156-whichmesh.mjs` cast rays across it and
named the surface: mesh **#4121**, `PlaneGeometry(3.4, 5.0)`, additive,
`mesh.userData.mod = "props"` — which is `ct/props.ts:1926`, the wall splash.

**The instrument refused itself once, and that mattered.** The first self-test
(day ÷ day, which must be flat) came back with jumps to 0.121: the world is
LIVE, and citizens, cars and pigeons move between two captures 400 ms apart. The
mean factor was exactly 1.000, so the division registered — what was missing was
a noise floor. Every station now shoots **day → night → day again**, so it
carries its own control at the same camera, seconds apart, in the same traffic.
Re-run of the null case: **GREEN, worst S/N 2.1, max edge 0.099**, both under the
bars.

## The proof, at the quad's own edges

Rows 215–292 (the band where the slab is brightest), night/day ratio:

| | before | after |
|---|---|---|
| **left edge** wall x400 → splash x407 | 0.236 → 0.420 = **+0.184** | 0.234 → 0.240 = **+0.006** |
| **right edge** splash x519 → wall x526 | 0.415 → 0.236 = **−0.179** | 0.241 → 0.239 = **−0.002** |

**The splash now begins and ends at the wall's own brightness** — a 31× and 90×
reduction in the discontinuity. Measured by stashing the change, rebuilding, and
re-running the identical band, so the two columns are the same instrument on the
same station.

The residual biggest jump in that band is **0.104 at mesh #4115 — the lamp POST**,
a different mesh and a legitimately lit object standing against a dark wall.

**A caution for whoever reads the sweep output.** The whole-facade metric only
moved 0.303 → 0.270, and that is not the fix under-performing: over rows 0–430
the biggest jump is usually a **lit window's frame**, which is genuinely bright
with a genuinely hard edge and is correct. The row band above is what isolates
the splash. I nearly mis-reported this as a weak fix before checking which mesh
sat on each side of the jump.

## The fix

The falloff is drawn **per pixel** against a distance normalised **separately in
each direction** — the centre sits 17 px down a 48 px canvas, so "up" has 17 px
to fade in and "down" has 31 — and clamped to 0 at 1. That is **zero along all
four edges by construction**, whatever the canvas aspect or where the centre
sits, so this cannot silently return if either changes. A circular gradient
cannot do that on a non-square texture with an off-centre origin, which is why
the original was doomed rather than merely mistuned.

**One texture, every lamp.** `wallSplashT` is built once and shared by every
splash on the building line, so this is fixed everywhere at once rather than at
the one lamp the user photographed.

## My verdict on the pictures

- `shots/zz-156-ratio-BEFORE.png` vs `shots/w87-156-map-zm50e-ratio.png` — the
  lighting field, texture divided out. **Before: a hard-edged bright slab.
  After: a soft radial glow.** This pair is the whole finding in two images.
- `shots/zz-156-after-look.png` — his own view, brightened. The brick now fades
  smoothly away from the lamp with no rectangle anywhere.

## Suite

`npm run sweep` **96 shots, 0 STATION MISS, 0 COVERAGE**. `node scripts/health.mjs`
**WORLD OK, exit 0**, build `6f3434518`. `npx tsc --noEmit` **clean**. 0 console
errors in every probe run.

## Found and not fixed

- **The desk's hypothesis was half right and worth recording as such.** It
  guessed "two adjacent faces of one wall, one patched and one not". The
  boundary is real but it is **not** a registration gap: mesh #306 sits on
  **both** sides of the edge and both sides are patched. The unpatched surface is
  the additive splash quad itself, which is *supposed* to be unpatched — it is a
  light, not a lit surface. The desk flagged its own lead as a candidate; it was
  the right neighbourhood and the wrong mechanism.
- **`sizeW` is NOT the cause and that hypothesis is dead.** The archived note
  `archive/B-for-AUDIT-the-wall-cannot-pool.md` says wide walls cannot pool, and
  it was true when pooling was a per-material CPU tint. Item 95's per-fragment
  rewrite already removed the span cliff (`ct/props.ts`: `const poolable =
  bx.min.y < POOL_Y1`). Anyone re-reading that note should know it describes a
  pipeline that no longer exists.
- **172 exterior meshes do not dim at night at all** (base under 4.5 m, colour
  identical at noon and midnight). The largest are the `#ffffff` window sheets at
  x ±6.96–6.98, which are the deliberate `selfLit` sheets item 234 describes and
  are almost certainly correct. **I did not audit them** — it is a separate
  question from this item and a big one. `w87-item156-thatplane.mjs` prints the
  census if the desk wants it queued.
- **`scripts/probes/w64-lampwall.mjs`, written for this item by an earlier
  worker, is aimed wrong** and reports nothing useful: it filters `bb.min.x > 300`
  and so sees only the apartment interior, and it looks up `userData.lampList` /
  `userData.lamps`, neither of which exists (the world publishes
  `lampHeadCount` / `lampHeadsUploaded`). It prints `lamps: null` and 11 meshes,
  none of them on the street. Left alone — it is not my item's file and it gates
  nothing — but it should be retired or repaired rather than trusted.

## Derived or copied

**Derived.** The probes read the world: lamp counts off `scene.userData`, meshes
and their patch state off `material.customProgramCacheKey()`, positions off
`matrixWorld`. Nothing re-implements `POOL_FRAG` — brief §8 forbids the second
copy, and a harness that re-derived the falloff would have agreed with the source
while disagreeing with the world, which is the exact failure this item is about.
The one number I read from source rather than the world is the gradient's own
`(16, 17, 1, 16, 17, 26)` against `pixTex(32, 48)`, cited at `ct/props.ts:1523`,
and it is the defect itself.
