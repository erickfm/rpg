# Queue — builder C  ·  worktree `../rpg-entrance`  ·  port 4180

**Owns:** `ct/apartment.ts`, `resGroundTex` in `ct/tex-world.ts`
**Desk writes this file. Do not edit it.**

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

Rebasing per item is not optional. Builders drifted 85–91 commits behind
mainline before landing today, and every hand-resolved conflict came from that
staleness. Rebasing at the start of an item is nearly free; rebasing after an
hour of work is where the conflicts live.

## Now

- [ ] **Hermit: clipped and too clean.** He stands IN the doorway, and his
      billboard rotates to face you, so it sweeps through the flat black door
      plane and slices him. Pull him 0.3–0.4 m forward into the hall, and give
      the doorway real depth instead of a flat black rectangle. BONUS: this also
      fixes "neighbour is still flat" — in a doorway only one atlas column is
      ever visible, so the 8 angles never show. Then make him grimy: stained
      yellowed undershirt, grease marks, unshaven, messy hair. Lived-in, not
      grotesque. Ref: `shots/user-hermit2.png`

## Next

- [ ] **Paper-thin walls.** Interior walls are single planes, so every opening
      is a hole cut in paper with zero visible depth. Give walls real thickness
      (~0.12–0.15 m) or at least a jamb — head + two side reveals — at EVERY
      interior opening, not just 301. This is the biggest single thing making
      the interior read as a set rather than a building.
      Ref: `shots/user-paperwalls.png`
- [ ] **301 has no door.** Add a real leaf, standing open against the inside
      wall, with visible edge thickness, handle, hinges, and casing round the
      opening. Check the new jamb does not narrow the opening below 0.90 m.
- [ ] **Ceiling lamps.** No fixture at all — a bare glow decal, and a smooth
      radial gradient in a world of hard-edged texels. Model a period
      flush-mount; replace the gradient with a stepped/dithered glow.
      Ref: `shots/user-ceilinglamp.png`

- [ ] **Move your `[E]` spots out of `crosstown.ts` and into your own module.**
      The entry point no longer enumerates interactions — `CtxBuild` now has
      `ctx.spot({...})` and `ctx.player` (`x()`, `z()`, `gy()`, `jumpTo()`).
      Register the spots belonging to ct/apartment.ts from inside it and delete them
      from the `SPOTS.push(...)` block in `crosstown.ts`. This is the last thing
      forcing you to edit the entry point. Verify by actually walking to each
      door and pressing E — `scripts/doortest.mjs` is a starting point.

## Done

- [x] Entrance bay: brick continuous, nameplate removed, stoop dressed
- [x] Steeper stairs at 31.5°, floor-picker re-derived, walked up and down
- [x] One continuous handrail with goosenecks at the turns
- [x] Basement stairwell opened under the stairs and padlocked
- [x] Wider doors — 0.90 m leaf
- [x] Door numbers texel-aligned, plate toned to brass
- [x] Hermit given the 8-angle `citizenAtlas` treatment
