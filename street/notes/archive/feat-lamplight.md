## feat/lamplight — things standing in a lamp pool now catch the light

**Commit:** `3a922ec` (also carries the bench rebuild — see feat-bus.md)

---

### Why nothing was lit

The world is entirely `MeshBasicMaterial`. Night is a single full-screen
darkening and the lamp pool is a **ground decal**. There are no lights in the
scene, so nothing could possibly respond to one. A car parked directly under a
lamp stayed exactly as dark as a car mid-block, and so did the brick behind it.

### How it works now

Exactly the pattern the **rain** already uses, which solves the identical
problem:

| | rain | light |
|---|---|---|
| registry | `wetMats` — `{material, base}` | `litMats` — `{root, material, base}` |
| driven by | `rainLevel` | `nightLevel × falloff` |
| target | slate `#5a626e` | sodium `#ffc077` |

The difference is the **root object**: rain is uniform, light is positional, so
each entry keeps the object it belongs to and is measured against the lamp
heads each frame.

**Registered:** parked cars, every vehicle in the cruising pool (bus included),
the citizens, and the kerb-side props — hydrant, payphone, trees, flag pole,
bench.

**Falloff** is a smoothstep over a 4 m radius to the nearest lamp head. It was
a square first, and that was wrong: squared only reaches 0.23 two metres from
the head, which is too faint to read as lit at all. Smoothstep keeps the soft
edge and actually fills the middle of the pool.

**Cost:** by day `nightLevel` is 0 and `updateLit` returns on its first line.
At night it is a few dozen objects against eight lamps, once per frame, in 2D.
Nothing per-vertex, nothing per-pixel.

### Wall splash

Each lamp also throws an additive plane onto the facade behind it, driven off
the **same night curve as its halo** (it just joins the existing `nightLit`
list). The brick beside a lamp is no longer as flat-black as the brick
mid-block. Compare `shots/ll-wall-splash.png` against `shots/ll-wall-midblock.png`.

### Verification

`node scripts/lamplight.mjs probe` reads the material colours straight off the
scene graph — this is material state, not a judgement about a screenshot:

```
hatch (2.1 m from the z=-51 lamp head)  day r-b  -3.5  ->  night 46.3
sedan (10 m from any lamp head)         day r-b  14.6  ->  night 14.6
OK  the car in the pool warms up at night
OK  the car away from any lamp is untouched
OK  it returns exactly to its base colour by day
```

That third assertion matters: the tint is applied from the stored base every
frame rather than accumulated, so it cannot drift over a day/night cycle.

`npm run sweep`: 48 shots, no page errors.

### Shots

- `shots/ll-hatch-close.png` — **the car in the pool.** Warm roof and panels against a cold street.
- `shots/ll-wall-splash.png` vs `ll-wall-midblock.png` — brick beside a lamp vs brick between lamps.
- `shots/ll-pool-under.png` — standing under a lamp.
- `shots/ll-hatch-day.png`, `ll-wall-day.png` — the same spots by day, untouched.

### Notes / left undone

- **Which cars actually light up depends on where the lamps are.** They
  alternate: east at z = −23, −51, −79; west at −9, −37, −65. Of the four
  parked cars only the **hatch at z = −49** is inside a pool (2.1 m). The
  pickup at −33 is 4.03 m from the west head — just outside the 4 m radius, so
  it stays dark. If you want more of the block lit, move a parked car or widen
  `LAMP_R`; I did not want to re-tune parking the user just approved.
- The tint is flat across an object — a car in a pool warms uniformly rather
  than being brighter on the lamp side. Directional falloff would need
  per-vertex work, which the brief ruled out.
- Shared materials bind to whichever root registers first (`litSeen`). That is
  why the bench got its own metal instance. Worth knowing before registering
  anything else that shares a material across distant objects.
- The bus is registered, so it warms as it passes a lamp — but it is 9 m long
  and lights as one unit.
