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
