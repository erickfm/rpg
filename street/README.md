# CROSSTOWN ’97

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

## Architecture

```
src/
  main.ts             world shell: renderer, input (pointer-lock + drag-look),
                      registry loader, per-world lifecycle & disposal
  protos.ts           REGISTRY — currently just Crosstown
  proto/
    types.ts          Proto interface (each world: scene/camera/update/dispose)
    fp.ts             FPRig (mouselook, WASD, axis-separated AABB collision,
                      kerb step-up via groundY, jump) + sky/env/curve helpers
    crosstown.ts      THE WORLD. All texel painters (canvas → NearestFilter
                      textures), the car fleet, the citizen atlas, the street
scripts/
  smoke.mjs           headless boot + walkthrough + screenshots, fails on any
                      page error
  shots.mjs           one screenshot per registered world
```

**Conventions**
- Forward is −z; camera fwd = `(sin yaw, 0, −cos yaw)` → mouse-right = yaw +=.
- Box material order `[+x, −x, +y, −y, +z, −z]`; car fronts paint on −z.
- All detail lives in small canvas textures (`pixTex`, 64–128 px, NearestFilter
  + dither). Geometry stays simple; the texel is the brush.
- Debug hook: `window.__ct.warp(x, z, yaw?)` for tours and screenshot scripts.

## Working agreement

Small, good pieces — proposed, built, screenshotted, then played on the dev
server and iterated. The fog is the world’s edge; when the street feels right,
the next block earns its place.

**Roadmap candidates:** enterable shop (era door-load), a corner/cross-street,
the 6 pm dusk palette flip, the drivable car, era ambience/audio, and — later,
if the world wants it — the subway.
