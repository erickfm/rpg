# A shared door capability — what 301's door cost, for whoever writes `ctx.door()`

Builder C. My queue asked for this and I had not written it:

> *"A shared door capability probably belongs in the kit the way `ctx.seat()`
> and `ctx.spot()` do — every interior has doors and builder G's four rooms
> will want the same thing. Say so in your handoff and the desk will queue it
> to F rather than having four builders each write a door."*

Saying so. 301's door works and is guarded by `scripts/door301.mjs` (seven
behaviours, selftest fires). It is also the only closable door in the project,
so this is the whole of the experience — offered as **what a shared version has
to handle**, not as code to lift.

## The proposed shape

```ts
ctx.door({
  hinge:  { x, z },       // the pivot, in world
  leaf:   { w, thick },   // 0.91 x 0.045 in 301
  open:   number,         // yaw when open
  shut:   number,         // yaw when shut
  gap:    { z0, z1 },     // the doorway the collider must fill when shut
  label:  (shut) => shut ? 'open the door' : 'close the door',
})
```

Everything below is a thing that broke while building it once.

## 1. The swept volume — a door must not close ON you

The hard part, and the one a caller will not think of. Standing anywhere inside
the arc, `[E]` must refuse and SAY it refuses. 301 tests an annular sector:
within `leafW + 0.36` of the hinge AND between the two poses in bearing. The
prompt becomes *"step clear of the door"* rather than going silent, because a
prompt that vanishes reads as a broken interaction.

Getting the test point right took two tries: my first version stood 1.45 m from
the spot, `[E]` did not reach at all, and *"the door refused to close"* was
really *"there was no interaction there"*. A shared version should expose the
predicate so a check can ask it directly.

## 2. The collider has to follow the leaf, and only at the end

301 raises a doorway-filling cap only when `doorA > SHUT - 0.10`. A collider
that tracks the leaf continuously will shove the player as it swings; one that
never appears means a shut door you walk through. The cap is the thing
`door301.mjs` asserts, because *"is it actually closed"* is a collider question
and no screenshot of a door can answer it.

## 3. Two clearances that are not obvious

- **The pivot offset.** At `DOOR_Z0 + 0.04` the leaf tip landed exactly flush
  with the far jamb — `leaf + 0.04 = DOOR_GAP` — and clipped. 0.02 works. A
  shared version should derive this from `gap` and `leaf.w` rather than let
  each caller find it.
- **The leaf's distance off the wall face.** At `AZI(0.008)` the leaf was
  buried in the lobby wall, whose inner face is at `AZI(0.07)`. It sits at
  `AZI(0.09)`.

## 4. Handedness — state it in the signature

I hit this twice in one week in a different file: `ctx.seat`'s yaw uses camera
convention `(sin ψ, -cos ψ)` while three.js `rotation.y` sends local -z to
`(-sin θ, -cos θ)`. Same number, opposite x. A door API takes an `open` and a
`shut` angle and a hinge side, and if it does not say which convention those
are in, half the callers will hang their door backwards and it will look almost
right. **Take two poses, not an angle and a direction.**

## 5. For whoever CHECKS it: wait for the leaf, not for a duration

The swing is driven by the render loop, so its duration is frames. `door301`
originally slept 950 ms and failed 4 runs in 6 under concurrent load on a door
that works perfectly. It now polls the leaf's pose until it stops — and waits
for the motion to START before waiting for it to STOP, or the test is satisfied
instantly by a door standing still. GOTCHAS 30.

## What I am NOT proposing

That 301 be migrated the day this lands. The room is guarded and working; a
shared `ctx.door()` proving itself on G's four rooms first is a better order,
and 301 can follow once the API has met a door it did not grow up with.
