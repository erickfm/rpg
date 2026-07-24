# Queue — builder B  ·  worktree `../rpg-ground`  ·  port 4178

**Owns:** `crosstown.ts`, `ct/props.ts`, `ct/cars.ts`, `ct/tex-ground.ts`,
`ct/citizens.ts`
**Desk writes this file. Do not edit it.** Take the top unchecked item under
`## Now`, do it, commit, then re-read this file before starting the next.

## Now

- [ ] **Get green.** 3 commits behind mainline and conflicting on
      `ct/citizens.ts`. Rebase on `add-stick-and-city98`; keep BOTH the desk's
      profile-feet fix (`view === 2` gets longer, nearly-overlapping shoes) and
      your variety work. Nothing you have built is visible to the user until
      this lands — the integrator drops broken worktrees from the live world.

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
- [ ] **Citizen variety.** Height/build ±8–10% with independent width. Wider
      speed range, and STRIDE MUST SCALE WITH SPEED — the walk cycle currently
      advances on a fixed phase, so fast and slow walkers take the same size
      steps, which reads wrong. Varied skin tones with hair matched sensibly;
      hair shape variety; gender through build/hair/clothing rather than the
      single `dress` fit. Target: no two people on screen look like the same
      person recoloured.

## Done

- [x] Kerb, gutter pan, corner return, catch basin — user: *"really enjoying the
      look of the curb and gutters"*, *"this corner looks so good"*
- [x] Thin-face texture rules (no fine detail on a 1–2 texel face)
- [x] Red kerb by rule — hydrants and corners, both sides, painted flat on the face
- [x] Citizen collider ±0.30 → ±0.25
- [x] `walkTex` split into `ct/tex-ground.ts`, signature changed to world extents
