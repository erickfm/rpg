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

- [ ] **Nothing queued — your whole queue landed** (`0e2e29f`, `1ce9cf5`,
      `3e2ea73`): [E] spots moved out of the entry point, and 301 furnished.
      Report to the desk. If you want work while you wait, walk the walk-up
      end to end — stoop, stairs, landings, 301, the hermit's floor — and
      write what is wrong to `notes/C-entrance-report.md` rather than fixing
      it. You own that building; a quality pass on it is a good use of time.


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

- [ ] **Furnish room 301 — "my room".** From the user's interiors list:
      *"i want to build out the insides of the following: … my room …"*

      You get this one because you own `ct/apartment.ts` and room 301 is
      already in it — it is the one interior on the list that is NOT built on
      the shared kit (`ct/interior.ts`, builder F's), because it is inside a
      building you can already walk up into rather than a room you teleport to.
      **Read the kit anyway** before you start, and read `ct/int-diner.ts`,
      which is the reference interior. Match their conventions — wall
      thickness, jamb reveals, ceiling height, light — so 301 does not read as
      the one room built by somebody else.

      It should be a specific person's room, not a hotel room: an unmade bed,
      a mattress on a frame that does not match it, a dresser with the drawer
      that never shuts, a portable TV on a milk crate, a radiator under the
      window, a poster, a full ashtray, clothes on a chair. The window looks
      out at the street you just walked in off — make sure it does, and that
      what you see through it agrees with where the building stands.

      You can already sleep here, so whatever you add must not block the bed
      interaction or trap the player between furniture and a wall. Walk it.

## Done

- [x] Entrance bay: brick continuous, nameplate removed, stoop dressed
- [x] Steeper stairs at 31.5°, floor-picker re-derived, walked up and down
- [x] One continuous handrail with goosenecks at the turns
- [x] Basement stairwell opened under the stairs and padlocked
- [x] Wider doors — 0.90 m leaf
- [x] Door numbers texel-aligned, plate toned to brass
- [x] Hermit given the 8-angle `citizenAtlas` treatment
