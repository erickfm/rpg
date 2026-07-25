# Queue — builder D  ·  worktree `../rpg-alley`  ·  port 4181

**Owns:** `ct/street.ts`, `ct/cat.ts` placement
**Desk writes this file. Do not edit it.**

For EACH item: **rebase on `add-stick-and-city98` FIRST**, then do the work,
then commit, then re-read this file before starting the next.

Rebasing per item is not optional. Builders drifted 85–91 commits behind
mainline before landing today, and every hand-resolved conflict came from that
staleness. Rebasing at the start of an item is nearly free; rebasing after an
hour of work is where the conflicts live.

> **This file is the monolith now.** Ten items queued here at one point while a
> functional blocker sat third in line. `ct/street.ts` should be split
> (buildings / alley / corner) so more than one builder can work the block.

## Now

- [ ] **BLOCKER: you cannot enter the bodega.** The chamfer colliders run across
      the doorway so the `[E]` trigger is unreachable. Put a gap in the collider
      at the door. Walk up and actually press E — do not close this from a
      screenshot. Report the door's world coords in your handoff; the `[E]` spot
      lives in `crosstown.ts` which you must not edit.
      Ref: `shots/user-bodega3.png`

## Next

- [ ] **Bodega door is not readable as a door.** Every panel in the chamfer bay
      is identical blue glass, and the OPEN neon sits over a WINDOW. Give the
      door its own frame, handle, kick plate, set the plane back slightly, and
      move OPEN over it.
- [ ] **Crates are empty.** They read as open boxes with a painted stripe. A
      produce crate outside a bodega is FULL — fruit heaped above the rim, so
      you see produce first and crate second. Shadow between the slats. Sit them
      flat.
- [ ] **Church tower.** Remove the campanile entirely; keep the stone, gable,
      rose window, lancets, arched entrance. Close the roofline cleanly, no
      orphaned collider, and put a modest cross on the gable peak.
      Ref: `shots/user-church.png`
- [ ] **Signs — three separate bugs.** (a) GOLDEN ACES marquee is rotated 180°
      IN PLANE (upside-down AND mirrored) — not a back-face issue. (b) HOTEL
      blade is the plain back-face case. (c) Neither is structurally supported:
      give the marquee a visible steel frame on the parapet, square to the
      street; give the blade wall brackets. Then audit every other sign.
      Ref: `shots/user-signs.png`
- [ ] **Shop resizing.** Shops get a 4.2 m ground floor (residential stays
      3.2 m — the user says the walk-up is correct). Glazing 1.92 m → ~2.7 m,
      add a ~0.35 m stallriser, sign band ~0.9 m, texture 40 → 52 texels.
      Ref: `shots/user-shopscale.png`
- [ ] **Window lights.** Lit windows are baked into `facadeTex`, so the same
      windows are lit at 4am as at 8pm. Paint facades dark; add an additive
      overlay of lit windows on the night curve; cross-fade a few variants
      slowly. Sensible: almost none at 4am, peak 8–10pm, a few all night.
      `facadeTex` is handed to you for this. Ref: `shots/user-windowlights.png`
- [ ] **Corporation** — the last unplaced roster entry. Blander and more modern
      than its neighbours; the contrast against the library is the point.

- [ ] **Move your `[E]` spots out of `crosstown.ts` and into your own module.**
      The entry point no longer enumerates interactions — `CtxBuild` now has
      `ctx.spot({...})` and `ctx.player` (`x()`, `z()`, `gy()`, `jumpTo()`).
      Register the spots belonging to ct/street.ts and ct/bodega.ts from inside it and delete them
      from the `SPOTS.push(...)` block in `crosstown.ts`. This is the last thing
      forcing you to edit the entry point. Verify by actually walking to each
      door and pressing E — `scripts/doortest.mjs` is a starting point.

## Done

- [x] Block re-cast: library, church, casino + hotel out at the side-street end
- [x] **Library** — stone, PVBLIC LIBRARY engraved, arched windows, recessed
      entrance with steps. User approved.
- [x] BURGER BARN (old PAWN slot), pawnshop (old CINEMA), tax service (old ARCADE)
- [x] BURGER BARN palette → red and beige
- [x] Bodega chamfered corner bay, full height, door in the cut face
- [x] Sky gap at the chamfer closed (the corner triangle)
- [x] Alley side walls differ from each other and carry brick
- [x] Plywood sheet and trash bags removed
- [x] Slatted produce crates (still need filling)
- [x] Six-cat comparison rig → black cat shipped
