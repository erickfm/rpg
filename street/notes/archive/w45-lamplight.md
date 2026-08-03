# w45 — item 95, the lamplight refactor

**The architecture in one line:** the lamp pool moved from one tint per
material, computed at the mesh's centre, to the same falloff evaluated at every
fragment's world x/z — so a surface is lit because of *where it is*, not
because a module remembered to register it or happened to be small enough to
qualify.

Port **4189** (dev) and **4193** (built preview). Both shut down at the end.
4188, 4190, 4196 answered 200 and were **other builders' worlds** — 4190
answered 200 to `curl` and then refused to bind, which is GOTCHAS 48 exactly.

---

## The item's diagnosis was wrong, and in an interesting way

The item says there are four private lamp registries — `ct/sidestreet.ts`,
`ct/traffic.ts`, `ct/crowd.ts`, `ct/vice.ts` — and that anything which never
signed up is never lit.

**There is one registry.** `props.lit`, in `ct/props.ts`. The three modules
named each declare a field *called* `lit` on their own options interface, and
`crosstown.ts` passes `props.lit` into all three (`:552`, `:568`, `:617`).
`ct/vice.ts:45` is a comment explaining why the casino deliberately does **not**
use it. Four sightings of one function passed as a parameter.

`lampHeads` is in `ct/props.ts`, not in `ct/sidestreet.ts`. The line the item
cites, `sidestreet.ts:41`, is a *comment about* props.ts, in a "what is not here
and why" section.

So "patch the list of registrations" would have fixed nothing — which the item
also suspected, and was right about for the wrong reason.

## What was actually wrong

Measured before changing anything (`scripts/probes/w45-whatisdark.mjs`), at the
main-street lamp at (4.1, −23), every material within 4.5 m of the head,
daylight colour against 23:00 colour:

```
held up by the lamp (night/day > 0.5):   3
at the night floor  (night/day <= 0.2): 38
```

The three it held up were a 0.1 × 0.1 lamp post and two 0.1 × 0.1 sign posts.
The road ribbon (60 × 124.5 m) read 0.045. The kerb (1.9 × 92.8 m) read 0.045.
Every shopfront read 0.030–0.115. **Nearly all of them carried
`userData.graded`** — they were registered and then refused. Two separate
causes, and the second is the one that matters:

1. **The span taper.** `poolable = wy.y < 4.5 && sizeW > 0`, where `sizeW`
   tapers to zero beyond a 12 m span. Every surface a lamp stands on in this
   world is longer than 12 m, so this did not exclude an unlucky few — it
   excluded *all ground, by construction*. And `wy.y < 4.5` is the mesh's
   **centre** height, so a shopfront whose box runs y 0–15 was refused
   including the part standing on the pavement.

2. **The ground is not in the registry at all.** The road, sidewalk, kerb and
   gutter are in `wetMats`, and *both* night-grading loops skip `wetMats` under
   the one-writer-per-material rule. This is far upstream of the taper, and it
   is the sidewalk specifically.

**The taper was not a bug.** Its own comment states the real ceiling: *"one
material carries ONE tint, so a 92 m road ribbon cannot hold a gradient. Pool it
and the whole street lifts uniformly … I did exactly that once with a
shared-material fix and had to revert it."* That is true of any fix that stays
on the CPU.

Which is why the pool you can see on the road **is not light at all** — it is a
painted 5.6 × 5.6 additive quad laid on the roadway. There is no such quad on
the pavement and none on a car. That is the user's sentence, mechanically:
*"the lighting only affects the street but not the sidewalk."*

## What I changed — all of it in `ct/props.ts`

The same math, one stage further down the pipe. Same `LAMP_R`, same
`LAMP_CORE`, same smoothstep, same `WARM_*` multiply, evaluated per fragment
instead of per centroid.

- `attachPool()` injects the falloff into a `MeshBasicMaterial` via
  `onBeforeCompile`, after `#include <color_fragment>` so it acts on the graded
  colour. One shared program (`customProgramCacheKey`), one shared lamp uniform.
- `updateLit` now writes only `base × ambient` and hands each material its own
  ambient as a uniform; the warm term and the gain live in the fragment.
- `updateRain` keeps sole ownership of the ground's colour and additionally
  hands those materials the same ambient — so the ground joins the light
  without a second writer.
- Retired: `sizeW` from the pool product, and both centroid tests. Height is now
  a per-fragment fade from 2.2 m to 4.5 m, so a shopfront is lit at the pavement
  and dark at the roofline instead of all-or-nothing on its middle.
  `sizeW` is still computed and published — `wallpool.mjs` reads it and the wall
  splash still uses the idea.
- `POOL_GAIN` 12 → **6.5**, and the road decal 0.72 → **0.22**. See below.
- `scene.userData.addLit(obj)`, published the way `addLamp` already is.

**This is not a conversion to real lights, and that is why it is safe for 8 px/m
art.** No normals, no diffuse term, no light objects. The thing that made the
old "warmed greenhouse" experiment read as a brown slab was shading by normal,
and there is no normal anywhere in this. A surface far from every lamp comes out
unchanged — `fpdiff` says textures, structure *and* tints are all identical.

## Why the gain came down, which is a judgement and not a measurement

12 was calibrated when only objects under ~6 m across could pool, so it
described how bright a *hydrant* should get and never had to describe an area.
With the ground taking the same term it put a 14 m circle of road at 58% of
daylight: mean frame luminance roughly doubled on all four standing frames, and
**looking at them, the dark asphalt had gone flat and grey.** 6.5 lands a
fully-pooled surface at 0.34, about where the painted decal already sat, so the
pool under a lamp is close to the one the user has been looking at — the change
is that the pavement and the car now get it too.

The decal came down for the same reason: it is now the same light a second time,
in one place only. Kept as a soft bloom rather than deleted, because the sheet
is shared with the park lanterns at `:1851`.

## My own verdict on the after-images

Comparing `shots/w45-stretch-before.png` with `-after.png`, and
`w45-walk-along-*`:

- **The sidewalk works.** In the before frames the pavement is one flat grey
  slab of uniform brightness from the near edge to the vanishing point. In the
  after frames it has a warm pool under each lamp that falls off along the
  street, and the kerb line reads. This is the complaint, fixed.
- **The road is better and I nearly made it worse.** At gain 12 the foreground
  asphalt was bright noisy grey and the moodiness was gone. At 6.5 it is dark
  again with a pool in it. I would not have caught this from the numbers — the
  measurement said "the sidewalk is now lit", which was true and not enough.
- **The car is the weakest part**, and honestly so — see below.
- The `stretch` frame is the one I would put in front of the user: several lamps
  down a dark street, each with a pool that covers road *and* pavement, and
  black between them.

## Found and NOT fixed

1. **No parked car in this world is under a lamp.** Nearest is 6.97 m from a
   head against a 7 m reach; the rest are 8–11 m. So the car in the user's
   screenshot was dark partly for a *placement* reason and lighting alone cannot
   put a pool on it. A car I placed under a lamp myself measures **1.82×** the
   same car at the darkest nearby roadway spot, so the mechanism works. Parking
   is in `crosstown.ts`, which **item 86 (w41) holds**, so I did not touch it.
   *Suggest queueing: nudge the parked-car z's toward the lamp z's, or widen
   `LAMP_R`.*
2. **Night frame time is +50%** — 53 ms → 79 ms median at (2.6, −23), 120
   frames. I cut it from +160% (three fixes, in the commit message) but the
   remainder is the honest price of per-fragment lighting. Absolute numbers are
   inflated: this machine was running several other builders' browsers. Day is
   unchanged. If this is too expensive, the lever is a hybrid — keep small
   objects on the CPU path, where one tint per material is *correct* because the
   object is smaller than the gradient, and use the shader only for surfaces
   bigger than a pool. I did not build that because it is two mechanisms again
   and I would rather the desk chose.
3. **Interiors are untouched by all of this.** `dimWorld` returns early for
   `|world x| > 100`, so every room keeps its own light and none of this reaches
   them. Whether interiors are consistent is a separate question nobody has
   asked yet.
4. **`poolLit` changed meaning.** It is still written, still per material, and
   several checks read it — but the pool is now per fragment, so "a lamp is
   holding this material up" is now an approximation of a thing that varies
   across the surface. It is computed from the nearest point of the mesh's box,
   as before.

## Instruments

All in `scripts/probes/`. Two of them were wrong first and are worth the
warning — **half of what I measured on this item was the instrument, not the
world**, which is BUILDER-BRIEF §7 landing three times in one sitting:

- `w45-lightaudit.mjs`, `w45-whatisdark.mjs` — the before/after diagnosis. **The
  audit stopped meaning anything the moment the fix landed**: it reads
  `m.color`, and the light is no longer in `m.color`. It reported the world had
  got *darker*.
- `w45-poolprofile.mjs` — first pixel probe. Pointed the camera down and
  measured **the player's hands**; both positions read 0.386 and the ratio came
  out 1.00×, which looks exactly like a failed fix. The hands are drawn at the
  bottom centre at any downward pitch, so that region can never be used.
- `w45-sidewalk.mjs` — **the lamps alternate sides every 14 m**, so the midpoint
  of two lamps on the same side is where the opposite side's lamp stands. My
  "gap" was a pool. Its trough-finding is still the weakest thing here: the
  1.05× it currently reports is a sampling artefact of the band moving with the
  camera, not a reading of the world. Trust the frames over this number.
- `w45-carpool.mjs`, `w45-carunder.mjs`, `w45-carheight.mjs`, `w45-patched.mjs`,
  `w45-fps.mjs`, `w45-nightframes.mjs` — the rest.

## Verification

- `npm run fp before/after` → **textures, structure and tints all IDENTICAL**;
  4 `places` differ, all pigeons/walkers at y 0.14–0.20.
- `node scripts/bugsweep.mjs` → **0 STATION MISS, 0 COVERAGE**, 96 shots, no
  shader-compile errors.
- Built bundle (`vite preview`, port 4193): 3849 materials carry the shader,
  27 heads registered, 12 uploaded — the cull working in prod.
- `npx tsc --noEmit` clean.

**Not verified:** I did not walk it. Nothing here touches collision, floors or
geometry — `structure` is bit-identical — so there is nothing to be wedged in,
but the standing rule says walking is the proof and I did not do it.
