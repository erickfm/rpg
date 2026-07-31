# H — the four questions that outlived BLOCKED-H.md

`BLOCKED-H.md` is deleted, as the wheel ruling instructed. **Item 1 was the
wheel and it is settled and shipped.** The other four were not about the wheel
and would have vanished with the file, so they are carried here. None is
waiting on work; each is waiting on a decision or sits in someone else's file.

## 1. The fleet never gets wet — not mine to fix

Measured, not noticed: one parked sedan's 33 materials have a mean luminance of
**0.5355 at dry hour 12 and 0.5355 at rainy hour 14** — identical to four
decimal places. The road, the kerbs and the ground all darken in rain; the cars
do not, so in a downpour the fleet reads as lit from a different world.

The wet pass lives in the ground/props layer, not in `ct/cars.ts`, so the fix
belongs to whoever owns it. **What I need is only a routing decision.**

## 2. `noLight` is honoured on one registration path and ignored on the other

`props.lit(root)` = `register(root, true)` respects `userData.noLight`. The
scene-wide sweep at `props.ts:405` does not. So the same mesh is lit or not
depending on which path registered it, which is invisible until something is
deliberately marked unlit and then lit anyway.

`ct/props.ts` is not my file. Found by failing to break my own check.

## 3. Traffic density — `maxActive = 1`

`ct/traffic.ts:239` puts **one vehicle on the block at a time**. That is a
deliberate choice rather than an oversight, and the user has never commented on
it — so I have not touched it. Worth a decision now that the corner works and
vehicles turn it: one car on a two-street block reads as empty.

## 4. `ctx.obstacle` records no owner — desk architecture

Colliders come back from `ctx.colliders()` as bare `{minX, maxX, minZ, maxZ}`.
Meshes carry `userData.mod`; colliders do not. So when a collider eats an `[E]`
trigger (GOTCHAS 8, which has now happened to the bodega crate and the diner
blanket wall), there is no way to ask WHICH MODULE put it there — you can only
find it by bisecting the world. Stamping the owner at registration is a small
change in the desk's own layer and it makes that class of bug self-reporting.

---

Also still open and asked twice, from `H-per-side-pass.md`:

- **The masonry rounding rule.** Does A's helper round to whole texels per metre
  and accept a fractional canvas, or fix the canvas and accept a fractional
  density? The fleet has panels from 0.34 m to 4.6 m, so that rule decides
  whether a hubcap and a van flank can share a density at all. The vehicle
  texel-density pass is blocked on it.
- **The wheel-arch well colour.** The arch and the sill are seven levels apart
  (90,84,58 against 83,78,52) and merge into one dark mass — the "large soft
  DARK BLOTCH". Separating them means darkening the well to about x0.18, and
  the instruction was "the wells and the arch paint you already fixed are good
  — do not disturb them". One line, needs a yes.
