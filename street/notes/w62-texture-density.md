# w62 — item 107: why nothing was catching the texture-density defects

**Port used: 4183 (dev) and 4181 (`vite preview`, the built bundle).** Both were
`000` before I took them. Shut down after.

The user, for the fifth time: *"interior jail textures look off. again why arent
we catching these? whats causing them and do we need to set a rule against them
so they aren't created?"*

**Why it reads badly, in one line:** above every interior doorway sat a band of
the floor-level wainscot tile, miniaturised and smeared into 24 cm of header —
the whole room's wall canvas crushed into a lintel, at 162 px/m against the
room's own 11.9.

---

## The desk's premise was half right, and the half it missed was the binding one

The desk filed: *"`masonry.mjs` sweeps only faces carrying `userData.masonry`.
Pillars, doors, benches and floor tiles are not masonry, so nothing checks
them."* **That is true** — measured, only **7.4%** of the world's textured faces
carry a density declaration at all.

**But `masonry.mjs` was not checking the masonry ones either.** It printed:

```
7792 meshes · 1902 textured · 0 carry a masonry stamp
FACES ACTUALLY AUTHORED AT THE WRONG DENSITY: 0            exit 0
```

Zero. It skipped any mesh with a `visible === false` ancestor, and commit
`5016d26b5` ("Item 141: region cull — the street is not drawn while you are
indoors") added a culler that switches off every top-level group west of
`REGION_X = 100` **plus every interior nobody has entered**. At the default
spawn that is **all 305 masonry stamps in the world**. The check was registered
in `checks.mjs` on the strength of "305 stamps, 16 disagreements"; a performance
optimisation three commits later silently reduced it to measuring nothing, and
it went on reporting green.

Its own `--selftest` had been **failing with exit 2 the whole time**. Nothing
ran it — `checks.mjs` does not pass the flag.

**So the answer to "why aren't we catching these" is not a category gap. The
jail is an interior, interiors are hidden until you are standing in one, and the
only density guard in the project could not see inside one by construction.**

Density is an **authoring** fact. Visibility is a **rendering** one. Confusing
them is what made the guard blind.

## What I changed

**`scripts/masonry.mjs`** — dropped the visibility skip. It now reproduces
exactly the numbers `checks.mjs` recorded at registration: 305 stamps, 16
disagreements, all 16 whole-texel rounding, **0 authored wrong**, and its
selftest passes.

**`scripts/texdensity.mjs`** (new) — the sweep the item asked for. Every
textured face, not the 7% that declare a density. It judges undeclared faces by
an invariant needing no declaration: **on a correctly mapped face a texel is
square**, and `ppmX`/`ppmY` are derived independently from the face's own two
dimensions. Every defect in BUILDER-BRIEF §7b's list is of exactly that shape.
Undeclared surfaces are reported as their own named category with a count.

**`src/proto/ct/interior.ts`** — the actual defect, three faults in one kit,
shared by **all twelve interiors** at once:

| fault | measured |
|---|---|
| the 0.18 m **end return** (the reveal you walk through in any doorway) wore the repeat computed for the 3.6 m run it caps | **2394 px/m** vs the room's 11.9 |
| **every lintel** over every door wore the whole room's canvas squeezed into its own height | **162 px/m** on a 0.24 m header |
| `Math.max(1, len / TILE_M)` floored short runs at one whole canvas | **177 px/m** |

`boxMats(w, d, y0, y1)` now gives each face a repeat from **its own** width, and
`offset.y`/`repeat.y` sample the band of wall the run actually occupies — so a
lintel lines up with the plaster either side of the door instead of restarting.
A full-height run still gets `repeat.y = 1, offset.y = 0`, unchanged.

> The material order trap is the expensive one here and I wrote it down at the
> call site: **`±x` is `depth` across, `±z` is `width`.** All three callers had
> passed one material for all four sides, so whichever pair was not the wide one
> drew the wide one's density.

```
gross (>= 4x stretched) faces   392 -> 250 -> 188
jail interior                    32 ->  24 ->  20
tax / library interiors           8, 12 -> 0
```

## My verdict on the after-images

`shots/w62/jail-lintel-{before,after}.png`, taken from the player's own standing
position inside the jail looking at the door he leaves by.

**Before:** a band of crushed green-and-white striping floats directly above the
door — the wainscot tile pattern, which belongs at ankle height, miniaturised
and hatched across the header at head height, unrelated to the wall around it.
That is what "textures look off" was pointing at.

**After:** the plaster runs unbroken across the header with a single clean trim
line at the door head. It reads as a wall with a hole in it, which is the whole
point of the kit's 0.18 m thickness.

The doorway pair (`jail-door-*.png`) shows the same fix smaller. I looked at
both at **13:00**, not at night.

## Proof

- **Built bundle** (`vite preview`, `built in 260ms` confirmed — GOTCHAS 77):
  `texdensity` exit 0, `masonry` exit 0, identical numbers to dev.
- `node scripts/bugsweep.mjs` → **`sweep findings: none (0 STATION MISS, 0 COVERAGE)`**.
- **The world did not move.** `scripts/probes/w62-geomdiff.mjs` compares geometry
  parameters and world position as a multiset: **7792 meshes before and after,
  0 BoxGeometry differing** — and every wall I touched is a Box. The only drift
  is 7 planes appearing and 7 disappearing, all `PlaneGeometry` 0.95×1.9 and one
  0.42×0.42: walking citizens and a pigeon, the documented noise floor.
  `fp`/`fpdiff` is the **wrong** tool here (§10) — the fix creates extra texture
  clones, which shifts the seeded random stream and repaints every dithered
  texture after it.
- **Both selftests genuinely assert.** `texdensity --selftest` first *passed
  vacuously* — it mutated a face to 3x against a GROSS line of 4x and asserted
  `gross.length`, which is 188 on this world regardless. Fixed: it mutates to 5x
  and asserts **that specific face** is in the list. The ratchet was proven red
  by hand-lowering a baseline: `REGRESSION — interior:jail: 5 -> 20`, exit 1.

## Found and NOT fixed — for the desk to queue

1. **`scripts/texdensity.mjs` is not registered in `checks.mjs`.** That file is
   not named by item 107, so per BUILDER-BRIEF §9 I stopped rather than edit it.
   One row, default tier, ~15 s:
   `['texdensity', 'does every textured face draw at a square, sane density?', true]`
   **Please also register `masonry --selftest`, or the next culling change
   re-blinds it silently.**
2. **188 gross faces remain**, baselined in `notes/texdensity-baseline.json` so
   the check ratchets rather than being tuned. Worst clusters:
   - `civic` 39 — the largest single owner left
   - `interior:bank` 32, `interior:jail` 20 — a *different* cause from the one I
     fixed: 4.6×0.07 m trim strips and 2.4×0.24 m bands sharing a canvas
   - a **30 × 0.22 m** face at `(-7.1, 0.1, -83)` drawing **0.27 px/m** across —
     an 8 px canvas stretched over thirty metres, the single worst face in the
     world at 16363x
   - the jail *site* (exterior, x≈61) has a 2.4×0.05 m face at 1540 px/m
3. **The world holds 3782 textured faces with no declared density** (92.6%).
   §7b says every textured surface should declare one; `declareSurface` only
   declares a *kind*, not a density, so there is currently **no API** for a
   non-masonry surface to declare px/m. That gap is why the rule cannot be
   enforced at authoring time — worth an item.
4. **`scripts/interiors-walk.mjs` cannot run against a built bundle** — it does
   `import('/src/proto/ct/doors.ts')`, which only vite dev serves. Anyone
   "verifying on the built bundle" with it gets a crash that looks like a world
   failure.
5. One declared density is **off the 8/16 grid**: 32 px/m at `(8.3, 0.1, -77)`.
   Probably deliberate (ground is 32) but it is the only one, so it is either
   fine or it is a typo, and nothing currently says which.

## Derived, not retyped

Room attribution comes from `window.__ct.roomDims()` — `interior.ts`'s own
`interiorRooms()`. The interior belt's slab pitch is exactly the sort of number
BUILDER-BRIEF §8 says not to copy. Face dimensions come from
`scripts/lib/faces.mjs`. The one number I copied is the `0.18` wall thickness in
a comment, and it is `T` in the same function.
