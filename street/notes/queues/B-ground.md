# Queue — builder B  ·  worktree `../rpg-ground`  ·  port 4178

**Owns:** `ct/props.ts`, `ct/tex-ground.ts`
**Desk writes this file. Do not edit it.**

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

> **Desk apology, 2026-07-24.** This file was stale for hours: it still listed
> the lighting tint, the van, the bus bench and the parking variance as
> pending when all four had already landed on mainline, and it opened with a
> "get green" blocker that no longer existed. You reported that; you were
> right. The desk was routing new work into a file it had stopped maintaining,
> and told the user you were blocked when you were not. Rebuilt below from
> what is actually on mainline.

## Now

- [ ] **Rain must wet the BUILDINGS, not just the ground.** The user:
      *"building should also get affected by the rain"*.

      Today `wetMats` only holds horizontal surfaces — the roads and the walks,
      registered through `ctx.wet()`. Every facade on the block stays bone dry
      through a storm, which is most of what you can see, so the rain reads as
      something happening to the floor rather than to the world.

      **Do it without editing anybody else's file.** `props.ts` already has the
      pattern: `dimWorld(scene)` traverses the whole scene after everything is
      built and registers what nothing else claimed. Write the rain equivalent
      and you need no cooperation from D, E or A — which matters, because all
      three are live in their files right now.

      A wet wall is not just a darker wall. What actually reads:
      · darkening that is STRONGEST AT THE BASE — splash-back off the sidewalk
        soaks the bottom half-metre or so and fades upward
      · streaks running down from sills, copings and anything that sheds
      · the wall going slightly cooler and more saturated, not just dimmer
      · it should dry from the top down, on the same `wetness` state you
        already built, so it outlasts the rain like the ground does

      Watch the interaction with the night pass: `dimWorld` and your rain
      registry must not both own the same material, the same way `updateRain`
      and `dimWorld` already negotiate that today. Do not let a wet wall at
      night go to black.

- [ ] **Fix the puddle contrast inversion — the desk approves your
      recommendation.** Your diagnosis (`bc20c70`) is the best piece of
      debugging on this project so far: the puddles are present, filled,
      correctly placed and drawn, and invisible because `updateRain` crushes
      the road toward slate at 0.95 while the puddle is a FIXED dark sheet
      that cannot go darker. The sign inverts and you get a pale smear — a
      quiet version of the glowing puddle that was already rejected once.

      Do what you proposed:
      · a real **ambient-scaled reflection** rather than a fixed dark sheet.
        Standing water reads by reflecting, which is exactly what the sheet
        lacks, and a reflection scales with the light so it cannot invert.
      · **put water where the player actually looks.** Every street puddle
        currently sits in the 45 cm gutter strip. Nobody walks there. Low
        spots on the sidewalk, the dip by the catch basin, under the awning
        drip line, the alley.
      · **hold off easing the wet tint**, as you recommended — the user just
        approved the night pass and that trades directly against it. Correct
        call; do not touch it.

      One more thing you raised: rain is 6 of 24 hours and the first is 100 s
      from spawn. The user has asked about rain and puddles four times and has
      probably never stood in a storm. Raise the odds and bring the first one
      much closer to spawn. This is a feature nobody can see.

- [ ] **The user still cannot see puddles while it is raining.** *"still no
      puddles during rain?"* — asked AFTER your `8a50f97` landed, so treat the
      buried-decal fix as necessary but not sufficient.

      You measured 11 of 14 showing during a storm in your own worktree. The
      user is playing the LIVE integration world on port 5177, which is
      mainline plus every builder's in-flight work — so verify there, not in
      your worktree. There is now a build stamp in-frame (`acbda51`), so you
      can confirm which build is actually being served rather than assuming.

      Then work outward from the most likely causes, in this order:
      1. **Is it raining at all when they look?** `rainAt(h)` is a hash gate
         that is true for about 22% of hours. If a player walks around for two
         minutes at a dry hour they see no rain and no puddles, and nothing is
         broken. If that is what is happening, say so — and consider whether
         22% is too rare to ever demonstrate a feature the user has asked
         about three times.
      2. **How long until a puddle is visible?** `puddleLevel` lerps at
         `dt * 0.22` and only shows above 0.03. Work out the wall-clock time
         from first drop to a visible puddle. If it is tens of seconds, the
         user has almost certainly stopped watching before one appears.
      3. **Where are they?** Puddles are in the gutter and under awnings. If
         you are standing on the sidewalk looking down the street you may
         simply not have any in frame.
      4. Only then look for a remaining rendering fault.

      Report what it actually is before changing anything — this has been
      "fixed" once already and came back.

- [ ] **Nothing queued.** Your two live items — the night pass and the wetness
      that outlasts the rain — both landed. Report to the desk and take a
      look at the world with fresh eyes: you own every surface the player
      walks on and every prop standing on it, so a quality pass on your own
      area is a legitimate use of your time. Write what you find to
      `notes/B-ground-report.md` rather than fixing it all at once, and the
      desk will prioritise.

      Two things worth looking at first, both from the user's own words:
      · the payphone and a street tree stand directly in front of the library
        doors. Builder E is recessing the library into a courtyard, which will
        strand both in the middle of it. E cannot move them — `ct/props.ts` is
        yours. Work out where they should go and coordinate through the desk.
      · *"trash looks too clean? and also under the gutter somehow"* — the
        litter never got a second pass.

## Next

- [ ] **Move your `[E]` spots out of `crosstown.ts` and into your own module.**
      `CtxBuild` has `ctx.spot({...})` and `ctx.player` (`x()`, `z()`, `gy()`,
      `jumpTo()`). Register the spots belonging to `ct/props.ts` from inside it
      and delete them from the `SPOTS.push(...)` block in `crosstown.ts`.
      Builders C and H have both done this already — copy what they did.
      Verify by walking to each spot and pressing E.

## Done

- [x] **Night: the road was never being darkened at all** (`895a056`)
- [x] **Wetness outlasts the rain, and the puddles crest after it** (`53f3a6f`)
- [x] Lamplight warms the surface instead of repainting it — cars no longer
      go brown under the lamps (`08af52b`)
- [x] The van in front of THRIFT is cut, collider with it (`17c2fda`)
- [x] Bus bench rebuilt — the ad panel IS the backrest (`ec94ed4`)
- [x] Parking drawn from a distribution, so near-perfect is a legitimate
      outcome rather than something the arrangement excludes (`f0f4792`)
- [x] Kerb, gutter pan, corner return, catch basin — user: *"really enjoying
      the look of the curb and gutters"*, *"this corner looks so good"*
- [x] Thin-face texture rules (no fine detail on a 1–2 texel face)
- [x] Red kerb by rule — hydrants and corners, both sides
- [x] Citizen collider ±0.30 → ±0.25
- [x] `walkTex` split into `ct/tex-ground.ts`, signature takes world extents
