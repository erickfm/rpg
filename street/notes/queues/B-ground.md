# Queue — builder B  ·  worktree `../rpg-ground`  ·  port 4178

**Owns:** `crosstown.ts`, `ct/props.ts`, `ct/cars.ts`, `ct/tex-ground.ts`,
`ct/citizens.ts`
**Desk writes this file. Do not edit it.**

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

Rebasing per item is not optional. Builders drifted 85–91 commits behind
mainline before landing today, and every hand-resolved conflict came from that
staleness. Rebasing at the start of an item is nearly free; rebasing after an
hour of work is where the conflicts live.

## Now

- [ ] **Get green.** Conflicting on `ct/citizens.ts`, which another builder
      rewrote and which is now merged. Do NOT merge yours —
      `git checkout add-stick-and-city98 -- street/src/proto/ct/citizens.ts`,
      then rebase and commit. Nothing you have built is visible to the user
      until this lands; the integrator drops broken worktrees.

## Next

- [ ] **Lighting tint is wrong — cars go brown under lamps.** Do not lerp
      toward amber; that replaces the colour. Multiply the base by a warm
      factor, cap around 0.25. Exclude glass, tyres and anything near-black.
      Refs: `shots/user-carlight.png`, `shots/user-cartrunk.png`
- [ ] **Night is flat.** The full-screen `nightDiv` overlay reduces contrast
      rather than creating darkness, so the gaps between lamps are as bright as
      the pools under them. Pull the flat wash down and darken world materials
      instead (the way `wetMats` does for rain), so lamp pools have something to
      contrast against. Consider fog fading toward near-black at night for depth
      falloff. Ref: `shots/user-nightflat.png`
- [ ] **Wetness must OUTLAST the rain, and the rain must leave puddles.**
      The user: *"make wetness last a lil after it stops raining"* and *"also
      make rain cause some puddles"*.

      Both live in `updateRain` in `ct/props.ts`, which you own. What is wrong
      today: `wetMats` is driven straight off `rainLevel`, so the street is
      bone dry the instant the last drop lands — the ground has no memory. And
      `puddleLevel` chases `rainLevel` too, so puddles never OUTLIVE the storm
      either; they just lag it by a few seconds.

      Give the ground its own state. A `wetness` that rises fast while it is
      raining and falls SLOWLY when it is not — minutes of game time, not
      seconds, and slower still at night and after a long soak. Drive
      `wetMats` and the puddle opacity from `wetness`, not from `rainLevel`.
      The order you want to see walking out after a storm: rain stops → the
      street is still dark and reflective → puddles are at their fullest a
      little AFTER the rain ends, because water is still finding the low
      spots → then it dries from the middle of the road outward, with the
      gutter and the puddles last.

      Puddles: there is already a `puddleT`/`puddleM` set. They are too shy —
      one shared material at 0.72 opacity means they all fade in lockstep and
      none of them read. Give them individual fill so some pool early and
      deep and others barely wet; put them where water actually goes (the
      gutter pan, the catch basin, low spots, under the drip line of awnings).
      They are ground decals, NOT billboards — `GOTCHAS.md` §3. And they must
      be DARKER than the surface at night, never lighter; a glowing puddle was
      already shipped once and rejected.

      Draw any new `rnd()` calls at the END of the module's build (§2) or you
      will move every tree and pigeon in the world.

- [ ] **Remove the van** parked at THRIFT — 4th entry in `parked`, z = -78.
      Check its collider comes out of `carColliders`/`citAvoid` cleanly.
      Ref: `shots/user-killcar.png`
- [ ] **Bus bench geometry.** The ad panel must BE the backrest, not a separate
      billboard behind a slab. Seat horizontal ~0.45 m, back to ~0.85 m, slats,
      legs, flush and parallel to the kerb. The stop sign sits near 3 m; real
      ones are 2.2–2.5 m. Keep TONY'S PIZZA — the ad concept is approved.
      Ref: `shots/user-benchbad.png`
- [ ] **Parking should VARY, including perfect.** Not four hand-tuned offsets —
      draw from a distribution off the seeded `rnd()` so some land near-perfect,
      one or two are off, and occasionally one is badly crooked.
- [ ] ~~Citizen variety~~ — **DONE BY ANOTHER BUILDER, do not redo.** Landed on
      mainline: build/skin/hair/garment/pace with stride tied to speed. Take
      mainline's `ct/citizens.ts` wholesale if yours conflicts.

- [ ] **Move your `[E]` spots out of `crosstown.ts` and into your own module.**
      The entry point no longer enumerates interactions — `CtxBuild` now has
      `ctx.spot({...})` and `ctx.player` (`x()`, `z()`, `gy()`, `jumpTo()`).
      Register the spots belonging to ct/props.ts and ct/cars.ts from inside it and delete them
      from the `SPOTS.push(...)` block in `crosstown.ts`. This is the last thing
      forcing you to edit the entry point. Verify by actually walking to each
      door and pressing E — `scripts/doortest.mjs` is a starting point.

## Done

- [x] Kerb, gutter pan, corner return, catch basin — user: *"really enjoying the
      look of the curb and gutters"*, *"this corner looks so good"*
- [x] Thin-face texture rules (no fine detail on a 1–2 texel face)
- [x] Red kerb by rule — hydrants and corners, both sides, painted flat on the face
- [x] Citizen collider ±0.30 → ±0.25
- [x] `walkTex` split into `ct/tex-ground.ts`, signature changed to world extents
