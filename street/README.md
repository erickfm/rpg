# CROSSTOWN ’97 — how this world got here

> **Working on this project? Read [`START-HERE.md`](START-HERE.md) instead.**
> This page is design history: where the look came from and why the world is
> shaped the way it is. It is not instructions.

A first-person, wide-FOV city street built like a 1997 console game — chunky
nearest-filtered texel art, camera-facing sprites with true 8-angle rotations,
hungry fog, and a hand-authored world that grows one deliberate piece at a
time.

**Stack:** TypeScript · Three.js · Vite · Playwright (headless smoke/screenshots)

```bash
npm install
npm run dev        # http://localhost:5177  (hot reload)
npm run build      # typecheck + bundle to dist/
npm run preview    # serve the built bundle on :4177
node scripts/smoke.mjs [outDir]   # headless walkthrough + screenshots (needs preview or SHOT_URL)
```

**Controls:** click (or drag) to look · WASD walk · Shift run · Space jump ·
arrows also look.

---

## How this project got here

The brief never changed: *“outdoors in a city, narrow street, a car parked,
people walking around, first person, wide FOV.”* What changed — over many
rounds of build → screenshot → playtest → cut — was everything else:

1. **Style lab** — one street relit nine ways (rejected: “filters on a photo”).
2. **Six genre worlds** — different cameras/genres (rejected: content is fixed).
3. **Ten independent “studio” builds** of the same brief — blob construction,
   painted cutout theater, voxel, papercraft, oil-sketch daubs, scrap collage,
   expressionist bent geometry, N64 sprite tech, and more. Each a complete
   walkable world with its own models, materials, and logic.
4. **Cuts and deep passes** narrowed the field; **online research** into the
   real PS1/N64 spec (affine mapping, vertex snapping, Gouraud lighting,
   Doom’s 5-stored/8-shown sprite rotations, DKC’s pre-rendered pipeline) and
   toy-world design fed two final pitches: **CROSSTOWN ’97** vs **TABLETOWN**.
5. **Crosstown won.** An infinite fog-streamed procedural city proved the tech
   (deterministic hashed blocks, four districts, streaming colliders), then
   was deliberately **scoped down** to a small hand-authored world to grow
   collaboratively.

The losing prototypes live on in `src/proto/` as reference implementations.

## The world today

One closed street block, authored by hand in `src/proto/crosstown.ts`:

- Six painted shopfronts (GROCERY · LAUNDRY · PIZZA · MUSIC · DINER · BOOKS),
  brick facades with lit/dark painted windows, cross-buildings sealing both
  ends of the street in fog.
- A **two-lane road with parking lanes** each side, raised **kerbed
  sidewalks** the player actually steps up onto (`groundY` hook in the rig).
- A **car fleet** — sedan, hatchback, pickup, panel van + a roving **taxi** —
  built from painted slabs and a **welded greenhouse loft** (windshield, roof,
  rear glass and trapezoid side windows share vertices: no seams; side-window
  UVs shear affinely, exactly like the era).
- **8-angle sprite citizens** (the Doom system: five painted views × two walk
  frames, mirrored to eight) with caps, dresses, hoodies, varied heights.
- An **alley** with a CITY WASTE dumpster, trash bags, a grimy end-wall
  window; a payphone; sprite trees of varied heights; pigeons on the kerb.
- **Collision on everything**, including the moving taxi (live AABB).

