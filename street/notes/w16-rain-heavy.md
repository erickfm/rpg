# w16 — rain: culled away in half the directions, and never heavy

Queue item **7** (formerly 5b): *"Rain never gets heavy… peak material opacity
was 0.155 (`0.55 * rainLevel`), so `rainLevel` never exceeds ~0.28… raise the
ceiling so heavy rain is heavy, then judge the sheath by facing four directions
at peak."*

**Root cause, one line:** the rain was being frustum-culled against a bounding
sphere the renderer cached once at the world origin, so on four of eight
headings the drops were not drawn *at all* — and separately `rainLevel` had
nothing but alpha to spend, because 500 drops in a 30x14x30 m box is the same
drizzle at every intensity.

`src/proto/ct/props.ts` only. Commit `fc332c5c5`.

---

## The item's stated cause is wrong

There is no ceiling on `rainLevel`. Measured live outdoors at a rainy hour
(`scripts/w16-rainpeak.mjs`): it climbs to **0.9995** and settles in ~11 s of
real time. Peak material opacity was **0.55**, not 0.155.

0.28 is exactly what `rainLevel += (1 - rainLevel) * dt * 0.6` reaches after
~0.55 s. The scan behind the item sampled about half a second after each clock
step and never let the lerp settle. There is a second trap that produces the
same reading:

> `hourAbs` is `Math.floor(totalMin / 60)` (`crosstown.ts:999`) — an **absolute**
> hour — and `rainAt` hashes it through murmur3's finalizer, which is **not
> periodic in 24**. So `__ct.clock(h % 24)` asks a different question than
> `rainAt(h)` answered and lands on a dry hour. My first run read `rainLevel
> 0.0000` for 16 straight seconds because of exactly this.
> **`scripts/rainlive.mjs` still has the `% 24` form** and will mis-measure.

## But the complaint is real, and there were two causes

### 1. The drops were culled — this is the user's twice-reported bug

Three caches a geometry's bounding sphere **once**, lazily, and never
recomputes it. For the rain that sphere is centre `(0, 7, 0)` radius `21.5` —
the box of random positions filled in at build time, sitting at the world
origin. The drops then spend the whole game being wrapped in *world space* to
follow the player, and the object's own transform deliberately never moves
(the rain is world-locked; a previous fix made it so). Nothing recomputes the
sphere.

Standing on the pavement at `(-6, -34)` you are **34.5 m outside** it, so the
cull test stops asking "can you see rain" and starts asking "can you see the
middle of the map".

Counted with `onBeforeRender`, which fires only for objects that survive the
cull (`scripts/w16-raindrawn.mjs`), at `rainLevel 0.99`:

| heading | frames drawn, before | after |
|---|---|---|
| 0 | **0** | 9 |
| 45 | **0** | 9 |
| 90 | 13 | 12 |
| 135 | 14 | 13 |
| 180 | 17 | 16 |
| 225 | 30 | 24 |
| 270 | **0** | 23 |
| 315 | **0** | 13 |

On the **built** pre-change bundle it was worse still: drawn on essentially no
heading at all.

This is the user's complaint, filed twice and quoted in the queue: *"how come i
face some directions and it's not raining and then i face a different direction
and it is raining?"* It was read as a contrast problem both times. The dark
sheath added for it is a genuine improvement and I have left it exactly as it
is — but it was never the cause.

Fix: `rain.frustumCulled = false`. The volume is recentred on the camera every
frame, so the correct cull answer is always "visible"; recomputing the sphere
each frame would also work and would cost an O(N) pass to reach the same
answer.

### 2. `rainLevel` had nothing but alpha to spend

500 drops in a 30x14x30 m box is 0.04 per m³ **at every intensity**, so "heavy"
could only ever mean "the same drizzle, louder". Changes:

- `RAIN_N` 500 → **2600** (0.21/m³; ~665 drops in frustum instead of ~130).
- `stormAt(h)` — a new per-storm strength in 0.62…1.0, an independent murmur3
  draw off the same hour, so storms are not all identical. Latched while it is
  actually raining so the count does not step sideways mid-fade.
- `heavy = rainLevel * stormNow` now drives **three** things: drop count via
  `setDrawRange` (the density axis), opacity (0.55 → 0.72 ceiling), and fall
  speed (13 → up to 22 m/s).
- `gl_PointSize` clamped to 46 px in the shader. Size attenuation has no
  ceiling, so a drop wrapping in near the eye drew as a ~200 px pale post that
  reads as a lamp post; the near field is a fixed fraction of the box, so 5x
  the drops is 5x the posts (~7 within 2 m at N=2600 against ~1.3 at N=500).
  Clamped in the shader rather than by moving drops, because every drop must
  keep wrapping by whole multiples of `RAIN_BOX` or it stops being world-locked.

The 2600-drop line does **not** contradict the note above it that says "tripling
it to 1500 made no visible difference". That note is true of the world it was
written in, where a drop was 0.22 units and sub-pixel wide — N was multiplying
nothing. Size 0.36 plus the sheath made each drop read, so N now multiplies
something. I left the original note in place and explained the change beneath it.

## My verdict on the after-images

`shots/w16-rain-final/` (four headings at peak) and
`shots/w16-opening-storm.png` (the built bundle, clock untouched).

It is a downpour now, and it is a downpour in **every** direction — which it
demonstrably was not. **On the sheath, which the item asked me to judge:** it
holds. Facing north the drops read against the pale grey sky (sheath biting),
against dark brick and wet asphalt (core biting), and against the bright tan
awning on the left. I found no heading where drops dissolve into the
background. I would not change it.

The only view that shows no rain is `W-across` in the shot sheet, and that is
the camera pressed flat against a shopfront at point-blank — correct, not a
defect. The eight-heading drawn check is the real directional evidence.

## Proof

| check | result |
|---|---|
| `w16-raindrawn.mjs` | **red before, green after**, on both dev and the built bundle |
| `w16-rainlock.mjs` | 16/16 drops world-locked, 16 actually wrapped |
| `npm run fp` before/after + `fpdiff` | textures **IDENTICAL**, structure **IDENTICAL**; 3 tint diffs (the documented casino chase) and 3 place diffs ≤6 cm (pigeons) |
| `bugsweep.mjs` on the built bundle | **zero STATION MISS**, no console/page issues |
| frame rate, software renderer | 13.6 fps dry vs 13.1 in a downpour — 3.7%, and the scene is fill-bound elsewhere |
| opening storm, clock untouched | rain at 14:04, ~44 s from spawn, drawn |
| `tsc --noEmit`, `vite build` | clean |

`w16-raindrawn.mjs` is the check that can fail: delete the `frustumCulled`
line and it goes red immediately, which is how I found the bug in the first
place.

## Found and NOT fixed — for the desk to queue

1. **`scripts/rain-check.mjs` has been measuring the wrong object.** It
   traverses for `o.type === 'Points'` and keeps the **last** match. There are
   three Points objects in the scene — the rain (2600, mapped), then a 77-point
   and a 13-point unmapped set — so it has been asserting "12/12 drops
   world-locked" about a 13-point object that never moves. Its tell is that
   every drop delta comes back exactly `0.000`, which the wrap it claims to be
   observing cannot produce. One-word fix: select the Points whose material has
   a `map`. `scripts/w16-rainlock.mjs` is a working replacement and additionally
   fails if no drop moved at all (so an inert run cannot pass).

2. **`scripts/rainlive.mjs` steps the clock with `h % 24`** and so tests a dry
   hour while believing it is testing a wet one. Same one-line class of fix.

3. **`bugsweep.mjs` STATION MISS is flaky on the dev server** — three runs gave
   `bank-far` + `thrift-wide`, then `tax-far`, then `tax-far`, always with the
   player still at the spawn `(198.6, -16.3)`. It is clean on the built bundle,
   and it is unrelated to rain (rain has no collider), but the misses are
   non-deterministic and someone will read one as a regression.

4. **The other two Points objects also have `frustumCulled = true` and sit at
   the origin.** I did not check whether either follows the player the way the
   rain does; if one does, it has this same bug. Not my item, not touched.
