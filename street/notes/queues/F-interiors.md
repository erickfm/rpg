# Queue — builder F  ·  worktree `../rpg-interiors`  ·  port 4185

**Owns:** `ct/interior.ts` (the shared kit), `ct/int-diner.ts`,
`ct/int-burger.ts`, `ct/int-thrift.ts` — and the interior-belt wiring in
`crosstown.ts`, which is otherwise desk-owned. Coordinate before touching
anything else in the entry point.
**Desk writes this file. Do not edit it.**

You are new. Read `START-HERE.md`, then `notes/GOTCHAS.md`, before your first
change.

## Context: the user asked for ten interiors at once

*"i want to build out the insides of the following: burger barn. diner.
library. tax service. pawn shop. bodega. thrift store. my room. the casino.
the hotel."*

They are split across four agents. You have three of them. Builder G has the
casino, hotel, pawn shop and tax service; builder E has the library; builder C
has room 301. The bodega interior already exists and is being left alone until
its door blocker lands.

Because four agents are building rooms in parallel, there is a **shared kit**:
`ct/interior.ts`. It hands out world-space addresses so two builders cannot
land in the same place, and it builds the room shell so ten rooms do not end
up looking like ten different games. **You own that kit.** If G or E needs
something from it, they ask you and you add it — they do not edit it.

## Now

- [ ] **Verify and finish the kit and the diner. THEY ARE UNVERIFIED.**

      Your worktree starts with uncommitted work already in it: `interior.ts`,
      `int-diner.ts`, and a small `crosstown.ts` change. The desk wrote them to
      unblock you and they **typecheck but have never been run** — the
      fingerprint harness was pointed at a stale server, so there is no
      evidence the diner loads at all, let alone that you can walk into it.
      Treat every line as suspect.

      What must be true before you commit:
      · the world still initialises (`node scripts/health.mjs`)
      · you can stand outside the diner on the west walk at z ≈ 9.6, press E,
        and end up inside it
      · you can press E at the door inside and come back out onto the street —
        and NOT get sucked straight back in (that bug has shipped once)
      · you cannot walk through any wall, and you can walk the lane between
        the counter stools and the booths without getting stuck
      · the floor is at the right height and you are not sunk into it

      Walk it. `GOTCHAS.md` §1 — a screenshot proves nothing here.

      Known-suspect specifics, in the order I would check them:
      1. `interiorGround` returns 0 for anything past x = 400 whether or not a
         room is there. Harmless now, wrong later.
      2. The front-wall hole-cutting loop assumes the door and window do not
         overlap and that both are inside the wall. Nothing checks either.
      3. The door leaf is a plane hung at a fixed angle. It may well clip the
         jamb.
      4. Interiors are excluded from the night sweep by `|x| > 100` in
         `props.ts`. Confirm the rooms actually keep their light after dark.

## Next

- [ ] **BURGER BARN interior.** Loudest building on the block, 16 m wide, west
      side. Red-and-beige inside as well as out (the user rejected red/yellow).
      Order counter with backlit menu boards, fryer station behind it, moulded
      fixed tables and swivel stools, tray stack, bin with a swing flap, tile
      to waist height then painted block above. A 1997 fast-food room is
      brighter and harder than the diner — more plastic, less chrome, no
      booths with dignity. That contrast with the diner is the point; do not
      let them converge.

- [ ] **THRIFT STORE interior.** 14 m wide, west side, north of BARBER.
      The opposite problem to the burger barn: it should feel like too much
      stuff in too little room. Rails of clothing packed tight, a wall of
      shoes, a shelf of chipped crockery, a glass case at the till with the
      good jewellery in it, handwritten card signs, fluorescent tubes where
      one is out. Density is the whole effect — a thrift store with clear
      floor space reads as a boutique.

## Standing rules for interiors

- **Furnish in LOCAL coordinates** via `room.put` / `room.solid`. Never write a
  world x. That is what keeps rooms relocatable and builders out of each
  other's space.
- **Never edit `crosstown.ts`** to add a room. The kit registers the way in and
  the way out for you. If you find yourself needing to, the kit is missing
  something — fix the kit.
- **Match the house style**: ~8 px/m, muted 1997 palette, unlit
  `MeshBasicMaterial`, no dither on any face thinner than ~0.3 m.
- **Every room must be walkable end to end.** The player capsule is 0.36 m in
  radius. Leave a clear lane through the furniture and walk it before you
  close an item.
- **Two failures then delete** — if a detail has been redrawn twice and still
  misses, take it out and say so in your handoff.

## Done

_(nothing yet — you are new)_
