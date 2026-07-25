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

- [ ] **Build the used car lot.** New file, `ct/lot.ts`, yours — the same
      relationship to `ct/street.ts` that `ct/civic.ts` and `ct/park.ts`
      already have. The user: *"turn hardware and cafe into a used car lot"*.

      You get this because you have capacity and it is self-contained. Builder
      D is clearing the ground: CAFE and HARDWARE come out of the EAST roster,
      leaving a **23.2 m frontage at the north end of the east side**. D
      reports the exact z-span through the desk — wait for it and use the real
      number rather than anything in this brief.

      A 1997 used car lot is one of the loudest things you can put on a
      street, and that is the point of it:
      · **asphalt, not grass** — cracked, patched, oil-stained, with faded
        painted bays
      · **chain-link fence** along the street line with a gate, and pennant
        bunting strung above it — the triangular plastic flags are the single
        most identifying thing about the whole typology
      · a **small office**: a portable cabin or a one-storey box with a big
        window, a desk visible inside, a hand-lettered sign
      · **stock in rows**, angled toward the street, with **windshield price
        cards** and soaped numbers on the glass
      · a pole sign, and banners — AS-IS, EZ CREDIT, NO MONEY DOWN
      · a single floodlight on a pole for after dark

      **Coordinate rather than duplicate:**
      · **cars belong to builder H** (`ct/cars.ts`). Do not build your own —
        H already exports the fleet and the parked-car machinery. Ask through
        the desk for what you need, and say if you want a variant (a car up on
        blocks, one with a hood open) rather than adding it yourself.
      · **it must read differently from the park.** E is building a 30 m park
        on the west side at the other end of the block. Two open lots on one
        street will invite comparison: the park is green, quiet and civic; the
        lot is asphalt, loud and commercial. Lean into that contrast.
      · benches or seats should use **`ctx.seat()`** — builder F has landed it
        with 29 seats already using it. Do not build a sit mechanic.
      · the lot must be **walk-into-able** and the 2 m sidewalk lane past it
        stays clear (`GOTCHAS.md` §9). Walk it before you close this.

- [ ] **Nothing queued — your whole queue landed** (`0e2e29f`, `1ce9cf5`,
      `3e2ea73`): [E] spots moved out of the entry point, and 301 furnished.
      Report to the desk. If you want work while you wait, walk the walk-up
      end to end — stoop, stairs, landings, 301, the hermit's floor — and
      write what is wrong to `notes/C-entrance-report.md` rather than fixing
      it. You own that building; a quality pass on it is a good use of time.


## Done

- [x] Hermit: clipped, too clean, grime (`bd3a241`)
- [x] Paper-thin walls — jambs at every interior opening (`bd3a241`)
- [x] 301 door leaf (`bd3a241`)
- [x] Ceiling lamps — period flush-mount, stepped glow (`28b521d`)
- [x] `[E]` spots registered from apartment.ts, not the entry point (`0e2e29f`)
- [x] Furnish 301 — somebody's room, not a hotel room (`1ce9cf5`)
- [x] Entrance bay: brick continuous, nameplate removed, stoop dressed
- [x] Steeper stairs at 31.5°, floor-picker re-derived, walked up and down
- [x] One continuous handrail with goosenecks at the turns
- [x] Basement stairwell opened under the stairs and padlocked
- [x] Wider doors — 0.90 m leaf
- [x] Door numbers texel-aligned, plate toned to brass
- [x] Hermit given the 8-angle `citizenAtlas` treatment
